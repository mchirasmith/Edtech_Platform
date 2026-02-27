# SPEC-06 — Video & Audio Player + Progress Tracking

| Field | Value |
|-------|-------|
| **Module** | Student Lesson Player — Video, Audio, Progress, Resume |
| **Phase** | Phase 1 |
| **Week** | Week 3 (Days 6–7) |
| **PRD Refs** | MEDIA-02, MEDIA-03, MEDIA-04, MEDIA-05 |
| **Depends On** | SPEC-05 (ImageKit Media), SPEC-03 (DB Schema) |

---

## 1. Overview

This spec covers the student-facing media consumption experience: the `LessonPlayer` React component that handles both HLS video and audio streams from signed ImageKit URLs, the 30-second progress reporting mechanism, lesson completion at 90% watch threshold, and playback resume from the last saved position.

---

## 2. Installation

```bash
npm install react-player hls.js
```

> `react-player` handles HLS natively via `hls.js` — no extra configuration needed. ImageKit auto-generates `.m3u8` playlists from uploaded `.mp4` files.

---

## 3. Backend — Progress Tracking Endpoints

### `backend/app/routers/progress.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.progress import LessonProgress
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/progress", tags=["progress"])

class ProgressUpdate(BaseModel):
    lesson_id: int
    watch_percent: int           # 0–100
    last_position_sec: int       # Current playback position in seconds

@router.post("/update")
def update_progress(
    payload: ProgressUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Called by the video player every 30 seconds with the current watch percentage."""
    # Verify enrollment
    lesson = db.query(Lesson).filter(Lesson.id == payload.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404)

    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.course_id == lesson.course_id,
    ).first()
    if not enrollment and current_user["role"] == "student":
        raise HTTPException(status_code=403, detail="Not enrolled")

    progress = db.query(LessonProgress).filter(
        LessonProgress.student_clerk_id == current_user["clerk_id"],
        LessonProgress.lesson_id == payload.lesson_id,
    ).first()

    if not progress:
        progress = LessonProgress(
            student_clerk_id=current_user["clerk_id"],
            lesson_id=payload.lesson_id,
        )
        db.add(progress)

    progress.watch_percent = max(progress.watch_percent, payload.watch_percent)
    progress.last_position_sec = payload.last_position_sec
    progress.completed = progress.watch_percent >= 90    # Mark complete at 90%

    db.commit()
    return {"watch_percent": progress.watch_percent, "completed": progress.completed}

@router.get("/lesson/{lesson_id}")
def get_lesson_progress(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Returns the student's current progress for a lesson (for resume playback)."""
    progress = db.query(LessonProgress).filter(
        LessonProgress.student_clerk_id == current_user["clerk_id"],
        LessonProgress.lesson_id == lesson_id,
    ).first()
    if not progress:
        return {"watch_percent": 0, "last_position_sec": 0, "completed": False}
    return {
        "watch_percent": progress.watch_percent,
        "last_position_sec": progress.last_position_sec,
        "completed": progress.completed,
    }
```

---

## 4. Frontend — Lesson Player Component

### `frontend/src/components/LessonPlayer.jsx`

```jsx
import { useEffect, useRef, useState, useCallback } from "react";
import ReactPlayer from "react-player";
import { useFetch } from "../hooks/useFetch";

export function LessonPlayer({ lessonId, onComplete }) {
  const { authFetch } = useFetch();
  const playerRef = useRef(null);

  const [streamUrl, setStreamUrl] = useState(null);
  const [mediaType, setMediaType] = useState("video");
  const [startPosition, setStartPosition] = useState(0);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);

  // Fetch signed stream URL + last resume position
  useEffect(() => {
    Promise.all([
      authFetch(`/media/lessons/${lessonId}/stream-url`),
      authFetch(`/progress/lesson/${lessonId}`),
    ]).then(([stream, progress]) => {
      setStreamUrl(stream.url);
      setMediaType(stream.media_type);
      setStartPosition(progress.last_position_sec);
    });
  }, [lessonId]);

  // Seek to resume position once player is ready
  const handleReady = useCallback(() => {
    if (!ready && startPosition > 0) {
      playerRef.current?.seekTo(startPosition, "seconds");
    }
    setReady(true);
  }, [ready, startPosition]);

  // Report progress every 30 seconds
  useEffect(() => {
    if (!streamUrl) return;
    const interval = setInterval(() => {
      const currentSec = playerRef.current?.getCurrentTime() ?? 0;
      const percent = duration > 0 ? Math.round((currentSec / duration) * 100) : 0;
      authFetch("/progress/update", {
        method: "POST",
        body: JSON.stringify({
          lesson_id: lessonId,
          watch_percent: percent,
          last_position_sec: Math.round(currentSec),
        }),
      }).then((res) => {
        if (res.completed) onComplete?.();
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [streamUrl, duration, lessonId]);

  if (!streamUrl) return <div className="animate-pulse bg-gray-200 rounded-xl h-64" />;

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      <ReactPlayer
        ref={playerRef}
        url={streamUrl}
        controls
        width="100%"
        height={mediaType === "audio" ? "60px" : "auto"}
        style={{ aspectRatio: mediaType === "video" ? "16/9" : "unset" }}
        config={{
          file: {
            forceHLS: mediaType === "video",
            hlsOptions: { enableWorker: true },
          },
        }}
        onReady={handleReady}
        onDuration={setDuration}
        playbackRate={1}
      />
    </div>
  );
}
```

---

## 5. Lesson Page Layout — `frontend/src/pages/LessonPage.jsx`

```jsx
import { useParams } from "react-router-dom";
import { LessonPlayer } from "../components/LessonPlayer";
import { BookmarkPanel } from "../components/BookmarkPanel";
import { useFetch } from "../hooks/useFetch";
import { useEffect, useState } from "react";

export default function LessonPage() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const { authFetch } = useFetch();

  useEffect(() => {
    // lesson details fetched from /courses/{cid}/lessons
    authFetch(`/progress/lesson/${lessonId}`);
  }, [lessonId]);

  return (
    <div className="max-w-5xl mx-auto p-6 grid grid-cols-3 gap-6">
      {/* Main player — takes 2/3 width */}
      <div className="col-span-2">
        <LessonPlayer
          lessonId={Number(lessonId)}
          onComplete={() => console.log("Lesson completed!")}
        />
        <h1 className="mt-4 text-xl font-bold">{lesson?.title}</h1>
      </div>

      {/* Bookmark panel — takes 1/3 width */}
      <div className="col-span-1">
        <BookmarkPanel lessonId={Number(lessonId)} />
      </div>
    </div>
  );
}
```

---

## 6. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/progress/update` | JWT | Updates watch_percent + last_position_sec |
| `GET` | `/progress/lesson/{id}` | JWT | Returns current progress for resume |

---

## 7. Adaptive Bitrate Notes

ImageKit auto-generates multiple quality variants for uploaded videos (360p, 480p, 720p, 1080p) and serves the `.m3u8` HLS manifest. The student's client (via `hls.js`) automatically selects the appropriate quality based on available bandwidth — no server-side configuration is needed.

For low-bandwidth enforcement in the URL: append `?tr=q-40` to reduce quality for mobile previews.

---

## 8. Implementation Steps

| Day | Task |
|-----|------|
| Day 6 AM | Write FastAPI `progress.py` router with `POST /progress/update` and `GET /progress/lesson/{id}`. |
| Day 6 PM | Build `LessonPlayer` React component. Test with a signed ImageKit URL. |
| Day 7 AM | Implement 30-second progress reporting interval. Verify progress updated in DB. |
| Day 7 PM | Build `LessonPage` layout. Test end-to-end: upload video → stream → progress saved → lesson marked complete at 90%. |

---

## 9. Acceptance Criteria

- [ ] Video streams via HLS from the signed ImageKit URL
- [ ] Audio renders as a compact player (60px height)
- [ ] Player resumes from `last_position_sec` on page reload
- [ ] Progress is reported every 30 seconds and saved in `lesson_progress`
- [ ] Lesson is marked `completed = true` when `watch_percent >= 90`
- [ ] Non-enrolled students receive `403` on `/media/lessons/{id}/stream-url`

---

## 10. Environment Variables Introduced

No new variables. Uses SPEC-05 ImageKit env vars and SPEC-02 JWT auth.

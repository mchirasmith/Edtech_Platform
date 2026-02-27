# SPEC-14 — Academic Tools: KaTeX & Video Bookmarks

| Field | Value |
|-------|-------|
| **Module** | KaTeX Math Rendering, Video Bookmarks with Notes, ImageKit Auto-Thumbnails |
| **Phase** | Phase 3 |
| **Week** | Week 8 |
| **PRD Refs** | MEDIA-05, Section 8 (Academic Edge) |
| **Depends On** | SPEC-06 (Video Player), SPEC-10 (Doubt Chat — KaTeX already partially used) |

---

## 1. Overview

This spec adds two academic productivity features: (1) KaTeX LaTeX rendering throughout the platform (doubt chat, test questions, lesson descriptions), and (2) video bookmarks that let students save a timestamped link to any moment in a video with a personal note, which is then rendered as a clickable list that seeks the player to that exact second. ImageKit auto-generated thumbnails at the bookmark timestamp are also covered.

---

## 2. KaTeX Math Rendering

### Installation

```bash
npm install react-katex katex
```

`katex/dist/katex.min.css` must be imported globally in `main.jsx` or `index.css`.

### Global LaTeX Renderer Component — `frontend/src/components/MathText.jsx`

This component is the single source of truth for LaTeX rendering across the entire platform. Use it everywhere you display teacher-authored text (lesson descriptions, question text, chat messages, explanations).

```jsx
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

/**
 * Renders text that may contain LaTeX.
 * Inline LaTeX: $expression$
 * Block LaTeX:  $$expression$$
 *
 * Usage: <MathText text="The formula is $E = mc^2$" />
 */
export function MathText({ text }) {
  if (!text) return null;

  // Split on $$...$$ first (block), then $...$ (inline)
  const segments = text.split(/(⬛\$[\s\S]+?\$⬛|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <span>
      {segments.map((segment, i) => {
        if (segment.startsWith("$$") && segment.endsWith("$$")) {
          return <BlockMath key={i} math={segment.slice(2, -2)} />;
        }
        if (segment.startsWith("$") && segment.endsWith("$")) {
          return <InlineMath key={i} math={segment.slice(1, -1)} />;
        }
        return <span key={i}>{segment}</span>;
      })}
    </span>
  );
}
```

**Usage in Test Question display:**
```jsx
<MathText text={question.question_text} />
```

**Usage in Doubt Chat:**
```jsx
<MathText text={message.content} />
```

---

## 3. Video Bookmarks

### 3.1 Backend — `backend/app/routers/bookmarks.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.test import Bookmark
from app.models.lesson import Lesson
from app.config import settings
from imagekitio import ImageKit

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])

imagekit = ImageKit(
    private_key=settings.IMAGEKIT_PRIVATE_KEY,
    public_key=settings.IMAGEKIT_PUBLIC_KEY,
    url_endpoint=settings.IMAGEKIT_URL_ENDPOINT,
)

class BookmarkCreate(BaseModel):
    lesson_id: int
    timestamp_seconds: int
    label: Optional[str] = None

class BookmarkOut(BaseModel):
    id: int
    lesson_id: int
    timestamp_seconds: int
    label: Optional[str]
    thumbnail_url: Optional[str]   # ImageKit auto-generated frame
    class Config:
        from_attributes = True

@router.post("/", response_model=BookmarkOut, status_code=201)
def create_bookmark(
    payload: BookmarkCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Check lesson exists and student has access
    lesson = db.query(Lesson).filter(Lesson.id == payload.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404)

    bookmark = Bookmark(
        student_clerk_id=current_user["clerk_id"],
        lesson_id=payload.lesson_id,
        timestamp_seconds=payload.timestamp_seconds,
        label=payload.label or f"Bookmark at {_format_time(payload.timestamp_seconds)}",
    )
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return _enrich_bookmark(bookmark, lesson)

@router.get("/lesson/{lesson_id}", response_model=list[BookmarkOut])
def get_lesson_bookmarks(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    bookmarks = db.query(Bookmark).filter(
        Bookmark.lesson_id == lesson_id,
        Bookmark.student_clerk_id == current_user["clerk_id"],
    ).order_by(Bookmark.timestamp_seconds).all()
    return [_enrich_bookmark(b, lesson) for b in bookmarks]

@router.delete("/{bookmark_id}", status_code=204)
def delete_bookmark(
    bookmark_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    bookmark = db.query(Bookmark).filter(
        Bookmark.id == bookmark_id,
        Bookmark.student_clerk_id == current_user["clerk_id"],
    ).first()
    if not bookmark:
        raise HTTPException(status_code=404)
    db.delete(bookmark)
    db.commit()

def _enrich_bookmark(bookmark: Bookmark, lesson: Lesson) -> dict:
    """Adds an ImageKit auto-thumbnail URL to a bookmark."""
    thumbnail_url = None
    if lesson.imagekit_path and lesson.media_type == "video":
        thumbnail_url = imagekit.url({
            "path": lesson.imagekit_path,
            "transformation": [
                {"so": str(bookmark.timestamp_seconds), "w": "320", "h": "180"}
            ],
        })
    return {
        "id": bookmark.id,
        "lesson_id": bookmark.lesson_id,
        "timestamp_seconds": bookmark.timestamp_seconds,
        "label": bookmark.label,
        "thumbnail_url": thumbnail_url,
    }

def _format_time(seconds: int) -> str:
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"
```

### 3.2 Frontend — Bookmark Panel Component

#### `frontend/src/components/BookmarkPanel.jsx`

```jsx
import { useEffect, useRef, useState } from "react";
import { useFetch } from "../hooks/useFetch";

export function BookmarkPanel({ lessonId, playerRef }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [label, setLabel] = useState("");
  const { authFetch } = useFetch();

  useEffect(() => {
    authFetch(`/bookmarks/lesson/${lessonId}`).then(setBookmarks);
  }, [lessonId]);

  const handleAdd = async () => {
    const timestamp = Math.round(playerRef.current?.getCurrentTime() ?? 0);
    const newBookmark = await authFetch("/bookmarks/", {
      method: "POST",
      body: JSON.stringify({ lesson_id: lessonId, timestamp_seconds: timestamp, label }),
    });
    setBookmarks((prev) => [...prev, newBookmark].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
    setLabel("");
  };

  const handleSeek = (seconds) => {
    playerRef.current?.seekTo(seconds, "seconds");
  };

  const handleDelete = async (id) => {
    await authFetch(`/bookmarks/${id}`, { method: "DELETE" });
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="bg-white border rounded-xl p-4 h-full overflow-y-auto">
      <h3 className="font-semibold text-gray-800 mb-3">📌 Bookmarks</h3>

      {/* Add bookmark */}
      <div className="flex gap-2 mb-4">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Note (optional)"
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <button
          onClick={handleAdd}
          className="bg-indigo-600 text-white px-3 py-1 rounded text-sm"
        >
          + Bookmark
        </button>
      </div>

      {/* Bookmark list */}
      {bookmarks.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No bookmarks yet. Click "+ Bookmark" while watching.</p>
      ) : (
        <div className="space-y-2">
          {bookmarks.map((bm) => (
            <div key={bm.id} className="flex gap-2 items-start group">
              {bm.thumbnail_url && (
                <button onClick={() => handleSeek(bm.timestamp_seconds)}>
                  <img
                    src={bm.thumbnail_url}
                    alt="frame"
                    className="w-16 h-9 rounded object-cover flex-shrink-0 hover:opacity-80"
                  />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleSeek(bm.timestamp_seconds)}
                  className="text-indigo-600 text-xs font-mono hover:underline"
                >
                  {formatTime(bm.timestamp_seconds)}
                </button>
                <p className="text-xs text-gray-600 truncate mt-0.5">{bm.label}</p>
              </div>
              <button
                onClick={() => handleDelete(bm.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 4. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/bookmarks/` | JWT | Create bookmark at current video position |
| `GET` | `/bookmarks/lesson/{id}` | JWT | All bookmarks for a lesson (sorted) |
| `DELETE` | `/bookmarks/{id}` | JWT | Remove a bookmark |

---

## 5. Implementation Steps

| Day | Task |
|-----|------|
| Day 1 | Install `react-katex`. Build and test `MathText` component. Integrate into test question display and doubt chat messages. |
| Day 2 | Write `bookmarks.py` FastAPI router. Test endpoint with curl/Swagger. |
| Day 3 | Build `BookmarkPanel` React component. Wire `playerRef` from `LessonPlayer`. |
| Day 4 | Test full flow: pause video → add bookmark → seek to bookmark → delete bookmark. Verify thumbnail frame renders. |

---

## 6. Acceptance Criteria

- [ ] `$\int_0^\infty e^{-x^2} dx$` renders as a formatted equation in test questions and doubt chat
- [ ] `$$E = mc^2$$` renders as a block equation
- [ ] Student can bookmark the current video position from the lesson page
- [ ] Bookmarks appear in sorted order (by `timestamp_seconds`)
- [ ] Clicking a bookmark thumbnail seeks the `react-player` to that exact second
- [ ] Thumbnail is an auto-generated 5-second frame via ImageKit (no extra upload needed)
- [ ] Deleting a bookmark removes it from the panel and database

---

## 7. Environment Variables Introduced

No new variables. Uses existing ImageKit env vars from SPEC-05.

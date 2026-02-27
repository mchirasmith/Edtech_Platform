# SPEC-05 — ImageKit.io Media Pipeline

| Field | Value |
|-------|-------|
| **Module** | ImageKit.io — Video/Audio Upload, HLS Streaming, Signed URLs |
| **Phase** | Phase 1 |
| **Week** | Week 3 (Days 1–5) |
| **PRD Refs** | MEDIA-01, MEDIA-02, MEDIA-06 |
| **Depends On** | SPEC-02 (Clerk Auth), SPEC-03 (DB Schema), SPEC-04 (Course Management) |

---

## 1. Overview

This spec covers the complete ImageKit.io integration: account setup, direct browser-to-ImageKit upload using server-issued auth signatures, folder structure conventions, server-side signed-URL generation for enrolled students, and the `media` FastAPI router. ImageKit replaces Cloudinary and Mux — it auto-transcodes uploaded `.mp4` files into HLS playlists with no configuration.

---

## 2. ImageKit Account Setup

1. Register at [imagekit.io](https://imagekit.io)
2. Go to **Settings → API Keys** — copy Public Key, Private Key, URL Endpoint
3. Create the following folder structure in the ImageKit Media Library:
   ```
   /edtech/
   ├── courses/
   └── profiles/
   ```
4. Folders for `courses/{course_id}/lessons/{lesson_id}/` are created automatically on first upload

---

## 3. Installation

```bash
# Frontend
npm install imagekitio-react

# Backend
pip install imagekitio
```

---

## 4. Backend — `backend/app/routers/media.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from imagekitio import ImageKit
from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user, require_teacher
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/media", tags=["media"])

# ImageKit SDK instance — shared across requests (thread-safe)
imagekit = ImageKit(
    private_key=settings.IMAGEKIT_PRIVATE_KEY,
    public_key=settings.IMAGEKIT_PUBLIC_KEY,
    url_endpoint=settings.IMAGEKIT_URL_ENDPOINT,
)

# ── Upload Auth ──────────────────────────────────────────────────────────────

@router.get("/auth")
def get_upload_auth(current_user: dict = Depends(require_teacher)):
    """
    Returns a short-lived upload signature (token, expire, signature) that
    the frontend IKUpload component needs to upload directly to ImageKit.
    Only teachers and admins can upload.
    """
    return imagekit.get_authentication_parameters()

# ── Save Media Path After Upload ─────────────────────────────────────────────

class SaveMediaPayload(BaseModel):
    imagekit_file_id: str
    imagekit_path: str          # e.g. /edtech/courses/1/lessons/2/video.mp4
    media_type: str             # 'video' | 'audio'

@router.post("/lessons/{lesson_id}/save")
def save_media_to_lesson(
    lesson_id: int,
    payload: SaveMediaPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    """Called by the frontend after a successful IKUpload to persist the ImageKit path."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404)
    lesson.imagekit_file_id = payload.imagekit_file_id
    lesson.imagekit_path = payload.imagekit_path
    lesson.media_type = payload.media_type
    db.commit()
    return {"status": "saved"}

# ── Signed Streaming URL ─────────────────────────────────────────────────────

@router.get("/lessons/{lesson_id}/stream-url")
def get_stream_url(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns a time-limited signed URL for a lesson's media.
    Requires the student to be enrolled in the course.
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not lesson.imagekit_path:
        raise HTTPException(status_code=404, detail="No media uploaded for this lesson")

    # Teachers and admins can preview without enrollment check
    if current_user["role"] not in ["teacher", "admin"]:
        enrollment = db.query(Enrollment).filter(
            Enrollment.student_clerk_id == current_user["clerk_id"],
            Enrollment.course_id == lesson.course_id,
        ).first()
        if not enrollment:
            raise HTTPException(
                status_code=403,
                detail="You must purchase this course to access the content",
            )

    signed_url = imagekit.url({
        "path": lesson.imagekit_path,
        "signed": True,
        "expire_seconds": 3600,   # URL valid for 1 hour
    })

    return {
        "url": signed_url,
        "media_type": lesson.media_type,
        "expires_in": 3600,
    }

# ── Thumbnail URL Helper ──────────────────────────────────────────────────────

@router.get("/lessons/{lesson_id}/thumbnail")
def get_lesson_thumbnail(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Returns an ImageKit auto-generated thumbnail URL for a video lesson."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson or not lesson.imagekit_path or lesson.media_type != "video":
        raise HTTPException(status_code=404)

    # ImageKit generates a frame at 5 seconds via ?tr=so-5
    thumbnail_url = imagekit.url({
        "path": lesson.imagekit_path,
        "transformation": [{"so": "5", "w": "640", "h": "360"}],
    })
    return {"thumbnail_url": thumbnail_url}
```

---

## 5. Frontend — Media Uploader Component

### 5.1 `frontend/src/components/MediaUploader.jsx`

```jsx
import { IKContext, IKUpload, IKImage } from "imagekitio-react";
import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";

const IK_PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
const IK_URL_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;
const API_URL = import.meta.env.VITE_API_URL;

export function MediaUploader({ courseId, lessonId, mediaType = "video", onSuccess }) {
  const { getToken } = useAuth();
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Fetches a short-lived upload auth token from FastAPI
  const authenticator = async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/media/auth`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to get upload auth");
    return res.json();
  };

  const handleSuccess = async (res) => {
    setUploading(false);
    const token = await getToken();
    // Persist the ImageKit path to the lesson record in FastAPI
    await fetch(`${API_URL}/media/lessons/${lessonId}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imagekit_file_id: res.fileId,
        imagekit_path: res.filePath,
        media_type: mediaType,
      }),
    });
    onSuccess?.({ fileId: res.fileId, filePath: res.filePath });
  };

  return (
    <IKContext
      publicKey={IK_PUBLIC_KEY}
      urlEndpoint={IK_URL_ENDPOINT}
      authenticator={authenticator}
    >
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
        <IKUpload
          folder={`/edtech/courses/${courseId}/lessons/${lessonId}/`}
          accept={mediaType === "video" ? "video/*" : "audio/*"}
          onUploadStart={() => setUploading(true)}
          onUploadProgress={(e) => setProgress(Math.round((e.loaded / e.total) * 100))}
          onSuccess={handleSuccess}
          onError={(err) => { setUploading(false); console.error(err); }}
          className="hidden"
          id={`ik-upload-${lessonId}`}
        />
        <label htmlFor={`ik-upload-${lessonId}`} className="cursor-pointer">
          {uploading ? (
            <div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-gray-500">Uploading... {progress}%</p>
            </div>
          ) : (
            <p className="text-gray-500">
              Click to upload {mediaType === "video" ? "video" : "audio"} file
            </p>
          )}
        </label>
      </div>
    </IKContext>
  );
}
```

---

## 6. ImageKit Folder & Naming Convention

```
ImageKit Media Library
└── edtech/
    ├── courses/
    │   └── {course_id}/
    │       ├── thumbnail.jpg                    # Course thumbnail
    │       └── lessons/
    │           └── {lesson_id}/
    │               ├── video.mp4               # Auto-transcoded to HLS
    │               └── audio_note.mp3
    └── profiles/
        └── {clerk_user_id}/
            └── avatar.jpg
```

**Rules**:
- Only the `imagekit_path` (not full URL) is stored in Supabase
- Full URLs are constructed at request time by the backend
- All student-facing URLs are signed (time-limited)
- Teacher preview URLs can be unsigned

---

## 7. URL Transformation Reference

| Use Case | URL Transform Parameter |
|---|---|
| Video thumbnail (frame at 5s) | `?tr=so-5,w-640,h-360` |
| Course card thumbnail (400×225) | `?tr=w-400,h-225,cm-extract` |
| Profile avatar (80×80, square crop) | `?tr=w-80,h-80,cm-face` |
| Audio compressed (96kbps mobile) | `?tr=q-96` |
| Low-quality video preview | `?tr=q-50` |

---

## 8. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/media/auth` | Teacher/Admin | Returns ImageKit upload auth signature |
| `POST` | `/media/lessons/{id}/save` | Teacher/Admin | Persists imagekit_path to lesson |
| `GET` | `/media/lessons/{id}/stream-url` | JWT + Enrolled | Returns signed streaming URL |
| `GET` | `/media/lessons/{id}/thumbnail` | JWT | Returns auto-generated thumbnail URL |

---

## 9. Implementation Steps

| Day | Task |
|-----|------|
| Day 1 | Create ImageKit account. Configure env variables. Set up folder structure in dashboard. |
| Day 2 | Write FastAPI `media.py` router — `/media/auth` and `/media/lessons/{id}/save` endpoints. |
| Day 3 | Write `/media/lessons/{id}/stream-url` with enrollment check and signed URL generation. |
| Day 4 | Build `MediaUploader` React component with `IKContext` / `IKUpload` and progress bar. |
| Day 5 | Integrate `MediaUploader` into the Teacher Dashboard lesson management page. End-to-end test: upload → save path → verify in DB. |

---

## 10. Acceptance Criteria

- [ ] Teacher can upload a `.mp4` to ImageKit via the Teacher Dashboard
- [ ] After upload, `imagekit_file_id` and `imagekit_path` are saved on the lesson record
- [ ] `GET /media/lessons/{id}/stream-url` returns a signed URL for enrolled students
- [ ] `GET /media/lessons/{id}/stream-url` returns `403` for non-enrolled students
- [ ] The signed URL expires after 1 hour (verify by checking the URL parameters)
- [ ] Thumbnail URL includes `?tr=so-5` and returns an image (not an error)

---

## 11. Environment Variables Introduced

```env
# Frontend .env.local
VITE_IMAGEKIT_PUBLIC_KEY=public_...
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# Backend .env
IMAGEKIT_PRIVATE_KEY=private_...
IMAGEKIT_PUBLIC_KEY=public_...
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
```

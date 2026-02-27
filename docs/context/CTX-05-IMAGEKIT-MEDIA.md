# Agent Context — SPEC-05: ImageKit.io Media Pipeline

## Your Task
Integrate ImageKit.io for all video, audio, and image uploads. Build the FastAPI endpoints for upload auth (signature) and signed streaming URL generation. Build the `MediaUploader` React component that uploads directly to ImageKit from the browser. Wire the component into the Teacher Dashboard's lesson management page.

## Pre-Conditions
- SPEC-02 done: `require_teacher` dependency exists
- SPEC-03 done: `Lesson` model with `imagekit_file_id`, `imagekit_path`, `media_type`, `course_id` columns
- SPEC-04 done: Lessons CRUD exists; Teacher Dashboard exists
- ImageKit account created at [imagekit.io](https://imagekit.io); API keys copied to `.env`

## ImageKit Folder Convention
```
/edtech/
  courses/{course_id}/lessons/{lesson_id}/   ← video.mp4, audio.mp3
  profiles/{clerk_user_id}/                  ← avatar.jpg
```
Upload uses this path in the `folder` prop of `IKUpload`.
Only the **path** (not full URL) is stored in Supabase. Full signed URLs are generated at request time.

## Files to Create / Modify

### `backend/app/routers/media.py`
```python
imagekit = ImageKit(private_key=..., public_key=..., url_endpoint=...)

# GET /media/auth  (require_teacher)
# Returns: imagekit.get_authentication_parameters()
# → {token, expire, signature} needed by IKUpload

# POST /media/lessons/{lesson_id}/save  (require_teacher)
# Body: {imagekit_file_id, imagekit_path, media_type}
# Action: update lesson.imagekit_file_id, lesson.imagekit_path, lesson.media_type → db.commit()

# GET /media/lessons/{lesson_id}/stream-url  (get_current_user)
# Logic:
#   1. Get lesson. If not found → 404
#   2. If role=="student": check Enrollment for (clerk_id, lesson.course_id) → 403 if missing
#   3. signed_url = imagekit.url({"path": lesson.imagekit_path, "signed": True, "expire_seconds": 3600})
#   4. Return: {url, media_type, expires_in: 3600}

# GET /media/lessons/{lesson_id}/thumbnail  (get_current_user)
# Returns imagekit.url with transformation [{so:"5", w:"640", h:"360"}]
```

Register in `main.py`: `app.include_router(media.router)`

### `frontend/src/components/MediaUploader.jsx`
```jsx
import { IKContext, IKUpload } from "imagekitio-react";

// authenticator = async () => fetch /media/auth with JWT → return {token, expire, signature}
// onSuccess: fetch POST /media/lessons/{lessonId}/save with {imagekit_file_id, imagekit_path, media_type}
// Show upload progress bar (onUploadProgress)
// Props: courseId, lessonId, mediaType ("video" | "audio"), onSuccess callback
```

### Wire into Teacher Course Manager
On the lesson row for each lesson, render `<MediaUploader courseId={...} lessonId={...} mediaType="video" />`.

## URL Transform Cheat Sheet
| Use Case | `?tr=` value |
|----------|-------------|
| Course card thumbnail | `w-400,h-225` |
| Video thumbnail at 5s | `so-5,w-640,h-360` |
| Avatar | `w-80,h-80,cm-face` |
| Audio 96kbps | `q-96` |

## Security Rule
- All student-facing media URLs MUST be signed (`signed: True, expire_seconds: 3600`)
- Teacher preview URLs can be unsigned
- ImageKit Private Key is NEVER sent to the frontend

## Environment Variables
```env
# frontend/.env.local
VITE_IMAGEKIT_PUBLIC_KEY=public_...
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# backend/.env
IMAGEKIT_PRIVATE_KEY=private_...
IMAGEKIT_PUBLIC_KEY=public_...
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
```

## Done When
- [ ] Teacher uploads a `.mp4` via the Teacher Dashboard
- [ ] After upload: `imagekit_file_id` and `imagekit_path` are saved on the lesson in Supabase
- [ ] `GET /media/lessons/{id}/stream-url` returns a signed URL for enrolled students
- [ ] Same endpoint returns `403` for non-enrolled students
- [ ] Progress bar shows upload percentage during upload

## Read Next
Full code: `docs/specs/SPEC-05-IMAGEKIT-MEDIA.md`

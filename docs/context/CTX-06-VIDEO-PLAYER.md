# Agent Context — SPEC-06: Video & Audio Player + Progress Tracking

## Your Task
Build the `LessonPlayer` React component using `react-player` that streams signed ImageKit URLs (HLS for video, direct URL for audio). Implement 30-second progress reporting to FastAPI, lesson completion at 90% watch threshold, and resume-from-last-position on page reload.

## Pre-Conditions
- SPEC-05 done: `GET /media/lessons/{id}/stream-url` returns `{url, media_type}`
- SPEC-03 done: `LessonProgress` model exists with `watch_percent`, `last_position_sec`, `completed`

## Install
```bash
npm install react-player hls.js
```
`react-player` uses `hls.js` automatically for `.m3u8` HLS streams — no extra config.

## Files to Create

### `backend/app/routers/progress.py`
```
POST /progress/update
  Body: { lesson_id, watch_percent (0–100), last_position_sec }
  Auth: get_current_user
  Logic:
    1. Get lesson → verify enrollment (students only, skip for teacher/admin)
    2. Upsert LessonProgress row: max(prev_percent, new_percent), completed = percent >= 90
    3. Return: {watch_percent, completed}

GET /progress/lesson/{lesson_id}
  Auth: get_current_user
  Returns: {watch_percent, last_position_sec, completed}
  If no row exists → return {watch_percent:0, last_position_sec:0, completed:false}
```
Register in `main.py`.

### `frontend/src/components/LessonPlayer.jsx`
```jsx
import ReactPlayer from "react-player";

// State: streamUrl, mediaType, startPosition, ready, duration
// On mount: parallel fetch /media/lessons/{id}/stream-url + /progress/lesson/{id}
// On ready: if startPosition > 0: playerRef.current.seekTo(startPosition, "seconds")
// Report progress every 30 seconds via setInterval:
//   currentSec = playerRef.current.getCurrentTime()
//   percent = Math.round((currentSec / duration) * 100)
//   POST /progress/update → if res.completed, call onComplete()
// clean up interval on unmount

// ReactPlayer config:
// forceHLS: true for video, height: "60px" for audio
// onDuration → setDuration, onReady → handleReady
```

### `frontend/src/pages/LessonPage.jsx`
- 2/3 + 1/3 grid layout
- Left: `<LessonPlayer lessonId={...} onComplete={() => ...} />`
- Right: `<BookmarkPanel />` (placeholder div for now — implemented in SPEC-14)
- Use `useParams()` to get `lessonId`

## Key Implementation Details

**Why 30-second interval?**
Progress is not critical real-time data. 30 seconds balances accuracy vs. backend load.

**Why `max(prev, new)` for watch_percent?**
Users may skip backwards. We only update if the new percentage is higher than what was previously saved, ensuring forward progress only.

**HLS on ImageKit:**
ImageKit auto-generates `.m3u8` HLS playlists from uploaded `.mp4`. You don't need to configure anything — just pass the signed URL to `react-player` and set `forceHLS: true` in `config.file`.

**Audio player height:**
When `media_type === "audio"`, set player to `height="60px"` and remove the `aspect-ratio: 16/9` style.

## Done When
- [ ] Video streams from signed ImageKit URL with adaptive bitrate (HLS)
- [ ] Audio renders as a compact 60px player
- [ ] Player seeks to `last_position_sec` on page reload
- [ ] Progress is saved every 30 seconds in `lesson_progress` table
- [ ] Lesson `completed` flag set to `true` when `watch_percent >= 90`
- [ ] Non-enrolled student gets `403` on stream URL endpoint

## Read Next
Full code: `docs/specs/SPEC-06-VIDEO-PLAYER.md`

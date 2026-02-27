# Agent Context — SPEC-14: Academic Tools — KaTeX & Video Bookmarks

## Your Task
Build two academic productivity features: (1) a reusable `MathText` React component that renders LaTeX throughout the platform, and (2) a video bookmark system that lets students save timestamped video positions with notes, and scrub the player to any bookmark with one click. ImageKit auto-generates frame thumbnails at the bookmark timestamp.

## Pre-Conditions
- SPEC-06 done: `LessonPlayer` with `playerRef` exposed; `Bookmark` model in DB
- SPEC-05 done: ImageKit SDK configured in backend
- `react-katex` installed (from SPEC-10 or install now)

## Part 1: MathText Component

### Install (if not done)
```bash
npm install react-katex katex
```
Import `"katex/dist/katex.min.css"` globally.

### `frontend/src/components/MathText.jsx`
```jsx
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

export function MathText({ text }) {
  if (!text) return null;
  // Split by $$...$$ first (block equations), then $...$ (inline)
  // For $$...$$ → <BlockMath math={...} />
  // For $...$   → <InlineMath math={...} />
  // For plain text → <span>{part}</span>
}
```

**Use `<MathText>` everywhere teacher-authored text is displayed:**
- Test question text and options (`TestPage.jsx`, `TestResults.jsx`)
- Lesson description
- Doubt chat messages (replace the inline split logic from SPEC-10 with `<MathText>`)
- Explanation text in test results

## Part 2: Video Bookmarks

### `backend/app/routers/bookmarks.py`
```
POST /bookmarks/  (get_current_user)
  Body: {lesson_id, timestamp_seconds, label?}
  → Create Bookmark row
  → Generate ImageKit thumbnail URL for timestamp:
    imagekit.url({"path": lesson.imagekit_path, "transformation": [{"so": str(seconds), "w":"320","h":"180"}]})
  → Return: {id, lesson_id, timestamp_seconds, label, thumbnail_url}

GET /bookmarks/lesson/{lesson_id}  (get_current_user)
  → Query Bookmark where lesson_id AND student_clerk_id == clerk_id
  → Order by timestamp_seconds ASC
  → Enrich each with thumbnail_url (same ImageKit logic)
  → Return list

DELETE /bookmarks/{bookmark_id}  (get_current_user)
  → Verify bookmark.student_clerk_id == current_user["clerk_id"] → else 404
  → Delete → 204
```
Register in `main.py`.

### `frontend/src/components/BookmarkPanel.jsx`
```jsx
// Props: lessonId, playerRef (ref to the ReactPlayer instance)
// State: bookmarks[], label (text input)

// On mount: GET /bookmarks/lesson/{lessonId} → setBookmarks

// handleAdd:
//   timestamp = Math.round(playerRef.current.getCurrentTime())
//   POST /bookmarks/ with {lesson_id, timestamp_seconds, label}
//   Add result to bookmarks list (sorted)

// handleSeek(seconds):
//   playerRef.current.seekTo(seconds, "seconds")

// handleDelete(id):
//   DELETE /bookmarks/{id} → remove from list

// Display: for each bookmark show:
//   - Clickable thumbnail (<img> → calls handleSeek on click)
//   - Timestamp formatted as MM:SS or HH:MM:SS
//   - Label text
//   - Delete button (visible on hover)
```

### Wire into `LessonPage.jsx`
```jsx
// Pass playerRef from LessonPlayer up to LessonPage then down to BookmarkPanel
// LessonPlayer exposes its internal ref via React.forwardRef or via a callback prop
const playerRef = useRef(null);
<LessonPlayer lessonId={...} playerRef={playerRef} />
<BookmarkPanel lessonId={...} playerRef={playerRef} />
```

## ImageKit Thumbnail Pattern
```python
imagekit.url({
    "path": lesson.imagekit_path,          # e.g. /edtech/courses/1/lessons/2/video.mp4
    "transformation": [{"so": "45", "w": "320", "h": "180"}]  # frame at 45 seconds
})
# Result: un-signed URL (thumbnails are public OK)
```
`so=` = "start offset" in seconds. ImageKit auto-captures the nearest keyframe.

## Done When
- [ ] `<MathText text="The formula is $E=mc^2$" />` renders a proper inline equation
- [ ] `<MathText text="$$\int_0^\infty f(x)dx$$" />` renders as a block equation
- [ ] Student can add a bookmark at any video timestamp
- [ ] Bookmarks list shows in chronological order with thumbnail frames
- [ ] Clicking a thumbnail seeks the player to that exact second
- [ ] Deleting a bookmark removes it from both UI and DB

## Read Next
Full code: `docs/specs/SPEC-14-ACADEMIC-TOOLS.md`

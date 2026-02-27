# Agent Context — SPEC-08: Enrollment & Content Access Gates

## Your Task
Build the post-payment experience: the "My Courses" page showing enrolled courses with completion progress bars, the DPP PDF unlock gate (PDF available only after lesson is marked complete), and enrollment verification helpers.

## Pre-Conditions
- SPEC-07 done: `Enrollment` rows are created by Razorpay webhook
- SPEC-06 done: `LessonProgress` rows exist with `completed` flag
- SPEC-03 done: `Lesson.dpp_pdf_path` column exists; Supabase Storage `dpp-files` bucket exists

## Files to Create

### `backend/app/routers/enrollments.py`
```
GET /enrollments/my-courses  (get_current_user)
  For each enrollment:
    - attach course details (id, title, subject, thumbnail_path)
    - calculate completion_percent: completed_lessons / total_lessons * 100
    - attach enrolled_at, batch_id
  Return: list of {course, batch_id, enrolled_at, completion_percent}

GET /enrollments/check/{course_id}  (get_current_user)
  Quick check: Return {enrolled: True/False}

GET /enrollments/lessons/{lesson_id}/dpp-url  (get_current_user)
  1. Get lesson → 404 if not found
  2. 404 if lesson.dpp_pdf_path is None ("No DPP attached")
  3. Check enrollment → 403 if student not enrolled
  4. GATED: Check LessonProgress.completed == True for this student
     → If student role and not completed: 403 "Complete the video lesson to unlock the DPP"
  5. Generate Supabase Storage signed URL (1 hour):
     supabase.storage.from_("dpp-files").create_signed_url(lesson.dpp_pdf_path, 3600)
  6. Return {pdf_url, expires_in: 3600}
```
Register in `main.py`.

### `frontend/src/pages/MyCourses.jsx`
```jsx
// Fetch GET /enrollments/my-courses on mount
// For each enrollment:
//   - Show course thumbnail (ImageKit URL + ?tr=w-600,h-337)
//   - Show course title and subject
//   - Render progress bar: completion_percent (0–100)
//   - Show enrolled_at date
//   - Wrap each card in <Link to={`/courses/${course.id}`}>
// Empty state: "No courses yet" + link to /catalog
```

### `frontend/src/components/DPPButton.jsx`
```jsx
// Props: lessonId, isCompleted (boolean from LessonPlayer onComplete callback)
// If !isCompleted: render disabled grey button "Complete lesson to unlock DPP"
// If isCompleted: render green button "Download DPP"
//   onClick: authFetch `/enrollments/lessons/${lessonId}/dpp-url` → window.open(pdf_url, "_blank")
```

### Wire DPPButton into `LessonPage.jsx`
Pass `isCompleted` state from `LessonPlayer`'s `onComplete` callback to `DPPButton`.

## Completion Percentage Calculation
```python
lessons = db.query(Lesson).filter(Lesson.course_id == course.id).all()
completed_count = db.query(LessonProgress).filter(
    LessonProgress.student_clerk_id == clerk_id,
    LessonProgress.lesson_id.in_([l.id for l in lessons]),
    LessonProgress.completed == True,
).count()
completion_pct = round((completed_count / len(lessons)) * 100) if lessons else 0
```

## Supabase Signed URL
```python
from supabase import create_client
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
result = supabase.storage.from_("dpp-files").create_signed_url(path, 3600)
return result["signedURL"]
```

## Done When
- [ ] `GET /enrollments/my-courses` shows only the student's enrolled courses
- [ ] Completion percentage updates correctly as lessons are watched
- [ ] `GET /enrollments/lessons/{id}/dpp-url` returns `403` if lesson not completed
- [ ] DPP URL is a Supabase signed URL (contains `?token=...`)
- [ ] `DPPButton` is disabled until `onComplete` fires from `LessonPlayer`
- [ ] My Courses page shows progress bars per course

## Read Next
Full code: `docs/specs/SPEC-08-ENROLLMENT-ACCESS.md`

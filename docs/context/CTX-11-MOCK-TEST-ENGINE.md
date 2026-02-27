# Agent Context — SPEC-11: Mock Test Engine (CBT Interface)

## Your Task
Build the complete mock test system: teacher-side question bank CRUD, student-facing CBT interface with real JEE/NEET exam feel (question palette, timer, section navigation), server-side evaluation engine with configurable positive/negative marking, and post-test analytics with batch percentile.

## Pre-Conditions
- SPEC-09 done: `get_student_batch_id` dependency exists
- SPEC-03 done: `TestQuestion`, `TestAttempt` models with JSONB `options` and `answers` columns
- `react-katex` installed (from SPEC-10)

## Files to Create

### `backend/app/routers/tests.py`
```
POST /tests/questions  (require_teacher)
  Body: {course_id, subject, chapter, question_text, options:{A,B,C,D}, correct_option, explanation?, positive_marks=4, negative_marks=1}
  → Create TestQuestion

GET /tests/questions?course_id=&subject=  (require_teacher)
  → Return all questions for a course/subject

GET /tests/take/{test_id}  (get_current_user + get_student_batch_id)
  → Return questions WITHOUT correct_option and explanation (strip them!)
  → Format: [{id, question_text, options:{A,B,C,D}, subject, positive_marks, negative_marks}]

POST /tests/submit  (get_current_user)
  Body: {test_id, answers:{"q_id":"A",...}, time_taken_sec}
  Evaluation loop:
    for each question:
      - student_answer in answers.get(str(q.id))
      - if None → skip (unattempted, no penalty)
      - if correct → score += positive_marks; correct_count++
      - if wrong → score -= negative_marks
  Persist TestAttempt(answers=answers_dict, score=total, accuracy_percent, time_taken_sec)
  Calculate batch_percentile: count of attempts <= this score / total attempts * 100
  Return: {attempt_id, score, accuracy_percent, correct, attempted, total_questions, batch_percentile, subject_breakdown}

GET /tests/results/{attempt_id}  (get_current_user)
  → Full review: each question with correct_option, student_option, is_correct, explanation
  → Only accessible to the student who owns the attempt (403 otherwise)
```
Register in `main.py`.

### `frontend/src/pages/TestPage.jsx`
```jsx
// Question STATUS enum: UNSEEN | SEEN | ANSWERED | MARKED_FOR_REVIEW
// State: questions[], currentIdx, answers{}, statuses{}, timeLeft (3hr in sec), submitted

// On mount: GET /tests/take/{testId} → setQuestions, init statuses as UNSEEN

// Timer: setInterval every second → decrement timeLeft
//   → Auto-submit when timeLeft <= 0

// handleAnswer(qId, option): answers[qId]=option, statuses[qId]=ANSWERED
// handleMarkForReview(qId): toggle MARKED

// handleSubmit: POST /tests/submit → navigate to /tests/results/{attempt_id}

// Layout: 2/3 question area + 1/3 question palette sidebar
// Question area: render <MathText> for question_text, option buttons (highlight selected)
// Palette: 5-column grid of numbered buttons, color-coded by status
//   ANSWERED=green, MARKED=purple, SEEN=grey, UNSEEN=white/border
// Timer: red when < 5 minutes remaining
```

### `frontend/src/pages/TestResults.jsx`
```jsx
// Receive result from router state (navigate state) or fetch GET /tests/results/{id}
// Show: score, accuracy%, batch_percentile, subject_breakdown
// Per-question review: question text + options, highlight correct (green) and student answer
// Show explanation text
// Use <MathText> for all question and option text
```

### `frontend/src/components/MathText.jsx` (if not already created in SPEC-10)
```jsx
// Splits text on $$...$$ (BlockMath) and $...$ (InlineMath)
// Returns rendered segments
```

## Marking Scheme Rules
- **Unattempted** (no answer for that question): score change = **0** (no penalty)
- **Correct**: score += `positive_marks` (default 4)
- **Wrong**: score -= `negative_marks` (default 1)
- Marks are stored per question in DB — each test can have different marking schemes

## Question Palette Color Coding
| Status | Color |
|--------|-------|
| Not Visited | White border |
| Seen but not answered | Grey fill |
| Answered | Green fill |
| Marked for Review | Purple fill |
| Currently active | Ring/outline |

## Done When
- [ ] Teacher can add questions with LaTeX question text
- [ ] CBT shows all questions with palette; option selection highlights selected
- [ ] Auto-submit fires when timer reaches zero
- [ ] Evaluation correctly handles unattempted (no penalty), correct, and wrong answers
- [ ] Results page shows correct answers and explanations after submission
- [ ] Batch percentile is calculated from existing attempts for that test

## Read Next
Full code: `docs/specs/SPEC-11-MOCK-TEST-ENGINE.md`

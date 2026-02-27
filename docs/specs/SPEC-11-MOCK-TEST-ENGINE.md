# SPEC-11 — Mock Test Engine (CBT Interface)

| Field | Value |
|-------|-------|
| **Module** | Question Bank, CBT UI, Timer, Evaluation Engine, Post-Test Analytics |
| **Phase** | Phase 2 |
| **Week** | Week 6 |
| **PRD Refs** | TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07 |
| **Depends On** | SPEC-09 (Batch Cohorts), SPEC-03 (DB Schema) |

---

## 1. Overview

This spec covers the complete Computer-Based Test (CBT) system that mirrors the JEE/NEET exam interface: a question palette showing numeric status of all questions, section navigation, a countdown timer with auto-submit, configurable positive/negative marking, the server-side evaluation engine, and a post-test analytics dashboard with subject-wise accuracy, time-per-question, and batch percentile.

---

## 2. Backend — Test Management

### `backend/app/routers/tests.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime
from app.database import get_db
from app.dependencies.auth import get_current_user, require_teacher
from app.models.test import TestQuestion, TestAttempt
from app.models.enrollment import Enrollment
from app.routers.batches import get_student_batch_id

router = APIRouter(prefix="/tests", tags=["tests"])

# ── Teacher: Create Question Bank ─────────────────────────────────────────────

class QuestionCreate(BaseModel):
    course_id: int
    subject: str
    chapter: str
    question_text: str           # Supports LaTeX ($equation$)
    options: Dict[str, str]      # {"A": "opt1", "B": "opt2", "C": "opt3", "D": "opt4"}
    correct_option: str          # "A" | "B" | "C" | "D"
    explanation: Optional[str] = None
    positive_marks: float = 4.0
    negative_marks: float = 1.0

@router.post("/questions", status_code=201)
def create_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    question = TestQuestion(**payload.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question

@router.get("/questions")
def get_questions(
    course_id: int,
    subject: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    q = db.query(TestQuestion).filter(TestQuestion.course_id == course_id)
    if subject:
        q = q.filter(TestQuestion.subject == subject)
    return q.all()

# ── Student: Take a Test ──────────────────────────────────────────────────────

@router.get("/take/{test_id}")
def get_test_questions(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    batch_id: int = Depends(get_student_batch_id),
):
    """Returns test questions without correct answers (for the exam interface)."""
    questions = db.query(TestQuestion).filter(
        TestQuestion.course_id == test_id  # test_id maps to course_id for now
    ).all()
    if not questions:
        raise HTTPException(status_code=404, detail="Test not found")

    # Strip correct answers and explanations
    return [
        {
            "id": q.id,
            "question_text": q.question_text,
            "options": q.options,
            "subject": q.subject,
            "positive_marks": float(q.positive_marks),
            "negative_marks": float(q.negative_marks),
        }
        for q in questions
    ]

# ── Student: Submit Test ──────────────────────────────────────────────────────

class TestSubmission(BaseModel):
    test_id: int
    answers: Dict[str, str]       # {"question_id": "A", ...}
    time_taken_sec: int

@router.post("/submit")
def submit_test(
    payload: TestSubmission,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Evaluates the test and saves the attempt. Returns score and analytics."""
    questions = db.query(TestQuestion).filter(
        TestQuestion.course_id == payload.test_id
    ).all()

    if not questions:
        raise HTTPException(status_code=404)

    total_score = 0.0
    subject_stats: Dict[str, Dict] = {}
    correct_count = 0
    attempted = 0

    for q in questions:
        q_id = str(q.id)
        student_answer = payload.answers.get(q_id)
        subject = q.subject

        if subject not in subject_stats:
            subject_stats[subject] = {"attempted": 0, "correct": 0, "total": 0}
        subject_stats[subject]["total"] += 1

        if student_answer is None:
            continue   # Unattempted — no penalty

        attempted += 1
        subject_stats[subject]["attempted"] += 1

        if student_answer == q.correct_option:
            total_score += float(q.positive_marks)
            correct_count += 1
            subject_stats[subject]["correct"] += 1
        else:
            total_score -= float(q.negative_marks)

    accuracy = round((correct_count / attempted * 100), 2) if attempted > 0 else 0

    attempt = TestAttempt(
        student_clerk_id=current_user["clerk_id"],
        test_id=payload.test_id,
        answers=payload.answers,
        score=total_score,
        accuracy_percent=accuracy,
        time_taken_sec=payload.time_taken_sec,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Calculate batch percentile
    all_scores = [a.score for a in db.query(TestAttempt).filter(
        TestAttempt.test_id == payload.test_id
    ).all()]
    percentile = round(sum(1 for s in all_scores if s <= total_score) / len(all_scores) * 100)

    return {
        "attempt_id": attempt.id,
        "score": total_score,
        "accuracy_percent": accuracy,
        "correct": correct_count,
        "attempted": attempted,
        "total_questions": len(questions),
        "batch_percentile": percentile,
        "subject_breakdown": subject_stats,
    }

@router.get("/results/{attempt_id}")
def get_test_results(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Full result view with correct answers (after test submission)."""
    attempt = db.query(TestAttempt).filter(TestAttempt.id == attempt_id).first()
    if not attempt or attempt.student_clerk_id != current_user["clerk_id"]:
        raise HTTPException(status_code=404)

    questions = db.query(TestQuestion).filter(
        TestQuestion.course_id == attempt.test_id
    ).all()

    review = []
    for q in questions:
        q_id = str(q.id)
        student_ans = attempt.answers.get(q_id)
        review.append({
            "question_id": q.id,
            "question_text": q.question_text,
            "options": q.options,
            "correct_option": q.correct_option,
            "student_option": student_ans,
            "is_correct": student_ans == q.correct_option,
            "explanation": q.explanation,
        })

    return {
        "score": attempt.score,
        "accuracy_percent": attempt.accuracy_percent,
        "time_taken_sec": attempt.time_taken_sec,
        "questions": review,
        "subject_breakdown": {},  # recalculate if needed
    }
```

---

## 3. Frontend — CBT Interface

### `frontend/src/pages/TestPage.jsx`

```jsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { InlineMath } from "react-katex";

const STATUS = { UNSEEN: "unseen", SEEN: "seen", ANSWERED: "answered", MARKED: "marked" };

export default function TestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useFetch();

  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});           // { q_id: "A" }
  const [statuses, setStatuses] = useState({});         // { q_id: STATUS }
  const [timeLeft, setTimeLeft] = useState(3 * 60 * 60); // 3 hours in seconds
  const [submitted, setSubmitted] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    authFetch(`/tests/take/${testId}`).then((qs) => {
      setQuestions(qs);
      const init = {};
      qs.forEach((q) => { init[q.id] = STATUS.UNSEEN; });
      setStatuses(init);
    });
  }, [testId]);

  // Countdown timer
  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted]);

  const handleAnswer = (qId, option) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }));
    setStatuses((prev) => ({ ...prev, [qId]: STATUS.ANSWERED }));
  };

  const handleMarkForReview = (qId) => {
    setStatuses((prev) => ({
      ...prev,
      [qId]: prev[qId] === STATUS.MARKED ? STATUS.SEEN : STATUS.MARKED,
    }));
  };

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
    const strAnswers = {};
    Object.entries(answers).forEach(([k, v]) => { strAnswers[k] = v; });

    const result = await authFetch("/tests/submit", {
      method: "POST",
      body: JSON.stringify({ test_id: Number(testId), answers: strAnswers, time_taken_sec: timeTaken }),
    });
    navigate(`/tests/results/${result.attempt_id}`, { state: result });
  };

  const formatTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const q = questions[currentIdx];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Question area */}
      <div className="flex-1 flex flex-col p-8">
        {/* Timer bar */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-lg">Question {currentIdx + 1} of {questions.length}</h2>
          <span className={`font-mono text-xl font-bold ${timeLeft < 300 ? "text-red-600" : "text-gray-700"}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>

        {q && (
          <div className="bg-white rounded-xl shadow p-6 flex-1">
            <p className="text-gray-800 leading-relaxed mb-6 text-base">
              {q.question_text.split(/\$([^$]+)\$/g).map((part, i) =>
                i % 2 === 1 ? <InlineMath key={i} math={part} /> : <span key={i}>{part}</span>
              )}
            </p>

            <div className="space-y-3">
              {Object.entries(q.options).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => handleAnswer(q.id, key)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    answers[q.id] === key
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  <span className="font-semibold mr-2">{key}.</span> {value}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => handleMarkForReview(q.id)}
                className="px-4 py-2 border rounded-lg text-sm">
                {statuses[q.id] === STATUS.MARKED ? "Unmark" : "Mark for Review"}
              </button>
              <button onClick={() => setCurrentIdx((i) => Math.min(i + 1, questions.length - 1))}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                Next →
              </button>
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitted}
          className="mt-4 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
          Submit Test
        </button>
      </div>

      {/* Question Palette */}
      <div className="w-64 bg-white border-l p-4 overflow-y-auto">
        <h3 className="font-semibold mb-3 text-sm text-gray-600">Question Palette</h3>
        <div className="grid grid-cols-5 gap-1">
          {questions.map((q, i) => {
            const s = statuses[q.id] ?? STATUS.UNSEEN;
            const color = {
              [STATUS.ANSWERED]: "bg-green-500 text-white",
              [STATUS.MARKED]: "bg-purple-500 text-white",
              [STATUS.SEEN]: "bg-gray-300",
              [STATUS.UNSEEN]: "bg-white border",
            }[s];
            return (
              <button key={q.id} onClick={() => setCurrentIdx(i)}
                className={`w-full aspect-square text-xs font-medium rounded ${color} ${
                  i === currentIdx ? "ring-2 ring-indigo-400" : ""
                }`}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded" /> Answered</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500 rounded" /> Marked for Review</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-300 rounded" /> Seen</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 border rounded" /> Not Visited</div>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/tests/questions` | Teacher/Admin | Create test question |
| `GET` | `/tests/questions` | Teacher/Admin | List questions for a course |
| `GET` | `/tests/take/{test_id}` | JWT + Enrolled | Questions without answers |
| `POST` | `/tests/submit` | JWT | Submit answers; returns score and analytics |
| `GET` | `/tests/results/{attempt_id}` | JWT | Full review with correct answers |

---

## 5. Implementation Steps

| Day | Task |
|-----|------|
| Day 1–2 | Write `tests.py` router with question CRUD and submission evaluation. |
| Day 3–4 | Build CBT UI: question display with KaTeX, option selection, and question palette. |
| Day 5 | Implement countdown timer with auto-submit at zero. |
| Day 6–7 | Build post-test analytics page (score, subject breakdown, percentile). Use Recharts for charts. |

---

## 6. Acceptance Criteria

- [ ] Teacher can create questions with LaTeX in the question text
- [ ] CBT interface renders all questions with working option selection
- [ ] Question palette reflects answered/marked/unseen status in real time
- [ ] Timer counts down and auto-submits when it reaches zero
- [ ] Evaluation engine correctly applies positive/negative marking
- [ ] Unattempted questions score zero (no penalty)
- [ ] Post-test results show correct answers and explanations
- [ ] Batch percentile is calculated correctly

---

## 7. Environment Variables Introduced

No new variables.

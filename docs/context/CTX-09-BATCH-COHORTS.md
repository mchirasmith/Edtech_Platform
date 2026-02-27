# Agent Context — SPEC-09: Batch Cohort System

## Your Task
Implement the batch isolation layer. Create the `Batch` and `BatchCourseLink` CRUD API, a reusable `get_student_batch_id` FastAPI dependency (used in ALL subsequent Phase 2 specs), the admin reassignment endpoint, and the Batch Dashboard frontend page.

## Pre-Conditions
- SPEC-03 done: `Batch`, `BatchCourseLink`, `Enrollment` models exist
- SPEC-07 done: `Enrollment` rows have `batch_id` set at purchase (assigned from first linked batch)

## Core Concept
A **batch** is the primary isolation unit. Every content endpoint in Phase 2+ filters by `batch_id`. A student in Batch A must NEVER see content from Batch B. The `get_student_batch_id` dependency enforces this across the whole backend.

## Files to Create

### `backend/app/routers/batches.py`
```python
# POST /batches/  (require_admin)
# GET /batches/   (get_current_user) — all batches
# GET /batches/my-batch  (get_current_user)
#   → query Enrollment where student_clerk_id==clerk_id AND batch_id IS NOT NULL
#   → 404 if not in a batch

# POST /batches/{batch_id}/courses/{course_id}  (require_admin)
#   → Create BatchCourseLink row

# POST /batches/reassign  (require_admin)
#   Body: {student_clerk_id, new_batch_id}
#   → Find enrollment by student_clerk_id → update batch_id → commit

# ── Reusable dependency (import this in ALL Phase 2 routers) ──
def get_student_batch_id(db=Depends(get_db), current_user=Depends(get_current_user)) -> int:
    if current_user["role"] in ["teacher", "admin"]:
        return None  # Teachers bypass batch isolation for preview
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.batch_id.isnot(None)
    ).first()
    if not enrollment:
        raise HTTPException(403, "Not assigned to a batch")
    return enrollment.batch_id
```
Register in `main.py`.

### How Batch Isolation Works in Other Routers
```python
# Every Phase 2 content endpoint must include this pattern:
@router.get("/batches/{batch_id}/something")
def get_something(batch_id: int, student_batch_id: int = Depends(get_student_batch_id)):
    if batch_id != student_batch_id:
        raise HTTPException(403, "Access denied to this batch")
    # ... return filtered content
```

### `frontend/src/pages/BatchDashboard.jsx`
- Fetch `GET /batches/my-batch` → display batch name and target_exam
- Fetch `GET /courses/` → list batch courses
- Quick link cards: My Courses, Doubt Chat, Mock Tests, Leaderboard (placeholders fine)

## Admin Reassignment Flow
```
Admin calls POST /batches/reassign with {student_clerk_id, new_batch_id}
→ Enrollment.batch_id updated
→ Student's WebSocket channels, content filters, test access all automatically change
   (because they're all derived from enrollment.batch_id at request time)
```

## Done When
- [ ] Admin creates a batch and links courses to it
- [ ] After purchase, `enrollment.batch_id` is set correctly
- [ ] `GET /batches/my-batch` returns correct batch for enrolled student
- [ ] Student hitting batch content endpoint with wrong `batch_id` gets `403`
- [ ] Admin reassigns student to new batch; subsequent requests reflect new batch

## Read Next
Full code: `docs/specs/SPEC-09-BATCH-COHORTS.md`

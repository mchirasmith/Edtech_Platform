# EdTech Platform — Spec Document Index

> All spec documents live in `docs/specs/`. Each spec maps to one implementation module and is built upon the PRD and Implementation Roadmap v2.

| # | Spec File | Module | Phase | Week(s) |
|---|-----------|--------|-------|---------|
| 00 | `SPEC-00-INDEX.md` | This index | — | — |
| 01 | `SPEC-01-PROJECT-SETUP.md` | Project scaffolding, repo structure, env & CI skeleton | Phase 1 | Week 1 |
| 02 | `SPEC-02-CLERK-AUTH.md` | Clerk authentication, RBAC, JWT verification | Phase 1 | Week 1 |
| 03 | `SPEC-03-DATABASE-SCHEMA.md` | Supabase PostgreSQL schema, SQLAlchemy models, Alembic migrations | Phase 1 | Week 2 |
| 04 | `SPEC-04-COURSE-MANAGEMENT.md` | Course & lesson CRUD, access control, teacher dashboard | Phase 1 | Week 2 |
| 05 | `SPEC-05-IMAGEKIT-MEDIA.md` | ImageKit.io upload, HLS streaming, signed URLs, audio CDN | Phase 1 | Week 3 |
| 06 | `SPEC-06-VIDEO-PLAYER.md` | Student video/audio player, progress tracking, adaptive bitrate | Phase 1 | Week 3 |
| 07 | `SPEC-07-RAZORPAY-PAYMENTS.md` | Razorpay order creation, checkout modal, webhook, enrollment grant | Phase 1 | Week 4 |
| 08 | `SPEC-08-ENROLLMENT-ACCESS.md` | Enrollment table, My Courses page, access gates | Phase 1 | Week 4 |
| 09 | `SPEC-09-BATCH-COHORTS.md` | Batch system, cohort isolation, content calendar, admin assignment | Phase 2 | Week 5 |
| 10 | `SPEC-10-DOUBT-CHAT.md` | WebSocket doubt chat, message persistence, audio notes, KaTeX, moderation | Phase 2 | Week 5 |
| 11 | `SPEC-11-MOCK-TEST-ENGINE.md` | CBT interface, question bank, timer, evaluation, analytics | Phase 2 | Week 6 |
| 12 | `SPEC-12-ADMIN-PANEL.md` | Admin dashboard, user management, payment logs, report export | Phase 2–3 | Week 6–7 |
| 13 | `SPEC-13-CACHING-CICD.md` | Redis caching, GitHub Actions CI/CD, Render + Vercel deployment | Phase 3 | Week 7 |
| 14 | `SPEC-14-ACADEMIC-TOOLS.md` | KaTeX rendering, video bookmarks, ImageKit thumbnails | Phase 3 | Week 8 |
| 15 | `SPEC-15-CODE-COMPILER-EMAIL.md` | Monaco Editor, Judge0 proxy, Resend transactional emails | Phase 3 | Weeks 9–10 |

---

## Reading Order

Build in the order listed above — each spec depends on the ones before it (e.g., the database schema must exist before course management, which must exist before payments).

## Spec Document Conventions

Each spec follows this structure:
1. **Overview** — What this module does and why it exists
2. **PRD References** — Which PRD requirement IDs this spec satisfies
3. **Dependencies** — Which other specs must be completed first
4. **Data Models** — Relevant database tables / columns touched
5. **API Endpoints** — FastAPI routes with request/response shapes
6. **Frontend Components** — React components and their props
7. **Implementation Steps** — Day-by-day checklist
8. **Acceptance Criteria** — How you know this spec is done
9. **Env Variables** — New variables introduced by this module

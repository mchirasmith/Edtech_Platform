**PRODUCT REQUIREMENTS DOCUMENT**

**EdTech Platform**

*A Cohort-Based Learning Platform for Competitive Exam Aspirants*

| Version | 1.0 — Initial Release |
| :---- | :---- |
| **Status** | Draft |
| **Stack** | React \+ Vite  |  FastAPI  |  Supabase (PostgreSQL)  |  Clerk  |  Razorpay |
| **Timeline** | 10 Weeks (Phased) |
| **Prepared For** | Internal Development Reference |

# **1\. Introduction**

This Product Requirements Document (PRD) defines the features, user personas, functional requirements, technical architecture, and phased implementation plan for the EdTech Platform — a full-stack, cohort-based online learning platform targeting Indian competitive exam aspirants (JEE, NEET, and related engineering and medical entrance examinations).

The platform is designed to compete directly with established players such as Physics Wallah, Allen Digital, and Competishun by replicating their core strengths (batch isolation, real-time doubt resolution, and structured mock testing) while adding modern engineering differentiators including an in-browser code compiler, AI-assisted doubt solving, LaTeX math rendering, and verifiable digital certificates.

## **1.1 Purpose of this Document**

This PRD serves as the single source of truth for the development team. It defines what to build, for whom, and why — bridging the gap between product vision and engineering execution. Every feature, API decision, and UI component described in this document maps directly to a real user need identified through the persona research in Section 3\.

## **1.2 Scope**

* Phase 1 (Weeks 1–4): Authentication, course management, video streaming, and payments.  
* Phase 2 (Weeks 5–6): Batch cohorts, real-time doubt chat, and mock test engine.  
* Phase 3 (Weeks 7–10): CI/CD, caching, KaTeX, video bookmarking, in-browser compiler, email notifications.  
* Out of scope (this version): Mobile native apps, blockchain certificates, B2B white-labelling.

# **2\. Product Overview**

## **2.1 Vision Statement**

*To build the most effective, accessible, and technically rigorous online learning platform for Indian competitive exam aspirants — one that mirrors the discipline of offline coaching while leveraging modern software engineering to deliver a better, more measurable experience.*

## **2.2 Problem Statement**

Competitive exam preparation in India is a high-stakes, high-stress market. Students spend 2–4 years preparing for JEE or NEET, often spending ₹1–2 lakh on offline coaching that is geographically inaccessible to rural students, poorly organised digitally, and offers no personalised performance analytics. Existing digital platforms either replicate old pedagogy poorly (recorded lectures dumped on a website) or are too expensive and bloated. There is a clear gap for a platform that is content-rich, performance-driven, and built with the same engineering quality as a consumer tech product.

## **2.3 Target Market**

| Segment | Description |
| :---- | :---- |
| **Primary** | Class 11 and 12 students (age 15–18) preparing for JEE Main, JEE Advanced, NEET UG. |
| **Secondary** | Dropper students (age 18–20) repeating the exam cycle for a second or third attempt. |
| **Tertiary** | Teachers and subject matter experts seeking a modern platform to host and monetise their content without building their own infrastructure. |
| **Admin** | Platform administrators managing content, user access, batch assignments, and payment reconciliation. |

## **2.4 Key Differentiators**

* Batch-isolated cohort architecture — students only see content relevant to their specific class year and target exam.  
* Real-time doubt resolution via FastAPI WebSockets — not an asynchronous ticket system but an instant, live channel.  
* Computer-based test (CBT) interface that mirrors the exact JEE/NEET exam UI, with post-test analytics showing subject-wise accuracy, time spent per question, and batch percentile ranking.  
* In-browser code compiler (Monaco Editor \+ Judge0) for programming and engineering modules.  
* KaTeX math rendering in live chat and test interfaces — teachers can type LaTeX equations that render in real time.  
* Video bookmarking with timestamped personal notes for revision efficiency.

# **3\. User Personas**

The following personas were constructed by synthesising the behavioural patterns, motivations, and frustrations of the four core user groups who will interact with this platform. Each persona is detailed enough to serve as a design and engineering reference — every feature decision in Section 4 maps back to at least one persona's stated need or pain point.

## **3.1 Arjun Sharma — The Determined JEE Aspirant (Student)**

| Arjun Sharma  —  Student — JEE Advanced Target (Class 12\) *"I study 10 hours a day but I still can't figure out where I'm losing marks. I need something that tells me exactly what to fix."* |  |
| :---- | :---- |
| **Name** | Arjun Sharma |
| **Role** | Student — JEE Advanced Target (Class 12\) |
| **Age** | 17 years old |
| **Location** | Patna, Bihar (Tier 2 city) |
| **Education** | Class 12, Science stream (PCM). Enrolled in a local offline coaching institute. |
| **Tech Level** | Moderate. Comfortable with smartphones, YouTube, and basic apps. Has never used a developer tool or LMS. Expects consumer-grade UX. |
| **Goals** | Crack JEE Advanced in the current cycle and secure admission to IIT Bombay or IIT Delhi for Computer Science. |
|  | Identify and eliminate weak topics before the exam, particularly in Organic Chemistry and Integral Calculus. |
|  | Complete at least 3 full mock tests per week under real exam conditions to build speed and accuracy. |
|  | Watch missed lecture recordings on his own schedule since his internet connection is unreliable in the evenings. |
|  | Get immediate answers to doubts without waiting 24 hours for a teacher's reply on a forum. |
| **Pain Points** | His current coaching institute has no digital platform — notes are distributed as handwritten photocopies and test papers are physical, leaving no analytics trail. |
|  | Free YouTube content is scattered and unstructured — he wastes 45 minutes searching before finding a relevant lecture. |
|  | His mobile data plan is limited (2GB/day), so high-bitrate video streams frequently buffer and cut out, breaking his concentration. |
|  | Practice tests on most apps don't penalise negative marking correctly, making his score estimates unreliable. |
|  | He submits doubts on Telegram group chats but gets responses 6–12 hours later, often losing the context of the original question. |
|  | He has no way to track which specific sub-topics he has improved on week-over-week. |
| **Behaviours** | Studies in two 4-hour blocks — 6 AM to 10 AM and 7 PM to 11 PM. Uses the platform primarily in the early morning block on desktop. |
|  | Bookmarks specific video timestamps and re-watches the 5-minute segment around a formula he doesn't understand rather than re-watching the full lecture. |
|  | Takes a mock test every Saturday and spends Sunday reviewing his mistakes — he needs the analytics to be ready immediately after submission, not after a manual review. |
|  | Participates actively in the batch doubt chat during teacher-hosted live sessions (7–9 PM on weekdays). |
|  | Relies on a Wi-Fi connection at home but frequently switches to mobile hotspot — expects adaptive video quality to handle this transparently. |
| **Platform Use** | Enrol in the Target JEE 2026 batch and access all subject-specific video lectures organised by chapter. |
|  | Take scheduled and on-demand mock tests with automatic score calculation and subject-wise analytics. |
|  | Post doubts with attached images of notebook problems and receive real-time replies from teachers in the batch chat. |
|  | Bookmark video timestamps during lectures and annotate them with personal notes for rapid exam revision. |
|  | Download PDFs of Daily Practice Problems (DPPs) that unlock automatically after he marks the corresponding lecture as completed. |

## **3.2 Priya Nair — The Dropper Rebuilding Confidence (Student)**

| Priya Nair  —  Student — NEET UG Dropper (Second Attempt) *"I scored 580 last year. I know I can cross 680 this time but I need to fix my Biology MCQ strategy, not just consume more content."* |  |
| :---- | :---- |
| **Name** | Priya Nair |
| **Role** | Student — NEET UG Dropper (Second Attempt) |
| **Age** | 19 years old |
| **Location** | Kochi, Kerala |
| **Education** | Class 12 completed. Taking a gap year dedicated entirely to NEET preparation. |
| **Tech Level** | High. Uses a laptop for study, comfortable with apps, has tried 3–4 EdTech platforms before. Has strong opinions about what features are useful vs. noise. |
| **Goals** | Achieve a NEET score above 680 to secure MBBS admission in a government medical college. |
|  | Fix her MCQ elimination strategy in Biology, particularly Genetics and Plant Physiology, where she loses 15–20 marks due to confusion between similar options. |
|  | Build a strict daily timetable using the platform's structured batch schedule and not deviate from it. |
|  | Track her performance percentile within her dropper batch to stay motivated and calibrate her effort. |
|  | Avoid the psychological trap of over-watching lectures and under-practicing — she wants to do more tests than videos. |
| **Pain Points** | After one failed attempt, she is acutely aware of the cost of wasted effort. She is deeply frustrated by platforms that suggest content without evidence it will improve her specific weak areas. |
|  | She has already consumed a large volume of content and needs targeted practice, not beginner explanations. |
|  | She feels isolated studying alone at home — she misses the peer competition and accountability of offline coaching. |
|  | Many platforms mix dropper-level content with Class 11 starters in the same batch, so she is forced to skip through irrelevant content. |
|  | Her parents are concerned about the gap year and she is under significant pressure to show consistent progress, not just effort. |
| **Behaviours** | Wakes at 5 AM and does her first 2-hour session before breakfast. Uses the platform to check her batch's daily study plan for the day. |
|  | Has a strong preference for attempting a topic test immediately after watching a lecture rather than passively re-watching. |
|  | Reviews detailed post-test breakdowns: she wants time-per-question data, not just a final score. |
|  | Participates in the batch doubt chat in reading mode — she often finds her doubts already answered, which saves time. |
|  | Keeps a digital revision list using the video bookmark feature — notes are exam strategy observations, not content summaries. |
| **Platform Use** | Enrol in the Dropper NEET 2026 batch, which is kept strictly separate from Class 11/12 content. |
|  | Complete topic-wise mini-tests immediately after video lectures to test retention before the concept fades. |
|  | View a week-over-week accuracy improvement graph per subject on her personal analytics dashboard. |
|  | See her rank within the dropper batch on the mock test leaderboard to calibrate where she stands. |
|  | Set a daily target (e.g., complete 2 lectures \+ 1 topic test) and check it off — the platform tracks streak and completion. |

## **3.3 Rajan Mehta — The Educator Monetising Expertise (Teacher)**

| Rajan Mehta  —  Teacher — Physics Subject Matter Expert *"I have taught 600 students offline and my JEE Advanced selection rate is 68%. I want to scale that online without losing the quality of interaction."* |  |
| :---- | :---- |
| **Name** | Rajan Mehta |
| **Role** | Teacher — Physics Subject Matter Expert |
| **Age** | 34 years old |
| **Location** | Jaipur, Rajasthan |
| **Education** | M.Sc. Physics, 9 years of offline coaching experience. Former faculty at a Kota coaching institute. |
| **Tech Level** | Moderate-High. Comfortable with desktop apps and video recording. Not a developer. Expects the platform to handle technical complexity invisibly. |
| **Goals** | Upload and structure his existing library of 400+ physics lecture recordings within a professional, organised syllabus interface. |
|  | Host live doubt-clearing sessions with real-time student interaction — not pre-recorded Q\&As. |
|  | Set and upload chapter-wise DPPs and mock tests with auto-grading, so he does not need to manually evaluate 500 submissions. |
|  | Track individual student engagement: which students are falling behind, who has not watched a lecture, who is struggling on specific tests. |
|  | Earn a consistent monthly income from course subscriptions without managing payment infrastructure himself. |
| **Pain Points** | He has tried hosting content on YouTube but gets no analytics on which students are watching, for how long, or whether they are learning. |
|  | Existing platforms (Udemy, Unacademy) take 50–70% of revenue or require a minimum follower threshold to go live. |
|  | He cannot type LaTeX equations in most chat or test interfaces — he has to photograph his handwritten working and upload it as an image, which is slow and low quality. |
|  | He has no visibility into student test performance at a granular level — he wants to see class-average performance per question, not just per student. |
|  | The teacher dashboards on most platforms feel like data entry forms, not professional content management tools. |
| **Behaviours** | Uploads 2–3 lecture videos per week, each 45–75 minutes. Writes a short summary and attaches a PDF DPP to each lecture. |
|  | Hosts live doubt sessions every Tuesday and Thursday from 7–9 PM. Uses the batch chat as a moderated Q\&A channel. |
|  | Reviews the previous week's mock test analytics every Monday: class average, hardest questions, students who scored below 40%. |
|  | Writes test questions using the platform's question editor with LaTeX support so equations render correctly for students. |
|  | Occasionally uses the admin view to reassign a student from one batch to another if they have changed their target exam year. |
| **Platform Use** | Upload lecture videos directly from the Teacher Dashboard — videos are processed and made available as HLS streams automatically. |
|  | Create and publish mock tests using a question editor with LaTeX support, define marking schemes, and schedule the test for a specific date/time. |
|  | View per-lecture engagement analytics: average watch time, percentage of students who completed the video, and drop-off points. |
|  | Receive automated alerts when a student has not logged in for 7 days — enabling proactive outreach. |
|  | Monitor a class dashboard showing each student's last active date, overall test score trend, and batch percentile. |

## **3.4 Sneha Kapoor — The Platform Administrator**

| Sneha Kapoor  —  Admin — Platform Operations Manager *"My job is to make sure no student falls through the cracks — whether that's a failed payment, a mis-assigned batch, or a teacher who hasn't uploaded content in two weeks."* |  |
| :---- | :---- |
| **Name** | Sneha Kapoor |
| **Role** | Admin — Platform Operations Manager |
| **Age** | 27 years old |
| **Location** | Mumbai, Maharashtra |
| **Education** | BBA, 3 years of experience in EdTech operations. Non-technical but highly process-oriented. |
| **Tech Level** | Low-Moderate. Proficient in Excel, Google Sheets, and operational SaaS tools. Not comfortable with code or database queries. Needs a fully visual admin interface. |
| **Goals** | Monitor all active enrollments and immediately resolve access issues when a payment webhook fails or a student is assigned to the wrong batch. |
|  | Generate weekly revenue and enrollment reports for the founding team without needing SQL access. |
|  | Onboard new teachers by creating their accounts, setting their roles, and assigning them to specific batches. |
|  | Ensure content quality by reviewing flagged doubts or reported test errors before they reach students. |
|  | Track platform health metrics: daily active users, content upload frequency, payment success rate. |
| **Pain Points** | She currently uses a combination of spreadsheets and WhatsApp to manage batch assignments — there is no single dashboard. |
|  | Payment failures are discovered reactively when students complain about missing access, not proactively through system alerts. |
|  | She has no way to see which teachers are falling behind on content uploads without messaging them individually. |
|  | Generating a revenue report requires her to ask the developer to run a database query — she cannot do it herself. |
|  | She cannot resolve a mis-assigned batch herself; she has to ask a developer to run a database update. |
| **Behaviours** | Logs in every morning to check the overnight payment activity, enrollment count, and any system alerts. |
|  | Processes batch transfer requests from students who have changed their target year (e.g., from Class 12 to Dropper). |
|  | Resolves payment edge cases: re-triggers enrollment for a student whose payment succeeded but whose webhook failed. |
|  | Reviews content publishing calendar to ensure each batch has at least 3 new lectures scheduled for the upcoming week. |
|  | Exports enrollment and revenue data as a CSV for the monthly founder review. |
| **Platform Use** | Access a unified admin dashboard showing: total enrollments, daily revenue, DAU, and flagged issues requiring action. |
|  | Manually enrol or unenroll a student from a batch without requiring developer intervention. |
|  | View a content calendar per batch showing which lectures are scheduled, published, or overdue. |
|  | Export filtered reports (by batch, by date range, by payment status) as CSV files without needing database access. |
|  | Receive automated email alerts when a payment webhook fails, or when a teacher has not uploaded content in 14 days. |

# **4\. Functional Requirements**

## **4.1 Authentication & Role Management (Clerk)**

Authentication is delegated entirely to Clerk. FastAPI verifies Clerk-issued JWTs on every protected route using Clerk's JWKS endpoint. The system supports four roles: Student, Teacher, Admin, and Super Admin.

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **AUTH-01** | Sign Up / Sign In | Email \+ password and Google OAuth sign-in via Clerk pre-built components. |
| **AUTH-02** | Role Assignment | On first sign-up, role is set to 'student' by default. Admin can promote to 'teacher' or 'admin' via Clerk publicMetadata. |
| **AUTH-03** | Protected Routes (Frontend) | React routes are wrapped with Clerk's \<SignedIn\> guard. Unauthorized users are redirected to the login page. |
| **AUTH-04** | JWT Verification (Backend) | FastAPI dependency get\_current\_user fetches JWKS, validates the token, and extracts clerk\_user\_id and role on every request. |
| **AUTH-05** | Password Reset | Handled natively by Clerk — OTP sent to registered email. No custom backend code required. |
| **AUTH-06** | Session Management | Clerk manages session tokens and refresh cycles. FastAPI is stateless. |

## **4.2 Course & Content Management**

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **COURSE-01** | Create Course | Teachers can create a course with title, description, subject, target exam, and thumbnail image. Stored in Supabase PostgreSQL. |
| **COURSE-02** | Batch Assignment | Each course is assigned to one or more batches (e.g., JEE 2026 Class 12). Students only see courses in their enrolled batch. |
| **COURSE-03** | Lesson Management | Teachers can add lessons to a course: title, description, video URL (from Cloudinary/Mux), and attached PDF DPP. |
| **COURSE-04** | Scheduled Content Unlock | DPP PDFs are unlocked automatically in the student's dashboard only after the linked lesson is marked as 'completed'. |
| **COURSE-05** | Student Catalog | Students see a grid of all courses in their batch, with enrollment status, completion percentage, and last-accessed lesson. |
| **COURSE-06** | Teacher Dashboard | A content management UI where teachers manage their courses, view per-lecture analytics, and monitor student engagement. |
| **COURSE-07** | CRUD Access Control | Only users with role='teacher' or role='admin' can create, update, or delete courses and lessons. Students have read-only access. |

## **4.3 Video Streaming & Media Handling**

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **MEDIA-01** | Video Upload | Teachers upload MP4 files via the Teacher Dashboard. Files are sent directly to Cloudinary or Mux via their upload API. |
| **MEDIA-02** | HLS Streaming | Video playback uses HTTP Live Streaming (HLS) for adaptive bitrate — quality automatically adjusts to the student's connection speed. |
| **MEDIA-03** | Custom Video Player | React-based player with play/pause, seek, playback speed (0.75x–2x), fullscreen, and quality selector. |
| **MEDIA-04** | Progress Tracking | The player reports watch progress to the FastAPI backend every 30 seconds. Lesson is marked 'completed' at 90% watch threshold. |
| **MEDIA-05** | Video Bookmarks | Students can click 'Bookmark' to save the current timestamp. Notes can be attached to each bookmark. Stored in Supabase. |
| **MEDIA-06** | PDF Storage | Course thumbnails and DPP PDFs are stored in Supabase Storage. Secure, signed URLs are generated by FastAPI for download. |

## **4.4 Payment Gateway (Razorpay)**

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **PAY-01** | Order Creation | FastAPI endpoint POST /payments/create-order calls the Razorpay API server-side and returns an order\_id to the React frontend. |
| **PAY-02** | Checkout Modal | React opens the Razorpay checkout modal using the order\_id. Payment is completed entirely within the Razorpay-hosted UI. |
| **PAY-03** | Webhook Listener | FastAPI route POST /payments/webhook. Verifies Razorpay HMAC-SHA256 signature, then inserts a row in the enrollments table. |
| **PAY-04** | Enrollment Grant | On successful webhook: student's clerk\_user\_id is linked to the purchased course/batch in the enrollments table. |
| **PAY-05** | My Courses Page | FastAPI queries the enrollments table filtered by the authenticated user's clerk\_user\_id and returns only purchased courses. |
| **PAY-06** | Invoice Email | A FastAPI BackgroundTask triggers an email via Resend API after a successful enrollment, attaching a PDF invoice. |
| **PAY-07** | Failed Webhook Retry | Admin can manually re-trigger enrollment for a student via the admin panel in edge cases where the webhook failed. |

## **4.5 Batch Cohort System**

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **BATCH-01** | Batch Definition | Admins create batches (e.g., 'JEE 2026 — Class 12', 'NEET Dropper 2026'). Each batch has a target exam, start date, and linked courses. |
| **BATCH-02** | Strict Isolation | FastAPI enforces batch isolation on every content endpoint — a student in Batch A cannot access content, chats, or test results from Batch B. |
| **BATCH-03** | Enrollment Assignment | On purchase, students are assigned to the batch linked to the purchased course. Admins can manually reassign. |
| **BATCH-04** | Cohort Dashboard | Students see a batch-specific homepage: upcoming live classes, recent lectures, pending DPPs, and batch leaderboard. |
| **BATCH-05** | Content Calendar | Admins and teachers see a week-view content calendar showing scheduled, published, and overdue lectures per batch. |

## **4.6 Real-Time Doubt Resolution**

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **DOUBT-01** | WebSocket Server | FastAPI maintains WebSocket connections grouped by batch\_id. Each batch has an isolated channel managed by a ConnectionManager class. |
| **DOUBT-02** | Chat UI | React chat interface with message history, online user count, and image upload support for attaching photos of notebook problems. |
| **DOUBT-03** | Message Persistence | All messages are saved to the doubt\_messages table in Supabase PostgreSQL via SQLAlchemy inside the WebSocket handler. |
| **DOUBT-04** | Teacher Moderation | Teachers can pin, delete, or mark messages as 'Resolved'. Students can upvote doubts to surface them for teacher attention. |
| **DOUBT-05** | LaTeX in Chat | Messages support KaTeX syntax — teachers type equations like \\int\_0^\\infty and they render as formatted math for all users. |
| **DOUBT-06** | Image Doubts | Students can upload a photo of a handwritten problem. Images are stored in Supabase Storage and displayed inline in the chat thread. |

## **4.7 Mock Test Engine (CBT Interface)**

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **TEST-01** | Question Bank | Teachers create questions with options, correct answer, explanation, subject, and chapter tags. Full LaTeX support in question text. |
| **TEST-02** | Test Scheduling | Tests can be scheduled (available only between specific start and end times) or on-demand (available anytime after publish). |
| **TEST-03** | CBT UI | JEE/NEET-accurate interface: question palette, 'Mark for Review', section navigation, countdown timer, and auto-submit on timeout. |
| **TEST-04** | Marking Scheme | Configurable positive/negative marking (e.g., \+4 / \-1 for JEE). Unattempted questions score zero. |
| **TEST-05** | Evaluation Engine | FastAPI endpoint scores the submission, calculates total marks, accuracy per subject, and saves results to test\_attempts. |
| **TEST-06** | Post-Test Analytics | Student dashboard shows: score, accuracy %, time per question, subject breakdown, and percentile rank within the batch. |
| **TEST-07** | Answer Key | After the test window closes, students can review each question with the correct answer, their answer, and the teacher's explanation. |

## **4.8 Admin Panel**

| Requirement ID | Feature | Description |
| :---- | :---- | :---- |
| **ADMIN-01** | Overview Dashboard | Shows: total enrollments, daily active users, revenue (today / this month), active batches, and system alerts. |
| **ADMIN-02** | User Management | View all users with role, batch, enrollment date, last active, and test score trend. Can promote role, reassign batch, or deactivate account. |
| **ADMIN-03** | Manual Enrollment | Admin can enrol or unenrol a student from a batch directly, without requiring payment — for scholarship or support cases. |
| **ADMIN-04** | Content Calendar | Week-view calendar per batch showing scheduled, published, and overdue content. Teachers are flagged if no upload in 14 days. |
| **ADMIN-05** | Payment Logs | Table of all transactions: amount, status, student name, course, timestamp. Manual re-trigger for failed webhooks. |
| **ADMIN-06** | Report Export | Filtered CSV export: by batch, date range, payment status, or user activity. No database access required. |

# **5\. Non-Functional Requirements**

| ID | Category | Requirement | Target |
| :---- | :---- | :---- | :---- |
| **NFR-01** | Performance | API response time for standard GET endpoints | \< 200ms at P95 |
| **NFR-02** | Performance | Video stream start time (time-to-first-frame) | \< 3 seconds on 10 Mbps connection |
| **NFR-03** | Scalability | Concurrent WebSocket connections (doubt chat) | 500+ simultaneous connections without degradation |
| **NFR-04** | Scalability | Database connection pooling | PgBouncer via Supabase, max 100 pool connections |
| **NFR-05** | Reliability | Razorpay webhook idempotency | Duplicate webhook events must not create duplicate enrollments |
| **NFR-06** | Security | JWT verification on all protected FastAPI routes | 100% of non-public endpoints must require a valid Clerk JWT |
| **NFR-07** | Security | Razorpay webhook signature verification | All webhook payloads verified via HMAC-SHA256 before any DB write |
| **NFR-08** | Availability | Frontend (Vercel) and Database (Supabase) uptime | 99.9% SLA (managed by hosting providers) |
| **NFR-09** | Caching | Redis cache for course catalog and batch endpoints | Cache hit rate \> 80% during peak hours (6–10 PM IST) |
| **NFR-10** | Accessibility | Video player adaptive bitrate | Automatic quality reduction on connections \< 5 Mbps |

# **6\. Technical Architecture**

## **6.1 Tech Stack Summary**

| Layer | Technology |
| :---- | :---- |
| **Frontend** | React 18 \+ Vite \+ Tailwind CSS \+ TypeScript |
| **Authentication** | Clerk (JWT issuance, session management, Google OAuth, RBAC via publicMetadata) |
| **Backend** | FastAPI (Python) — REST APIs, WebSockets, Background Tasks, Razorpay webhook listener |
| **ORM** | SQLAlchemy — Python models mapped to Supabase PostgreSQL tables |
| **Database** | Supabase (hosted PostgreSQL) — used as database only; no RLS, no Edge Functions, no Realtime |
| **File Storage** | Supabase Storage (PDFs, images) \+ Cloudinary or Mux (HLS video streaming) |
| **Payment** | Razorpay — order creation and webhook verification in FastAPI |
| **Caching** | Redis (Upstash free tier) via fastapi-cache2 |
| **Email** | Resend API (transactional emails via FastAPI BackgroundTasks) |
| **Math Rendering** | KaTeX (react-katex) in chat and test UI |
| **Code Compiler** | Monaco Editor \+ Judge0 API (proxied through FastAPI) |
| **Hosting** | Vercel (React frontend) \+ Render (FastAPI backend) \+ Supabase (PostgreSQL) |
| **CI/CD** | GitHub Actions — lint, test, auto-deploy on merge to main |

## **6.2 Database Schema (Key Tables)**

All tables use the Clerk user ID (text, e.g. user\_2abc123) as the user identifier. No password or session data is stored in Supabase.

| Table | Key Columns | Relationships | Notes |
| :---- | :---- | :---- | :---- |
| **courses** | id, title, subject, batch\_id, teacher\_clerk\_id, thumbnail\_url, created\_at | has\_many: lessons; belongs\_to: batch | CRUD restricted to teacher/admin roles via FastAPI |
| **batches** | id, name, target\_exam, year, start\_date | has\_many: courses, enrollments | Created by admin only |
| **lessons** | id, course\_id, title, video\_url, dpp\_pdf\_url, order\_index, unlock\_after\_lesson\_id | belongs\_to: course | video\_url is Cloudinary/Mux playback URL |
| **enrollments** | id, clerk\_user\_id, batch\_id, course\_id, enrolled\_at, razorpay\_order\_id | belongs\_to: batch, course | Inserted by webhook handler. Unique on (clerk\_user\_id, course\_id) |
| **lesson\_progress** | id, clerk\_user\_id, lesson\_id, watch\_percent, completed, bookmarks (JSONB) | belongs\_to: lesson | Updated every 30s by video player. Bookmarks stored as JSON array |
| **test\_attempts** | id, clerk\_user\_id, test\_id, answers (JSONB), score, accuracy, submitted\_at | belongs\_to: test | answers is a JSON map of question\_id \-\> selected\_option |
| **doubt\_messages** | id, batch\_id, clerk\_user\_id, message, image\_url, created\_at, is\_resolved | belongs\_to: batch | Persisted from WebSocket handler. image\_url from Supabase Storage |

## **6.3 Environment Variables**

### **React Frontend (.env.local)**

* VITE\_CLERK\_PUBLISHABLE\_KEY — Clerk dashboard publishable key  
* VITE\_API\_URL — FastAPI backend base URL (e.g., https://your-app.onrender.com)  
* VITE\_RAZORPAY\_KEY\_ID — Razorpay public key (safe to expose on frontend)

### **FastAPI Backend (.env / Render environment variables)**

* CLERK\_SECRET\_KEY — for verifying Clerk JWTs via JWKS endpoint  
* DATABASE\_URL — Supabase PostgreSQL connection string  
* RAZORPAY\_KEY\_ID \+ RAZORPAY\_KEY\_SECRET — for order creation and webhook verification  
* RESEND\_API\_KEY — for transactional email delivery  
* REDIS\_URL — Upstash Redis connection string for FastAPI caching  
* CLOUDINARY\_API\_KEY \+ CLOUDINARY\_API\_SECRET — for video upload and streaming

# **7\. Implementation Roadmap**

The platform will be built across three phases over 10 weeks. Each week has a single primary deliverable and a clear 'done' definition.

| Week | Phase | Focus | Done Definition |
| :---- | :---- | :---- | :---- |
| **1** | Phase 1 | Project setup \+ Clerk auth \+ FastAPI JWT verification | Login/signup working; roles respected; FastAPI returns 401 for unauthenticated requests |
| **2** | Phase 1 | Supabase schema \+ Course CRUD \+ Teacher & Student dashboards | Teacher can create a course; student catalog renders batch-filtered content |
| **3** | Phase 1 | Video upload pipeline \+ HLS player \+ progress tracking | Teacher uploads a video; student watches with adaptive bitrate; progress saved |
| **4** | Phase 1 | Razorpay order \+ webhook \+ enrollment \+ My Courses page | End-to-end payment flow: click Buy → pay → access granted automatically |
| **5** | Phase 2 | Batch isolation \+ FastAPI WebSocket doubt chat | Students in different batches cannot see each other's content or chat; real-time messaging works |
| **6** | Phase 2 | CBT mock test UI \+ evaluation engine \+ post-test analytics | Student completes a timed test; score and subject analytics appear immediately after submission |
| **7** | Phase 3 | Redis caching \+ GitHub Actions CI/CD pipeline | Course catalog served from Redis cache; code auto-deploys to Vercel and Render on merge |
| **8** | Phase 3 | KaTeX math rendering \+ video bookmarking | Teacher types LaTeX in chat and it renders; student bookmarks a video timestamp with a note |
| **9** | Phase 3 | Monaco Editor \+ Judge0 code compiler integration | Student writes Python code in the browser, submits it, and sees output within 3 seconds |
| **10** | Phase 3 | Email notifications \+ QA \+ performance tuning \+ launch | Invoice emails send on purchase; all critical paths pass end-to-end tests; platform is live |

# **8\. Risks & Mitigations**

| Risk | Probability | Mitigation |
| :---- | :---- | :---- |
| **Razorpay webhook delivery failure — student pays but does not get access** | Medium | Implement idempotency key on enrollment INSERT. Admin panel allows manual re-trigger. Razorpay retries webhooks for 24 hours. |
| **Render free tier cold start (30–50 second wake-up delay)** | High | Use a cron job (e.g., cron-job.org) to ping the backend every 10 minutes to prevent it from sleeping. |
| **Video upload failures for large files (\>1GB lectures)** | Medium | Use Cloudinary's direct upload API with chunked multipart upload and a progress bar in the Teacher Dashboard. |
| **Supabase connection pool exhaustion under heavy load** | Low–Medium | PgBouncer is enabled by default on Supabase. Use SQLAlchemy connection pooling with pool\_size=10, max\_overflow=5. |
| **Clerk JWKS endpoint latency adding overhead to FastAPI** | Low | Cache the JWKS public keys in memory (TTL: 1 hour) using a FastAPI startup event. Re-fetch only on cache miss. |
| **Judge0 API rate limits for the code compiler** | Medium | Proxy requests through FastAPI with a per-user rate limit (max 10 submissions/minute). Consider self-hosted Judge0 for production. |

# **9\. Success Metrics**

| Metric | Target at 90-Day Post-Launch |
| :---- | :---- |
| **Monthly Active Students** | 500+ students actively accessing content per month |
| **Course Completion Rate** | \> 40% of enrolled students complete at least one full course |
| **Mock Test Participation** | \> 70% of enrolled students attempt at least one scheduled mock test per month |
| **Doubt Chat Response Time** | Teacher responds to 80% of doubts within 2 hours during live session windows |
| **Payment Success Rate** | \> 97% of initiated checkouts reach successful enrollment |
| **Video Streaming Buffering Rate** | \< 2% of streaming sessions experience a buffering event lasting \> 3 seconds |
| **Platform Uptime** | \> 99.5% measured monthly (excluding scheduled maintenance) |
| **Net Promoter Score (NPS)** | \> 50 from student survey at 30-day mark |

# **10\. Open Questions & Future Considerations**

* Pricing Model: Will courses be sold individually (one-time purchase) or via a monthly batch subscription? The current Razorpay integration supports both, but the enrollment logic differs slightly.  
* AI Doubt Solver: An LLM-powered first-pass doubt responder (before the teacher sees the message) is planned for Phase 4\. Which model (Claude API, Gemini, or open-source) will be used needs to be decided before Phase 2 chat is finalised, as the message schema may need an additional 'ai\_response' column.  
* Blockchain Certificates: Verifiable certificates minted on a public chain were identified as a Phase 4 feature. This requires a wallet integration decision (MetaMask, Coinbase Wallet) and a smart contract audit before it can be scoped.  
* Mobile App: The current plan is web-only (React, responsive). A React Native app is a Phase 4 consideration. The FastAPI backend is designed to support mobile clients without architectural changes.  
* Offline Mode: Rural students with intermittent connectivity have requested the ability to download lectures for offline playback. This requires DRM licensing and is deferred to Phase 4\.

*EdTech Platform PRD  |  Version 1.0  |  Stack: Clerk \+ FastAPI \+ Supabase \+ Razorpay*  

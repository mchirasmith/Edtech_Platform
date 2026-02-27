**EdTech Platform**  
**Updated Implementation Roadmap**  
*Stack: Clerk  |  Supabase  |  Razorpay  |  React \+ Vite*

# **1\. Updated Tech Stack at a Glance**

The following table summarises every component that has changed from the original plan and what replaces it:

| Category | Original Plan | Updated Stack |
| :---- | :---- | :---- |
| Authentication | JWT (custom) \+ Google OAuth (built manually) | Clerk (drop-in auth SDK — handles JWTs, sessions, social logins, RBAC) |
| Backend | FastAPI (Python) | FastAPI (Python) — unchanged |
| Database | PostgreSQL on Neon.tech \+ SQLAlchemy ORM | Supabase (hosted PostgreSQL) \+ SQLAlchemy ORM via direct connection string |
| Payment Gateway | Razorpay | Razorpay — unchanged |
| Frontend | React \+ Vite \+ Tailwind CSS | React \+ Vite \+ Tailwind CSS — unchanged |
| Real-time | FastAPI WebSockets | FastAPI WebSockets — unchanged (Supabase is not used for real-time) |
| File Storage | AWS S3 / Cloudinary | Supabase Storage (PDFs/images) \+ Cloudinary or Mux (video streaming) |
| Hosting | Render (backend) \+ Vercel (frontend) \+ Neon.tech (DB) | Render (FastAPI) \+ Vercel (React) \+ Supabase (PostgreSQL database) |

## **Why This Stack Works Together**

* Clerk handles 100% of the auth complexity — JWTs, session management, social logins (Google, GitHub), and role-based metadata are all managed through a single SDK. You no longer write any password hashing, JWT signing, or session management code in FastAPI.  
* Supabase is used purely as a managed PostgreSQL database. Your FastAPI backend connects to it via a standard SQLAlchemy connection string — exactly as it would with Neon.tech, just with a better dashboard, built-in storage buckets for PDFs and images, and no 90-day data expiry.  
* FastAPI remains your full backend: it handles all API routes, business logic, WebSocket connections, Razorpay webhook processing, and talks to Supabase (PostgreSQL) via SQLAlchemy.  
* Razorpay stays exactly as planned — integrated into FastAPI for order creation and webhook verification.

# **2\. Revised Architecture Overview**

### **Frontend (React \+ Vite)**

* Clerk SDK wraps your entire React app to protect routes and expose user/role context (useUser, useAuth hooks).  
* All API calls go to your FastAPI backend — the frontend never talks directly to Supabase.  
* Razorpay Checkout JS handles the payment modal on the client side.

### **Backend (FastAPI — Python)**

* All REST API routes, business logic, RBAC enforcement, and WebSocket connections live here — exactly as originally planned.  
* Clerk JWT Verification: instead of issuing your own JWTs, FastAPI verifies the Clerk-issued JWT on every protected request using the python-jose library and Clerk's JWKS endpoint. The user's role (student / teacher / admin) is extracted from the JWT's publicMetadata claim.  
* Razorpay webhook listener is a FastAPI route — same as the original plan.  
* FastAPI connects to Supabase PostgreSQL using SQLAlchemy, identical to how it would connect to Neon.tech. Just swap the DATABASE\_URL environment variable.

### **Database (Supabase — PostgreSQL only)**

* Same relational schema as originally planned: users, courses, batches, lessons, enrollments, test\_questions, test\_attempts, doubt\_messages, bookmarks.  
* The Clerk user ID (e.g., user\_2abc123) is stored as a text column and used as the foreign key for the user across all tables — no separate password or session columns needed.  
* Supabase Storage is used for non-video files: PDF DPPs, course thumbnails, profile pictures. Videos are served via Cloudinary or Mux for HLS streaming.

# **3\. Updated 10-Week Implementation Roadmap**

## **Phase 1: Core Foundation (Weeks 1–4)**

Goal: Spin up the full infrastructure, implement auth with Clerk, build course management, handle video delivery, and process payments.

### **Week 1: Project Setup \+ Clerk Authentication**

* Days 1–2: Initialize the Vite/React frontend and FastAPI backend (same as original plan). Connect FastAPI to Supabase PostgreSQL by setting the DATABASE\_URL environment variable to the Supabase connection string. Set up SQLAlchemy models exactly as originally planned.  
* Days 3–4: Install the Clerk React SDK (@clerk/clerk-react). Wrap the app with \<ClerkProvider\> and add the publishable key from the Clerk dashboard. Use Clerk's pre-built \<SignIn /\> and \<SignUp /\> components or build custom ones with Clerk hooks. Configure Google OAuth in the Clerk dashboard — no backend code needed for social login.  
* Days 5–6: Implement RBAC. In Clerk, set a publicMetadata field (role: 'student' | 'teacher' | 'admin') on each user via a Clerk webhook triggered on user creation (or manually via the dashboard during development). Use the useUser hook in React to conditionally render Student, Teacher, or Admin dashboards.  
* Day 7: Protect FastAPI routes with Clerk JWT verification. Install python-jose and httpx. Write a FastAPI dependency (get\_current\_user) that fetches Clerk's public JWKS keys, validates the JWT from the Authorization header, and extracts the user's Clerk ID and role. Attach this dependency to every protected route.

### **Week 2: Database Schema \+ Course Management Engine**

* Days 1–2: Design and create PostgreSQL tables in Supabase using the dashboard SQL editor or via SQLAlchemy migrations: courses, batches, lessons, enrollments, test\_questions, test\_attempts. Store the Clerk user ID (text) as the user identifier across all tables.  
* Days 3–4: Write FastAPI CRUD endpoints for courses and lessons (GET, POST, PUT, DELETE). All access control is enforced in FastAPI using the get\_current\_user dependency — only users with role='teacher' or role='admin' can create or modify content.  
* Days 5–6: Build the Teacher Dashboard UI in React. Use axios or fetch to call your FastAPI endpoints. Pass the Clerk JWT in the Authorization header on every request (use Clerk's getToken() method).  
* Day 7: Build the Student Catalog UI — a React page that calls a FastAPI endpoint to fetch all available courses and renders them in a grid layout.

### **Week 3: Media Delivery Pipeline**

* Days 1–3: Video Storage Decision. Use Supabase Storage for PDFs and images (DPPs, thumbnails). For video lectures, integrate Mux or Cloudinary — both have generous free tiers and handle HLS streaming automatically, removing the complexity of self-managing S3 \+ FFmpeg transcoding. Store only the video asset ID or playback URL in Supabase.  
* Days 4–5: Build the video upload flow in the Teacher Dashboard. The teacher selects a video file, it uploads directly to Mux/Cloudinary via their upload API, and the returned playback URL is saved to the lessons table in Supabase.  
* Days 6–7: Build the Student Video Player in React using a library like react-player or the Mux Player component. The player reads the HLS URL from the Supabase lessons table.

### **Week 4: Razorpay Commerce Layer**

* Days 1–2: Set up a Razorpay test account. Write a FastAPI endpoint (POST /payments/create-order) that calls the Razorpay API server-side to create an order and returns the order\_id to the React frontend. This is identical to the original plan.  
* Days 3–4: Build the React checkout UI. On 'Buy Now', call the FastAPI create-order endpoint, then open the Razorpay checkout modal using the order\_id. On payment success, Razorpay sends a webhook to your backend.  
* Days 5–6: Write the Razorpay webhook listener as a FastAPI route (POST /payments/webhook). This route verifies the Razorpay signature using HMAC-SHA256 (crucial for security) and, on success, INSERTs a row into the enrollments table in Supabase PostgreSQL via SQLAlchemy.  
* Day 7: Build the 'My Courses' page. FastAPI queries the enrollments table filtered by the logged-in user's Clerk ID, and returns only courses they have paid for. Test the full payment-to-access flow end-to-end.

## **Phase 2: Engagement & Competitor Standards (Weeks 5–6)**

Goal: Implement batch isolation and the real-time doubt engine using Supabase's built-in capabilities.

### **Week 5: Batch Cohorts \+ Real-Time Doubt Chat**

* Days 1–3: Cohorting. Add a batch\_id column to the enrollments table. Update FastAPI endpoints so all content queries (lessons, live classes, DPPs) are filtered by the student's enrolled batch\_id. Build the 'My Batch' React page showing only cohort-relevant content.  
* Days 4–7: Real-Time Doubt Chat using FastAPI WebSockets — same as the original plan. Implement a WebSocket endpoint in FastAPI with connection managers grouped by batch\_id. On the React side, use the native WebSocket API to connect, send messages, and render live replies. Messages are persisted to a doubt\_messages table in Supabase via SQLAlchemy inside the WebSocket handler.

### **Week 6: Assessment Engine (CBT Mock Tests)**

* Days 1–3: Build the React CBT (Computer-Based Test) interface — question palette, 'Mark for Review' state, a countdown timer using useEffect, and auto-submit when the timer hits zero.  
* Days 4–5: Write the answer evaluation logic. On test submission, a Supabase Edge Function compares the student's answers against the answer key stored in the test\_questions table, calculates the score with positive/negative marking, and writes the result to test\_attempts.  
* Days 6–7: Build the post-test analytics dashboard using Chart.js or Recharts. Display accuracy per subject, time-per-question, and batch-average comparison by querying test\_attempts from Supabase.

## **Phase 3: Production Polish & Advanced Features (Weeks 7–10)**

Goal: Harden for real-world traffic, add the academic and code tooling edge, and launch.

### **Week 7: Caching, CI/CD & Performance**

* Integrate Redis with FastAPI using the fastapi-cache2 library. Cache the course catalog and batch listing endpoints so repeated reads don't hit Supabase PostgreSQL on every request. Supabase's PgBouncer handles connection pooling at the database level automatically.  
* Set up a GitHub Actions workflow that runs on every push to main: lint the Python backend, run pytest tests, and auto-deploy the FastAPI app to Render and the React frontend to Vercel.

### **Week 8: Academic Edge — Math Rendering & Video Bookmarks**

* KaTeX: Integrate the react-katex library into the doubt chat and test components so teachers can type LaTeX equations that render beautifully for students.  
* Video Bookmarks: Use React's useRef hook on the video player to capture the currentTime when a student clicks 'Bookmark'. Save the timestamp and lesson\_id to a bookmarks table in Supabase. Render the saved bookmarks as a clickable list that seeks the video player to that moment.

### **Week 9: In-Browser Code Compiler**

* Integrate the Monaco Editor (@monaco-editor/react) into a React component for a VS Code-like coding experience.  
* Write a FastAPI endpoint that acts as a secure proxy to the Judge0 API — the student's code is sent to FastAPI, which forwards it to Judge0 for sandboxed compilation and execution. This keeps your Judge0 API key secret and off the frontend.

### **Week 10: Email Notifications & Launch**

* For transactional emails (PDF invoices on purchase, test result summaries), use FastAPI BackgroundTasks connected to the Resend API or SendGrid — triggered inside the Razorpay webhook handler and test submission endpoint. This is the same BackgroundTasks pattern from the original plan.  
* Note: Clerk already handles OTP and magic-link emails for authentication out of the box — you only need custom email logic for business events like purchase confirmations.  
* Final end-to-end testing, performance audits (use FastAPI's built-in profiling and Supabase's query performance advisor), and production launch.

# **4\. Key Developer Workflow Changes**

| Original Approach | Updated Approach |
| :---- | :---- |
| Write JWT middleware in FastAPI | Clerk handles token issuance; FastAPI only verifies the JWT using Clerk's JWKS endpoint |
| Manually hash passwords, store in DB | Clerk manages credentials — you never touch passwords or sessions |
| Connect FastAPI to Neon.tech PostgreSQL | Connect FastAPI to Supabase PostgreSQL — same SQLAlchemy setup, just a different DATABASE\_URL |
| Build WebSocket server in Python | FastAPI WebSockets — unchanged from original plan |
| Deploy FastAPI to Render | Deploy FastAPI to Render — unchanged |
| Store user sessions in DB | Session management handled entirely by Clerk; Supabase only stores business data |

# **5\. Environment Variables Checklist**

Add these to your .env.local (React) and Supabase Edge Function secrets:

### **React Frontend (.env.local)**

* VITE\_CLERK\_PUBLISHABLE\_KEY — from Clerk dashboard  
* VITE\_API\_URL — base URL of your FastAPI backend (e.g., https://your-app.onrender.com)  
* VITE\_RAZORPAY\_KEY\_ID — Razorpay test/live key (public, safe to expose on frontend)

### **FastAPI Backend (.env / Render environment variables)**

* CLERK\_SECRET\_KEY — for verifying Clerk JWTs server-side using the JWKS endpoint  
* DATABASE\_URL — Supabase PostgreSQL connection string (from Supabase project settings \> Database \> Connection String)  
* RAZORPAY\_KEY\_ID \+ RAZORPAY\_KEY\_SECRET — for order creation and webhook signature verification  
* RESEND\_API\_KEY (or SENDGRID\_API\_KEY) — for transactional emails  
* REDIS\_URL — for FastAPI caching in Week 7 (can use Upstash Redis free tier)

# **6\. Milestone Summary**

| Week | Milestone | Deliverable |
| :---- | :---- | :---- |
| **1** | **Auth Live** | Clerk login/signup working; roles assigned; Supabase RLS respecting Clerk JWTs |
| **2** | **Database Live** | All tables created with RLS; teacher can create courses; student catalog renders |
| **3** | **Video Live** | Teachers upload lectures; students stream HLS video via custom player |
| **4** | **Payments Live** | Full Razorpay checkout → webhook → enrollment flow working end-to-end |
| **5** | **Batches \+ Chat Live** | Students isolated to cohort; real-time doubt chat functional via Supabase Realtime |
| **6** | **Mock Tests Live** | CBT UI with timer \+ auto-submit; evaluation engine \+ post-test analytics dashboard |
| **7** | **CI/CD Live** | GitHub Actions pipeline auto-deploys to Vercel \+ Supabase on every commit |
| **8** | **Academic Tools Live** | KaTeX math rendering in chat/tests; video bookmarking working |
| **9** | **Code Compiler Live** | Monaco Editor \+ Judge0 API integration for in-browser code execution |
| **10** | **Launch Ready** | Email notifications; end-to-end QA; performance optimisation; production launch |

*Stack: Clerk \+ Supabase \+ Razorpay \+ React/Vite*  

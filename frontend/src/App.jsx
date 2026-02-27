import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";

// Clerk sign-in/sign-up pages will be wired in SPEC-02
// import { SignIn, SignUp } from "@clerk/clerk-react";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth pages — placeholders for SPEC-02 */}
      {/* <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} /> */}
      {/* <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} /> */}

      {/* Student area — auth protection added in SPEC-02 */}
      <Route path="/dashboard" element={<StudentDashboard />} />

      {/* Teacher area — role-guard added in SPEC-02 */}
      <Route path="/teacher" element={<TeacherDashboard />} />

      {/* 404 fallback */}
      <Route
        path="*"
        element={
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              gap: "16px",
            }}
          >
            <h1 style={{ fontSize: "3rem", fontWeight: 700, color: "var(--accent)" }}>404</h1>
            <p style={{ color: "var(--text-muted)" }}>Page not found</p>
            <a href="/" className="btn-primary" style={{ marginTop: "8px" }}>
              ← Back to Home
            </a>
          </div>
        }
      />
    </Routes>
  );
}

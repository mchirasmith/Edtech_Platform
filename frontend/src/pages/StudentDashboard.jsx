/* Student Dashboard — PathShala */
/* NOTE: useUser() is wired in SPEC-02 once Clerk is configured */

const NAV_ITEMS = [
    { label: "Dashboard", href: "/dashboard", icon: "▣" },
    { label: "My Courses", href: "/courses", icon: "▤" },
    { label: "Batches", href: "/batches", icon: "◈" },
    { label: "Mock Tests", href: "/tests", icon: "✦" },
    { label: "Bookmarks", href: "/bookmarks", icon: "◆" },
    { label: "Doubts", href: "/doubts", icon: "◉" },
    { label: "Profile", href: "/profile", icon: "◎" },
];

const MOCK_COURSES = [
    { title: "JEE Physics — Mechanics & Waves", progress: 68, teacher: "Dr. Priya Sharma", totalHours: 48 },
    { title: "JEE Chemistry — Organic", progress: 42, teacher: "Rahul Gupta", totalHours: 36 },
];

const MOCK_TESTS = [
    { name: "JEE Full Mock #6", score: 198, total: 300, date: "Feb 24" },
    { name: "Physics Unit Test", score: 87, total: 120, date: "Feb 21" },
    { name: "Chemistry Mock #4", score: 156, total: 240, date: "Feb 18" },
];

export default function StudentDashboard() {
    const name = "shouya"; // Replaced with useUser() in SPEC-02

    const today = new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="dashboard-layout">
            {/* ── Sidebar ──────────────────────────────────────────── */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    Path<span className="accent">Shala</span>
                </div>

                {/* Profile */}
                <div
                    style={{
                        padding: "20px 24px",
                        borderBottom: "1px solid var(--border)",
                    }}
                >
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            background: "var(--accent)",
                            color: "#0a0a0f",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "12px",
                        }}
                    >
                        {name[0]}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{name} Sharma</div>
                    <div
                        style={{
                            display: "inline-block",
                            marginTop: "6px",
                            padding: "2px 8px",
                            border: "1px solid var(--accent)",
                            color: "var(--accent)",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                        }}
                    >
                        JEE 2026
                    </div>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <a key={item.label} href={item.href} className="sidebar-nav-item">
                            <span style={{ fontSize: "0.9rem", width: 20 }}>{item.icon}</span>
                            {item.label}
                        </a>
                    ))}
                </nav>
            </aside>

            {/* ── Main Content ─────────────────────────────────────── */}
            <main className="dashboard-main">
                {/* Header */}
                <div style={{ marginBottom: "32px" }}>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        Good Morning, <span className="accent">{name}</span>
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "4px" }}>
                        {today}
                    </p>
                </div>

                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "var(--border)", marginBottom: "40px" }}>
                    {[
                        { value: "4", label: "Courses Enrolled" },
                        { value: "12", label: "Tests Attempted" },
                        { value: "86h", label: "Hours Studied" },
                    ].map((s) => (
                        <div key={s.label} className="stat-card">
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Continue Learning */}
                <section style={{ marginBottom: "40px" }}>
                    <h2
                        style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "var(--text-muted)",
                            marginBottom: "16px",
                        }}
                    >
                        Continue Learning
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--border)" }}>
                        {MOCK_COURSES.map((course) => (
                            <div key={course.title} className="card" style={{ cursor: "pointer" }}>
                                <h3 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "4px" }}>
                                    {course.title}
                                </h3>
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                                    {course.teacher} · {course.totalHours}h total
                                </p>
                                <div className="progress-bar" style={{ marginBottom: "8px" }}>
                                    <div className="progress-fill" style={{ width: `${course.progress}%` }} />
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>
                                    {course.progress}% complete
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Upcoming Session */}
                <section style={{ marginBottom: "40px" }}>
                    <h2
                        style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "var(--text-muted)",
                            marginBottom: "16px",
                        }}
                    >
                        Upcoming Live Session
                    </h2>
                    <div
                        className="card"
                        style={{
                            borderLeft: "4px solid var(--accent)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "16px",
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "4px" }}>
                                JEE Physics — Electrostatics Deep Dive
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                                Dr. Priya Sharma · Tomorrow at 7:00 PM IST
                            </div>
                        </div>
                        <button className="btn-primary" style={{ padding: "10px 20px" }}>
                            Set Reminder
                        </button>
                    </div>
                </section>

                {/* Recent Mock Tests */}
                <section>
                    <h2
                        style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "var(--text-muted)",
                            marginBottom: "16px",
                        }}
                    >
                        Recent Mock Tests
                    </h2>
                    <div className="card" style={{ padding: 0 }}>
                        {MOCK_TESTS.map((t, i) => (
                            <div
                                key={t.name}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "16px 24px",
                                    borderBottom: i < MOCK_TESTS.length - 1 ? "1px solid var(--border)" : "none",
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{t.name}</div>
                                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>{t.date}</div>
                                </div>
                                <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "1.1rem" }}>
                                    {t.score}<span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.875rem" }}>/{t.total}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

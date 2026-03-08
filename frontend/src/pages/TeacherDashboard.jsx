/* Teacher Dashboard — PathShala */
/* NOTE: useUser() is wired in SPEC-02 once Clerk is configured */

const NAV_ITEMS = [
    { label: "Overview", href: "/teacher", icon: "▣" },
    { label: "My Courses", href: "/teacher/courses", icon: "▤" },
    { label: "Upload Content", href: "/teacher/upload", icon: "↑" },
    { label: "Batches", href: "/teacher/batches", icon: "◈" },
    { label: "Student Doubts", href: "/teacher/doubts", icon: "◉" },
    { label: "Analytics", href: "/teacher/analytics", icon: "∿" },
];

const MOCK_COURSES = [
    { name: "JEE Physics — Complete", students: 124, status: "Active", revenue: "₹62,000" },
    { name: "JEE Chemistry Organic", students: 88, status: "Active", revenue: "₹44,000" },
    { name: "NEET Biology Botany", students: 60, status: "Active", revenue: "₹18,500" },
    { name: "JEE Maths Calculus", students: 40, status: "Draft", revenue: "—" },
];

const MOCK_DOUBTS = [
    { student: "Arjun Sharma", subject: "Physics", question: "Can you explain Gauss's Law for electric flux?", time: "2h ago" },
    { student: "Priya Patel", subject: "Chemistry", question: "What is the mechanism of SN2 reaction?", time: "4h ago" },
    { student: "Rohan Mehta", subject: "Physics", question: "Confused about wave-particle duality in modern physics.", time: "Yesterday" },
];

export default function TeacherDashboard() {
    const name = "Dr. Sehrish"; // Replaced with useUser() in SPEC-02

    return (
        <div className="dashboard-layout">
            {/* ── Sidebar ──────────────────────────────────────────── */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    Path<span className="accent">Shala</span>
                </div>

                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            background: "var(--bg-card)",
                            border: "2px solid var(--accent)",
                            color: "var(--accent)",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "12px",
                        }}
                    >
                        P
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{name} Sharma</div>
                    <div
                        style={{
                            display: "inline-block",
                            marginTop: "6px",
                            padding: "2px 8px",
                            background: "var(--accent)",
                            color: "#0a0a0f",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                        }}
                    >
                        Physics Expert
                    </div>
                </div>

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
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "32px",
                        flexWrap: "wrap",
                        gap: "16px",
                    }}
                >
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        Teacher Overview
                    </h1>
                    <button className="btn-primary">+ Create Course</button>
                </div>

                {/* Stats */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "1px",
                        background: "var(--border)",
                        marginBottom: "40px",
                    }}
                >
                    {[
                        { value: "6", label: "Active Courses" },
                        { value: "312", label: "Total Students" },
                        { value: "8", label: "Pending Doubts" },
                        { value: "₹1,24,500", label: "Revenue (MTD)" },
                    ].map((s) => (
                        <div key={s.label} className="stat-card">
                            <div className="stat-value" style={{ fontSize: s.value.includes("₹") ? "1.4rem" : "2rem" }}>
                                {s.value}
                            </div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* My Courses table */}
                <section style={{ marginBottom: "40px" }}>
                    <h2 style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
                        My Courses
                    </h2>
                    <div style={{ border: "1px solid var(--border)" }}>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                                padding: "12px 20px",
                                background: "var(--bg-surface)",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                color: "var(--text-muted)",
                                borderBottom: "1px solid var(--border)",
                            }}
                        >
                            <span>Course</span>
                            <span>Students</span>
                            <span>Status</span>
                            <span>Revenue</span>
                        </div>
                        {MOCK_COURSES.map((c, i) => (
                            <div
                                key={c.name}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                                    padding: "16px 20px",
                                    borderBottom: i < MOCK_COURSES.length - 1 ? "1px solid var(--border)" : "none",
                                    fontSize: "0.875rem",
                                    alignItems: "center",
                                }}
                            >
                                <span style={{ fontWeight: 500 }}>{c.name}</span>
                                <span style={{ color: "var(--text-muted)" }}>{c.students}</span>
                                <span>
                                    <span
                                        style={{
                                            display: "inline-block",
                                            padding: "2px 8px",
                                            fontSize: "0.7rem",
                                            fontWeight: 700,
                                            letterSpacing: "0.05em",
                                            textTransform: "uppercase",
                                            background: c.status === "Active" ? "rgba(245,158,11,0.12)" : "var(--bg-surface)",
                                            color: c.status === "Active" ? "var(--accent)" : "var(--text-muted)",
                                            border: `1px solid ${c.status === "Active" ? "var(--accent)" : "var(--border)"}`,
                                        }}
                                    >
                                        {c.status}
                                    </span>
                                </span>
                                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{c.revenue}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    {/* Pending Doubts */}
                    <section>
                        <h2 style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
                            Pending Student Doubts
                        </h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)" }}>
                            {MOCK_DOUBTS.map((d) => (
                                <div key={d.student} className="card" style={{ background: "var(--bg-card)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.75rem" }}>
                                        <span style={{ fontWeight: 600, color: "var(--accent)" }}>{d.student}</span>
                                        <span style={{ color: "var(--text-muted)" }}>{d.time}</span>
                                    </div>
                                    <div
                                        style={{
                                            display: "inline-block",
                                            padding: "1px 6px",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-muted)",
                                            fontSize: "0.65rem",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            marginBottom: "10px",
                                        }}
                                    >
                                        {d.subject}
                                    </div>
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-primary)", marginBottom: "14px" }}>
                                        {d.question}
                                    </p>
                                    <button className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.75rem" }}>
                                        Answer
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Upload Content */}
                    <section>
                        <h2 style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "16px" }}>
                            Upload Content
                        </h2>
                        <div
                            style={{
                                border: "2px dashed var(--accent)",
                                padding: "60px 32px",
                                textAlign: "center",
                                cursor: "pointer",
                                background: "rgba(245,158,11,0.04)",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,158,11,0.08)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(245,158,11,0.04)")}
                        >
                            <div style={{ fontSize: "2rem", marginBottom: "12px", color: "var(--accent)" }}>↑</div>
                            <p style={{ fontWeight: 600, marginBottom: "8px" }}>Drop files here</p>
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Video, Audio, PDF — max 4GB</p>
                            <button className="btn-outline" style={{ marginTop: "20px", padding: "10px 20px" }}>
                                Browse Files
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

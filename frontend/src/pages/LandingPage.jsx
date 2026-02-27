/* Landing page — PathShala */
import { Link } from "react-router-dom";

const SUBJECTS = [
    { name: "JEE Physics", icon: "⚡", desc: "Mechanics, Electrodynamics, Optics, Modern Physics" },
    { name: "JEE Chemistry", icon: "🧪", desc: "Organic, Inorganic, Physical & Analytical Chemistry" },
    { name: "JEE Mathematics", icon: "∑", desc: "Calculus, Algebra, Coordinate Geometry, Probability" },
    { name: "NEET Biology", icon: "🧬", desc: "Botany, Zoology, Human Physiology, Ecology" },
];

const STATS = [
    { value: "50+", label: "Expert Teachers" },
    { value: "10K+", label: "Students Enrolled" },
    { value: "Live", label: "Doubt Sessions" },
    { value: "Cohort", label: "Based Learning" },
];

export default function LandingPage() {
    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            {/* ── Navbar ─────────────────────────────────────────── */}
            <nav
                style={{
                    position: "fixed",
                    top: "16px",
                    left: "16px",
                    right: "16px",
                    zIndex: 100,
                    background: "rgba(17,17,24,0.95)",
                    border: "1px solid var(--border)",
                    padding: "0 32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: "60px",
                    backdropFilter: "blur(4px)",
                }}
            >
                <span style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                    Path<span className="accent">Shala</span>
                </span>

                <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
                    {["Courses", "Batches", "About"].map((item) => (
                        <a
                            key={item}
                            href="#"
                            style={{
                                color: "var(--text-muted)",
                                textDecoration: "none",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                transition: "color 0.15s",
                            }}
                            onMouseEnter={(e) => (e.target.style.color = "var(--accent)")}
                            onMouseLeave={(e) => (e.target.style.color = "var(--text-muted)")}
                        >
                            {item}
                        </a>
                    ))}
                    <Link to="/sign-in" className="btn-primary" style={{ padding: "10px 20px" }}>
                        Join Free
                    </Link>
                </div>
            </nav>

            {/* ── Hero ───────────────────────────────────────────── */}
            <section
                className="container animate-in"
                style={{ paddingTop: "160px", paddingBottom: "100px" }}
            >
                <div
                    style={{
                        borderLeft: "4px solid var(--accent)",
                        paddingLeft: "32px",
                        marginBottom: "40px",
                    }}
                >
                    <p
                        style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: "var(--accent)",
                            marginBottom: "16px",
                        }}
                    >
                        India's Premier JEE &amp; NEET Preparation Platform
                    </p>
                    <h1
                        style={{
                            fontSize: "clamp(3rem, 8vw, 7rem)",
                            fontWeight: 700,
                            lineHeight: 0.95,
                            letterSpacing: "-0.03em",
                            maxWidth: "900px",
                        }}
                    >
                        Crack JEE.<br />
                        Crack NEET.<br />
                        <span className="accent">No Excuses.</span>
                    </h1>
                </div>

                <p
                    style={{
                        maxWidth: "520px",
                        color: "var(--text-muted)",
                        fontSize: "1.1rem",
                        lineHeight: 1.7,
                        marginBottom: "40px",
                        marginLeft: "auto",
                        marginRight: "160px",
                    }}
                >
                    Cohort-based learning with India's best teachers. Live doubt sessions,
                    structured batches, and a curriculum built around the exact exam pattern.
                </p>

                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <Link to="/courses" className="btn-primary">
                        Explore Courses →
                    </Link>
                    <button className="btn-outline">Watch Demo</button>
                </div>
            </section>

            {/* ── Stats strip ────────────────────────────────────── */}
            <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                <div
                    className="container"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "0",
                    }}
                >
                    {STATS.map((s, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "40px 32px",
                                borderRight: i < 3 ? "1px solid var(--border)" : "none",
                            }}
                        >
                            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)" }}>
                                {s.value}
                            </div>
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    color: "var(--text-muted)",
                                    marginTop: "4px",
                                }}
                            >
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Subjects ───────────────────────────────────────── */}
            <section className="container" style={{ padding: "100px 24px" }}>
                <p
                    style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                        marginBottom: "24px",
                    }}
                >
                    Subjects We Cover
                </p>
                <h2
                    style={{
                        fontSize: "clamp(2rem, 4vw, 3.5rem)",
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                        marginBottom: "60px",
                    }}
                >
                    Every subject.<br />Every topic.<br />Exam-ready.
                </h2>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "1px",
                        background: "var(--border)",
                    }}
                >
                    {SUBJECTS.map((s, i) => (
                        <div
                            key={i}
                            className="card"
                            style={{
                                background: "var(--bg-card)",
                                cursor: "pointer",
                                transition: "border-color 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.borderColor = "var(--accent)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.borderColor = "var(--border)")
                            }
                        >
                            <div style={{ fontSize: "2rem", marginBottom: "16px" }}>{s.icon}</div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px" }}>
                                {s.name}
                            </h3>
                            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                                {s.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA Banner ─────────────────────────────────────── */}
            <section
                style={{
                    borderTop: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                }}
            >
                <div
                    className="container"
                    style={{
                        padding: "80px 24px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "32px",
                    }}
                >
                    <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)", fontWeight: 700, maxWidth: "600px" }}>
                        Start your JEE / NEET journey today.<br />
                        <span className="accent">Your rank depends on it.</span>
                    </h2>
                    <Link to="/sign-up" className="btn-primary" style={{ flexShrink: 0 }}>
                        Create Free Account →
                    </Link>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────── */}
            <footer style={{ padding: "40px 0", borderTop: "1px solid var(--border)" }}>
                <div
                    className="container"
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                    }}
                >
                    <span>
                        Path<span className="accent">Shala</span> © {new Date().getFullYear()}
                    </span>
                    <span>Built for JEE &amp; NEET aspirants across India</span>
                </div>
            </footer>
        </div>
    );
}

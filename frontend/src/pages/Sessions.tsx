import { Link } from "react-router-dom";

const mockSessions = [
  {
    id: "sess-001",
    repo: "example/api",
    issue: "Add rate limiting middleware",
    status: "coding",
    iteration: 2,
  },
  {
    id: "sess-002",
    repo: "example/web",
    issue: "Fix login redirect loop",
    status: "testing",
    iteration: 1,
  },
  {
    id: "sess-003",
    repo: "example/cli",
    issue: "Support config file flag",
    status: "completed",
    iteration: 3,
  },
];

function statusClass(status: string) {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "reflecting") return "warning";
  return "info";
}

function Sessions() {
  return (
    <div>
      <h1 className="page-title">Active Sessions</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mockSessions.map((s) => (
          <Link
            key={s.id}
            to={`/sessions/${s.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="glass-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.issue}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  {s.repo} · {s.id} · iteration {s.iteration}
                </div>
              </div>
              <span className={`clay-badge ${statusClass(s.status)}`}>{s.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Sessions;

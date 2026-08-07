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
  if (status === "completed") return "badge-success";
  if (status === "failed") return "badge-danger";
  if (status === "reflecting") return "badge-warning";
  return "badge-info";
}

function Sessions() {
  return (
    <div>
      <h1 className="page-title">Active Sessions</h1>
      <div className="card-list">
        {mockSessions.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="card session-row">
            <div>
              <div className="title">{s.issue}</div>
              <div className="meta">
                {s.repo} · {s.id} · iteration {s.iteration}
              </div>
            </div>
            <span className={`badge ${statusClass(s.status)}`}>{s.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Sessions;

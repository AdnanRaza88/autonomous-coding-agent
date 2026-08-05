import { useParams } from "react-router-dom";

function SessionDetail() {
  const { id } = useParams();

  return (
    <div>
      <h1 className="page-title">Session {id}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <h2 className="section-title">Plan</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Structured plan will appear here once the planner node completes.
          </p>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <h2 className="section-title">Test Output</h2>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap" }}>
            Waiting for test results...
          </pre>
        </div>
        <div className="glass-card" style={{ padding: 20, gridColumn: "1 / -1" }}>
          <h2 className="section-title">Event Stream</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Live tool calls and reflections will stream here.
          </p>
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button className="soft-button primary">Approve Plan</button>
        <button className="soft-button">Inject Guidance</button>
        <button className="soft-button">Force PR</button>
        <button className="soft-button">Abort</button>
      </div>
    </div>
  );
}

export default SessionDetail;

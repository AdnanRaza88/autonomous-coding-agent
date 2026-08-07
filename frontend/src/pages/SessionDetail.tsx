import { useParams } from "react-router-dom";

function SessionDetail() {
  const { id } = useParams();

  return (
    <div>
      <h1 className="page-title">Session {id}</h1>
      <div className="detail-grid">
        <div className="card" style={{ padding: 20 }}>
          <h2 className="section-title">Plan</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Structured plan will appear here once the planner node completes.
          </p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h2 className="section-title">Test Output</h2>
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              color: "var(--text-secondary)",
            }}
          >
            Waiting for test results...
          </pre>
        </div>
        <div className="card full" style={{ padding: 20 }}>
          <h2 className="section-title">Event Stream</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Live tool calls and reflections will stream here.
          </p>
        </div>
      </div>
      <div className="actions">
        <button className="btn btn-primary">Approve Plan</button>
        <button className="btn">Inject Guidance</button>
        <button className="btn">Force PR</button>
        <button className="btn">Abort</button>
      </div>
    </div>
  );
}

export default SessionDetail;

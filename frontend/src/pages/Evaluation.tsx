function Evaluation() {
  return (
    <div>
      <h1 className="page-title">Evaluation</h1>
      <div className="grid-metrics">
        <div className="metric-tile">
          <div className="value">72%</div>
          <div className="label">E2E Success</div>
        </div>
        <div className="metric-tile">
          <div className="value">61%</div>
          <div className="label">Recovery Rate</div>
        </div>
        <div className="metric-tile">
          <div className="value">2.4</div>
          <div className="label">Avg Iterations</div>
        </div>
        <div className="metric-tile">
          <div className="value">18%</div>
          <div className="label">Human Intervention</div>
        </div>
      </div>
      <div className="glass-card" style={{ padding: 20 }}>
        <h2 className="section-title">Recent Evaluation Runs</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Evaluation harness results will appear here after scheduled runs complete.
        </p>
      </div>
    </div>
  );
}

export default Evaluation;

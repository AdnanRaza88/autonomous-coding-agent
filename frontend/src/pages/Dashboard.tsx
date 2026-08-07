function Dashboard() {
  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="grid-metrics">
        <div className="metric-tile">
          <div className="value">78%</div>
          <div className="label">Success Rate</div>
        </div>
        <div className="metric-tile">
          <div className="value">3</div>
          <div className="label">Active Sessions</div>
        </div>
        <div className="metric-tile">
          <div className="value">14m</div>
          <div className="label">Avg Time to PR</div>
        </div>
        <div className="metric-tile">
          <div className="value">2</div>
          <div className="label">Escalations Today</div>
        </div>
      </div>
      <section className="section">
        <h2 className="section-title">Recent Activity</h2>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            No recent sessions. Start a new agent run from a GitHub issue.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;

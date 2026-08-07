function History() {
  return (
    <div>
      <h1 className="page-title">History</h1>
      <div className="card" style={{ padding: 20 }}>
        <input
          type="search"
          className="input"
          placeholder="Search sessions by issue, plan, or reflection..."
        />
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 16 }}>
          Archived sessions will be listed here with full-text search support.
        </p>
      </div>
    </div>
  );
}

export default History;

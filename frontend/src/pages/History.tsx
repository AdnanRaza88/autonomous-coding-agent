function History() {
  return (
    <div>
      <h1 className="page-title">History</h1>
      <div className="glass-card" style={{ padding: 20 }}>
        <input
          type="search"
          placeholder="Search sessions by issue, plan, or reflection..."
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid var(--border-soft)",
            fontSize: 14,
            background: "var(--bg-elevated)",
            marginBottom: 16,
          }}
        />
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Archived sessions will be listed here with full-text search support.
        </p>
      </div>
    </div>
  );
}

export default History;

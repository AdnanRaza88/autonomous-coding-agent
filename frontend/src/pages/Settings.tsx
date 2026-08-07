function Settings() {
  return (
    <div>
      <h1 className="page-title">Repository Settings</h1>
      <div className="card" style={{ padding: 24 }}>
        <h2 className="section-title">Connected Repositories</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
          Configure which repositories the agent may act on and their sandbox policies.
        </p>
        <button className="btn btn-primary">Add Repository</button>
      </div>
    </div>
  );
}

export default Settings;

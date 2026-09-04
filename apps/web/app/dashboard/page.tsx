const runs = [
  ["run_84e2f1", "Coder / Integrator", "completed", "shell.exec", "$0.0000"],
  ["run_b7a193", "Coder / Integrator", "waiting approval", "deploy.preview", "$0.0000"],
  ["run_61ceaa", "Imported Skill Preview", "completed", "repo.read", "$0.0000"],
];

export default function DashboardPage() {
  return (
    <main>
      <header className="page-head">
        <span className="eyebrow">Operator workspace</span>
        <h1>Control plane.</h1>
        <p>A dense operational surface for agents, runs, approvals, sandbox activity and cost. The first implementation uses demo telemetry while the schema and service boundaries match the production design.</p>
      </header>
      <div className="kpis">
        <div className="kpi"><div className="kpi-label">Active agents</div><div className="kpi-value">3</div></div>
        <div className="kpi"><div className="kpi-label">Runs today</div><div className="kpi-value">18</div></div>
        <div className="kpi"><div className="kpi-label">Pending approvals</div><div className="kpi-value">1</div></div>
        <div className="kpi"><div className="kpi-label">Sandbox minutes</div><div className="kpi-value">42</div></div>
      </div>
      <section className="panel">
        <div className="panel-title">Recent agent runs</div>
        <div className="panel-sub" style={{marginBottom:12}}>Execution and policy events are stored as separate auditable steps.</div>
        <div style={{overflowX:"auto"}}>
          <table className="table">
            <thead><tr><th>Run</th><th>Skill</th><th>Status</th><th>Last action</th><th>Cost</th></tr></thead>
            <tbody>{runs.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

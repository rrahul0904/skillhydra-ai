const boxes = [
  ["Ingress & identity", ["Web chat and future messaging adapters", "Organization and participant identity", "Conversation normalization"]],
  ["Skill control plane", ["Resolver and version pinning", "SKILL.md parser + checksum", "Tool/permission capability graph"]],
  ["Agent runtime", ["Focused specialist prompt", "Model routing abstraction", "Run/step state machine"]],
  ["Policy & approvals", ["Least-privilege tool checks", "Risk-based approval gates", "Audit event emission"]],
  ["Execution plane", ["Disposable sandbox interface", "Filesystem/shell/browser isolation", "Preview deployment boundary"]],
  ["Data plane", ["PostgreSQL control records", "Artifact/object storage planned", "Usage + cost event ledger"]],
  ["Secrets boundary", ["Encrypted secret references", "Host-scoped egress permissions", "No raw secret in model-visible context"]],
  ["Operations", ["Run timeline + failure diagnosis", "Sandbox lifecycle telemetry", "Policy and cost dashboards"]],
];

export default function ArchitecturePage() {
  return (
    <main>
      <header className="page-head">
        <span className="eyebrow">Clean-room system design</span>
        <h1>Separate thinking from execution.</h1>
        <p>The core design keeps the model/control loop stateless and moves privileged work behind explicit policy and isolated execution boundaries. This page mirrors the repository’s package structure.</p>
      </header>
      <div className="arch-grid">
        {boxes.map(([title, items]) => (
          <section className="arch-box" key={title as string}>
            <h3>{title}</h3>
            <ul>{(items as string[]).map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
      </div>
    </main>
  );
}

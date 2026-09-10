import { ControlPlaneDashboard } from "../../components/control-plane-dashboard";

export default function DashboardPage() {
  return (
    <main>
      <header className="page-head">
        <span className="eyebrow">Operator workspace</span>
        <h1>Control plane.</h1>
        <p>Live organization-scoped agents, persisted runs, approval decisions and audit events. Configure DATABASE_URL for PostgreSQL durability; local development falls back to the in-memory adapter.</p>
      </header>
      <ControlPlaneDashboard />
    </main>
  );
}

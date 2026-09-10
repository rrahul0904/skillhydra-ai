"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, RefreshCw, ShieldAlert, X } from "lucide-react";

type Organization = { id: string; name: string; role: string };
type Agent = { id: string; name: string; status: string; createdAt: string };
type Run = { id: string; status: string; model: string | null; estimatedCostUsd: number; createdAt: string };
type Approval = { id: string; runId: string; toolName: string; status: string; createdAt: string };
type AuditEvent = { id: string; action: string; resourceType: string; resourceId: string | null; createdAt: string };
type Summary = {
  organizationId: string;
  role: string;
  metrics: { agents: number; runs: number; pendingApprovals: number; completedRuns: number; failedRuns: number; estimatedCostUsd: number };
  agents: Agent[];
  runs: Run[];
  approvals: Approval[];
  audit: AuditEvent[];
};

export function ControlPlaneDashboard() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function loadOrganizations() {
    const response = await fetch("/api/organizations");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to load organizations");
    setOrganizations(data.organizations ?? []);
    const selected = organizationId || data.organizations?.[0]?.id || "";
    setOrganizationId(selected);
    return selected;
  }

  async function loadSummary(id?: string) {
    const selected = id ?? organizationId;
    if (!selected) { setSummary(null); return; }
    const response = await fetch(`/api/control-plane/summary?organizationId=${encodeURIComponent(selected)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to load control plane");
    setSummary(data);
  }

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const selected = await loadOrganizations();
      if (selected) await loadSummary(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load control plane");
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "SkillHydra Workspace" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create workspace");
      setOrganizationId(data.organization.id);
      await loadOrganizations();
      await loadSummary(data.organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace");
    } finally {
      setBusy(false);
    }
  }

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    if (!organizationId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, approvalId, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update approval");
      await loadSummary(organizationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update approval");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const pending = useMemo(() => summary?.approvals.filter((item) => item.status === "pending") ?? [], [summary]);

  if (busy && !summary && organizations.length === 0) {
    return <section className="panel" style={{display:"grid", placeItems:"center", minHeight:260}}><LoaderCircle size={24}/></section>;
  }

  if (organizations.length === 0) {
    return (
      <section className="panel empty-state">
        <ShieldAlert size={28}/>
        <h3>No control-plane workspace yet</h3>
        <p>Create an organization here, or send the first message from Talk to Skill and SkillHydra will provision one automatically.</p>
        <button className="btn btn-primary" onClick={createWorkspace} disabled={busy}>Create workspace</button>
        {error && <div className="warning">{error}</div>}
      </section>
    );
  }

  return (
    <div>
      <div className="dashboard-toolbar">
        <select className="input dashboard-select" value={organizationId} onChange={async (event) => {
          const next = event.target.value;
          setOrganizationId(next);
          setBusy(true);
          try { await loadSummary(next); } finally { setBusy(false); }
        }}>
          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.role}</option>)}
        </select>
        <button className="btn" onClick={refresh} disabled={busy}><RefreshCw size={15}/> Refresh</button>
      </div>
      {error && <div className="warning" style={{marginBottom:14}}>{error}</div>}

      <div className="kpis">
        <div className="kpi"><div className="kpi-label">Active agents</div><div className="kpi-value">{summary?.metrics.agents ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">Persisted runs</div><div className="kpi-value">{summary?.metrics.runs ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">Pending approvals</div><div className="kpi-value">{summary?.metrics.pendingApprovals ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">Tracked cost</div><div className="kpi-value">{"$"}{(summary?.metrics.estimatedCostUsd ?? 0).toFixed(4)}</div></div>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">Approval inbox</div>
          <div className="panel-sub">High-risk actions remain unexecuted until an authorized operator decides.</div>
          {pending.length === 0 ? (
            <div className="empty-row">No approvals are waiting.</div>
          ) : pending.map((item) => (
            <div className="approval-row" key={item.id}>
              <div>
                <strong>{item.toolName}</strong>
                <div className="panel-sub">run {item.runId.slice(0, 8)}… · {new Date(item.createdAt).toLocaleString()}</div>
              </div>
              <div className="approval-actions">
                <button className="icon-btn approve" onClick={() => decide(item.id, "approved")} title="Approve"><Check size={15}/></button>
                <button className="icon-btn reject" onClick={() => decide(item.id, "rejected")} title="Reject"><X size={15}/></button>
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-title">Agents</div>
          <div className="panel-sub">Organization-scoped specialist identities.</div>
          {summary?.agents.length ? summary.agents.map((agent) => (
            <div className="list-row" key={agent.id}>
              <div><strong>{agent.name}</strong><div className="panel-sub">{agent.id.slice(0, 8)}…</div></div>
              <span className="badge">{agent.status}</span>
            </div>
          )) : <div className="empty-row">No agents yet. Start a Talk-to-Skill conversation.</div>}
        </section>
      </div>

      <section className="panel" style={{marginTop:16}}>
        <div className="panel-title">Recent runs</div>
        <div className="panel-sub" style={{marginBottom:12}}>Persisted execution state, newest first.</div>
        <div style={{overflowX:"auto"}}>
          <table className="table">
            <thead><tr><th>Run</th><th>Status</th><th>Model</th><th>Created</th><th>Cost</th></tr></thead>
            <tbody>
              {summary?.runs.length ? summary.runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.id.slice(0, 12)}…</td>
                  <td>{run.status.replaceAll("_", " ")}</td>
                  <td>{run.model ?? "—"}</td>
                  <td>{new Date(run.createdAt).toLocaleString()}</td>
                  <td>{"$"}{run.estimatedCostUsd.toFixed(4)}</td>
                </tr>
              )) : <tr><td colSpan={5}>No persisted runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {summary?.audit.length ? (
        <section className="panel" style={{marginTop:16}}>
          <div className="panel-title">Audit trail</div>
          <div className="panel-sub">Owner/admin visibility into security-relevant control-plane activity.</div>
          {summary.audit.slice(0, 10).map((event) => (
            <div className="list-row" key={event.id}>
              <div><strong>{event.action}</strong><div className="panel-sub">{event.resourceType} · {event.resourceId?.slice(0, 12) ?? "—"}</div></div>
              <div className="panel-sub">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

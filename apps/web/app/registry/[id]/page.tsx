import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GitCommitHorizontal, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  createInstallPlan,
  getRegistryEntry,
  type InstallScope,
  type RegistryAgent,
} from "@skillhydra/registry";
import { RegistryInstallPrompt } from "../../../components/registry-install-prompt";

const agentOptions: Array<{ value: RegistryAgent; label: string }> = [
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "cursor", label: "Cursor" },
  { value: "gemini-cli", label: "Gemini CLI" },
  { value: "windsurf", label: "Windsurf" },
  { value: "opencode", label: "OpenCode" },
  { value: "universal", label: "Universal .agents layout" },
];

export default async function RegistryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agent?: string; scope?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const entry = getRegistryEntry(id);
  if (!entry) notFound();

  const selectedAgent = agentOptions.some((option) => option.value === query.agent)
    ? (query.agent as RegistryAgent)
    : "codex";
  const selectedScope: InstallScope = query.scope === "global" ? "global" : "project";
  const plan = createInstallPlan(entry, selectedAgent, selectedScope);
  const SafetyIcon = entry.security.status === "reviewed" ? ShieldCheck : ShieldAlert;

  return (
    <main>
      <header className="page-head registry-detail-head">
        <Link className="registry-back" href="/registry"><ArrowLeft size={15} /> Registry</Link>
        <div className="registry-detail-title-row">
          <div>
            <span className="eyebrow">{entry.kind} · {entry.category}</span>
            <h1>{entry.name}</h1>
          </div>
          <span className={`trust-badge trust-${entry.security.status}`}>
            <SafetyIcon size={15} /> {entry.security.status}
          </span>
        </div>
        <p>{entry.description}</p>
      </header>

      <section className="registry-detail-grid">
        <article className="panel registry-detail-main">
          <div className="registry-detail-section">
            <h2>Source & provenance</h2>
            <div className="registry-facts">
              <div><span>Publisher</span><strong>{entry.publisher.name}</strong></div>
              <div><span>Identity</span><strong>{entry.publisher.identityVerified ? "Verified person/org" : "Unverified"}</strong></div>
              <div><span>Source state</span><strong>{entry.source.immutable ? "Immutable" : "Floating ref — pin required"}</strong></div>
              <div><span>License</span><strong>{entry.source.license ?? "Not recorded"}</strong></div>
            </div>
            <a className="btn" href={entry.source.url} target="_blank" rel="noreferrer">
              Open upstream source <ExternalLink size={14} />
            </a>
          </div>

          <div className="registry-detail-section">
            <h2>Security boundary</h2>
            <p className="registry-section-copy">{entry.security.summary}</p>
            {entry.security.warnings.length > 0 ? (
              <div className="registry-warning-list">
                {entry.security.warnings.map((warning) => <div className="warning" key={warning}><ShieldAlert size={14} /> {warning}</div>)}
              </div>
            ) : (
              <div className="registry-ok"><ShieldCheck size={15} /> No catalog warnings recorded. Installation still requires review and approval.</div>
            )}
            <h3>Declared permissions</h3>
            <div className="chips">
              {entry.security.declaredPermissions.map((permission) => <span className="chip" key={permission}>{permission}</span>)}
            </div>
          </div>

          <div className="registry-detail-section">
            <h2>Compatibility</h2>
            <div className="chips">
              {entry.compatibility.map((agent) => <span className="chip" key={agent}>{agent}</span>)}
            </div>
            <h3>Prerequisites</h3>
            {entry.prerequisites.length > 0 ? (
              <ul className="registry-list">{entry.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : <p className="registry-section-copy">No prerequisites recorded.</p>}
          </div>
        </article>

        <aside className="panel registry-plan-panel">
          <div className="panel-title"><GitCommitHorizontal size={17} /> Build installation plan</div>
          <div className="panel-sub">Planning is read-only. The plan always stops before installation or script execution.</div>
          <form method="get" className="registry-plan-form">
            <label>
              <span>Target agent</span>
              <select className="input" name="agent" defaultValue={selectedAgent}>
                {agentOptions.filter((option) => entry.compatibility.includes(option.value) || entry.compatibility.includes("universal")).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Scope</span>
              <select className="input" name="scope" defaultValue={selectedScope}>
                <option value="project">Project</option>
                <option value="global">Global</option>
              </select>
            </label>
            <button className="btn" type="submit">Refresh plan</button>
          </form>

          <div className="registry-plan-summary">
            <div><span>Target</span><code>{plan.targetPath}</code></div>
            <div><span>Approval</span><strong>Required</strong></div>
            <div><span>Executes while planning</span><strong>No</strong></div>
            <div><span>Immutable source pin</span><strong>{plan.sourcePinRequired ? "Required" : "Already pinned"}</strong></div>
          </div>
        </aside>
      </section>

      <section className="section">
        <div className="registry-results-head">
          <div><span className="eyebrow">Install contract</span><h2>Review first. Approve second. Write last.</h2></div>
          <p>These steps reconstruct the useful one-copy-paste experience without turning the prompt into implicit authorization for third-party code execution.</p>
        </div>
        <div className="registry-install-grid">
          <article className="panel registry-steps">
            <ol>
              {plan.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <h3>Verification after approval</h3>
            <ul className="registry-list">{plan.verification.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <RegistryInstallPrompt prompt={plan.prompt} />
        </div>
      </section>
    </main>
  );
}

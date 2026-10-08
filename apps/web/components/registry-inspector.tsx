"use client";

import { useMemo, useState } from "react";
import styles from "./registry-inspector.module.css";

type Agent = "claude-code" | "codex" | "cursor" | "gemini-cli" | "windsurf" | "opencode" | "universal";
type Scope = "project" | "global";

type InspectionResult = {
  repository: string;
  requestedRef: string;
  resolvedCommit: string;
  requestedPath: string | null;
  manifest: { found: boolean; path?: string; name?: string; description?: string };
  files: Array<{ path: string; size: number }>;
  scan: {
    receiptId: string;
    digest: string;
    status: "pass" | "warning" | "blocked";
    riskScore: number;
    fileCount: number;
    totalBytes: number;
    immutableSource: boolean;
    capabilities: string[];
    findings: Array<{ ruleId: string; severity: string; path: string; line: number; message: string }>;
    note: string;
  };
  plan: {
    targetAgent: Agent;
    scope: Scope;
    targetPath: string;
    approvalRequired: true;
    executesDuringPlanning: false;
    sourcePinRequired: boolean;
    steps: string[];
    prompt: string;
  };
  reviewContract: {
    sourcePinned: boolean;
    staticScanOnly: boolean;
    approvalRequired: boolean;
    installationAuthorized: boolean;
  };
};

const AGENTS: Array<{ value: Agent; label: string }> = [
  { value: "codex", label: "Codex" },
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  { value: "gemini-cli", label: "Gemini CLI" },
  { value: "windsurf", label: "Windsurf" },
  { value: "opencode", label: "OpenCode" },
  { value: "universal", label: "Universal .agents" },
];

function statusClass(status: InspectionResult["scan"]["status"]) {
  if (status === "pass") return styles.statusPass;
  if (status === "blocked") return styles.statusBlocked;
  return styles.statusWarning;
}

export function RegistryInspector() {
  const [repository, setRepository] = useState("https://github.com/anthropics/skills");
  const [ref, setRef] = useState("main");
  const [path, setPath] = useState("skills/frontend-design");
  const [agent, setAgent] = useState<Agent>("codex");
  const [scope, setScope] = useState<Scope>("project");
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const totalKb = useMemo(() => result ? Math.ceil(result.scan.totalBytes / 1024) : 0, [result]);

  async function inspect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/registry/inspect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repository, ref: ref || undefined, path: path || undefined, agent, scope }),
      });
      const payload = await response.json() as { data?: InspectionResult; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || `inspection failed with ${response.status}`);
      setResult(payload.data);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "inspection failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt() {
    if (!result) return;
    await navigator.clipboard.writeText(result.plan.prompt);
    setCopied(true);
  }

  return (
    <div className={styles.shell}>
      <section className="panel">
        <form className={styles.form} onSubmit={inspect}>
          <div className={styles.formGrid}>
            <label>
              <span>Public GitHub repository</span>
              <input className="input" type="url" required value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="https://github.com/owner/repo" />
            </label>
            <label>
              <span>Ref</span>
              <input className="input" value={ref} onChange={(event) => setRef(event.target.value)} placeholder="main" maxLength={200} />
            </label>
            <label>
              <span>Repository path</span>
              <input className="input" value={path} onChange={(event) => setPath(event.target.value)} placeholder="skills/my-skill" maxLength={300} />
            </label>
          </div>
          <div className={styles.selectRow}>
            <label>
              <span>Target agent</span>
              <select className="input" value={agent} onChange={(event) => setAgent(event.target.value as Agent)}>
                {AGENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Install scope</span>
              <select className="input" value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
                <option value="project">Project</option>
                <option value="global">Global</option>
              </select>
            </label>
          </div>
          <div className={styles.actions}>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Resolving + scanning…" : "Resolve source + inspect"}</button>
            <p className={styles.note}>Read-only inspection. No repository writes, installs, scripts, auth, deploys or external side effects are authorized.</p>
          </div>
        </form>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </section>

      {result ? (
        <>
          <section className={styles.summaryGrid} aria-label="Inspection receipt summary">
            <div className={styles.fact}><span>Static scan</span><strong className={statusClass(result.scan.status)}>{result.scan.status} · {result.scan.riskScore}/100</strong></div>
            <div className={styles.fact}><span>Immutable commit</span><code>{result.resolvedCommit}</code></div>
            <div className={styles.fact}><span>Source digest</span><code>{result.scan.digest}</code></div>
            <div className={styles.fact}><span>Bounded read</span><strong>{result.scan.fileCount} files · {totalKb} KiB</strong></div>
          </section>

          <section className={styles.results}>
            <article className={`panel ${styles.section}`}>
              <div>
                <span className="eyebrow">Inspection receipt</span>
                <h2>{result.manifest.name || "Skill manifest"}</h2>
              </div>
              <p>{result.manifest.description || (result.manifest.found ? "SKILL.md found, but no single-line description was declared." : "No SKILL.md was found in the inspected path.")}</p>
              <div className="chips">
                {result.scan.capabilities.length ? result.scan.capabilities.map((capability) => <span className="chip" key={capability}>{capability}</span>) : <span className="chip">no configured capability rules matched</span>}
              </div>

              <div>
                <h3>Static findings</h3>
                {result.scan.findings.length === 0 ? <p className={styles.note}>No configured static rule matched. This still does not certify the code as safe.</p> : (
                  <ul className={styles.findings}>
                    {result.scan.findings.map((finding, index) => (
                      <li className={styles.finding} key={`${finding.ruleId}-${finding.path}-${finding.line}-${index}`}>
                        <span className={styles.severity}>{finding.severity}</span>
                        <div><strong>{finding.message}</strong><span className={styles.path}>{finding.path}:{finding.line} · {finding.ruleId}</span></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3>Files read</h3>
                <ul className={styles.fileList}>
                  {result.files.map((file) => <li key={file.path}><code>{file.path}</code> · {file.size} bytes</li>)}
                </ul>
              </div>
              <p className={styles.note}>{result.scan.note}</p>
            </article>

            <aside className={`panel ${styles.plan}`}>
              <div>
                <span className="eyebrow">Review-first plan</span>
                <h2>Installation is still not authorized.</h2>
              </div>
              <div className={styles.fact}><span>Target path</span><code>{result.plan.targetPath}</code></div>
              <div className={styles.fact}><span>Approval boundary</span><strong>{result.plan.approvalRequired ? "Explicit approval required" : "Unexpected"}</strong></div>
              <div className={styles.fact}><span>Source pin</span><strong>{result.reviewContract.sourcePinned ? "Resolved" : "Missing"}</strong></div>
              <ol>
                {result.plan.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <button className="btn" type="button" onClick={copyPrompt}>{copied ? "Prompt copied" : "Copy review-first prompt"}</button>
              <pre className={styles.prompt}>{result.plan.prompt}</pre>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}

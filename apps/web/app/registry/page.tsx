import Link from "next/link";
import { Search, ShieldCheck, ShieldAlert, PackageCheck, GitBranch } from "lucide-react";
import {
  listRegistryCategories,
  searchRegistry,
  type RegistryAgent,
  type RegistrySafetyStatus,
} from "@skillhydra/registry";

const agentOptions: Array<{ value: RegistryAgent; label: string }> = [
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "cursor", label: "Cursor" },
  { value: "gemini-cli", label: "Gemini CLI" },
  { value: "windsurf", label: "Windsurf" },
  { value: "opencode", label: "OpenCode" },
];

const safetyOptions: Array<{ value: RegistrySafetyStatus; label: string }> = [
  { value: "reviewed", label: "Reviewed" },
  { value: "warning", label: "Warning" },
  { value: "unknown", label: "Unknown" },
];

function safetyIcon(status: RegistrySafetyStatus) {
  return status === "reviewed" ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />;
}

export default async function RegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; agent?: string; safety?: string }>;
}) {
  const params = await searchParams;
  const agent = agentOptions.some((option) => option.value === params.agent)
    ? (params.agent as RegistryAgent)
    : undefined;
  const safety = safetyOptions.some((option) => option.value === params.safety)
    ? (params.safety as RegistrySafetyStatus)
    : undefined;
  const results = searchRegistry({
    q: params.q,
    category: params.category,
    agent,
    safety,
    limit: 50,
  });

  return (
    <main>
      <header className="page-head registry-head">
        <span className="eyebrow"><PackageCheck size={14} /> SkillHydra Registry</span>
        <h1>Discover skills with the trust boundary attached.</h1>
        <p>
          Search portable skills and packs by capability, target agent and review status. A verified publisher is not the same thing as reviewed code, and discovery never grants permission to install or execute anything.
        </p>
      </header>

      <section className="registry-toolbar panel" aria-label="Registry filters">
        <form method="get" className="registry-filter-form">
          <label className="registry-search-field">
            <span>Search</span>
            <div className="registry-input-with-icon">
              <Search size={16} />
              <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="code review, frontend, policy…" maxLength={200} />
            </div>
          </label>
          <label>
            <span>Category</span>
            <select className="input" name="category" defaultValue={params.category ?? ""}>
              <option value="">All categories</option>
              {listRegistryCategories().map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span>Agent</span>
            <select className="input" name="agent" defaultValue={agent ?? ""}>
              <option value="">All agents</option>
              {agentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Safety</span>
            <select className="input" name="safety" defaultValue={safety ?? ""}>
              <option value="">Any review state</option>
              {safetyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className="btn btn-primary registry-submit" type="submit">Search</button>
        </form>
      </section>

      <section className="section">
        <div className="registry-results-head">
          <div>
            <span className="eyebrow">Catalog</span>
            <h2>{results.length} result{results.length === 1 ? "" : "s"}</h2>
          </div>
          <p>Search is deterministic and read-only. Install plans are generated only on the listing page and always stop for approval before a write or execution step.</p>
        </div>

        {results.length === 0 ? (
          <div className="panel empty-state">
            <h3>No registry entries match those filters.</h3>
            <p>Try a broader capability search or remove one of the category, agent or safety filters.</p>
            <Link className="btn" href="/registry">Clear filters</Link>
          </div>
        ) : (
          <div className="registry-grid">
            {results.map(({ entry, score }) => (
              <article className="registry-card" key={entry.id}>
                <div className="registry-card-top">
                  <div>
                    <div className="registry-kicker">{entry.kind} · {entry.category}</div>
                    <h3>{entry.name}</h3>
                  </div>
                  <span className={`trust-badge trust-${entry.security.status}`}>
                    {safetyIcon(entry.security.status)} {entry.security.status}
                  </span>
                </div>
                <p className="registry-tagline">{entry.tagline}</p>
                <div className="registry-meta-row">
                  <span>{entry.publisher.identityVerified ? "✓ identity verified" : "identity unverified"}</span>
                  <span><GitBranch size={13} /> {entry.source.immutable ? "immutable source" : "floating source"}</span>
                  {score > 0 ? <span>match {score}</span> : null}
                </div>
                <div className="chips">
                  {entry.tags.slice(0, 5).map((tag) => <span className="chip" key={tag}>{tag}</span>)}
                </div>
                <div className="registry-card-footer">
                  <span>{entry.compatibility.length - (entry.compatibility.includes("universal") ? 1 : 0)} target agents</span>
                  <Link className="btn" href={`/registry/${entry.id}`}>Review listing</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

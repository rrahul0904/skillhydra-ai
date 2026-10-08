"use client";

import { useState } from "react";
import styles from "./registry-inspector.module.css";

type SubmissionResponse = {
  data: {
    id: string;
    name: string;
    status: "pending" | "approved" | "rejected";
    claimRequested: boolean;
    claimState: "unverified" | "verified";
    repository: string;
    resolvedCommit: string;
    sourceDigest: string;
    scanStatus: "pass" | "warning" | "blocked";
    riskScore: number;
    createdAt: string;
  };
  meta: {
    durability: "memory" | "postgres";
    claimIsVerified: boolean;
    note: string;
  };
};

export function RegistrySubmission() {
  const [repository, setRepository] = useState("https://github.com/anthropics/skills");
  const [ref, setRef] = useState("main");
  const [path, setPath] = useState("skills/frontend-design");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [publisherName, setPublisherName] = useState("");
  const [claimRequested, setClaimRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResponse | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/registry/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository,
          ref: ref || undefined,
          path: path || undefined,
          name: name || undefined,
          description: description || undefined,
          publisherName: publisherName || undefined,
          claimRequested,
        }),
      });
      const payload = await response.json() as SubmissionResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || `submission failed with ${response.status}`);
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "submission failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className="panel">
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.formGrid}>
            <label>
              <span>Public GitHub repository</span>
              <input className="input" type="url" required value={repository} onChange={(event) => setRepository(event.target.value)} />
            </label>
            <label>
              <span>Ref</span>
              <input className="input" value={ref} onChange={(event) => setRef(event.target.value)} maxLength={200} />
            </label>
            <label>
              <span>Repository path</span>
              <input className="input" value={path} onChange={(event) => setPath(event.target.value)} maxLength={300} />
            </label>
          </div>
          <div className={styles.formGrid}>
            <label>
              <span>Listing name (optional)</span>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Uses SKILL.md name when blank" />
            </label>
            <label>
              <span>Publisher display name</span>
              <input className="input" value={publisherName} onChange={(event) => setPublisherName(event.target.value)} maxLength={120} placeholder="Unverified until auth proves ownership" />
            </label>
            <label>
              <span>Claim intent</span>
              <select className="input" value={claimRequested ? "yes" : "no"} onChange={(event) => setClaimRequested(event.target.value === "yes")}>
                <option value="no">Submit without ownership claim</option>
                <option value="yes">Request ownership claim review</option>
              </select>
            </label>
          </div>
          <label>
            <span>Description override (optional)</span>
            <textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="Uses SKILL.md description when blank" />
          </label>
          <div className={styles.actions}>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Pinning + scanning + submitting…" : "Submit for registry review"}</button>
            <p className={styles.note}>Submission never proves ownership. A claim remains unverified until a future authenticated ownership check succeeds.</p>
          </div>
        </form>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </section>

      {result ? (
        <section className="panel">
          <div className={styles.section}>
            <div>
              <span className="eyebrow">Submission receipt</span>
              <h2>{result.data.name}</h2>
            </div>
            <div className={styles.summaryGrid}>
              <div className={styles.fact}><span>Submission ID</span><code>{result.data.id}</code></div>
              <div className={styles.fact}><span>Moderation</span><strong>{result.data.status}</strong></div>
              <div className={styles.fact}><span>Claim state</span><strong>{result.data.claimRequested ? result.data.claimState : "not requested"}</strong></div>
              <div className={styles.fact}><span>Storage</span><strong>{result.meta.durability}</strong></div>
            </div>
            <div className={styles.summaryGrid}>
              <div className={styles.fact}><span>Static scan</span><strong>{result.data.scanStatus} · {result.data.riskScore}/100</strong></div>
              <div className={styles.fact}><span>Immutable commit</span><code>{result.data.resolvedCommit}</code></div>
              <div className={styles.fact}><span>Source digest</span><code>{result.data.sourceDigest}</code></div>
              <div className={styles.fact}><span>Created</span><strong>{new Date(result.data.createdAt).toLocaleString()}</strong></div>
            </div>
            <p className={styles.note}>{result.meta.note}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

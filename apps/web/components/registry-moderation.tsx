"use client";

import { useState } from "react";
import styles from "./registry-inspector.module.css";

type Submission = {
  id: string;
  name: string;
  repository: string;
  resolvedCommit: string;
  sourceDigest: string;
  scanStatus: string;
  riskScore: number;
  publisherName: string | null;
  claimRequested: boolean;
  claimState: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export function RegistryModeration() {
  const [token, setToken] = useState("");
  const [records, setRecords] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/registry/admin/submissions?status=pending", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json() as { data?: Submission[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || `request failed with ${response.status}`);
      setRecords(payload.data);
    } catch (cause) {
      setRecords([]);
      setError(cause instanceof Error ? cause.message : "moderation request failed");
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, status: "approved" | "rejected") {
    setError(null);
    const response = await fetch("/api/registry/admin/submissions", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setError(payload.error || `request failed with ${response.status}`);
      return;
    }
    setRecords((current) => current.filter((record) => record.id !== id));
  }

  return (
    <div className={styles.shell}>
      <section className="panel">
        <div className={styles.form}>
          <label>
            <span>Registry admin token</span>
            <input className="input" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" placeholder="REGISTRY_ADMIN_TOKEN" />
          </label>
          <div className={styles.actions}>
            <button className="btn btn-primary" type="button" disabled={loading || token.length < 1} onClick={load}>{loading ? "Loading…" : "Load pending submissions"}</button>
            <p className={styles.note}>The token stays in this browser state and is sent only in the Authorization header. No insecure admin fallback is enabled when the server secret is missing.</p>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </section>
      {records.length ? records.map((record) => (
        <article className="panel" key={record.id}>
          <div className={styles.section}>
            <div><span className="eyebrow">Pending submission</span><h2>{record.name}</h2></div>
            <div className={styles.summaryGrid}>
              <div className={styles.fact}><span>Static scan</span><strong>{record.scanStatus} · {record.riskScore}/100</strong></div>
              <div className={styles.fact}><span>Publisher claim</span><strong>{record.claimRequested ? record.claimState : "not requested"}</strong></div>
              <div className={styles.fact}><span>Commit</span><code>{record.resolvedCommit}</code></div>
              <div className={styles.fact}><span>Digest</span><code>{record.sourceDigest}</code></div>
            </div>
            <p className={styles.note}>{record.repository} · {record.publisherName || "publisher not supplied"}</p>
            <div className={styles.actions}>
              <button className="btn btn-primary" type="button" onClick={() => decide(record.id, "approved")}>Approve listing</button>
              <button className="btn" type="button" onClick={() => decide(record.id, "rejected")}>Reject listing</button>
            </div>
          </div>
        </article>
      )) : <section className="panel"><p className={styles.note}>No pending submissions are loaded.</p></section>}
    </div>
  );
}

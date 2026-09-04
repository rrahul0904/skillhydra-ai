"use client";

import { useState } from "react";
import { ArrowUp, Check, LoaderCircle, PackageSearch, ShieldCheck, Sparkles } from "lucide-react";
import type { AgentRun, SkillBundle } from "@skillhydra/core";

type ResolveResponse = {
  requestedSource: string;
  normalizedSource: string;
  bundle: SkillBundle;
  warnings: string[];
};

type ChatMessage = { role: "user" | "agent"; text: string };

export function TalkToSkill() {
  const [source, setSource] = useState("tank:@uriva/p2b-coder");
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", text: "Resolve a skill on the left, then ask me to inspect code, implement a change, run tests, or deploy." },
  ]);
  const [message, setMessage] = useState("Inspect the repository and tell me what you find.");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [busy, setBusy] = useState(false);

  async function resolve() {
    setBusy(true);
    try {
      const response = await fetch("/api/skills/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to resolve skill");
      setResolved(data);
      setRun(null);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!resolved || !message.trim() || busy) return;
    const outgoing = message.trim();
    setMessages((items) => [...items, { role: "user", text: outgoing }]);
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: outgoing, source: resolved.requestedSource }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Agent run failed");
      setRun(data.run);
      setMessages((items) => [...items, { role: "agent", text: data.run.response }]);
    } catch (error) {
      setMessages((items) => [...items, { role: "agent", text: error instanceof Error ? error.message : "Agent run failed" }]);
    } finally {
      setBusy(false);
    }
  }

  const skill = resolved?.bundle.manifest;

  return (
    <div className="launcher">
      <aside className="panel">
        <div className="panel-title"><PackageSearch size={17}/> Resolve skill</div>
        <div className="panel-sub">Tank, GitHub or packaged skill source</div>
        <div className="input-row">
          <input className="input" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Skill source" />
          <button className="btn btn-primary" onClick={resolve} disabled={busy}>
            {busy ? <LoaderCircle size={16}/> : <Sparkles size={16}/>} Resolve
          </button>
        </div>

        {skill && (
          <div className="skill-card">
            <div className="skill-top">
              <div>
                <div className="skill-name">{skill.displayName}</div>
                <div className="panel-sub">{skill.name} · v{skill.version}</div>
              </div>
              <span className="badge"><ShieldCheck size={12}/> scanned</span>
            </div>
            <p className="panel-sub" style={{lineHeight:1.55}}>{skill.description}</p>
            <div className="chips">
              {skill.tools.map((tool) => <span className="chip" key={tool}>{tool}</span>)}
            </div>
            <div className="chips">
              {skill.permissions.subprocess && <span className="chip">subprocess</span>}
              {skill.permissions.browser && <span className="chip">browser</span>}
              {skill.permissions.deploy && <span className="chip">deploy</span>}
              <span className="chip">{skill.permissions.network.length} network hosts</span>
            </div>
            {resolved.warnings.map((warning) => <div className="warning" key={warning}>{warning}</div>)}
            <div className="panel-sub" style={{marginTop:12}}>SHA-256 {resolved.bundle.checksum.slice(0, 18)}…</div>
          </div>
        )}
      </aside>

      <section className="panel chat">
        <div className="chat-header">
          <div>
            <div className="panel-title">Hydrated specialist</div>
            <div className="panel-sub">Model → policy → tool → sandbox</div>
          </div>
          <div className="status"><span className="status-dot"/> demo runtime</div>
        </div>

        <div className="messages">
          {messages.map((item, index) => (
            <div className={`message ${item.role === "user" ? "message-user" : "message-agent"}`} key={`${item.role}-${index}`}>{item.text}</div>
          ))}
        </div>

        {run && (
          <div className="timeline">
            <div className="timeline-title">Run timeline · {run.status.replaceAll("_", " ")}</div>
            {run.steps.map((step) => (
              <div className={`step ${step.status === "pending" ? "step-pending" : ""}`} key={step.id}>
                <span className="step-icon">{step.status === "completed" ? <Check size={10}/> : "!"}</span>
                <div className="step-main">{step.title}<div className="step-detail">{step.detail}</div></div>
              </div>
            ))}
          </div>
        )}

        <div className="composer">
          <textarea className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={resolved ? "Ask the specialist…" : "Resolve a skill first…"} disabled={!resolved || busy} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button className="btn btn-primary" onClick={send} disabled={!resolved || busy} aria-label="Send message"><ArrowUp size={17}/></button>
        </div>
      </section>
    </div>
  );
}

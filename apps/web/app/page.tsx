import Link from "next/link";
import { ArrowRight, Boxes, KeyRound, ShieldCheck, Sparkles, TerminalSquare, Workflow } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Policy before execution", text: "Every tool call is checked against the hydrated skill manifest and risk policy before it can run." },
  { icon: TerminalSquare, title: "Isolated execution", text: "Shell, filesystem and browser work belong in disposable sandboxes instead of the agent control plane." },
  { icon: KeyRound, title: "Secret-aware by design", text: "The architecture keeps credentials out of model-visible context and associates access with explicit destinations." },
  { icon: Boxes, title: "Portable specialist skills", text: "Package instructions, tools and permissions into versionable skills that can hydrate focused agents on demand." },
  { icon: Workflow, title: "Auditable run timeline", text: "Model decisions, policy checks, tool calls and approvals are first-class run steps rather than hidden side effects." },
  { icon: Sparkles, title: "Demo works without keys", text: "A deterministic local model and mock sandbox make the entire flow testable before connecting paid infrastructure." },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Skill → specialist agent</span>
          <h1>Hydrate skills into secure, executable agents.</h1>
          <p>
            SkillHydra is a clean-room implementation of the portable-skill agent pattern: resolve a skill, inspect its capabilities, create a constrained specialist, and execute tools through policy-governed runtimes.
          </p>
          <div className="actions">
            <Link href="/talk-to-skill" className="btn btn-primary">Launch a skill <ArrowRight size={16} /></Link>
            <Link href="/architecture" className="btn">View architecture</Link>
          </div>
        </div>
        <div className="hero-card" aria-label="agent runtime example">
          <div className="codebar"><span className="dot"/><span className="dot"/><span className="dot"/></div>
          <div className="terminal">
            <div><span className="accent">$</span> resolve tank:@uriva/p2b-coder</div>
            <div>↳ normalized to clean-room coder profile</div>
            <div>↳ permissions: fs, subprocess, browser, deploy</div>
            <br />
            <div><span className="accent">agent</span> inspect this repository and run tests</div>
            <div>✓ policy: shell.exec → allow</div>
            <div>✓ sandbox: isolated execution</div>
            <div>✓ run: completed + auditable</div>
            <br />
            <div><span className="accent">agent</span> deploy this to production</div>
            <div>⏸ policy: approval_required</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div><span className="eyebrow">Core system</span><h2 style={{marginTop:14}}>Built around the control boundary.</h2></div>
          <p>The agent loop stays small. Security, permissions, execution, identity, observability and cost controls live around it as independent platform services.</p>
        </div>
        <div className="grid-3">
          {features.map(({icon: Icon, title, text}) => (
            <article className="feature" key={title}>
              <div className="feature-icon"><Icon size={19}/></div>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

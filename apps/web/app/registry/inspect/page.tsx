import Link from "next/link";
import { ArrowLeft, GitBranch, ShieldCheck } from "lucide-react";
import { RegistryInspector } from "../../../components/registry-inspector";

export default function RegistryInspectPage() {
  return (
    <main>
      <header className="page-head registry-detail-head">
        <Link className="registry-back" href="/registry"><ArrowLeft size={15} /> Registry</Link>
        <span className="eyebrow"><GitBranch size={14} /> Public GitHub inspection</span>
        <h1>Resolve the source before you trust the skill.</h1>
        <p>
          Pin a public GitHub skill to an immutable commit, read a bounded set of text files, parse its manifest, compute a source digest and run static risk rules before an installation plan is even eligible for approval.
        </p>
        <div className="warning"><ShieldCheck size={14} /> A clean static result is evidence, not a security certification.</div>
      </header>
      <RegistryInspector />
    </main>
  );
}

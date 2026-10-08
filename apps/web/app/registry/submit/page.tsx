import Link from "next/link";
import { ArrowLeft, ShieldCheck, UploadCloud } from "lucide-react";
import { RegistrySubmission } from "../../../components/registry-submission";

export default function RegistrySubmitPage() {
  return (
    <main>
      <header className="page-head registry-detail-head">
        <Link className="registry-back" href="/registry"><ArrowLeft size={15} /> Registry</Link>
        <span className="eyebrow"><UploadCloud size={14} /> Publisher submission</span>
        <h1>Submit pinned evidence, not an unreviewed URL.</h1>
        <p>
          Every submission is resolved to an immutable commit and statically inspected before entering the moderation queue. Requesting a claim records intent only; it does not grant a verified-publisher badge.
        </p>
        <div className="warning"><ShieldCheck size={14} /> Identity verification and code/security review remain separate states.</div>
      </header>
      <RegistrySubmission />
    </main>
  );
}

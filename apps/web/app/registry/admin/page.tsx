import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { RegistryModeration } from "../../../components/registry-moderation";

export default function RegistryAdminPage() {
  return (
    <main>
      <header className="page-head registry-detail-head">
        <Link className="registry-back" href="/registry"><ArrowLeft size={15} /> Registry</Link>
        <span className="eyebrow"><Shield size={14} /> Moderation</span>
        <h1>Review pinned submissions before publishing.</h1>
        <p>Moderation requires the server-side REGISTRY_ADMIN_TOKEN. Approval changes listing moderation state only; it does not verify publisher ownership or turn a static scan into a security certification.</p>
      </header>
      <RegistryModeration />
    </main>
  );
}

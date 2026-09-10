import { getControlPlaneStore } from "@skillhydra/db";
import { getPrincipal, jsonError } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = getPrincipal(request);
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    if (!organizationId) return Response.json({ error: "organizationId is required" }, { status: 400 });

    const store = getControlPlaneStore();
    await requireOrganizationRole(store, organizationId, principal.userId, "admin");
    return Response.json({ events: await store.listAuditEvents(organizationId, limit) });
  } catch (error) {
    return jsonError(error);
  }
}

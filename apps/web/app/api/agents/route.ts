import { getControlPlaneStore } from "@skillhydra/db";
import { getPrincipal, jsonError } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = getPrincipal(request);
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return Response.json({ error: "organizationId is required" }, { status: 400 });

    const store = getControlPlaneStore();
    await requireOrganizationRole(store, organizationId, principal.userId, "viewer");
    return Response.json({ agents: await store.listAgents(organizationId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = getPrincipal(request);
    const body = await request.json() as { organizationId?: string; name?: string };
    if (!body.organizationId || !body.name?.trim()) {
      return Response.json({ error: "organizationId and name are required" }, { status: 400 });
    }

    const store = getControlPlaneStore();
    await requireOrganizationRole(store, body.organizationId, principal.userId, "member");
    const agent = await store.createAgent({ organizationId: body.organizationId, name: body.name.trim() });
    await store.appendAuditEvent({
      organizationId: body.organizationId,
      actorId: principal.userId,
      action: "agent.create",
      resourceType: "agent",
      resourceId: agent.id,
      metadata: { name: agent.name },
    });
    return Response.json({ agent }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

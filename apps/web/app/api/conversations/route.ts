import { getControlPlaneStore } from "@skillhydra/db";
import { getPrincipal, jsonError } from "../../../lib/auth";
import { organizationForAgent, requireOrganizationRole } from "../../../lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = getPrincipal(request);
    const agentId = new URL(request.url).searchParams.get("agentId");
    if (!agentId) return Response.json({ error: "agentId is required" }, { status: 400 });

    const store = getControlPlaneStore();
    const { organizationId } = await organizationForAgent(store, agentId);
    await requireOrganizationRole(store, organizationId, principal.userId, "viewer");
    return Response.json({ conversations: await store.listConversations(agentId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = getPrincipal(request);
    const body = await request.json() as { agentId?: string };
    if (!body.agentId) return Response.json({ error: "agentId is required" }, { status: 400 });

    const store = getControlPlaneStore();
    const { organizationId } = await organizationForAgent(store, body.agentId);
    await requireOrganizationRole(store, organizationId, principal.userId, "member");
    const conversation = await store.createConversation({ agentId: body.agentId, externalChannel: "web" });
    await store.appendAuditEvent({
      organizationId,
      actorId: principal.userId,
      action: "conversation.create",
      resourceType: "conversation",
      resourceId: conversation.id,
      metadata: { agentId: body.agentId },
    });
    return Response.json({ conversation }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

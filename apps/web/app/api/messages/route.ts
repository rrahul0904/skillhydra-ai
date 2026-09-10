import { getControlPlaneStore } from "@skillhydra/db";
import { getPrincipal, jsonError } from "../../../lib/auth";
import { organizationForConversation, requireOrganizationRole } from "../../../lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = getPrincipal(request);
    const conversationId = new URL(request.url).searchParams.get("conversationId");
    if (!conversationId) return Response.json({ error: "conversationId is required" }, { status: 400 });

    const store = getControlPlaneStore();
    const { organizationId } = await organizationForConversation(store, conversationId);
    await requireOrganizationRole(store, organizationId, principal.userId, "viewer");
    return Response.json({ messages: await store.listMessages(conversationId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = getPrincipal(request);
    const body = await request.json() as { conversationId?: string; role?: string; content?: unknown };
    if (!body.conversationId || !body.role) return Response.json({ error: "conversationId and role are required" }, { status: 400 });

    const store = getControlPlaneStore();
    const { organizationId } = await organizationForConversation(store, body.conversationId);
    await requireOrganizationRole(store, organizationId, principal.userId, "member");
    const message = await store.createMessage({ conversationId: body.conversationId, role: body.role, content: body.content ?? "" });
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

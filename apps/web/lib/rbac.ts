import type { ControlPlaneStore, OrganizationRole } from "@skillhydra/db";

const rank: Record<OrganizationRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export async function requireOrganizationRole(
  store: ControlPlaneStore,
  organizationId: string,
  userId: string,
  minimum: OrganizationRole = "viewer",
) {
  const membership = await store.getOrganizationMember(organizationId, userId);
  if (!membership || rank[membership.role] < rank[minimum]) {
    throw new Error("FORBIDDEN: You do not have permission for this organization");
  }
  return membership;
}

export async function organizationForAgent(store: ControlPlaneStore, agentId: string) {
  const agent = await store.getAgent(agentId);
  if (!agent) throw new Error("NOT_FOUND: Agent not found");
  return { organizationId: agent.organizationId, agent };
}

export async function organizationForConversation(store: ControlPlaneStore, conversationId: string) {
  const conversation = await store.getConversation(conversationId);
  if (!conversation) throw new Error("NOT_FOUND: Conversation not found");
  const { organizationId, agent } = await organizationForAgent(store, conversation.agentId);
  return { organizationId, agent, conversation };
}

import test from "node:test";
import assert from "node:assert/strict";
import { MemoryControlPlaneStore } from "@skillhydra/db";

test("isolates organizations, agents and runs by membership boundary", async () => {
  const store = new MemoryControlPlaneStore();
  const userA = "00000000-0000-4000-8000-00000000000a";
  const userB = "00000000-0000-4000-8000-00000000000b";

  const orgA = await store.createOrganization({ name: "A", ownerUserId: userA });
  const orgB = await store.createOrganization({ name: "B", ownerUserId: userB });
  const agentA = await store.createAgent({ organizationId: orgA.id, name: "Agent A" });
  const agentB = await store.createAgent({ organizationId: orgB.id, name: "Agent B" });

  const conversationA = await store.createConversation({ agentId: agentA.id });
  const conversationB = await store.createConversation({ agentId: agentB.id });
  await store.createRun({ conversationId: conversationA.id, status: "completed" });
  await store.createRun({ conversationId: conversationB.id, status: "failed" });

  assert.equal((await store.listOrganizationsForUser(userA)).length, 1);
  assert.equal((await store.listOrganizationsForUser(userA))[0].id, orgA.id);
  assert.equal((await store.listAgents(orgA.id)).length, 1);
  assert.equal((await store.listRunsForOrganization(orgA.id)).length, 1);
  assert.equal((await store.listRunsForOrganization(orgA.id))[0].status, "completed");
});

test("persists messages, run steps and approval state", async () => {
  const store = new MemoryControlPlaneStore();
  const userId = "00000000-0000-4000-8000-000000000001";
  const org = await store.createOrganization({ name: "SkillHydra", ownerUserId: userId });
  const agent = await store.createAgent({ organizationId: org.id, name: "Coder" });
  const conversation = await store.createConversation({ agentId: agent.id });

  await store.createMessage({ conversationId: conversation.id, role: "user", content: "deploy" });
  const run = await store.createRun({ conversationId: conversation.id, status: "waiting_approval", model: "demo" });
  await store.createRunStep({ runId: run.id, kind: "policy", status: "completed", payload: { decision: "approval_required" } });
  const approval = await store.createApproval({ runId: run.id, toolName: "deploy.preview", request: { target: "preview" } });

  assert.equal((await store.listMessages(conversation.id)).length, 1);
  assert.equal((await store.listApprovalsForOrganization(org.id, "pending")).length, 1);

  const decided = await store.decideApproval(approval.id, "approved", userId);
  assert.equal(decided?.status, "approved");
  assert.equal((await store.listApprovalsForOrganization(org.id, "pending")).length, 0);
  assert.equal((await store.listApprovalsForOrganization(org.id, "approved")).length, 1);

  const secondDecision = await store.decideApproval(approval.id, "rejected", userId);
  assert.equal(secondDecision, null);
});

test("records organization-scoped audit history", async () => {
  const store = new MemoryControlPlaneStore();
  const userId = "00000000-0000-4000-8000-000000000001";
  const org = await store.createOrganization({ name: "Audit", ownerUserId: userId });

  await store.appendAuditEvent({
    organizationId: org.id,
    actorId: userId,
    action: "agent.create",
    resourceType: "agent",
    resourceId: "agent-1",
    metadata: { source: "test" },
  });

  const events = await store.listAuditEvents(org.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "agent.create");
});

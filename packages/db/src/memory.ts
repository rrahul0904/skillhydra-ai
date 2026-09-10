import { randomUUID } from "node:crypto";
import type {
  AgentRecord,
  AppendAuditEventInput,
  ApprovalRecord,
  AuditEventRecord,
  ControlPlaneStore,
  ConversationRecord,
  CreateAgentInput,
  CreateApprovalInput,
  CreateConversationInput,
  CreateMessageInput,
  CreateOrganizationInput,
  CreateRunInput,
  CreateRunStepInput,
  MessageRecord,
  OrganizationMemberRecord,
  OrganizationRecord,
  StoredRun,
  StoredRunStep,
} from "./types.ts";

function now() { return new Date().toISOString(); }
function id() { return randomUUID(); }

export class MemoryControlPlaneStore implements ControlPlaneStore {
  private organizations: OrganizationRecord[] = [];
  private members: OrganizationMemberRecord[] = [];
  private agents: AgentRecord[] = [];
  private conversations: ConversationRecord[] = [];
  private messages: MessageRecord[] = [];
  private runs: StoredRun[] = [];
  private runSteps: StoredRunStep[] = [];
  private approvals: ApprovalRecord[] = [];
  private audit: AuditEventRecord[] = [];

  async createOrganization(input: CreateOrganizationInput) {
    const organization = { id: id(), name: input.name, createdAt: now() };
    this.organizations.push(organization);
    this.members.push({ organizationId: organization.id, userId: input.ownerUserId, role: "owner", createdAt: now() });
    return organization;
  }

  async listOrganizationsForUser(userId: string) {
    return this.members.filter((m) => m.userId === userId).flatMap((m) => {
      const org = this.organizations.find((o) => o.id === m.organizationId);
      return org ? [{ ...org, role: m.role }] : [];
    });
  }

  async getOrganizationMember(organizationId: string, userId: string) {
    return this.members.find((m) => m.organizationId === organizationId && m.userId === userId) ?? null;
  }

  async createAgent(input: CreateAgentInput) {
    const agent = { id: id(), organizationId: input.organizationId, name: input.name, status: "active", createdAt: now() };
    this.agents.push(agent);
    return agent;
  }

  async listAgents(organizationId: string) {
    return this.agents.filter((a) => a.organizationId === organizationId);
  }

  async getAgent(agentId: string) {
    return this.agents.find((a) => a.id === agentId) ?? null;
  }

  async createConversation(input: CreateConversationInput) {
    const conversation = {
      id: id(),
      agentId: input.agentId,
      externalChannel: input.externalChannel ?? null,
      externalConversationId: input.externalConversationId ?? null,
      createdAt: now(),
    };
    this.conversations.push(conversation);
    return conversation;
  }

  async listConversations(agentId: string) {
    return this.conversations.filter((c) => c.agentId === agentId);
  }

  async getConversation(conversationId: string) {
    return this.conversations.find((c) => c.id === conversationId) ?? null;
  }

  async createMessage(input: CreateMessageInput) {
    const message = { id: id(), conversationId: input.conversationId, role: input.role, content: input.content, createdAt: now() };
    this.messages.push(message);
    return message;
  }

  async listMessages(conversationId: string) {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }

  async createRun(input: CreateRunInput) {
    const run: StoredRun = {
      id: input.id ?? id(),
      conversationId: input.conversationId ?? null,
      status: input.status,
      model: input.model ?? null,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      estimatedCostUsd: input.estimatedCostUsd ?? 0,
      createdAt: now(),
      completedAt: input.completedAt ?? null,
    };
    this.runs.push(run);
    return run;
  }

  async createRunStep(input: CreateRunStepInput) {
    const step = { id: input.id ?? id(), runId: input.runId, kind: input.kind, status: input.status, payload: input.payload ?? {}, createdAt: now() };
    this.runSteps.push(step);
    return step;
  }

  async listRunsForOrganization(organizationId: string, limit = 50) {
    const agentIds = new Set(this.agents.filter((a) => a.organizationId === organizationId).map((a) => a.id));
    const conversationIds = new Set(this.conversations.filter((c) => agentIds.has(c.agentId)).map((c) => c.id));
    return this.runs.filter((r) => r.conversationId && conversationIds.has(r.conversationId)).slice(-limit).reverse();
  }

  async createApproval(input: CreateApprovalInput) {
    const approval: ApprovalRecord = {
      id: input.id ?? id(),
      runId: input.runId,
      toolName: input.toolName,
      request: input.request,
      status: "pending",
      decidedBy: null,
      decidedAt: null,
      createdAt: now(),
    };
    this.approvals.push(approval);
    return approval;
  }

  async listApprovalsForOrganization(organizationId: string, status?: ApprovalRecord["status"]) {
    const runs = await this.listRunsForOrganization(organizationId, Number.MAX_SAFE_INTEGER);
    const runIds = new Set(runs.map((r) => r.id));
    return this.approvals.filter((a) => runIds.has(a.runId) && (!status || a.status === status));
  }

  async decideApproval(approvalId: string, status: "approved" | "rejected", decidedBy: string) {
    const approval = this.approvals.find((a) => a.id === approvalId);
    if (!approval || approval.status !== "pending") return null;
    approval.status = status;
    approval.decidedBy = decidedBy;
    approval.decidedAt = now();
    return { ...approval };
  }

  async appendAuditEvent(input: AppendAuditEventInput) {
    const event: AuditEventRecord = {
      id: String(this.audit.length + 1),
      organizationId: input.organizationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    this.audit.push(event);
    return event;
  }

  async listAuditEvents(organizationId: string, limit = 100) {
    return this.audit.filter((e) => e.organizationId === organizationId).slice(-limit).reverse();
  }
}

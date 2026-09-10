export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

export interface OrganizationRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface OrganizationMemberRecord {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
}

export interface AgentRecord {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  agentId: string;
  externalChannel: string | null;
  externalConversationId: string | null;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: string;
  content: unknown;
  createdAt: string;
}

export interface StoredRun {
  id: string;
  conversationId: string | null;
  status: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
  completedAt: string | null;
}

export interface StoredRunStep {
  id: string;
  runId: string;
  kind: string;
  status: string;
  payload: unknown;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  runId: string;
  toolName: string;
  request: unknown;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface CreateOrganizationInput {
  name: string;
  ownerUserId: string;
}

export interface CreateAgentInput {
  organizationId: string;
  name: string;
}

export interface CreateConversationInput {
  agentId: string;
  externalChannel?: string | null;
  externalConversationId?: string | null;
}

export interface CreateMessageInput {
  conversationId: string;
  role: string;
  content: unknown;
}

export interface CreateRunInput {
  id?: string;
  conversationId?: string | null;
  status: string;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  completedAt?: string | null;
}

export interface CreateRunStepInput {
  id?: string;
  runId: string;
  kind: string;
  status: string;
  payload?: unknown;
}

export interface CreateApprovalInput {
  id?: string;
  runId: string;
  toolName: string;
  request: unknown;
}

export interface AppendAuditEventInput {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: unknown;
}

export interface ControlPlaneStore {
  createOrganization(input: CreateOrganizationInput): Promise<OrganizationRecord>;
  listOrganizationsForUser(userId: string): Promise<Array<OrganizationRecord & { role: OrganizationRole }>>;
  getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMemberRecord | null>;

  createAgent(input: CreateAgentInput): Promise<AgentRecord>;
  listAgents(organizationId: string): Promise<AgentRecord[]>;
  getAgent(agentId: string): Promise<AgentRecord | null>;

  createConversation(input: CreateConversationInput): Promise<ConversationRecord>;
  listConversations(agentId: string): Promise<ConversationRecord[]>;
  getConversation(conversationId: string): Promise<ConversationRecord | null>;

  createMessage(input: CreateMessageInput): Promise<MessageRecord>;
  listMessages(conversationId: string): Promise<MessageRecord[]>;

  createRun(input: CreateRunInput): Promise<StoredRun>;
  createRunStep(input: CreateRunStepInput): Promise<StoredRunStep>;
  listRunsForOrganization(organizationId: string, limit?: number): Promise<StoredRun[]>;

  createApproval(input: CreateApprovalInput): Promise<ApprovalRecord>;
  listApprovalsForOrganization(organizationId: string, status?: ApprovalRecord["status"]): Promise<ApprovalRecord[]>;
  decideApproval(id: string, status: "approved" | "rejected", decidedBy: string): Promise<ApprovalRecord | null>;

  appendAuditEvent(input: AppendAuditEventInput): Promise<AuditEventRecord>;
  listAuditEvents(organizationId: string, limit?: number): Promise<AuditEventRecord[]>;
}

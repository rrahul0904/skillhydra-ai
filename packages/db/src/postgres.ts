import pg from "pg";
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
  OrganizationRole,
  StoredRun,
  StoredRunStep,
} from "./types.ts";

const { Pool } = pg;

type Row = Record<string, unknown>;
function iso(value: unknown): string { return value instanceof Date ? value.toISOString() : String(value); }
function num(value: unknown): number { return Number(value ?? 0); }

function organization(row: Row): OrganizationRecord {
  return { id: String(row.id), name: String(row.name), createdAt: iso(row.created_at) };
}
function member(row: Row): OrganizationMemberRecord {
  return { organizationId: String(row.organization_id), userId: String(row.user_id), role: String(row.role) as OrganizationRole, createdAt: iso(row.created_at) };
}
function agent(row: Row): AgentRecord {
  return { id: String(row.id), organizationId: String(row.organization_id), name: String(row.name), status: String(row.status), createdAt: iso(row.created_at) };
}
function conversation(row: Row): ConversationRecord {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    externalChannel: row.external_channel == null ? null : String(row.external_channel),
    externalConversationId: row.external_conversation_id == null ? null : String(row.external_conversation_id),
    createdAt: iso(row.created_at),
  };
}
function message(row: Row): MessageRecord {
  return { id: String(row.id), conversationId: String(row.conversation_id), role: String(row.role), content: row.content, createdAt: iso(row.created_at) };
}
function run(row: Row): StoredRun {
  return {
    id: String(row.id), conversationId: row.conversation_id == null ? null : String(row.conversation_id),
    status: String(row.status), model: row.model == null ? null : String(row.model),
    inputTokens: num(row.input_tokens), outputTokens: num(row.output_tokens),
    estimatedCostUsd: num(row.estimated_cost_usd), createdAt: iso(row.created_at),
    completedAt: row.completed_at == null ? null : iso(row.completed_at),
  };
}
function approval(row: Row): ApprovalRecord {
  return {
    id: String(row.id), runId: String(row.run_id), toolName: String(row.tool_name), request: row.request,
    status: String(row.status) as ApprovalRecord["status"],
    decidedBy: row.decided_by == null ? null : String(row.decided_by),
    decidedAt: row.decided_at == null ? null : iso(row.decided_at), createdAt: iso(row.created_at),
  };
}
function auditEvent(row: Row): AuditEventRecord {
  return {
    id: String(row.id), organizationId: row.organization_id == null ? null : String(row.organization_id),
    actorId: row.actor_id == null ? null : String(row.actor_id), action: String(row.action),
    resourceType: String(row.resource_type), resourceId: row.resource_id == null ? null : String(row.resource_id),
    metadata: row.metadata, createdAt: iso(row.created_at),
  };
}

export class PostgresControlPlaneStore implements ControlPlaneStore {
  readonly pool: InstanceType<typeof Pool>;

  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL mode");
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  }

  async createOrganization(input: CreateOrganizationInput) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const created = await client.query("insert into organizations(name) values($1) returning *", [input.name]);
      const org = organization(created.rows[0]);
      await client.query("insert into organization_members(organization_id,user_id,role) values($1,$2,'owner')", [org.id, input.ownerUserId]);
      await client.query("commit");
      return org;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async listOrganizationsForUser(userId: string) {
    const result = await this.pool.query(`
      select o.*, m.role from organizations o
      join organization_members m on m.organization_id = o.id
      where m.user_id = $1 order by o.created_at asc`, [userId]);
    return result.rows.map((row) => ({ ...organization(row), role: String(row.role) as OrganizationRole }));
  }

  async getOrganizationMember(organizationId: string, userId: string) {
    const result = await this.pool.query("select * from organization_members where organization_id=$1 and user_id=$2", [organizationId, userId]);
    return result.rows[0] ? member(result.rows[0]) : null;
  }

  async createAgent(input: CreateAgentInput) {
    const result = await this.pool.query("insert into agents(organization_id,name) values($1,$2) returning *", [input.organizationId, input.name]);
    return agent(result.rows[0]);
  }

  async listAgents(organizationId: string) {
    const result = await this.pool.query("select * from agents where organization_id=$1 order by created_at desc", [organizationId]);
    return result.rows.map(agent);
  }

  async getAgent(agentId: string) {
    const result = await this.pool.query("select * from agents where id=$1", [agentId]);
    return result.rows[0] ? agent(result.rows[0]) : null;
  }

  async createConversation(input: CreateConversationInput) {
    const result = await this.pool.query(
      "insert into conversations(agent_id,external_channel,external_conversation_id) values($1,$2,$3) returning *",
      [input.agentId, input.externalChannel ?? null, input.externalConversationId ?? null],
    );
    return conversation(result.rows[0]);
  }

  async listConversations(agentId: string) {
    const result = await this.pool.query("select * from conversations where agent_id=$1 order by created_at desc", [agentId]);
    return result.rows.map(conversation);
  }

  async getConversation(conversationId: string) {
    const result = await this.pool.query("select * from conversations where id=$1", [conversationId]);
    return result.rows[0] ? conversation(result.rows[0]) : null;
  }

  async createMessage(input: CreateMessageInput) {
    const result = await this.pool.query("insert into messages(conversation_id,role,content) values($1,$2,$3::jsonb) returning *", [input.conversationId, input.role, JSON.stringify(input.content)]);
    return message(result.rows[0]);
  }

  async listMessages(conversationId: string) {
    const result = await this.pool.query("select * from messages where conversation_id=$1 order by created_at asc", [conversationId]);
    return result.rows.map(message);
  }

  async createRun(input: CreateRunInput) {
    const result = await this.pool.query(`
      insert into runs(id,conversation_id,status,model,input_tokens,output_tokens,estimated_cost_usd,completed_at)
      values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8) returning *`,
      [input.id ?? null, input.conversationId ?? null, input.status, input.model ?? null, input.inputTokens ?? 0, input.outputTokens ?? 0, input.estimatedCostUsd ?? 0, input.completedAt ?? null]);
    return run(result.rows[0]);
  }

  async createRunStep(input: CreateRunStepInput) {
    const result = await this.pool.query(`
      insert into run_steps(id,run_id,kind,status,payload)
      values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5::jsonb) returning *`,
      [input.id ?? null, input.runId, input.kind, input.status, JSON.stringify(input.payload ?? {})]);
    const row = result.rows[0];
    return { id:String(row.id), runId:String(row.run_id), kind:String(row.kind), status:String(row.status), payload:row.payload, createdAt:iso(row.created_at) };
  }

  async listRunsForOrganization(organizationId: string, limit = 50) {
    const result = await this.pool.query(`
      select r.* from runs r
      join conversations c on c.id=r.conversation_id
      join agents a on a.id=c.agent_id
      where a.organization_id=$1 order by r.created_at desc limit $2`, [organizationId, limit]);
    return result.rows.map(run);
  }

  async createApproval(input: CreateApprovalInput) {
    const result = await this.pool.query(`
      insert into approvals(id,run_id,tool_name,request)
      values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4::jsonb) returning *`,
      [input.id ?? null, input.runId, input.toolName, JSON.stringify(input.request)]);
    return approval(result.rows[0]);
  }

  async listApprovalsForOrganization(organizationId: string, status?: ApprovalRecord["status"]) {
    const values: unknown[] = [organizationId];
    let where = "a.organization_id=$1";
    if (status) { values.push(status); where += " and ap.status=$2"; }
    const result = await this.pool.query(`
      select ap.* from approvals ap
      join runs r on r.id=ap.run_id
      join conversations c on c.id=r.conversation_id
      join agents a on a.id=c.agent_id
      where ${where} order by ap.created_at desc`, values);
    return result.rows.map(approval);
  }

  async decideApproval(id: string, status: "approved" | "rejected", decidedBy: string) {
    const result = await this.pool.query(`
      update approvals set status=$2,decided_by=$3,decided_at=now()
      where id=$1 and status='pending' returning *`, [id, status, decidedBy]);
    return result.rows[0] ? approval(result.rows[0]) : null;
  }

  async appendAuditEvent(input: AppendAuditEventInput) {
    const result = await this.pool.query(`
      insert into audit_events(organization_id,actor_id,action,resource_type,resource_id,metadata)
      values($1,$2,$3,$4,$5,$6::jsonb) returning *`,
      [input.organizationId ?? null, input.actorId ?? null, input.action, input.resourceType, input.resourceId ?? null, JSON.stringify(input.metadata ?? {})]);
    return auditEvent(result.rows[0]);
  }

  async listAuditEvents(organizationId: string, limit = 100) {
    const result = await this.pool.query("select * from audit_events where organization_id=$1 order by created_at desc limit $2", [organizationId, limit]);
    return result.rows.map(auditEvent);
  }
}

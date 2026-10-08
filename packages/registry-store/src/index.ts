import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

export type RegistrySubmissionStatus = "pending" | "approved" | "rejected";
export type RegistryClaimState = "unverified" | "verified";
export type RegistryStoreMode = "memory" | "postgres";

export interface CreateRegistrySubmissionInput {
  name: string;
  description?: string | null;
  repository: string;
  requestedRef: string;
  requestedPath?: string | null;
  resolvedCommit: string;
  sourceDigest: string;
  scanStatus: "pass" | "warning" | "blocked";
  riskScore: number;
  publisherName?: string | null;
  claimRequested?: boolean;
}

export interface RegistrySubmissionRecord extends CreateRegistrySubmissionInput {
  id: string;
  status: RegistrySubmissionStatus;
  claimState: RegistryClaimState;
  claimRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrySubmissionStore {
  readonly mode: RegistryStoreMode;
  create(input: CreateRegistrySubmissionInput): Promise<RegistrySubmissionRecord>;
  get(id: string): Promise<RegistrySubmissionRecord | null>;
  list(status?: RegistrySubmissionStatus, limit?: number): Promise<RegistrySubmissionRecord[]>;
  setStatus(id: string, status: RegistrySubmissionStatus): Promise<RegistrySubmissionRecord | null>;
}

function clone(record: RegistrySubmissionRecord): RegistrySubmissionRecord {
  return { ...record };
}

function validate(input: CreateRegistrySubmissionInput): CreateRegistrySubmissionInput {
  const name = input.name.trim();
  if (!name || name.length > 120) throw new Error("submission name must be 1-120 characters");
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)) throw new Error("submission repository must be canonical public GitHub URL");
  if (!/^[0-9a-f]{40}$/i.test(input.resolvedCommit)) throw new Error("submission requires an immutable 40-character commit SHA");
  if (!/^[0-9a-f]{64}$/i.test(input.sourceDigest)) throw new Error("submission requires a 64-character source digest");
  if (!Number.isInteger(input.riskScore) || input.riskScore < 0 || input.riskScore > 100) throw new Error("risk score must be an integer from 0 to 100");
  return {
    ...input,
    name,
    description: input.description?.trim().slice(0, 2000) || null,
    publisherName: input.publisherName?.trim().slice(0, 120) || null,
    requestedPath: input.requestedPath?.trim().slice(0, 300) || null,
    claimRequested: Boolean(input.claimRequested),
  };
}

export class MemoryRegistrySubmissionStore implements RegistrySubmissionStore {
  readonly mode = "memory" as const;
  private readonly records = new Map<string, RegistrySubmissionRecord>();

  async create(raw: CreateRegistrySubmissionInput): Promise<RegistrySubmissionRecord> {
    const input = validate(raw);
    const now = new Date().toISOString();
    const record: RegistrySubmissionRecord = {
      ...input,
      id: `sub_${randomUUID()}`,
      status: "pending",
      claimState: "unverified",
      claimRequested: Boolean(input.claimRequested),
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(record.id, record);
    return clone(record);
  }

  async get(id: string): Promise<RegistrySubmissionRecord | null> {
    const record = this.records.get(id);
    return record ? clone(record) : null;
  }

  async list(status?: RegistrySubmissionStatus, limit = 100): Promise<RegistrySubmissionRecord[]> {
    return [...this.records.values()]
      .filter((record) => !status || record.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(200, Math.floor(limit))))
      .map(clone);
  }

  async setStatus(id: string, status: RegistrySubmissionStatus): Promise<RegistrySubmissionRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;
    const updated = { ...record, status, updatedAt: new Date().toISOString() };
    this.records.set(id, updated);
    return clone(updated);
  }
}

type Row = Record<string, unknown>;
function text(value: unknown): string { return String(value ?? ""); }
function nullable(value: unknown): string | null { return value == null ? null : String(value); }

function fromRow(row: Row): RegistrySubmissionRecord {
  return {
    id: text(row.id),
    name: text(row.name),
    description: nullable(row.description),
    repository: text(row.repository),
    requestedRef: text(row.requested_ref),
    requestedPath: nullable(row.requested_path),
    resolvedCommit: text(row.resolved_commit),
    sourceDigest: text(row.source_digest),
    scanStatus: text(row.scan_status) as RegistrySubmissionRecord["scanStatus"],
    riskScore: Number(row.risk_score),
    publisherName: nullable(row.publisher_name),
    claimRequested: Boolean(row.claim_requested),
    claimState: text(row.claim_state) as RegistryClaimState,
    status: text(row.status) as RegistrySubmissionStatus,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : text(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : text(row.updated_at),
  };
}

export class PostgresRegistrySubmissionStore implements RegistrySubmissionStore {
  readonly mode = "postgres" as const;
  private readonly pool: InstanceType<typeof Pool>;
  private schemaReady: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private ensureSchema(): Promise<void> {
    this.schemaReady ??= this.pool.query(`
      create table if not exists registry_submissions (
        id text primary key,
        name text not null,
        description text,
        repository text not null,
        requested_ref text not null,
        requested_path text,
        resolved_commit varchar(40) not null,
        source_digest varchar(64) not null,
        scan_status text not null check (scan_status in ('pass','warning','blocked')),
        risk_score integer not null check (risk_score between 0 and 100),
        publisher_name text,
        claim_requested boolean not null default false,
        claim_state text not null default 'unverified' check (claim_state in ('unverified','verified')),
        status text not null default 'pending' check (status in ('pending','approved','rejected')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists registry_submissions_status_created_idx on registry_submissions(status, created_at desc);
      create index if not exists registry_submissions_source_idx on registry_submissions(repository, resolved_commit, source_digest);
    `).then(() => undefined);
    return this.schemaReady;
  }

  async create(raw: CreateRegistrySubmissionInput): Promise<RegistrySubmissionRecord> {
    await this.ensureSchema();
    const input = validate(raw);
    const id = `sub_${randomUUID()}`;
    const result = await this.pool.query(
      `insert into registry_submissions
       (id,name,description,repository,requested_ref,requested_path,resolved_commit,source_digest,scan_status,risk_score,publisher_name,claim_requested)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [id, input.name, input.description, input.repository, input.requestedRef, input.requestedPath, input.resolvedCommit, input.sourceDigest, input.scanStatus, input.riskScore, input.publisherName, input.claimRequested],
    );
    return fromRow(result.rows[0] as Row);
  }

  async get(id: string): Promise<RegistrySubmissionRecord | null> {
    await this.ensureSchema();
    const result = await this.pool.query("select * from registry_submissions where id=$1", [id]);
    return result.rowCount ? fromRow(result.rows[0] as Row) : null;
  }

  async list(status?: RegistrySubmissionStatus, limit = 100): Promise<RegistrySubmissionRecord[]> {
    await this.ensureSchema();
    const bounded = Math.max(1, Math.min(200, Math.floor(limit)));
    const result = status
      ? await this.pool.query("select * from registry_submissions where status=$1 order by created_at desc limit $2", [status, bounded])
      : await this.pool.query("select * from registry_submissions order by created_at desc limit $1", [bounded]);
    return result.rows.map((row) => fromRow(row as Row));
  }

  async setStatus(id: string, status: RegistrySubmissionStatus): Promise<RegistrySubmissionRecord | null> {
    await this.ensureSchema();
    const result = await this.pool.query(
      "update registry_submissions set status=$2, updated_at=now() where id=$1 returning *",
      [id, status],
    );
    return result.rowCount ? fromRow(result.rows[0] as Row) : null;
  }
}

let singleton: RegistrySubmissionStore | null = null;

export function createRegistrySubmissionStore(): RegistrySubmissionStore {
  return process.env.DATABASE_URL ? new PostgresRegistrySubmissionStore(process.env.DATABASE_URL) : new MemoryRegistrySubmissionStore();
}

export function getRegistrySubmissionStore(): RegistrySubmissionStore {
  singleton ??= createRegistrySubmissionStore();
  return singleton;
}

export function resetRegistrySubmissionStoreForTests(): void {
  singleton = null;
}

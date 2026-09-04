create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id) on delete cascade,
  version text not null,
  checksum text not null,
  manifest jsonb not null,
  instructions text not null,
  created_at timestamptz not null default now(),
  unique(skill_id, version)
);

create table if not exists agent_skills (
  agent_id uuid not null references agents(id) on delete cascade,
  skill_version_id uuid not null references skill_versions(id),
  primary key(agent_id, skill_version_id)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  external_channel text,
  external_conversation_id text,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  status text not null,
  model text,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_usd numeric(14,6) not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  kind text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  tool_name text not null,
  request jsonb not null,
  status text not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  ciphertext bytea not null,
  allowed_hosts text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists sandboxes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete set null,
  provider text not null,
  external_id text,
  status text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  organization_id uuid references organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key(organization_id, user_id)
);

create table if not exists agent_members (
  agent_id uuid not null references agents(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  primary key(agent_id, user_id)
);

create table if not exists channel_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null,
  external_account_id text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  participant_key text not null,
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  primary key(conversation_id, participant_key)
);

create table if not exists oauth_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  external_account_id text,
  encrypted_credentials bytea not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  participant_key text,
  kind text not null,
  content jsonb not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete set null,
  kind text not null,
  storage_key text not null,
  content_type text,
  size_bytes bigint,
  checksum text,
  created_at timestamptz not null default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  name text not null,
  schedule_kind text not null,
  schedule_spec jsonb not null,
  prompt text not null,
  enabled boolean not null default true,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists usage_events (
  id bigserial primary key,
  organization_id uuid references organizations(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  meter text not null,
  quantity numeric(18,6) not null,
  unit text not null,
  estimated_cost_usd numeric(14,6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_runs_created_at on runs(created_at desc);
create index if not exists idx_run_steps_run_id on run_steps(run_id, created_at);
create index if not exists idx_approvals_status on approvals(status, created_at);
create index if not exists idx_usage_org_created on usage_events(organization_id, created_at desc);
create index if not exists idx_audit_org_created on audit_events(organization_id, created_at desc);

# Roadmap

## Milestone 0 — Baseline foundation

Status: initial draft in this repository.

- Monorepo and Next.js product shell.
- Talk-to-Skill demo.
- Portable coder skill example.
- Skill parser and checksum.
- Tool risk catalog and policy decisions.
- Deterministic agent runtime.
- Mock sandbox.
- PostgreSQL schema.
- Docker and CI.
- Parser/policy/runtime tests.

## Milestone 1 — Persistent product

- Authentication and organizations.
- Database migration runner and repositories.
- Persistent skills, agents, conversations, messages, runs, run steps, approvals, audit events.
- Agent and approval APIs.
- Operator UI backed by PostgreSQL.
- RBAC.

Exit criteria: refresh/restart does not lose product state and two organizations are isolated by tests.

## Milestone 2 — Real model runtime

- Vercel AI SDK / AI Gateway adapter.
- Streaming responses.
- Tool-loop agent integration behind existing runtime contracts.
- Provider/model routing.
- Token, latency, and cost capture.
- Run trace UI and replay metadata.

Exit criteria: a real model can resolve a tool call and produce a fully persisted trace with usage.

## Milestone 3 — Isolated execution

- Production sandbox provider adapter.
- Git clone/checkout.
- Filesystem read/write/patch tools.
- Shell command execution with timeout and output limits.
- Browser automation adapter.
- Artifact upload/download.
- Sandbox leases, cleanup, retry, and cancellation.

Exit criteria: a coding agent can modify a sample repository, run tests, and return a diff/artifact without host access.

## Milestone 4 — Security broker

- Encrypted secret vault.
- Secret reference tokens.
- Host-scoped egress proxy.
- OAuth integration broker.
- Approval policies for deploy, merge, delete, send, payment, and privileged database actions.
- Tamper-evident audit log strategy.

Exit criteria: agent-controlled code cannot read raw production credentials in the supported execution path.

## Milestone 5 — Skill ecosystem

- Skill publishing and semantic versions.
- Immutable version pinning and integrity locks.
- Permission diff on upgrade.
- Static/security scans.
- Evaluations and benchmark metadata.
- Trust score inputs.
- Skill builder from conversation.

Exit criteria: users can publish, install, pin, upgrade, and roll back a skill safely.

## Milestone 6 — Distribution

- Web share links.
- Email connector.
- Slack/Telegram/WhatsApp adapters based on normalized channel events.
- Schedules and webhook triggers.
- Per-channel conversation policies.

## Milestone 7 — Enterprise scale

- SSO/SAML/OIDC.
- Fine-grained RBAC and policy templates.
- Regional data controls.
- Quotas and budgets.
- Queue-backed execution and autoscaling.
- Reliability SLOs, alerts, and incident runbooks.
- Multi-model optimization and fallback.

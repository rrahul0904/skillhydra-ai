# Implementation plan

## Phase 0 — shipped in this repository

- Clean-room product/architecture specification.
- Next.js operator UI.
- Talk-to-Skill resolver demo.
- Skill manifest parser + SHA-256 integrity checksum.
- Tool catalog and policy engine.
- Agent run state machine.
- Approval-gated deployment example.
- Sandbox executor abstraction + deterministic safe mock.
- PostgreSQL production schema.
- Docker and CI baseline.
- Unit/integration tests for parser, policy and runtime.

## Phase 1 — persistent control plane

- Auth and organizations.
- PostgreSQL repositories/migrations runner.
- Agent, conversation, messages, runs and approvals APIs.
- RBAC and audit log UI.

## Phase 2 — real AI + observability

- AI Gateway adapter.
- Streaming chat.
- Model routing and fallback.
- Token/cost accounting.
- Run traces and replay.

## Phase 3 — real isolated execution

- Sandbox provider adapter.
- Git repository checkout and branch management.
- Filesystem patch protocol.
- Shell command allow/deny controls.
- Browser automation.
- Artifact persistence.

## Phase 4 — secure integrations

- OAuth connection broker.
- Encrypted credential vault.
- Host-scoped egress proxy.
- GitHub, Slack, email and deployment tools.

## Phase 5 — ecosystem

- Skill publishing/versioning.
- Security scan and trust score.
- Marketplace and creator attribution.
- Conversational skill builder.
- Evaluations and benchmark suite.

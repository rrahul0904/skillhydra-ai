# Technical architecture

## Principles

- **Control plane and execution plane are separate trust domains.**
- **Skills are declarative capability packages, not implicit superuser prompts.**
- **Every tool call has a policy decision before execution.**
- **External/irreversible writes are approval-gated.**
- **Secrets are references with destination policy, never plain text in model context.**
- **Expensive compute is provisioned only when a task requires it.**

## Logical architecture

```text
Web / messaging adapters
        |
        v
Conversation normalizer ---- Identity / tenant boundary
        |
        v
Skill resolver -> version/checksum -> hydrated specialist context
        |
        v
Model router / agent loop
        |
        v
Policy engine -----> Approval service
        |
        v
Tool gateway ------> Secret egress proxy
        |
        +---- safe API executor
        |
        +---- sandbox manager -> filesystem / shell / browser / preview deploy
        |
        v
Run + audit + cost events -> PostgreSQL / telemetry
```

## Repository boundaries

- `apps/web`: Next.js web UI and route handlers.
- `packages/core`: shared domain contracts and identifiers.
- `packages/skill-kit`: SKILL.md parsing, checksums, normalization and resolution.
- `packages/policy`: tool catalog and least-privilege decisions.
- `packages/runtime`: agent turn state machine and model adapter boundary.
- `packages/sandbox`: execution interface and safe demo executor.
- `packages/db`: persistence contracts and SQL schema.

## Production adapters to add

- Auth / organizations.
- PostgreSQL repositories for all control data.
- AI Gateway model adapter with per-run usage accounting.
- E2B/Daytona/Vercel Sandbox execution adapter.
- Browser service.
- KMS-backed secret vault + host-scoped outbound proxy.
- Durable queue/workflow engine.
- Object storage for artifacts.
- Messaging channels and OAuth integrations.
- OpenTelemetry traces and evaluation pipeline.

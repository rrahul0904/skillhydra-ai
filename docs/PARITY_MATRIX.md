# Reverse-engineering parity matrix

This is a clean-room product-behavior matrix. "Implemented" means the repository contains a working local path; "Interface" means the contract/schema is present and a production provider remains to be connected.

| Capability | Status | Implementation |
|---|---|---|
| Talk-to-Skill launcher | Implemented | `/talk-to-skill`, resolver API |
| Tank-style source normalization | Implemented | `packages/skill-kit` compatibility profile |
| Skill instructions + manifest | Implemented | `SKILL.md` parser |
| Version + integrity checksum | Implemented | SHA-256 bundle checksum |
| Declared tool permissions | Implemented | `SkillPermissions` |
| Policy allow/deny | Implemented | `packages/policy` |
| Human approval boundary | Implemented demo | deployment pauses before execution |
| Specialist agent loop | Implemented | `packages/runtime` |
| Run timeline | Implemented | UI + `AgentRun.steps` |
| Isolated execution abstraction | Implemented | `SandboxExecutor` |
| Real VM sandbox | Interface | add provider adapter in Phase 3 |
| Git repository tools | Demo | safe mock executor |
| Browser execution | Interface | permission + architecture contract |
| Secrets / host-scoped egress | Schema/design | production vault/proxy in Phase 4 |
| Conversations/messages | Schema | PostgreSQL tables |
| Multi-user organizations/RBAC | Schema | org/member/agent-member tables |
| Per-user agent isolation | Schema/design | participant + memory boundaries |
| Durable memory | Schema | `memories` table |
| Schedules | Schema | `schedules` table |
| OAuth integrations | Schema | `oauth_connections` |
| Web channel | Implemented | Next.js UI/API |
| WhatsApp/Telegram/Email | Architecture | channel adapter phase |
| Usage/cost accounting | Schema/UI demo | `usage_events`, dashboard |
| Audit log | Schema | `audit_events` |
| Skill marketplace | Roadmap | Phase 5 |
| Conversational skill builder | Roadmap | Phase 5 |
| Creator attribution/revenue | Roadmap | Phase 5 |
| Skill trust/security score | Roadmap | Phase 5 |

# SkillHydra AI

A clean-room implementation of the **portable skill → hydrated specialist agent** pattern explored during the Prompt2Bot / `p2b-coder` reverse-engineering exercise.

SkillHydra is intentionally not a source-code clone. It recreates the product architecture from first principles: portable skills, least-privilege permissions, policy checks, approval gates, isolated execution, auditable runs and an operator control plane.

## What works now

- `Talk to Skill` web flow with `tank:@uriva/p2b-coder` compatibility preview.
- SKILL.md YAML front-matter parser and SHA-256 checksum.
- Tool/permission manifest.
- Policy engine: allow / approval-required / deny.
- Deterministic specialist model for zero-key local demos.
- Mock isolated sandbox executor.
- Run timeline showing model → policy → tool/approval state.
- Control-plane dashboard and architecture page.
- PostgreSQL production schema.
- Docker/Compose baseline.
- Automated tests.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000/talk-to-skill`.

Try these prompts after resolving the default skill:

```text
Inspect the repository and tell me what you find.
Run the tests and build.
Implement a change to the API.
Deploy this preview.
```

The deployment request intentionally pauses at `approval_required`, demonstrating the control boundary without making an external change.

## Verify

```bash
npm test
npm run build
```

## Docker

```bash
docker compose up --build
```

The web demo does not require PostgreSQL yet, but Compose starts the production data-plane dependency and the full schema is available at `packages/db/migrations/001_init.sql`.

## Project structure

```text
skillhydra-ai/
├── apps/web/                  Next.js product UI + APIs
├── packages/core/             Domain contracts
├── packages/skill-kit/        Skill parser/resolver/checksums
├── packages/policy/           Permissions + risk decisions
├── packages/runtime/          Agent run state machine
├── packages/sandbox/          Execution provider interface
├── packages/db/               Data contracts + PostgreSQL schema
├── examples/skills/coder/     Portable clean-room coder skill
├── tests/                     Parser, policy and runtime tests
├── docs/                      Product, architecture, security, roadmap
├── Dockerfile
└── docker-compose.yml
```

## Production direction

See:

- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md)
- [`docs/PRODUCT.md`](docs/PRODUCT.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)

The next implementation wave replaces the deterministic model and mock executor with real AI Gateway + isolated sandbox adapters while retaining the same policy and run-state contracts.

# SkillHydra AI — Project Plan

## Mission

Build a clean-room skill-to-agent platform where a portable skill can be resolved, inspected, permission-scoped, instantiated as a specialist agent, and executed through policy-controlled tools and isolated runtimes.

## Product thesis

The durable product is not a single coding chatbot. It is a control plane for turning reusable capability packages into secure, observable specialist agents. Expensive execution environments are provisioned only when a task requires them; simple API actions stay on the control plane.

## Primary users

1. Developers who want a coding or integration specialist from a reusable skill.
2. Teams that need governed AI agents with approvals, auditability, cost controls, and RBAC.
3. Skill authors who want to publish, version, test, and monetize specialist capabilities.
4. Operators who need to inspect runs, approvals, failures, usage, and sandbox activity.

## MVP outcomes

The MVP is complete when a user can:

- Paste a supported skill reference.
- Resolve and inspect the skill manifest and requested permissions.
- Create a specialist agent from that skill.
- Chat with the agent and see its run timeline.
- Execute low-risk tools automatically.
- Pause high-risk actions for approval.
- Resume an approved run.
- Execute repository/shell work inside an isolated sandbox provider.
- Persist conversations, runs, approvals, usage, and audit events.
- Inspect operations from an admin/control-plane UI.

## Architecture principles

- Clean-room implementation; no copied proprietary source or branding.
- Control plane separated from execution plane.
- Least-privilege skill permissions.
- Human approval for high-impact actions.
- Secrets never exposed directly to agent-controlled code.
- Provider abstractions for LLMs, sandboxes, storage, and channels.
- Durable, replayable run state rather than opaque one-shot prompts.
- Cost and token accounting as first-class product data.
- Docker-first local development and cloud-agnostic service boundaries.

## Workstreams

### A. Product and UX

- Talk-to-Skill launcher.
- Agent workspace and conversation UI.
- Run timeline and tool-call inspector.
- Approval inbox.
- Skill registry and skill detail pages.
- Operator dashboard.
- Usage and cost surfaces.

### B. Agent control plane

- Agent and conversation APIs.
- Model adapter and routing policy.
- Run state machine.
- Tool registry and execution dispatcher.
- Memory and context assembly.
- Usage/cost metering.

### C. Skill system

- `SKILL.md` parser.
- Manifest validation.
- Integrity hashes and version pinning.
- Permission diffing.
- Registry/import adapters.
- Security scanning and trust metadata.

### D. Execution plane

- Sandbox provider interface.
- Git checkout and workspace lifecycle.
- Shell and filesystem tool adapters.
- Browser automation.
- Artifact persistence.
- Lease/timeout/cleanup semantics.

### E. Security and governance

- RBAC.
- Approval policies.
- Credential vault.
- Host-scoped secret egress.
- Audit log.
- Tool risk taxonomy.
- Tenant isolation.

### F. Platform and operations

- PostgreSQL control data.
- Background jobs/queue.
- OpenTelemetry traces.
- CI/CD.
- Docker Compose local stack.
- Production deployment templates.

## Delivery sequence

1. Foundation and deterministic demo.
2. Persistent control plane.
3. Real model streaming and observability.
4. Isolated sandbox execution.
5. OAuth/secrets/integration broker.
6. Skill registry and builder.
7. Multi-channel agents.
8. Enterprise governance and scale hardening.

## Definition of done for each phase

Every phase must include:

- Typed interfaces and migrations where applicable.
- Unit tests for new decision logic.
- At least one end-to-end happy path.
- Failure-path coverage.
- Security review notes for new privileged operations.
- Usage/cost instrumentation for external providers.
- Documentation updated in the same pull request.

## Non-goals for the first release

- Building a proprietary VM hypervisor.
- Supporting every messaging channel immediately.
- Fully autonomous production changes without approval policy.
- A large public marketplace before skill trust and versioning are reliable.

## Success metrics

- Time from skill URL to usable agent.
- Successful run completion rate.
- Approval turnaround and resume success rate.
- Sandbox startup latency and cleanup reliability.
- Cost per completed task.
- Tool failure rate.
- Percentage of runs with complete audit traces.
- Skill install-to-repeat-use rate.

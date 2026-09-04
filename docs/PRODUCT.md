# Product specification

SkillHydra converts portable AI skills into focused specialist agents. A skill packages instructions, declared tools, permissions, metadata and a version checksum. The control plane resolves and hydrates the skill, the policy engine evaluates every privileged action, and the execution plane runs approved actions in an isolated environment.

## Core user journeys

1. **Talk to Skill** — paste a Tank/GitHub/package source, inspect capabilities, start a specialist conversation.
2. **Build with an agent** — inspect a repository, edit in an isolated workspace, run tests, view the exact run timeline.
3. **Approval-gated external action** — deploy, merge, send, delete or otherwise cross a trust boundary only after explicit approval.
4. **Operate agents** — inspect run state, policy events, tool calls, failures, cost, sandbox lifetime and audit records.
5. **Publish skills** — version and distribute reusable specialist capability packages.

## Non-goals for the first milestone

- Copying Prompt2Bot UI, code, branding or proprietary implementation.
- Executing arbitrary third-party skill code before a trust scan.
- Giving models raw infrastructure or OAuth secrets.
- Production deployment without explicit policy approval.

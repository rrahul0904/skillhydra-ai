# SkillHydra Registry — operating guide

This guide covers the end-to-end clean-room registry workflow added by PR #2.

## Product lifecycle

1. **Discover** curated and approved community registry entries at `/registry`.
2. **Inspect** a public GitHub skill at `/registry/inspect`.
3. SkillHydra resolves the requested branch/ref to an immutable Git commit, reads a bounded set of text files, parses `SKILL.md`, computes a deterministic SHA-256 source digest and runs static risk rules.
4. The user reviews an agent-specific installation plan. Inspection and planning authorize no writes or script execution.
5. **Install locally** with the Registry CLI only after approving the exact digest and passing `--apply`.
6. The CLI verifies the installed digest, writes `.skillhydra/registry-lock.json`, backs up a replaced target and supports rollback.
7. **Submit** a public skill at `/registry/submit`. Submission re-runs pinning/scanning before queueing it.
8. **Moderate** at `/registry/admin`. The server fails closed unless `REGISTRY_ADMIN_TOKEN` is configured. Blocked static scans cannot be approved through the supported moderation API.
9. Approved submissions become discoverable in `/registry` and use the same provenance/security/install-plan detail page as curated entries.

## Environment

### Zero-config development

Without `DATABASE_URL`, publisher submissions use an in-process memory store. This is intentionally labeled non-durable and is suitable only for local development/testing.

### Durable registry submissions

Set:

```text
DATABASE_URL=postgresql://...
```

The registry submission store uses PostgreSQL and lazily creates its `registry_submissions` table/indexes. Existing control-plane database behavior is unchanged.

### Moderation

Set a strong server-side token of at least 24 characters:

```text
REGISTRY_ADMIN_TOKEN=<secret>
```

Do not expose this token as a public/client environment variable. `/api/registry/admin/submissions` returns 503 when the token is not configured and 401 when the Bearer token does not match.

## Local install CLI

Read-only plan:

```bash
npm run registry:cli -- plan --source ./skill --name my-skill --agent codex --scope project
```

After reviewing the exact content and digest printed by the plan:

```bash
npm run registry:cli -- install --source ./skill --name my-skill --agent codex --scope project --approve-digest <sha256> --apply
```

Rollback:

```bash
npm run registry:cli -- rollback --name my-skill --agent codex --scope project --apply
```

Supported targets: Claude Code, Codex, Cursor, Gemini CLI, Windsurf, OpenCode and universal `.agents` layout.

## Trust model

These states are deliberately separate:

- publisher identity / ownership verification;
- immutable source provenance;
- deterministic source digest;
- configured static scan status;
- moderation approval;
- manual code/security review;
- user approval of the exact content digest;
- local install verification receipt.

A clean static scan is **not** a security certification. A moderation approval is **not** publisher-identity verification. A publisher claim starts unverified until an authenticated ownership mechanism proves it.

## Current hosted certification blocker

On October 8, 2026, Vercel refused a new exact-SHA preview because the connected Hobby account exceeded the free API deployment quota (`api-deployments-free-per-day`, more than 100 deployments/day). GitHub CI remains the current exact-SHA compiler/test/build gate. Do not promote the registry PR to production until a fresh hosted preview can be built and browser-certified on the same SHA.

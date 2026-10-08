# Reverse-engineering dossier: Skill Harbor pattern

Status: Phase 1 implementation in progress  
Issue: #1  
Method: clean-room, evidence-first reconstruction

## 1. Source identification

Primary donor surface supplied for analysis:

- Reddit post: `https://www.reddit.com/r/SideProject/comments/1x0dhz3/i_got_tired_of_reinstalling_the_same_ai_skills/`
- Public product: `https://theskillharbor.com/`

The donor is treated as a product-behavior reference only. We do **not** copy source code, branding, private implementation details, or proprietary text.

## 2. Evidence ledger

| Claim | Evidence class | Public source | Confidence |
|---|---|---|---|
| Catalog contains roughly 1,900+ installable builds/skills and supports free listings | first-party-public | Reddit launch post | high |
| Listings expose a copy/paste installer prompt for an assistant | first-party-public | Reddit launch post + public product pages | high |
| Install guidance asks the agent to inspect the source, safety-check scripts, install to a skills directory and verify locally | first-party-public | public install guide/product pages | high |
| Catalog supports categories, search and curated collections | first-party-public | `/products/` and `/collections/` | high |
| There is a public read-only assistant-search surface | first-party-public | `/connect/` | high |
| Build submission supports conversational/Muse submission plus a direct form | first-party-public | `/submit/` | high |
| Creator identity verification is explicitly distinct from code review/security | first-party-public | product pages + safety guide | high |
| Some listings receive visible warnings for risky install patterns such as remote-script piping | first-party-public | public product pages | high |
| Paid products can send buyers to seller-owned checkout and the directory says it does not process the payment | first-party-public | home/product pages | high |

Evidence classes used by this repository:

- `official-doc`: official documentation/API/changelog/status material.
- `official-source`: official open-source implementation.
- `first-party-public`: donor-authored public site/post/demo.
- `third-party-public`: independent article, directory, review or discussion.
- `inference`: reconstructed behavior that still needs independent proof.

## 3. Reconstructed user workflows

### Discover

1. User describes a capability or browses a category/collection.
2. Directory returns build cards with name, description, price/category and creator metadata.
3. User opens a listing to inspect prerequisites, source and install guidance.

### Evaluate trust

1. User distinguishes identity verification from code/security review.
2. Listing surfaces prerequisites and warnings.
3. User can inspect upstream source when available.
4. Risky install patterns should cause a warning or stop condition.

### Prepare installation

1. User copies an assistant-readable installation prompt.
2. Agent fetches/inspects source in a temporary location.
3. Agent summarizes behavior and scans for suspicious code or permissions.
4. Agent installs to the target skill location only after the user is satisfied.
5. Agent performs local verification and reports exactly what changed.

### Publish/claim

1. Creator submits a build or claims an existing curated listing.
2. Listing is reviewed/moderated before publication.
3. Creator controls description/product metadata and, for paid builds, links to seller-owned checkout.

### Search from an assistant

1. User connects a read-only search description to their assistant.
2. Assistant sends capability keywords only.
3. Search returns listing cards/metadata.
4. Search itself performs no install or write action.

## 4. Capability decomposition

### Catalog plane

- normalized listing schema
- search/ranking/filtering
- categories/tags/collections
- listing detail pages
- compatibility metadata
- pricing/license/source metadata

### Trust plane

- publisher identity state
- provenance/source pin state
- license evidence
- static safety scan state
- declared/inferred permissions
- warnings and review receipts
- immutable content digest

### Install plane

- target-agent path mapping
- review-first installation plan
- explicit approval boundary
- bounded filesystem write target
- local verification/checksum receipt
- update/diff/rollback path

### Publisher plane

- account/auth
- submit/claim
- review/moderation queue
- seller links/pricing
- version/update lifecycle

### Agent/search plane

- read-only search API
- MCP/connector exposure
- CLI/native agent integration
- no implicit escalation from search to install

## 5. Failure modes to design out

1. **Identity badge becomes a security badge.** Publisher verification must never be rendered as proof that code is safe.
2. **Floating-ref install.** A branch name can change after review. Resolve to an immutable commit/digest before approval.
3. **Prompt equals authorization.** Copying an install prompt must not itself authorize execution, authentication, publishing, deploys or external writes.
4. **Scope creep on filesystem writes.** Installer must write only inside the declared target path unless separately approved.
5. **Hidden prerequisites/secrets.** Requirements and secret destinations must be visible before install; secrets never belong in the prompt itself.
6. **Search leaks personal data.** Search API should receive capability terms/filters, not conversation history or user secrets.
7. **Pack install ambiguity.** Packs require an exact selected-skill manifest rather than blindly installing every discovered file.
8. **Unsafe update drift.** Updates require a new source pin, diff and review receipt; prior approval does not authorize future versions.
9. **Popularity substitutes for quality.** Install counts/ratings are discovery signals, not security evidence.
10. **Catalog poisoning.** Submission/ingestion must validate canonical source ownership/provenance and rate-limit/moderate abuse.

## 6. Competitive comparison

### skills.sh / Vercel Labs

Strengths: broad cross-agent CLI support, install telemetry/leaderboard, packs, public ecosystem and a conventional SKILL.md workflow.

Gap SkillHydra can address: make provenance, source pinning, policy/permission review, approval receipts and execution isolation first-class instead of treating installation as the end state.

### SkillRegistry / other catalog sites

Strengths: searchable registries, CLI installation, community discovery.

Gap SkillHydra can address: unified trust model + auditable install/runtime controls rather than only indexing and copying skills.

### Skill Harbor

Strengths: approachable non-technical UX, agent-readable install prompts, creator/claim workflow, collections and seller-direct monetization.

Gap SkillHydra can address: cross-agent portability, immutable source receipts, deterministic safety/policy gates, isolated execution, signed manifests/lockfiles and an operator control plane.

## 7. Internal donor audit

### `skillhydra-ai`

Already has:

- SKILL.md parser/checksum
- declared tool/permission model
- allow / approval-required / deny policy decisions
- isolated execution interface and Docker sandbox work
- auditable run timeline/control plane
- database contracts and CI

This makes SkillHydra the right home for a registry because discovery can flow directly into the existing trust/execution boundary.

### `agent-skills`

Useful internal patterns:

- cross-agent skill installation conventions
- lifecycle quality gates (spec, plan, build, verify, review, ship)
- security, source-driven development and browser verification workflows

Reuse ideas/contracts, not donor-specific branding or copied product text.

## 8. Product thesis and target boundary

### Thesis

**SkillHydra Registry = discover + prove + install + execute safely.**

The product should not compete as another giant scraped directory. Its differentiator is that every catalog entry can progress through a measurable trust lifecycle:

`discovered -> source pinned -> inspected -> policy summarized -> approved -> installed -> verified -> executable under policy`

### Phase 1 boundary

In scope:

- typed registry entry contract
- deterministic search/filtering
- compatibility metadata
- separate identity vs security states
- provenance/floating-ref state
- read-only search API
- listing detail UI
- review-first install plan/prompt generator
- tests for search and install guardrails

Out of scope until follow-on evidence/implementation:

- executing third-party installer scripts
- crawling GitHub at runtime
- marketplace payments
- creator auth/claims
- production security verdicts
- install-count telemetry
- autonomous updates

## 9. Behavior contracts / acceptance tests

1. Search is deterministic for the same catalog + query.
2. Search result limit is bounded server-side.
3. Unsupported agent/safety filters return an input error.
4. Publisher identity and code review status are modeled separately.
5. A floating source ref causes `sourcePinRequired=true`.
6. Install planning always returns `approvalRequired=true` and `executesDuringPlanning=false`.
7. Plan text explicitly stops before install/script execution/external writes.
8. Target path is derived from the selected agent + scope, not arbitrary user input.
9. Undeclared agent compatibility is rejected.
10. Tests/build must pass before merge/deploy.

## 10. Implementation status

Current branch: `feat/skill-registry-catalog`

Implemented in Phase 1:

- `@skillhydra/registry` workspace package
- typed seed catalog + deterministic search
- review-first install plan generator
- bounded `GET /api/registry/search`
- `/registry` discovery/filter UI
- `/registry/[id]` provenance/security/install-plan view
- copyable review-first prompt
- registry unit tests

Remaining before Phase 1 can merge:

- CI test/build evidence
- browser/preview verification
- accessibility/runtime review
- exact branch SHA receipt

## 11. Next implementation waves

1. **Ingestion/provenance**: GitHub source adapter, immutable commit resolution, license capture and source receipts.
2. **Scanner**: static rule engine for shell/network/credential/persistence patterns, plus explicit unknown state when evidence is insufficient.
3. **Persistence**: registry tables, versions, scan receipts, claims, collections and moderation states.
4. **Publisher workflow**: auth, submit/claim, moderation and signed listing updates.
5. **Installer/CLI**: cross-agent install, selected-pack manifest, lockfile, checksum verification and rollback.
6. **MCP/connector**: structured read-only search plus safe handoff to install planning.
7. **Hosted certification**: browser tests, recovery tests, rate limits, abuse controls, observability and production deployment evidence.

import assert from "node:assert/strict";
import test from "node:test";

import { communityEntryMatches, registrySubmissionToEntry } from "../apps/web/lib/registry-community.ts";
import type { RegistrySubmissionRecord } from "../packages/registry-store/src/index.ts";

function record(overrides: Partial<RegistrySubmissionRecord> = {}): RegistrySubmissionRecord {
  return {
    id: "sub_demo",
    name: "Community Demo",
    description: "Pinned community skill",
    repository: "https://github.com/example/demo",
    requestedRef: "main",
    requestedPath: "skills/demo",
    resolvedCommit: "a".repeat(40),
    sourceDigest: "b".repeat(64),
    scanStatus: "pass",
    riskScore: 0,
    publisherName: "Example Publisher",
    claimRequested: true,
    claimState: "unverified",
    status: "approved",
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
    ...overrides,
  };
}

test("approved community submission preserves immutable provenance without inventing trust", () => {
  const entry = registrySubmissionToEntry(record());
  assert.equal(entry.source.immutable, true);
  assert.equal(entry.source.ref, "a".repeat(40));
  assert.equal(entry.publisher.identityVerified, false);
  assert.equal(entry.security.status, "unknown");
  assert.match(entry.install.verification.join("\n"), /bbbbbbbbbbbbbbbb/);
});

test("warning and blocked scan states never become reviewed entries", () => {
  const warning = registrySubmissionToEntry(record({ scanStatus: "warning", riskScore: 24 }));
  const blocked = registrySubmissionToEntry(record({ scanStatus: "blocked", riskScore: 80 }));
  assert.equal(warning.security.status, "warning");
  assert.equal(blocked.security.status, "warning");
  assert.match(blocked.security.warnings.join("\n"), /must not be installed/i);
});

test("community discovery applies query, category, agent and safety filters", () => {
  const entry = registrySubmissionToEntry(record());
  assert.equal(communityEntryMatches(entry, { q: "community demo", agent: "codex", category: "Community", safety: "unknown" }).matches, true);
  assert.equal(communityEntryMatches(entry, { q: "missing" }).matches, false);
  assert.equal(communityEntryMatches(entry, { category: "Design" }).matches, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { MemoryRegistrySubmissionStore } from "../packages/registry-store/src/index.ts";

const valid = {
  name: "Demo Skill",
  description: "Submission fixture",
  repository: "https://github.com/example/demo",
  requestedRef: "main",
  requestedPath: "skills/demo",
  resolvedCommit: "a".repeat(40),
  sourceDigest: "b".repeat(64),
  scanStatus: "pass" as const,
  riskScore: 0,
  publisherName: "Example",
  claimRequested: true,
};

test("submission store keeps ownership claims unverified by default", async () => {
  const store = new MemoryRegistrySubmissionStore();
  const record = await store.create(valid);
  assert.equal(record.status, "pending");
  assert.equal(record.claimRequested, true);
  assert.equal(record.claimState, "unverified");
  assert.ok(record.id.startsWith("sub_"));
});

test("submission store can retrieve and moderate records without mutating returned clones", async () => {
  const store = new MemoryRegistrySubmissionStore();
  const record = await store.create(valid);
  const fetched = await store.get(record.id);
  assert.ok(fetched);
  fetched.name = "mutated";
  assert.equal((await store.get(record.id))?.name, "Demo Skill");

  const approved = await store.setStatus(record.id, "approved");
  assert.equal(approved?.status, "approved");
  assert.equal((await store.list("approved")).length, 1);
});

test("submission store rejects non-pinned or non-digested sources", async () => {
  const store = new MemoryRegistrySubmissionStore();
  await assert.rejects(store.create({ ...valid, resolvedCommit: "main" }), /immutable 40-character commit/);
  await assert.rejects(store.create({ ...valid, sourceDigest: "short" }), /64-character source digest/);
});

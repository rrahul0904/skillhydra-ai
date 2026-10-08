import assert from "node:assert/strict";
import test from "node:test";

import {
  createInstallPlan,
  getRegistryEntry,
  listRegistryEntries,
  searchRegistry,
  type RegistryEntry,
} from "../packages/registry/src/index.ts";

test("registry exposes cloned entries instead of mutable catalog references", () => {
  const first = listRegistryEntries();
  first[0].tags.push("mutated");
  first[0].security.warnings.push("mutated");

  const second = listRegistryEntries();
  assert.equal(second[0].tags.includes("mutated"), false);
  assert.equal(second[0].security.warnings.includes("mutated"), false);
});

test("search ranks name and tag matches deterministically", () => {
  const results = searchRegistry({ q: "frontend design", limit: 10 });
  assert.ok(results.length > 0);
  assert.equal(results[0].entry.id, "anthropic-frontend-design");
  assert.ok(results[0].score > 0);
  assert.ok(results[0].matched.includes("frontend"));
  assert.ok(results[0].matched.includes("design"));
});

test("search applies agent and safety filters and caps result limits", () => {
  const reviewed = searchRegistry({ agent: "codex", safety: "reviewed", limit: 500 });
  assert.equal(reviewed.length, 1);
  assert.equal(reviewed[0].entry.id, "skillhydra-coder");

  const bounded = searchRegistry({ limit: 500 });
  assert.ok(bounded.length <= 50);
});

test("install plan is review-first, non-executing and requires immutable source pinning", () => {
  const entry = getRegistryEntry("anthropic-frontend-design");
  assert.ok(entry);

  const plan = createInstallPlan(entry, "codex", "project");
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.executesDuringPlanning, false);
  assert.equal(plan.sourcePinRequired, true);
  assert.equal(plan.targetPath, ".codex/skills/frontend-design");
  assert.match(plan.prompt, /Do not install, execute scripts/);
  assert.match(plan.steps.join("\n"), /STOP and request explicit approval/);
});

test("install plan rejects an undeclared target agent", () => {
  const base = getRegistryEntry("skillhydra-coder");
  assert.ok(base);

  const constrained: RegistryEntry = {
    ...base,
    compatibility: ["codex"],
  };

  assert.throws(() => createInstallPlan(constrained, "claude-code"), /does not declare compatibility/);
});

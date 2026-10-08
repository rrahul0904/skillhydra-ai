import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
  createLocalInstallPlan,
  installApprovedLocalSkill,
  rollbackLocalSkill,
} from "../packages/registry-cli/src/install.ts";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "skillhydra-registry-"));
  const source = path.join(root, "source");
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, "SKILL.md"), "---\nname: demo\ndescription: safe local fixture\n---\n\nUse local reasoning only.\n", "utf8");
  return { root, source };
}

test("local install plan is read-only and derives the Codex target path", async () => {
  const { root, source } = await fixture();
  const plan = await createLocalInstallPlan({ sourceDirectory: source, skillName: "demo", targetAgent: "codex", projectRoot: root });
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.applyRequired, true);
  assert.equal(plan.scriptsExecuted, false);
  assert.equal(plan.targetPath, path.join(root, ".codex", "skills", "demo"));
  assert.match(plan.sourceDigest, /^[0-9a-f]{64}$/);
});

test("installer rejects stale or unapproved content digests", async () => {
  const { root, source } = await fixture();
  await assert.rejects(
    installApprovedLocalSkill({
      sourceDirectory: source,
      skillName: "demo",
      targetAgent: "codex",
      projectRoot: root,
      approvedDigest: "0".repeat(64),
      apply: true,
    }),
    /approved digest does not match/,
  );
});

test("approved install writes a verified lock receipt and rollback removes the install", async () => {
  const { root, source } = await fixture();
  const plan = await createLocalInstallPlan({ sourceDirectory: source, skillName: "demo", targetAgent: "codex", projectRoot: root });
  const receipt = await installApprovedLocalSkill({
    sourceDirectory: source,
    skillName: "demo",
    targetAgent: "codex",
    projectRoot: root,
    approvedDigest: plan.sourceDigest,
    apply: true,
    now: new Date("2026-10-08T00:00:00.000Z"),
  });
  assert.equal(receipt.verified, true);
  assert.equal(receipt.installedDigest, plan.sourceDigest);
  assert.match(await readFile(path.join(root, ".codex", "skills", "demo", "SKILL.md"), "utf8"), /safe local fixture/);
  const lock = JSON.parse(await readFile(path.join(root, ".skillhydra", "registry-lock.json"), "utf8")) as { entries: Record<string, unknown> };
  assert.ok(lock.entries["project:codex:demo"]);

  const rolledBack = await rollbackLocalSkill({ skillName: "demo", targetAgent: "codex", projectRoot: root, apply: true });
  assert.equal(rolledBack.rolledBack, true);
  await assert.rejects(readFile(path.join(root, ".codex", "skills", "demo", "SKILL.md"), "utf8"), /ENOENT/);
});

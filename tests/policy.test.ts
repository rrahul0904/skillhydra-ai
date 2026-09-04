import test from "node:test";
import assert from "node:assert/strict";
import { coderSkill } from "@skillhydra/skill-kit";
import { evaluateToolPolicy } from "@skillhydra/policy";

test("allows sandboxed shell execution declared by skill", () => {
  assert.equal(evaluateToolPolicy(coderSkill.manifest, "shell.exec"), "allow");
});

test("requires approval for preview deployment", () => {
  assert.equal(evaluateToolPolicy(coderSkill.manifest, "deploy.preview"), "approval_required");
});

test("denies undeclared tool", () => {
  assert.equal(evaluateToolPolicy(coderSkill.manifest, "deploy.production"), "deny");
});

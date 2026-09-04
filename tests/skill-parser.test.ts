import test from "node:test";
import assert from "node:assert/strict";
import { coderSkill, parseSkillMarkdown } from "@skillhydra/skill-kit";

test("parses coder skill permissions and checksum", () => {
  assert.equal(coderSkill.manifest.name, "@skillhydra/coder");
  assert.equal(coderSkill.manifest.permissions.subprocess, true);
  assert.equal(coderSkill.manifest.permissions.deploy, true);
  assert.equal(coderSkill.checksum.length, 64);
});

test("rejects markdown without front matter", () => {
  assert.throws(() => parseSkillMarkdown("hello"), /YAML front matter/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { coderSkill } from "@skillhydra/skill-kit";
import { AgentRuntime, DemoAgentModel } from "@skillhydra/runtime";
import { MockSandboxExecutor } from "@skillhydra/sandbox";

const runtime = new AgentRuntime(new DemoAgentModel(), new MockSandboxExecutor());

test("executes an allowed verification tool", async () => {
  const run = await runtime.runTurn(coderSkill, "Run the tests and build");
  assert.equal(run.status, "completed");
  assert.equal(run.policyDecision, "allow");
  assert.equal(run.toolRequest?.tool, "shell.exec");
});

test("pauses before deployment", async () => {
  const run = await runtime.runTurn(coderSkill, "Deploy this preview");
  assert.equal(run.status, "waiting_approval");
  assert.equal(run.policyDecision, "approval_required");
});

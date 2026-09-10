import test from "node:test";
import assert from "node:assert/strict";
import { coderSkill } from "@skillhydra/skill-kit";
import { GatewayAgentModel } from "@skillhydra/runtime";

test("normalizes gateway tool calls and captures configurable usage cost", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      model: "provider/test-model",
      usage: { prompt_tokens: 1_000, completion_tokens: 500, total_tokens: 1_500 },
      choices: [{
        message: {
          content: "I need to inspect the repository.",
          tool_calls: [{
            function: { name: "repo_read", arguments: JSON.stringify({ path: "src" }) },
          }],
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const model = new GatewayAgentModel({
    apiKey: "test-key",
    model: "provider/test-model",
    inputCostPerMillion: 2,
    outputCostPerMillion: 4,
    fetchImpl,
  });

  const decision = await model.decide("Inspect the code", { skill: coderSkill, history: [] });
  assert.equal(decision.tool?.name, "repo.read");
  assert.deepEqual(decision.tool?.input, { path: "src" });
  assert.equal(decision.model, "provider/test-model");
  assert.equal(decision.usage?.inputTokens, 1_000);
  assert.equal(decision.usage?.outputTokens, 500);
  assert.equal(decision.usage?.estimatedCostUsd, 0.004);
  assert.equal(requestBody?.model, "provider/test-model");
  assert.ok(Array.isArray(requestBody?.tools));
});

test("returns a final gateway answer when no tool is requested", async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    model: "provider/test-model",
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    choices: [{ message: { content: "The task is complete." } }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  const model = new GatewayAgentModel({
    apiKey: "test-key",
    model: "provider/test-model",
    fetchImpl,
  });

  const decision = await model.decide("Summarize", {
    skill: coderSkill,
    history: [{ tool: "repo.read", input: { path: "." }, output: { files: ["README.md"] } }],
  });

  assert.equal(decision.tool, undefined);
  assert.equal(decision.response, "The task is complete.");
  assert.equal(decision.usage?.totalTokens, 15);
});

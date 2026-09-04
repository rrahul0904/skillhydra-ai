import { makeId, type AgentRun, type SkillBundle, type ToolRequest } from "@skillhydra/core";
import { evaluateToolPolicy } from "@skillhydra/policy";
import type { SandboxExecutor } from "@skillhydra/sandbox";
import type { AgentModel } from "./model.ts";

export class AgentRuntime {
  private readonly model: AgentModel;
  private readonly executor: SandboxExecutor;

  constructor(model: AgentModel, executor: SandboxExecutor) {
    this.model = model;
    this.executor = executor;
  }

  async runTurn(skill: SkillBundle, message: string): Promise<AgentRun> {
    const runId = makeId("run");
    const decision = await this.model.decide(message);
    const steps: AgentRun["steps"] = [
      { id: makeId("step"), kind: "model", title: "Specialist planned next action", status: "completed", detail: decision.response },
    ];

    if (!decision.tool) {
      return { id: runId, skill: skill.manifest.name, message, status: "completed", response: decision.response, steps };
    }

    const request: ToolRequest = { id: makeId("tool"), tool: decision.tool.name, input: decision.tool.input };
    const policy = evaluateToolPolicy(skill.manifest, request.tool);
    steps.push({ id: makeId("step"), kind: "policy", title: `Policy decision: ${policy}`, status: "completed", detail: request.tool });

    if (policy === "deny") {
      steps.push({ id: makeId("step"), kind: "tool", title: request.tool, status: "blocked", detail: "Permission not granted by the skill manifest." });
      return {
        id: runId,
        skill: skill.manifest.name,
        message,
        status: "failed",
        response: `${decision.response} The requested tool was blocked by policy.`,
        steps,
        toolRequest: request,
        policyDecision: policy,
      };
    }

    if (policy === "approval_required") {
      steps.push({ id: makeId("step"), kind: "approval", title: `Approval required for ${request.tool}`, status: "pending", detail: "No external action has been executed." });
      return {
        id: runId,
        skill: skill.manifest.name,
        message,
        status: "waiting_approval",
        response: decision.response,
        steps,
        toolRequest: request,
        policyDecision: policy,
      };
    }

    const result = await this.executor.execute(request);
    steps.push({ id: makeId("step"), kind: "tool", title: request.tool, status: result.ok ? "completed" : "blocked", detail: JSON.stringify(result.output) });
    return {
      id: runId,
      skill: skill.manifest.name,
      message,
      status: result.ok ? "completed" : "failed",
      response: `${decision.response}\n\nTool result: ${JSON.stringify(result.output)}`,
      steps,
      toolRequest: request,
      policyDecision: policy,
    };
  }
}

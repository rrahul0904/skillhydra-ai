import type { ModelUsage, SkillBundle } from "@skillhydra/core";

export interface ModelHistoryItem {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface ModelContext {
  skill: SkillBundle;
  history: ModelHistoryItem[];
}

export interface ModelDecision {
  response: string;
  tool?: { name: string; input: Record<string, unknown> };
  model?: string;
  usage?: ModelUsage;
}

export interface AgentModel {
  decide(message: string, context: ModelContext): Promise<ModelDecision>;
}

export class DemoAgentModel implements AgentModel {
  async decide(message: string, context: ModelContext): Promise<ModelDecision> {
    if (context.history.length > 0) {
      const last = context.history.at(-1)!;
      return {
        model: "demo-deterministic",
        response: `Completed ${last.tool}. Result: ${JSON.stringify(last.output)}`,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      };
    }

    const lower = message.toLowerCase();
    if (lower.includes("deploy")) {
      return {
        model: "demo-deterministic",
        response: "I prepared a preview deployment request. Because deployments cross the workspace boundary, the policy engine requires owner approval before execution.",
        tool: { name: "deploy.preview", input: { target: "preview", source: "workspace" } },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      };
    }
    if (lower.includes("test") || lower.includes("build")) {
      return {
        model: "demo-deterministic",
        response: "I can verify the workspace with the sandboxed test/build toolchain.",
        tool: { name: "shell.exec", input: { command: "npm test && npm run build" } },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      };
    }
    if (lower.includes("edit") || lower.includes("change") || lower.includes("implement")) {
      return {
        model: "demo-deterministic",
        response: "I can write a scoped implementation request into the isolated workspace, then verification can inspect and execute it.",
        tool: { name: "repo.write", input: { path: "skillhydra-request.md", content: message } },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      };
    }
    if (lower.includes("repo") || lower.includes("code") || lower.includes("inspect")) {
      return {
        model: "demo-deterministic",
        response: "I’ll inspect the repository first so changes are grounded in the current codebase.",
        tool: { name: "repo.read", input: { path: "." } },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      };
    }

    return {
      model: "demo-deterministic",
      response: "This specialist is hydrated with a constrained coding skill. Ask it to inspect code, implement a change, run tests, or prepare a preview deployment; each action is checked against the skill manifest before execution.",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    };
  }
}

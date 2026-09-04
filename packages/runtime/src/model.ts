export interface ModelDecision {
  response: string;
  tool?: {
    name: string;
    input: Record<string, unknown>;
  };
}

export interface AgentModel {
  decide(message: string): Promise<ModelDecision>;
}

export class DemoAgentModel implements AgentModel {
  async decide(message: string): Promise<ModelDecision> {
    const lower = message.toLowerCase();

    if (lower.includes("deploy")) {
      return {
        response: "I prepared a preview deployment request. Because deployments cross the workspace boundary, the policy engine requires owner approval before execution.",
        tool: { name: "deploy.preview", input: { target: "preview", source: "workspace" } },
      };
    }
    if (lower.includes("test") || lower.includes("build")) {
      return {
        response: "I can verify the workspace with the sandboxed test/build toolchain.",
        tool: { name: "shell.exec", input: { command: "npm test && npm run build" } },
      };
    }
    if (lower.includes("edit") || lower.includes("change") || lower.includes("implement")) {
      return {
        response: "I can make the requested change inside the isolated workspace, then run verification before presenting the patch.",
        tool: { name: "repo.write", input: { intent: message } },
      };
    }
    if (lower.includes("repo") || lower.includes("code") || lower.includes("inspect")) {
      return {
        response: "I’ll inspect the repository first so changes are grounded in the current codebase.",
        tool: { name: "repo.read", input: { path: "." } },
      };
    }

    return {
      response: "This specialist is hydrated with a constrained coding skill. Ask it to inspect code, implement a change, run tests, or prepare a preview deployment; each action is checked against the skill manifest before execution.",
    };
  }
}

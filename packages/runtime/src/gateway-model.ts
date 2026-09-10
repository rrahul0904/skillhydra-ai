import type { ModelUsage } from "@skillhydra/core";
import type { AgentModel, ModelContext, ModelDecision } from "./model.ts";

type FetchLike = typeof fetch;

export interface GatewayAgentModelOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fallbackModels?: string[];
  inputCostPerMillion?: number;
  outputCostPerMillion?: number;
  fetchImpl?: FetchLike;
}

const toolNameToGateway: Record<string, string> = {
  "repo.read": "repo_read",
  "repo.write": "repo_write",
  "shell.exec": "shell_exec",
  "http.fetch": "http_fetch",
  "deploy.preview": "deploy_preview",
  "deploy.production": "deploy_production",
};
const gatewayToToolName = Object.fromEntries(Object.entries(toolNameToGateway).map(([key, value]) => [value, key]));

const toolSchemas: Record<string, Record<string, unknown>> = {
  "repo.read": {
    type: "function",
    function: {
      name: "repo_read",
      description: "Inspect repository files or metadata in the isolated workspace.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
    },
  },
  "repo.write": {
    type: "function",
    function: {
      name: "repo_write",
      description: "Modify files in the isolated workspace according to a clear implementation intent.",
      parameters: { type: "object", properties: { intent: { type: "string" } }, required: ["intent"], additionalProperties: false },
    },
  },
  "shell.exec": {
    type: "function",
    function: {
      name: "shell_exec",
      description: "Run a shell command inside the isolated workspace.",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"], additionalProperties: false },
    },
  },
  "http.fetch": {
    type: "function",
    function: {
      name: "http_fetch",
      description: "Fetch an allowed network destination.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
    },
  },
  "deploy.preview": {
    type: "function",
    function: {
      name: "deploy_preview",
      description: "Request creation of a preview deployment. This action is approval-gated by policy.",
      parameters: {
        type: "object",
        properties: { target: { type: "string" }, source: { type: "string" } },
        required: ["target"],
        additionalProperties: false,
      },
    },
  },
};

function usageFrom(raw: Record<string, unknown> | undefined, inputRate: number, outputRate: number): ModelUsage {
  const inputTokens = Number(raw?.prompt_tokens ?? raw?.input_tokens ?? 0);
  const outputTokens = Number(raw?.completion_tokens ?? raw?.output_tokens ?? 0);
  const totalTokens = Number(raw?.total_tokens ?? inputTokens + outputTokens);
  const estimatedCostUsd = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
  return { inputTokens, outputTokens, totalTokens, estimatedCostUsd };
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export class GatewayAgentModel implements AgentModel {
  private readonly options: Required<Omit<GatewayAgentModelOptions, "fallbackModels">> & { fallbackModels: string[] };

  constructor(options: GatewayAgentModelOptions) {
    this.options = {
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: (options.baseUrl ?? "https://ai-gateway.vercel.sh/v1").replace(/\/$/, ""),
      fallbackModels: options.fallbackModels ?? [],
      inputCostPerMillion: options.inputCostPerMillion ?? 0,
      outputCostPerMillion: options.outputCostPerMillion ?? 0,
      fetchImpl: options.fetchImpl ?? fetch,
    };
  }

  async decide(message: string, context: ModelContext): Promise<ModelDecision> {
    const historyText = context.history.length
      ? `\nPrevious policy-approved tool results:\n${JSON.stringify(context.history, null, 2)}\nUse them to decide whether another tool is needed or the task is complete.`
      : "";

    const system = [
      context.skill.instructions,
      "",
      "You are running inside SkillHydra. Tool availability is declarative and every proposed call is independently policy-checked.",
      "Never claim a tool ran until a tool result is present. Prefer the least-privileged tool. If the task is complete, answer without a tool call.",
      `Declared skill tools: ${context.skill.manifest.tools.join(", ")}.`,
      historyText,
    ].join("\n");

    const availableTools = context.skill.manifest.tools.flatMap((name) => toolSchemas[name] ? [toolSchemas[name]] : []);
    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      tools: availableTools,
      tool_choice: "auto",
      stream: false,
    };
    if (this.options.fallbackModels.length) body.models = this.options.fallbackModels;

    const response = await this.options.fetchImpl(`${this.options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI Gateway request failed (${response.status}): ${text.slice(0, 500)}`);
    }

    const data = await response.json() as {
      model?: string;
      usage?: Record<string, unknown>;
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };

    const assistant = data.choices?.[0]?.message;
    if (!assistant) throw new Error("AI Gateway returned no assistant message");

    const usage = usageFrom(data.usage, this.options.inputCostPerMillion, this.options.outputCostPerMillion);
    const toolCall = assistant.tool_calls?.[0]?.function;
    const normalizedTool = toolCall?.name ? gatewayToToolName[toolCall.name] : undefined;

    if (normalizedTool) {
      return {
        model: data.model ?? this.options.model,
        response: assistant.content?.trim() || `Requesting ${normalizedTool}.`,
        tool: { name: normalizedTool, input: parseArguments(toolCall?.arguments) },
        usage,
      };
    }

    return {
      model: data.model ?? this.options.model,
      response: assistant.content?.trim() || "The model completed without a textual response.",
      usage,
    };
  }
}

export function createConfiguredAgentModel(): AgentModel {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
  const model = process.env.AI_MODEL;
  if (!apiKey || !model) {
    const { DemoAgentModel } = requireDemoModel();
    return new DemoAgentModel();
  }

  return new GatewayAgentModel({
    apiKey,
    model,
    baseUrl: process.env.AI_GATEWAY_BASE_URL,
    fallbackModels: (process.env.AI_FALLBACK_MODELS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    inputCostPerMillion: Number(process.env.AI_INPUT_COST_PER_MILLION ?? 0),
    outputCostPerMillion: Number(process.env.AI_OUTPUT_COST_PER_MILLION ?? 0),
  });
}

function requireDemoModel() {
  return { DemoAgentModel: class {
    async decide(message: string, context: ModelContext) {
      if (context.history.length > 0) {
        const last = context.history.at(-1)!;
        return { model: "demo-deterministic", response: `Completed ${last.tool}. Result: ${JSON.stringify(last.output)}`, usage: { inputTokens:0, outputTokens:0, totalTokens:0, estimatedCostUsd:0 } };
      }
      const lower = message.toLowerCase();
      if (lower.includes("deploy")) return { model:"demo-deterministic", response:"I prepared a preview deployment request. Because deployments cross the workspace boundary, the policy engine requires owner approval before execution.", tool:{name:"deploy.preview",input:{target:"preview",source:"workspace"}}, usage:{inputTokens:0,outputTokens:0,totalTokens:0,estimatedCostUsd:0} };
      if (lower.includes("test") || lower.includes("build")) return { model:"demo-deterministic", response:"I can verify the workspace with the sandboxed test/build toolchain.", tool:{name:"shell.exec",input:{command:"npm test && npm run build"}}, usage:{inputTokens:0,outputTokens:0,totalTokens:0,estimatedCostUsd:0} };
      if (lower.includes("edit") || lower.includes("change") || lower.includes("implement")) return { model:"demo-deterministic", response:"I can make the requested change inside the isolated workspace, then run verification before presenting the patch.", tool:{name:"repo.write",input:{intent:message}}, usage:{inputTokens:0,outputTokens:0,totalTokens:0,estimatedCostUsd:0} };
      if (lower.includes("repo") || lower.includes("code") || lower.includes("inspect")) return { model:"demo-deterministic", response:"I’ll inspect the repository first so changes are grounded in the current codebase.", tool:{name:"repo.read",input:{path:"."}}, usage:{inputTokens:0,outputTokens:0,totalTokens:0,estimatedCostUsd:0} };
      return { model:"demo-deterministic", response:"This specialist is hydrated with a constrained coding skill. Ask it to inspect code, implement a change, run tests, or prepare a preview deployment; each action is checked against the skill manifest before execution.", usage:{inputTokens:0,outputTokens:0,totalTokens:0,estimatedCostUsd:0} };
    }
  } };
}

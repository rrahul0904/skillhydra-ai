import type { SkillBundle, ToolRequest, ToolResult } from "@skillhydra/core";

export interface SandboxExecutor {
  execute(request: ToolRequest): Promise<ToolResult>;
  close?(): Promise<void>;
}

export class MockSandboxExecutor implements SandboxExecutor {
  async execute(request: ToolRequest): Promise<ToolResult> {
    const started = Date.now();
    const outputByTool: Record<string, unknown> = {
      "repo.read": { files: ["package.json", "src/index.ts", "README.md"], branch: "main" },
      "repo.write": { path: request.input.path ?? "demo.txt", bytesWritten: String(request.input.content ?? "").length, simulated: true },
      "shell.exec": { exitCode: 0, stdout: "✓ typecheck\n✓ tests\n✓ build", stderr: "", network: "none" },
      "http.fetch": { status: 200, body: "Safe mock network response" },
    };

    return {
      requestId: request.id,
      ok: true,
      output: outputByTool[request.tool] ?? { message: `Simulated ${request.tool}` },
      durationMs: Math.max(4, Date.now() - started),
    };
  }
}

export async function createConfiguredSandboxExecutor(skill: SkillBundle): Promise<SandboxExecutor> {
  const provider = (process.env.SANDBOX_PROVIDER ?? "mock").toLowerCase();
  if (provider === "mock") return new MockSandboxExecutor();
  if (provider === "docker") {
    const { createDockerSandboxForSkill } = await import("./docker.ts");
    return createDockerSandboxForSkill(skill);
  }
  throw new Error(`Unsupported SANDBOX_PROVIDER: ${provider}`);
}

export * from "./docker.ts";

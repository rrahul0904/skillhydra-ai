import type { ToolRequest, ToolResult } from "@skillhydra/core";

export interface SandboxExecutor {
  execute(request: ToolRequest): Promise<ToolResult>;
}

export class MockSandboxExecutor implements SandboxExecutor {
  async execute(request: ToolRequest): Promise<ToolResult> {
    const started = Date.now();
    const outputByTool: Record<string, unknown> = {
      "repo.read": { files: ["package.json", "src/index.ts", "README.md"], branch: "main" },
      "repo.write": { changedFiles: 2, patch: "Demo workspace patch generated safely." },
      "shell.exec": { exitCode: 0, stdout: "✓ typecheck\n✓ tests\n✓ build" },
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

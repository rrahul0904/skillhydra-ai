import type { PolicyDecision, SkillManifest, ToolDefinition } from "@skillhydra/core";

export const toolCatalog: Record<string, ToolDefinition> = {
  "repo.read": {
    name: "repo.read",
    description: "Inspect repository files and metadata",
    risk: "low",
    permission: "filesystem.read",
  },
  "repo.write": {
    name: "repo.write",
    description: "Modify files in the isolated workspace",
    risk: "medium",
    permission: "filesystem.write",
  },
  "shell.exec": {
    name: "shell.exec",
    description: "Execute a command in an isolated sandbox",
    risk: "medium",
    permission: "subprocess",
  },
  "http.fetch": {
    name: "http.fetch",
    description: "Fetch an allowed network destination",
    risk: "medium",
    permission: "network",
  },
  "deploy.preview": {
    name: "deploy.preview",
    description: "Create a non-production preview deployment",
    risk: "high",
    permission: "deploy",
    requiresApproval: true,
  },
  "deploy.production": {
    name: "deploy.production",
    description: "Create or promote a production deployment",
    risk: "critical",
    permission: "deploy",
    requiresApproval: true,
  },
};

export function evaluateToolPolicy(manifest: SkillManifest, toolName: string): PolicyDecision {
  const tool = toolCatalog[toolName];
  if (!tool) return "deny";
  if (!manifest.tools.includes(toolName)) return "deny";

  const p = manifest.permissions;
  const permissionAllowed =
    tool.permission === "filesystem.read" ? p.filesystem.read.length > 0 :
    tool.permission === "filesystem.write" ? p.filesystem.write.length > 0 :
    tool.permission === "network" ? p.network.length > 0 :
    tool.permission === "subprocess" ? p.subprocess :
    tool.permission === "browser" ? p.browser :
    tool.permission === "deploy" ? p.deploy : false;

  if (!permissionAllowed) return "deny";
  if (tool.requiresApproval || tool.risk === "critical") return "approval_required";
  return "allow";
}

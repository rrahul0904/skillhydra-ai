export type RiskLevel = "low" | "medium" | "high" | "critical";
export type PolicyDecision = "allow" | "approval_required" | "deny";

export interface SkillPermissions {
  network: string[];
  filesystem: {
    read: string[];
    write: string[];
  };
  subprocess: boolean;
  browser: boolean;
  deploy: boolean;
}

export interface SkillManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  source: string;
  tools: string[];
  permissions: SkillPermissions;
  tags: string[];
}

export interface SkillBundle {
  manifest: SkillManifest;
  instructions: string;
  checksum: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  risk: RiskLevel;
  permission: keyof SkillPermissions | "filesystem.read" | "filesystem.write";
  requiresApproval?: boolean;
}

export interface ToolRequest {
  id: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  requestId: string;
  ok: boolean;
  output: unknown;
  durationMs: number;
}

export interface RunStep {
  id: string;
  kind: "model" | "policy" | "tool" | "approval";
  title: string;
  status: "completed" | "pending" | "blocked";
  detail?: string;
}

export interface AgentRun {
  id: string;
  skill: string;
  message: string;
  status: "completed" | "waiting_approval" | "failed";
  response: string;
  steps: RunStep[];
  toolRequest?: ToolRequest;
  policyDecision?: PolicyDecision;
}

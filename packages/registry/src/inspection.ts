import { createHash } from "node:crypto";

export type RegistryFindingSeverity = "low" | "medium" | "high" | "critical";
export type RegistryStaticScanStatus = "pass" | "warning" | "blocked";

export interface RegistryInspectionFile {
  path: string;
  content: string;
  size?: number;
}

export interface RegistryScanSource {
  url: string;
  ref?: string;
  resolvedCommit?: string;
  path?: string;
}

export interface RegistryScanFinding {
  ruleId: string;
  severity: RegistryFindingSeverity;
  path: string;
  line: number;
  message: string;
}

export interface RegistrySkillManifest {
  found: boolean;
  path?: string;
  name?: string;
  description?: string;
}

export interface RegistryScanReceipt {
  schemaVersion: "1";
  receiptId: string;
  source: RegistryScanSource;
  immutableSource: boolean;
  digest: string;
  status: RegistryStaticScanStatus;
  riskScore: number;
  fileCount: number;
  totalBytes: number;
  capabilities: string[];
  findings: RegistryScanFinding[];
  scannedAt: string;
  note: string;
}

interface ScanRule {
  id: string;
  severity: RegistryFindingSeverity;
  message: string;
  capability: string;
  pattern: RegExp;
}

const RULES: ScanRule[] = [
  {
    id: "remote-shell-pipe",
    severity: "critical",
    message: "Downloads remote content and pipes it directly into a shell.",
    capability: "network+shell",
    pattern: /\b(?:curl|wget)\b[^\n|]{0,240}\|\s*(?:sh|bash|zsh)\b/i,
  },
  {
    id: "destructive-shell",
    severity: "critical",
    message: "Contains a destructive or unusually privileged shell command.",
    capability: "privileged-shell",
    pattern: /\b(?:rm\s+-rf|sudo\s+|chmod\s+777|mkfs\b|dd\s+if=)/i,
  },
  {
    id: "subprocess-execution",
    severity: "high",
    message: "Can execute subprocesses or operating-system commands.",
    capability: "subprocess",
    pattern: /(?:child_process|execSync\s*\(|spawnSync\s*\(|subprocess\.(?:run|Popen)|os\.system\s*\()/i,
  },
  {
    id: "dynamic-code-execution",
    severity: "high",
    message: "Contains dynamic code execution that needs manual review.",
    capability: "dynamic-code",
    pattern: /\b(?:eval|Function)\s*\(/i,
  },
  {
    id: "persistence-modification",
    severity: "high",
    message: "References persistence or shell-startup mechanisms.",
    capability: "persistence",
    pattern: /(?:crontab|launchd|LaunchAgents|systemd|\.bashrc|\.zshrc|schtasks)/i,
  },
  {
    id: "network-access",
    severity: "medium",
    message: "Can make outbound network requests.",
    capability: "network",
    pattern: /(?:fetch\s*\(|axios\.|requests\.(?:get|post|put|delete)|https?\.request|urllib\.request)/i,
  },
  {
    id: "credential-environment-access",
    severity: "medium",
    message: "References environment variables or credential-like values.",
    capability: "credentials",
    pattern: /(?:process\.env|os\.environ|getenv\s*\(|Deno\.env|api[_-]?key|access[_-]?token|secret[_-]?key)/i,
  },
  {
    id: "filesystem-write",
    severity: "medium",
    message: "Can write or append files and therefore needs a bounded target path.",
    capability: "filesystem-write",
    pattern: /(?:writeFile(?:Sync)?\s*\(|appendFile(?:Sync)?\s*\(|fs\.promises\.write|\.write_text\s*\(|\.write_bytes\s*\()/i,
  },
  {
    id: "package-install-hook",
    severity: "medium",
    message: "Declares a package lifecycle hook that may execute during installation.",
    capability: "install-hook",
    pattern: /["']?(?:preinstall|postinstall|prepare)["']?\s*:/i,
  },
];

const SEVERITY_SCORE: Record<RegistryFindingSeverity, number> = {
  low: 2,
  medium: 8,
  high: 20,
  critical: 40,
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedFile(file: RegistryInspectionFile): RegistryInspectionFile {
  const path = file.path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`unsafe inspection path: ${file.path}`);
  }
  return { path, content: file.content, size: file.size ?? Buffer.byteLength(file.content, "utf8") };
}

export function computeRegistrySourceDigest(files: RegistryInspectionFile[]): string {
  const normalized = files.map(normalizedFile).sort((a, b) => a.path.localeCompare(b.path));
  const hash = createHash("sha256");
  for (const file of normalized) {
    hash.update(file.path, "utf8");
    hash.update("\0", "utf8");
    hash.update(sha256(file.content), "utf8");
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function parseFrontmatterValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim() || undefined;
  }
  return trimmed;
}

export function parseRegistrySkillManifest(files: RegistryInspectionFile[]): RegistrySkillManifest {
  const skill = files.map(normalizedFile).find((file) => file.path.toLowerCase().endsWith("skill.md"));
  if (!skill) return { found: false };

  const frontmatter = skill.content.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  if (!frontmatter) return { found: true, path: skill.path };

  let name: string | undefined;
  let description: string | undefined;
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = parseFrontmatterValue(line.slice(separator + 1));
    if (key === "name") name = value?.slice(0, 120);
    if (key === "description") description = value?.slice(0, 500);
  }

  return { found: true, path: skill.path, name, description };
}

export function scanRegistryFiles(
  files: RegistryInspectionFile[],
  source: RegistryScanSource,
  now: Date = new Date(),
): RegistryScanReceipt {
  if (files.length === 0) throw new Error("at least one text file is required for inspection");

  const normalized = files.map(normalizedFile);
  const findings: RegistryScanFinding[] = [];
  const capabilities = new Set<string>();

  for (const file of normalized) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        rule.pattern.lastIndex = 0;
        if (!rule.pattern.test(line)) continue;
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          path: file.path,
          line: index + 1,
          message: rule.message,
        });
        capabilities.add(rule.capability);
      }
    });
  }

  const riskScore = Math.min(100, findings.reduce((score, finding) => score + SEVERITY_SCORE[finding.severity], 0));
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const status: RegistryStaticScanStatus = hasCritical || riskScore >= 60 ? "blocked" : findings.length ? "warning" : "pass";
  const digest = computeRegistrySourceDigest(normalized);
  const immutableSource = Boolean(source.resolvedCommit && /^[0-9a-f]{40}$/i.test(source.resolvedCommit));

  return {
    schemaVersion: "1",
    receiptId: `scan_${digest.slice(0, 20)}`,
    source: { ...source },
    immutableSource,
    digest,
    status,
    riskScore,
    fileCount: normalized.length,
    totalBytes: normalized.reduce((sum, file) => sum + (file.size ?? 0), 0),
    capabilities: [...capabilities].sort(),
    findings,
    scannedAt: now.toISOString(),
    note: "Static scan evidence is not a security certification. Publisher identity and code review remain separate trust signals.",
  };
}

import { NextResponse } from "next/server";
import { createInstallPlan, type InstallScope, type RegistryAgent, type RegistryEntry } from "@skillhydra/registry";
import { inspectPublicGitHubSkill, RegistryGitHubInspectionError } from "../../../../lib/registry-github";

export const runtime = "nodejs";

const AGENTS = new Set<RegistryAgent>(["claude-code", "codex", "cursor", "gemini-cli", "windsurf", "opencode", "universal"]);
const SCOPES = new Set<InstallScope>(["project", "global"]);
const rateWindow = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}

function rateLimited(request: Request): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const current = rateWindow.get(key);
  if (!current || current.resetAt <= now) {
    rateWindow.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 10;
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "inspected-skill";
}

export async function POST(request: Request) {
  if (rateLimited(request)) return NextResponse.json({ error: "inspection rate limit exceeded" }, { status: 429 });

  let body: { repository?: unknown; ref?: unknown; path?: unknown; agent?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
  }

  if (typeof body.repository !== "string" || body.repository.length > 500) {
    return NextResponse.json({ error: "repository is required and must be 500 characters or fewer" }, { status: 400 });
  }
  if (body.ref !== undefined && typeof body.ref !== "string") return NextResponse.json({ error: "ref must be a string" }, { status: 400 });
  if (body.path !== undefined && typeof body.path !== "string") return NextResponse.json({ error: "path must be a string" }, { status: 400 });

  const agent = typeof body.agent === "string" ? body.agent as RegistryAgent : "codex";
  const scope = typeof body.scope === "string" ? body.scope as InstallScope : "project";
  if (!AGENTS.has(agent)) return NextResponse.json({ error: "unsupported target agent" }, { status: 400 });
  if (!SCOPES.has(scope)) return NextResponse.json({ error: "unsupported install scope" }, { status: 400 });

  try {
    const inspection = await inspectPublicGitHubSkill({
      repository: body.repository,
      ref: typeof body.ref === "string" ? body.ref : undefined,
      path: typeof body.path === "string" ? body.path : undefined,
    });

    const inferredName = inspection.manifest.name || inspection.requestedPath?.split("/").pop() || inspection.repository.split("/").pop() || "Inspected Skill";
    const warnings = [
      ...inspection.scan.findings.slice(0, 12).map((finding) => `${finding.severity}: ${finding.message} (${finding.path}:${finding.line})`),
    ];
    if (inspection.scan.status === "pass") {
      warnings.push("Static scan found no configured rule matches; this is not a manual code review or security certification.");
    }

    const entry: RegistryEntry = {
      id: `inspection-${inspection.scan.digest.slice(0, 12)}`,
      name: inferredName,
      tagline: inspection.manifest.description || "Public GitHub skill inspected by SkillHydra.",
      description: inspection.manifest.description || "An inspected public GitHub source pinned to an immutable commit before any installation decision.",
      kind: "skill",
      category: "Inspected source",
      tags: ["github", "inspection", ...inspection.scan.capabilities.slice(0, 5)],
      featuredRank: 999,
      source: {
        kind: "github",
        url: inspection.repository,
        ref: inspection.resolvedCommit,
        path: inspection.requestedPath || undefined,
        immutable: true,
      },
      publisher: { name: inspection.repository.split("/")[3] || "GitHub publisher", identityVerified: false },
      compatibility: ["claude-code", "codex", "cursor", "gemini-cli", "windsurf", "opencode", "universal"],
      prerequisites: [],
      security: {
        status: inspection.scan.status === "blocked" || inspection.scan.status === "warning" ? "warning" : "unknown",
        summary: `Static scan status: ${inspection.scan.status}; risk score ${inspection.scan.riskScore}/100.`,
        warnings,
        declaredPermissions: inspection.scan.capabilities.length ? inspection.scan.capabilities : ["unknown"],
      },
      install: {
        skillName: slugify(inferredName),
        verification: [
          `Verify installed files match source digest ${inspection.scan.digest}.`,
          `Verify source commit remains ${inspection.resolvedCommit}.`,
          "Run local structure checks without network access before enabling the skill.",
        ],
      },
    };

    const plan = createInstallPlan(entry, agent, scope);
    return NextResponse.json({
      data: {
        ...inspection,
        plan,
        reviewContract: {
          sourcePinned: true,
          staticScanOnly: true,
          approvalRequired: true,
          installationAuthorized: false,
        },
      },
    });
  } catch (error) {
    if (error instanceof RegistryGitHubInspectionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "inspection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRegistrySubmissionStore } from "@skillhydra/registry-store";
import { inspectPublicGitHubSkill, RegistryGitHubInspectionError } from "../../../../lib/registry-github";

export const runtime = "nodejs";

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
  return current.count > 5;
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 100) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const store = getRegistrySubmissionStore();
  const record = await store.get(id);
  if (!record) return NextResponse.json({ error: "submission not found" }, { status: 404 });
  return NextResponse.json({ data: record, meta: { durability: store.mode } });
}

export async function POST(request: Request) {
  if (rateLimited(request)) return NextResponse.json({ error: "submission rate limit exceeded" }, { status: 429 });

  let body: {
    repository?: unknown;
    ref?: unknown;
    path?: unknown;
    name?: unknown;
    description?: unknown;
    publisherName?: unknown;
    claimRequested?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
  }

  if (typeof body.repository !== "string" || body.repository.length > 500) return NextResponse.json({ error: "repository is required" }, { status: 400 });
  for (const [key, value, max] of [["ref", body.ref, 200], ["path", body.path, 300], ["name", body.name, 120], ["description", body.description, 2000], ["publisherName", body.publisherName, 120]] as const) {
    if (value !== undefined && (typeof value !== "string" || value.length > max)) return NextResponse.json({ error: `${key} has an invalid value` }, { status: 400 });
  }

  try {
    const inspection = await inspectPublicGitHubSkill({
      repository: body.repository,
      ref: typeof body.ref === "string" ? body.ref : undefined,
      path: typeof body.path === "string" ? body.path : undefined,
    });
    const name = (typeof body.name === "string" && body.name.trim()) || inspection.manifest.name || inspection.requestedPath?.split("/").pop() || "Submitted Skill";
    const description = (typeof body.description === "string" && body.description.trim()) || inspection.manifest.description || null;
    const store = getRegistrySubmissionStore();
    const record = await store.create({
      name,
      description,
      repository: inspection.repository,
      requestedRef: inspection.requestedRef,
      requestedPath: inspection.requestedPath,
      resolvedCommit: inspection.resolvedCommit,
      sourceDigest: inspection.scan.digest,
      scanStatus: inspection.scan.status,
      riskScore: inspection.scan.riskScore,
      publisherName: typeof body.publisherName === "string" ? body.publisherName : null,
      claimRequested: body.claimRequested === true,
    });

    return NextResponse.json({
      data: record,
      receipt: {
        manifest: inspection.manifest,
        scan: inspection.scan,
      },
      meta: {
        durability: store.mode,
        claimIsVerified: false,
        note: store.mode === "memory" ? "No DATABASE_URL is configured, so this development queue is process-local and non-durable." : "Submission is stored in PostgreSQL.",
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof RegistryGitHubInspectionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "submission failed" }, { status: 500 });
  }
}

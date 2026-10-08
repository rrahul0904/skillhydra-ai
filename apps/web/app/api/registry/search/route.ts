import { NextResponse } from "next/server";
import {
  searchRegistry,
  type RegistryAgent,
  type RegistrySafetyStatus,
} from "@skillhydra/registry";

const agents = new Set<RegistryAgent>([
  "claude-code",
  "codex",
  "cursor",
  "gemini-cli",
  "windsurf",
  "opencode",
  "universal",
]);

const safetyStatuses = new Set<RegistrySafetyStatus>(["reviewed", "warning", "unknown"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const category = url.searchParams.get("category")?.trim() || undefined;
  const agentParam = url.searchParams.get("agent")?.trim() || undefined;
  const safetyParam = url.searchParams.get("safety")?.trim() || undefined;
  const limitParam = url.searchParams.get("limit");

  if (q && q.length > 200) {
    return NextResponse.json({ error: "q must be 200 characters or fewer" }, { status: 400 });
  }
  if (agentParam && !agents.has(agentParam as RegistryAgent)) {
    return NextResponse.json({ error: "unsupported agent filter" }, { status: 400 });
  }
  if (safetyParam && !safetyStatuses.has(safetyParam as RegistrySafetyStatus)) {
    return NextResponse.json({ error: "unsupported safety filter" }, { status: 400 });
  }

  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const results = searchRegistry({
    q,
    category,
    agent: agentParam as RegistryAgent | undefined,
    safety: safetyParam as RegistrySafetyStatus | undefined,
    limit: parsedLimit,
  });

  return NextResponse.json({
    data: results,
    meta: {
      count: results.length,
      query: q ?? null,
      category: category ?? null,
      agent: agentParam ?? null,
      safety: safetyParam ?? null,
      readOnly: true,
    },
  });
}

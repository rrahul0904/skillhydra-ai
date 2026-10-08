import { NextResponse } from "next/server";
import { getRegistrySubmissionStore, type RegistrySubmissionStatus } from "@skillhydra/registry-store";
import { isRegistryAdminAuthorized, registryAdminTokenConfigured } from "../../../../../lib/registry-admin-auth";

export const runtime = "nodejs";

const STATUSES = new Set<RegistrySubmissionStatus>(["pending", "approved", "rejected"]);

function authorize(request: Request): NextResponse | null {
  if (!registryAdminTokenConfigured()) return NextResponse.json({ error: "registry moderation is not configured" }, { status: 503 });
  if (!isRegistryAdminAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status")?.trim() || undefined;
  if (statusParam && !STATUSES.has(statusParam as RegistrySubmissionStatus)) return NextResponse.json({ error: "unsupported submission status" }, { status: 400 });
  const store = getRegistrySubmissionStore();
  const records = await store.list(statusParam as RegistrySubmissionStatus | undefined, 100);
  return NextResponse.json({ data: records, meta: { durability: store.mode, count: records.length } });
}

export async function PATCH(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
  }
  if (typeof body.id !== "string" || body.id.length > 100) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (typeof body.status !== "string" || !STATUSES.has(body.status as RegistrySubmissionStatus)) return NextResponse.json({ error: "status must be pending, approved or rejected" }, { status: 400 });
  const store = getRegistrySubmissionStore();
  const existing = await store.get(body.id);
  if (!existing) return NextResponse.json({ error: "submission not found" }, { status: 404 });
  if (body.status === "approved" && existing.scanStatus === "blocked") {
    return NextResponse.json({ error: "blocked static scans cannot be approved; submit changed source and obtain a new receipt" }, { status: 409 });
  }
  const updated = await store.setStatus(body.id, body.status as RegistrySubmissionStatus);
  return NextResponse.json({ data: updated, meta: { durability: store.mode } });
}

import { NextResponse } from "next/server";
import { resolveSkill } from "@skillhydra/skill-kit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { source?: string };
    const resolved = await resolveSkill(body.source ?? "");
    return NextResponse.json(resolved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve skill" }, { status: 400 });
  }
}

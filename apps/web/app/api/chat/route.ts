import { NextResponse } from "next/server";
import { resolveSkill } from "@skillhydra/skill-kit";
import { AgentRuntime, DemoAgentModel } from "@skillhydra/runtime";
import { MockSandboxExecutor } from "@skillhydra/sandbox";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { message?: string; source?: string };
    if (!body.message?.trim()) return NextResponse.json({ error: "A message is required" }, { status: 400 });

    const skill = await resolveSkill(body.source ?? "tank:@uriva/p2b-coder");
    const runtime = new AgentRuntime(new DemoAgentModel(), new MockSandboxExecutor());
    const run = await runtime.runTurn(skill.bundle, body.message);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent run failed" }, { status: 500 });
  }
}

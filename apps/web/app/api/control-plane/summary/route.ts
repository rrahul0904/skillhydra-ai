import { getControlPlaneStore } from "@skillhydra/db";
import { getPrincipal, jsonError } from "../../../../lib/auth";
import { requireOrganizationRole } from "../../../../lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = getPrincipal(request);
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return Response.json({ error: "organizationId is required" }, { status: 400 });

    const store = getControlPlaneStore();
    const membership = await requireOrganizationRole(store, organizationId, principal.userId, "viewer");
    const [agents, runs, approvals] = await Promise.all([
      store.listAgents(organizationId),
      store.listRunsForOrganization(organizationId, 50),
      store.listApprovalsForOrganization(organizationId),
    ]);
    const audit = membership.role === "owner" || membership.role === "admin"
      ? await store.listAuditEvents(organizationId, 50)
      : [];

    const pendingApprovals = approvals.filter((item) => item.status === "pending");
    const completedRuns = runs.filter((item) => item.status === "completed").length;
    const failedRuns = runs.filter((item) => item.status === "failed").length;

    return Response.json({
      organizationId,
      role: membership.role,
      metrics: {
        agents: agents.length,
        runs: runs.length,
        pendingApprovals: pendingApprovals.length,
        completedRuns,
        failedRuns,
        estimatedCostUsd: runs.reduce((sum, item) => sum + item.estimatedCostUsd, 0),
      },
      agents,
      runs,
      approvals,
      audit,
    });
  } catch (error) {
    return jsonError(error);
  }
}

import { getControlPlaneStore, type ApprovalRecord } from "@skillhydra/db";
import { getPrincipal, jsonError } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = getPrincipal(request);
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    const status = url.searchParams.get("status") as ApprovalRecord["status"] | null;
    if (!organizationId) return Response.json({ error: "organizationId is required" }, { status: 400 });

    const store = getControlPlaneStore();
    await requireOrganizationRole(store, organizationId, principal.userId, "viewer");
    return Response.json({ approvals: await store.listApprovalsForOrganization(organizationId, status ?? undefined) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = getPrincipal(request);
    const body = await request.json() as { organizationId?: string; approvalId?: string; decision?: "approved" | "rejected" };
    if (!body.organizationId || !body.approvalId || !body.decision) {
      return Response.json({ error: "organizationId, approvalId and decision are required" }, { status: 400 });
    }

    const store = getControlPlaneStore();
    await requireOrganizationRole(store, body.organizationId, principal.userId, "admin");
    const orgApprovals = await store.listApprovalsForOrganization(body.organizationId);
    if (!orgApprovals.some((item) => item.id === body.approvalId)) {
      return Response.json({ error: "Approval not found in organization" }, { status: 404 });
    }

    const approval = await store.decideApproval(body.approvalId, body.decision, principal.userId);
    if (!approval) return Response.json({ error: "Approval is no longer pending" }, { status: 409 });

    await store.appendAuditEvent({
      organizationId: body.organizationId,
      actorId: principal.userId,
      action: `approval.${body.decision}`,
      resourceType: "approval",
      resourceId: approval.id,
      metadata: { runId: approval.runId, toolName: approval.toolName },
    });
    return Response.json({ approval });
  } catch (error) {
    return jsonError(error);
  }
}

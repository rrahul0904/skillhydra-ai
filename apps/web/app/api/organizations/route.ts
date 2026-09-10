import { getControlPlaneStore } from "@skillhydra/db";
import { getPrincipal, jsonError } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = getPrincipal(request);
    const store = getControlPlaneStore();
    return Response.json({ organizations: await store.listOrganizationsForUser(principal.userId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = getPrincipal(request);
    const body = await request.json() as { name?: string };
    if (!body.name?.trim()) return Response.json({ error: "Organization name is required" }, { status: 400 });

    const store = getControlPlaneStore();
    const organization = await store.createOrganization({ name: body.name.trim(), ownerUserId: principal.userId });
    await store.appendAuditEvent({
      organizationId: organization.id,
      actorId: principal.userId,
      action: "organization.create",
      resourceType: "organization",
      resourceId: organization.id,
      metadata: { name: organization.name, authMode: principal.mode },
    });
    return Response.json({ organization }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

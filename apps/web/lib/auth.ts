export interface Principal {
  userId: string;
  mode: "dev" | "trusted-header";
}

export class AuthError extends Error {
  readonly status = 401;
}

const DEFAULT_DEV_USER_ID = "00000000-0000-4000-8000-000000000001";

export function getPrincipal(request: Request): Principal {
  const configured = process.env.SKILLHYDRA_AUTH_MODE;
  const mode = configured ?? (process.env.NODE_ENV === "production" ? "trusted-header" : "dev");

  if (mode === "dev") {
    if (process.env.NODE_ENV === "production" && process.env.SKILLHYDRA_ALLOW_DEV_AUTH !== "true") {
      throw new AuthError("Dev authentication is disabled in production");
    }
    return {
      userId: process.env.SKILLHYDRA_DEV_USER_ID ?? DEFAULT_DEV_USER_ID,
      mode: "dev",
    };
  }

  if (mode === "trusted-header") {
    const userId = request.headers.get("x-skillhydra-user-id");
    if (!userId) throw new AuthError("Missing trusted identity header");
    return { userId, mode: "trusted-header" };
  }

  throw new AuthError(`Unsupported authentication mode: ${mode}`);
}

export function jsonError(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) {
    return Response.json({ error: error.message.slice("FORBIDDEN:".length).trim() }, { status: 403 });
  }
  if (error instanceof Error && error.message.startsWith("NOT_FOUND:")) {
    return Response.json({ error: error.message.slice("NOT_FOUND:".length).trim() }, { status: 404 });
  }
  return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
}

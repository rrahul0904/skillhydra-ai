import { timingSafeEqual } from "node:crypto";

export function registryAdminTokenConfigured(secret = process.env.REGISTRY_ADMIN_TOKEN): boolean {
  return typeof secret === "string" && secret.length >= 24;
}

export function isRegistryAdminAuthorized(authorization: string | null, secret = process.env.REGISTRY_ADMIN_TOKEN): boolean {
  if (!registryAdminTokenConfigured(secret) || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret as string, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

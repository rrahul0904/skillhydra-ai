export function GET() {
  const modelMode = (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) && process.env.AI_MODEL
    ? "gateway"
    : "demo";
  const storeMode = process.env.DATABASE_URL ? "postgres" : "memory";
  return Response.json({ ok: true, service: "skillhydra-web", modelMode, storeMode });
}

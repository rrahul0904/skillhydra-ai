import type { RegistryEntry, RegistryAgent, RegistrySafetyStatus } from "@skillhydra/registry";
import type { RegistrySubmissionRecord } from "@skillhydra/registry-store";

export function registrySubmissionToEntry(record: RegistrySubmissionRecord): RegistryEntry {
  const scanWarning = record.scanStatus === "pass"
    ? "Static scan passed configured rules, but the code has not been manually security-reviewed."
    : record.scanStatus === "warning"
      ? `Static scan reported warnings (risk score ${record.riskScore}/100). Review source before installation.`
      : "Static scan was blocked. This submission must not be installed unless it is re-submitted with changed source and passes moderation.";

  return {
    id: record.id,
    name: record.name,
    tagline: record.description || "Community-submitted skill pinned and scanned before moderation.",
    description: record.description || "A community submission resolved to immutable source before entering the SkillHydra moderation queue.",
    kind: "skill",
    category: "Community",
    tags: ["community", "pinned-source", `scan-${record.scanStatus}`],
    featuredRank: 500,
    source: {
      kind: "github",
      url: record.repository,
      ref: record.resolvedCommit,
      path: record.requestedPath || undefined,
      immutable: true,
    },
    publisher: {
      name: record.publisherName || record.repository.split("/")[3] || "Community publisher",
      identityVerified: record.claimState === "verified",
    },
    compatibility: ["claude-code", "codex", "cursor", "gemini-cli", "windsurf", "opencode", "universal"],
    prerequisites: [],
    security: {
      status: record.scanStatus === "pass" ? "unknown" : "warning",
      summary: `Pinned submission. Static scan: ${record.scanStatus}; risk score ${record.riskScore}/100.`,
      warnings: [scanWarning],
      declaredPermissions: ["unknown-until-manual-review"],
    },
    install: {
      skillName: record.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `community-${record.id.slice(-8)}`,
      verification: [
        `Verify source commit is exactly ${record.resolvedCommit}.`,
        `Verify the approved source digest is exactly ${record.sourceDigest}.`,
        "Re-run local static and structure checks before enabling the installed skill.",
      ],
    },
  };
}

export function communityEntryMatches(
  entry: RegistryEntry,
  input: { q?: string; category?: string; agent?: RegistryAgent; safety?: RegistrySafetyStatus },
): { matches: boolean; score: number } {
  if (input.category && input.category.toLowerCase() !== entry.category.toLowerCase()) return { matches: false, score: 0 };
  if (input.agent && !entry.compatibility.includes(input.agent) && !entry.compatibility.includes("universal")) return { matches: false, score: 0 };
  if (input.safety && entry.security.status !== input.safety) return { matches: false, score: 0 };
  const tokens = (input.q || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { matches: true, score: 0 };
  const haystack = [entry.name, entry.tagline, entry.description, entry.category, entry.publisher.name, ...entry.tags].join(" ").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!haystack.includes(token)) return { matches: false, score: 0 };
    score += entry.name.toLowerCase().includes(token) ? 20 : entry.tags.some((tag) => tag.toLowerCase().includes(token)) ? 8 : 2;
  }
  return { matches: true, score };
}

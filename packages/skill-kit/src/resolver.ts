import type { SkillBundle } from "@skillhydra/core";
import { coderSkill } from "./builtin.ts";

export interface ResolvedSkill {
  requestedSource: string;
  normalizedSource: string;
  bundle: SkillBundle;
  warnings: string[];
}

export async function resolveSkill(source: string): Promise<ResolvedSkill> {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("A skill source is required");

  if (trimmed === "tank:@uriva/p2b-coder" || trimmed.includes("p2b-coder")) {
    return {
      requestedSource: trimmed,
      normalizedSource: "builtin:@skillhydra/coder",
      bundle: coderSkill,
      warnings: [
        "Clean-room compatibility profile: this demo does not download or execute third-party skill code.",
      ],
    };
  }

  return {
    requestedSource: trimmed,
    normalizedSource: "builtin:@skillhydra/coder",
    bundle: {
      ...coderSkill,
      manifest: {
        ...coderSkill.manifest,
        source: trimmed,
        displayName: "Imported Skill Preview",
        description: "A safe preview profile for an external skill source.",
      },
    },
    warnings: [
      "External fetching is intentionally disabled in demo mode. The source is normalized into a safe preview profile.",
    ],
  };
}

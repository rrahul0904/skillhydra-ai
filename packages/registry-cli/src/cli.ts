#!/usr/bin/env -S node --experimental-strip-types

import {
  createLocalInstallPlan,
  installApprovedLocalSkill,
  rollbackLocalSkill,
  type RegistryCliAgent,
  type RegistryCliScope,
} from "./install.ts";

const AGENTS = new Set<RegistryCliAgent>(["claude-code", "codex", "cursor", "gemini-cli", "windsurf", "opencode", "universal"]);

function options(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function required(opts: Record<string, string | boolean>, key: string): string {
  const value = opts[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`--${key} is required`);
  return value;
}

function common(opts: Record<string, string | boolean>) {
  const targetAgent = required(opts, "agent") as RegistryCliAgent;
  if (!AGENTS.has(targetAgent)) throw new Error(`unsupported --agent: ${targetAgent}`);
  const scope = (typeof opts.scope === "string" ? opts.scope : "project") as RegistryCliScope;
  if (scope !== "project" && scope !== "global") throw new Error("--scope must be project or global");
  return {
    skillName: required(opts, "name"),
    targetAgent,
    scope,
    projectRoot: typeof opts.root === "string" ? opts.root : process.cwd(),
  };
}

function usage(): never {
  console.error(`SkillHydra Registry CLI\n\nPlan (read-only):\n  skillhydra-registry plan --source ./skill --name my-skill --agent codex [--scope project] [--root .]\n\nInstall (writes only after exact digest approval):\n  skillhydra-registry install --source ./skill --name my-skill --agent codex --approve-digest <sha256> --apply\n\nRollback:\n  skillhydra-registry rollback --name my-skill --agent codex --apply\n`);
  process.exit(2);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) usage();
  const opts = options(rest);

  if (command === "plan") {
    const plan = await createLocalInstallPlan({ sourceDirectory: required(opts, "source"), ...common(opts) });
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (command === "install") {
    const receipt = await installApprovedLocalSkill({
      sourceDirectory: required(opts, "source"),
      approvedDigest: required(opts, "approve-digest"),
      apply: opts.apply === true,
      ...common(opts),
    });
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  if (command === "rollback") {
    const receipt = await rollbackLocalSkill({ apply: opts.apply === true, ...common(opts) });
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

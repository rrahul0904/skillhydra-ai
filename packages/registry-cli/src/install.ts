import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";

import {
  computeRegistrySourceDigest,
  scanRegistryFiles,
  type RegistryInspectionFile,
  type RegistryScanReceipt,
} from "@skillhydra/registry/inspection";

export type RegistryCliAgent = "claude-code" | "codex" | "cursor" | "gemini-cli" | "windsurf" | "opencode" | "universal";
export type RegistryCliScope = "project" | "global";

const MAX_FILES = 100;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const SKIP_DIRS = new Set([".git", "node_modules", ".skillhydra"]);
const TEXT_NAMES = new Set(["skill.md", "package.json", "pyproject.toml", "requirements.txt", "dockerfile"]);
const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".sh", ".bash", ".zsh", ".ps1", ".rb", ".go", ".rs",
]);

const PROJECT_TARGETS: Record<RegistryCliAgent, string> = {
  "claude-code": ".claude/skills",
  codex: ".codex/skills",
  cursor: ".cursor/skills",
  "gemini-cli": ".agents/skills",
  windsurf: ".windsurf/skills",
  opencode: ".opencode/skills",
  universal: ".agents/skills",
};

const GLOBAL_TARGETS: Record<RegistryCliAgent, string> = {
  "claude-code": ".claude/skills",
  codex: ".codex/skills",
  cursor: ".cursor/skills",
  "gemini-cli": ".gemini/skills",
  windsurf: ".codeium/windsurf/skills",
  opencode: ".config/opencode/skills",
  universal: ".agents/skills",
};

export interface LocalInstallPlan {
  sourceDirectory: string;
  sourceDigest: string;
  targetAgent: RegistryCliAgent;
  scope: RegistryCliScope;
  skillName: string;
  targetPath: string;
  lockPath: string;
  fileCount: number;
  totalBytes: number;
  scan: RegistryScanReceipt;
  approvalRequired: true;
  applyRequired: true;
  scriptsExecuted: false;
}

export interface LocalInstallReceipt extends LocalInstallPlan {
  installedAt: string;
  installedDigest: string;
  backupPath: string | null;
  verified: true;
}

interface RegistryLockEntry {
  skillName: string;
  targetAgent: RegistryCliAgent;
  scope: RegistryCliScope;
  targetPath: string;
  sourceDirectory: string;
  sourceDigest: string;
  installedDigest: string;
  installedAt: string;
  backupPath: string | null;
}

interface RegistryLockFile {
  version: 1;
  entries: Record<string, RegistryLockEntry>;
}

function validateSkillName(skillName: string): string {
  const normalized = skillName.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(normalized)) {
    throw new Error("skill name must match [a-z0-9][a-z0-9._-]{0,79}");
  }
  return normalized;
}

function isTextPath(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  if (TEXT_NAMES.has(basename)) return true;
  return TEXT_EXTENSIONS.has(path.extname(basename));
}

function ensureInside(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("resolved target escaped the approved root");
}

function targetPaths(agent: RegistryCliAgent, scope: RegistryCliScope, skillName: string, projectRoot: string) {
  const root = scope === "project" ? path.resolve(projectRoot) : homedir();
  const relativeBase = scope === "project" ? PROJECT_TARGETS[agent] : GLOBAL_TARGETS[agent];
  const targetPath = path.resolve(root, relativeBase, skillName);
  ensureInside(root, targetPath);
  const stateRoot = path.resolve(root, ".skillhydra");
  ensureInside(root, stateRoot);
  return { root, targetPath, stateRoot, lockPath: path.join(stateRoot, "registry-lock.json") };
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function readLocalSkillFiles(sourceDirectory: string): Promise<RegistryInspectionFile[]> {
  const root = path.resolve(sourceDirectory);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("source must be a real directory, not a symlink");

  const files: RegistryInspectionFile[] = [];
  let totalBytes = 0;

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error(`symlink refused: ${path.relative(root, absolute)}`);
      if (stat.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!stat.isFile()) throw new Error(`unsupported filesystem entry: ${path.relative(root, absolute)}`);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (!isTextPath(relative)) throw new Error(`unsupported non-text file refused: ${relative}`);
      if (stat.size > MAX_FILE_BYTES) throw new Error(`file exceeds ${MAX_FILE_BYTES} byte install limit: ${relative}`);
      const content = await readFile(absolute, "utf8");
      if (content.includes("\0")) throw new Error(`binary content refused: ${relative}`);
      const size = Buffer.byteLength(content, "utf8");
      totalBytes += size;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error("skill exceeds the 1 MiB approved text limit");
      files.push({ path: relative, content, size });
      if (files.length > MAX_FILES) throw new Error(`skill exceeds the ${MAX_FILES} file limit`);
    }
  }

  await walk(root);
  if (!files.length) throw new Error("source directory contains no supported skill files");
  return files;
}

async function writeFiles(root: string, files: RegistryInspectionFile[]): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const file of files) {
    const destination = path.resolve(root, ...file.path.split("/"));
    ensureInside(root, destination);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, "utf8");
  }
}

async function readLock(lockPath: string): Promise<RegistryLockFile> {
  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as RegistryLockFile;
    if (parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== "object") throw new Error("invalid registry lockfile");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, entries: {} };
    throw error;
  }
}

async function writeLock(lockPath: string, lock: RegistryLockFile): Promise<void> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  const temp = `${lockPath}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  await rename(temp, lockPath);
}

function lockKey(agent: RegistryCliAgent, scope: RegistryCliScope, skillName: string): string {
  return `${scope}:${agent}:${skillName}`;
}

export async function createLocalInstallPlan(input: {
  sourceDirectory: string;
  skillName: string;
  targetAgent: RegistryCliAgent;
  scope?: RegistryCliScope;
  projectRoot?: string;
}): Promise<LocalInstallPlan> {
  const scope = input.scope ?? "project";
  const skillName = validateSkillName(input.skillName);
  const projectRoot = path.resolve(input.projectRoot ?? process.cwd());
  const files = await readLocalSkillFiles(input.sourceDirectory);
  const sourceDigest = computeRegistrySourceDigest(files);
  const scan = scanRegistryFiles(files, { url: `file://${path.resolve(input.sourceDirectory)}` });
  const paths = targetPaths(input.targetAgent, scope, skillName, projectRoot);
  return {
    sourceDirectory: path.resolve(input.sourceDirectory),
    sourceDigest,
    targetAgent: input.targetAgent,
    scope,
    skillName,
    targetPath: paths.targetPath,
    lockPath: paths.lockPath,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + (file.size ?? 0), 0),
    scan,
    approvalRequired: true,
    applyRequired: true,
    scriptsExecuted: false,
  };
}

export async function installApprovedLocalSkill(input: {
  sourceDirectory: string;
  skillName: string;
  targetAgent: RegistryCliAgent;
  scope?: RegistryCliScope;
  projectRoot?: string;
  approvedDigest: string;
  apply: boolean;
  now?: Date;
}): Promise<LocalInstallReceipt> {
  const plan = await createLocalInstallPlan(input);
  if (!input.apply) throw new Error("write refused: pass apply=true only after explicit approval");
  if (!/^[0-9a-f]{64}$/i.test(input.approvedDigest) || input.approvedDigest.toLowerCase() !== plan.sourceDigest) {
    throw new Error("approved digest does not match the current source; inspect and approve the exact content first");
  }
  if (plan.scan.status === "blocked") throw new Error("installation refused: static scan contains blocked findings");

  const files = await readLocalSkillFiles(plan.sourceDirectory);
  const paths = targetPaths(plan.targetAgent, plan.scope, plan.skillName, input.projectRoot ?? process.cwd());
  const stamp = (input.now ?? new Date()).toISOString().replace(/[:.]/g, "-");
  let backupPath: string | null = null;

  if (await exists(paths.targetPath)) {
    const previous = await readLocalSkillFiles(paths.targetPath);
    backupPath = path.join(paths.stateRoot, "backups", `${plan.targetAgent}-${plan.skillName}-${stamp}`);
    await writeFiles(backupPath, previous);
  }

  const stagingPath = path.join(paths.stateRoot, "staging", `${plan.targetAgent}-${plan.skillName}-${process.pid}`);
  await rm(stagingPath, { recursive: true, force: true });
  await writeFiles(stagingPath, files);
  await rm(paths.targetPath, { recursive: true, force: true });
  await mkdir(path.dirname(paths.targetPath), { recursive: true });
  await rename(stagingPath, paths.targetPath);

  const installedFiles = await readLocalSkillFiles(paths.targetPath);
  const installedDigest = computeRegistrySourceDigest(installedFiles);
  if (installedDigest !== plan.sourceDigest) {
    await rm(paths.targetPath, { recursive: true, force: true });
    if (backupPath) await writeFiles(paths.targetPath, await readLocalSkillFiles(backupPath));
    throw new Error("post-install digest verification failed; target was rolled back");
  }

  const installedAt = (input.now ?? new Date()).toISOString();
  const lock = await readLock(paths.lockPath);
  lock.entries[lockKey(plan.targetAgent, plan.scope, plan.skillName)] = {
    skillName: plan.skillName,
    targetAgent: plan.targetAgent,
    scope: plan.scope,
    targetPath: paths.targetPath,
    sourceDirectory: plan.sourceDirectory,
    sourceDigest: plan.sourceDigest,
    installedDigest,
    installedAt,
    backupPath,
  };
  await writeLock(paths.lockPath, lock);

  return { ...plan, installedAt, installedDigest, backupPath, verified: true };
}

export async function rollbackLocalSkill(input: {
  skillName: string;
  targetAgent: RegistryCliAgent;
  scope?: RegistryCliScope;
  projectRoot?: string;
  apply: boolean;
}): Promise<{ rolledBack: true; restoredBackup: boolean; targetPath: string; lockPath: string }> {
  if (!input.apply) throw new Error("rollback refused: pass apply=true only after explicit approval");
  const scope = input.scope ?? "project";
  const skillName = validateSkillName(input.skillName);
  const paths = targetPaths(input.targetAgent, scope, skillName, input.projectRoot ?? process.cwd());
  const lock = await readLock(paths.lockPath);
  const key = lockKey(input.targetAgent, scope, skillName);
  const entry = lock.entries[key];
  if (!entry) throw new Error("no installed registry entry exists for that agent/scope/skill");

  await rm(paths.targetPath, { recursive: true, force: true });
  let restoredBackup = false;
  if (entry.backupPath && await exists(entry.backupPath)) {
    const backup = await readLocalSkillFiles(entry.backupPath);
    await writeFiles(paths.targetPath, backup);
    restoredBackup = true;
  }
  delete lock.entries[key];
  await writeLock(paths.lockPath, lock);
  return { rolledBack: true, restoredBackup, targetPath: paths.targetPath, lockPath: paths.lockPath };
}

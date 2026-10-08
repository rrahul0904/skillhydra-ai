import {
  parseRegistrySkillManifest,
  scanRegistryFiles,
  type RegistryInspectionFile,
  type RegistryScanReceipt,
  type RegistrySkillManifest,
} from "@skillhydra/registry/inspection";

const MAX_FILES = 80;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

const TEXT_NAMES = new Set(["skill.md", "package.json", "pyproject.toml", "requirements.txt", "dockerfile"]);
const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".sh", ".bash", ".zsh", ".ps1", ".rb", ".go", ".rs",
]);

export class RegistryGitHubInspectionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "RegistryGitHubInspectionError";
  }
}

interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree" | string;
  size?: number;
}

interface GitHubRepoResponse {
  default_branch?: string;
}

interface GitHubCommitResponse {
  sha?: string;
  commit?: { tree?: { sha?: string } };
}

interface GitHubTreeResponse {
  truncated?: boolean;
  tree?: GitHubTreeEntry[];
}

export interface PublicGitHubInspectionInput {
  repository: string;
  ref?: string;
  path?: string;
}

export interface PublicGitHubInspectionResult {
  repository: string;
  requestedRef: string;
  resolvedCommit: string;
  requestedPath: string | null;
  manifest: RegistrySkillManifest;
  files: Array<{ path: string; size: number }>;
  scan: RegistryScanReceipt;
}

function parseRepositoryUrl(repository: string): { owner: string; repo: string; canonical: string } {
  let url: URL;
  try {
    url = new URL(repository);
  } catch {
    throw new RegistryGitHubInspectionError("repository must be a valid https://github.com/owner/repo URL");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new RegistryGitHubInspectionError("only public github.com repositories are supported");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new RegistryGitHubInspectionError("repository URL must include owner and repository");
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new RegistryGitHubInspectionError("repository owner/name contains unsupported characters");
  }
  return { owner, repo, canonical: `https://github.com/${owner}/${repo}` };
}

function normalizeRequestedPath(path?: string): string | undefined {
  if (!path?.trim()) return undefined;
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.length > 300 || normalized.split("/").includes("..")) {
    throw new RegistryGitHubInspectionError("path must be a bounded repository-relative path");
  }
  return normalized;
}

function isTextPath(path: string): boolean {
  const lower = path.toLowerCase();
  const basename = lower.split("/").pop() ?? lower;
  if (TEXT_NAMES.has(basename)) return true;
  const dot = basename.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(basename.slice(dot));
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "skillhydra-registry-inspector/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (response.status === 404) throw new RegistryGitHubInspectionError("GitHub repository, ref or path was not found", 404);
  if (response.status === 403 || response.status === 429) {
    throw new RegistryGitHubInspectionError("GitHub rate limit reached; retry after the provider window resets", 429);
  }
  if (!response.ok) throw new RegistryGitHubInspectionError(`GitHub returned ${response.status}`, 502);
  return response.json() as Promise<T>;
}

async function rawText(owner: string, repo: string, commit: string, path: string): Promise<string> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${commit}/${encodedPath}`, {
    headers: { "User-Agent": "skillhydra-registry-inspector/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new RegistryGitHubInspectionError(`failed to read ${path} from pinned source`, 502);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) {
    throw new RegistryGitHubInspectionError(`text file exceeds ${MAX_FILE_BYTES} byte inspection limit: ${path}`, 413);
  }
  return text;
}

export async function inspectPublicGitHubSkill(input: PublicGitHubInspectionInput): Promise<PublicGitHubInspectionResult> {
  const { owner, repo, canonical } = parseRepositoryUrl(input.repository);
  const requestedPath = normalizeRequestedPath(input.path);
  const repoMeta = await githubJson<GitHubRepoResponse>(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const requestedRef = input.ref?.trim() || repoMeta.default_branch || "main";
  if (requestedRef.length > 200) throw new RegistryGitHubInspectionError("ref must be 200 characters or fewer");

  const commit = await githubJson<GitHubCommitResponse>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(requestedRef)}`,
  );
  const resolvedCommit = commit.sha;
  const treeSha = commit.commit?.tree?.sha;
  if (!resolvedCommit || !treeSha || !/^[0-9a-f]{40}$/i.test(resolvedCommit)) {
    throw new RegistryGitHubInspectionError("GitHub did not return an immutable commit receipt", 502);
  }

  const tree = await githubJson<GitHubTreeResponse>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${treeSha}?recursive=1`,
  );
  if (tree.truncated) throw new RegistryGitHubInspectionError("repository tree is too large for bounded inspection; choose a narrower path", 413);

  const prefix = requestedPath ? `${requestedPath}/` : "";
  const candidates = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob")
    .filter((entry) => !requestedPath || entry.path === requestedPath || entry.path.startsWith(prefix))
    .filter((entry) => isTextPath(entry.path))
    .filter((entry) => (entry.size ?? 0) <= MAX_FILE_BYTES)
    .sort((a, b) => {
      const aSkill = a.path.toLowerCase().endsWith("skill.md") ? 0 : 1;
      const bSkill = b.path.toLowerCase().endsWith("skill.md") ? 0 : 1;
      return aSkill - bSkill || a.path.localeCompare(b.path);
    });

  if (candidates.length === 0) throw new RegistryGitHubInspectionError("no inspectable text files were found at that repository path", 404);
  if (candidates.length > MAX_FILES) throw new RegistryGitHubInspectionError(`path contains more than ${MAX_FILES} inspectable files; choose a narrower path`, 413);

  let totalBytes = 0;
  const files: RegistryInspectionFile[] = [];
  for (const candidate of candidates) {
    const content = await rawText(owner, repo, resolvedCommit, candidate.path);
    const size = Buffer.byteLength(content, "utf8");
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) throw new RegistryGitHubInspectionError("inspection exceeded the 1 MiB total text limit", 413);
    files.push({ path: candidate.path, content, size });
  }

  const manifest = parseRegistrySkillManifest(files);
  const scan = scanRegistryFiles(files, {
    url: canonical,
    ref: requestedRef,
    resolvedCommit,
    path: requestedPath,
  });

  return {
    repository: canonical,
    requestedRef,
    resolvedCommit,
    requestedPath: requestedPath ?? null,
    manifest,
    files: files.map((file) => ({ path: file.path, size: file.size ?? Buffer.byteLength(file.content, "utf8") })),
    scan,
  };
}

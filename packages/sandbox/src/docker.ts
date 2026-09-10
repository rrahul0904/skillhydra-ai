import { cp, lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { SkillBundle, ToolRequest, ToolResult } from "@skillhydra/core";
import type { SandboxExecutor } from "./index.ts";

const MAX_FILE_BYTES = 512 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_LIST_ENTRIES = 200;

export interface DockerSandboxOptions {
  image?: string;
  sourceDir?: string;
  allowedHosts?: string[];
  allowContainerNetwork?: boolean;
  commandTimeoutMs?: number;
}

function allowedHost(hostname: string, allowed: string[]) {
  return allowed.some((entry) => {
    const normalized = entry.toLowerCase();
    const host = hostname.toLowerCase();
    if (normalized.startsWith("*.")) {
      const suffix = normalized.slice(1);
      return host.endsWith(suffix) && host !== suffix.slice(1);
    }
    return host === normalized;
  });
}

function limitedAppend(current: string, chunk: Buffer | string) {
  if (Buffer.byteLength(current) >= MAX_OUTPUT_BYTES) return current;
  const next = current + String(chunk);
  if (Buffer.byteLength(next) <= MAX_OUTPUT_BYTES) return next;
  return Buffer.from(next).subarray(0, MAX_OUTPUT_BYTES).toString("utf8") + "\n[output truncated]";
}

export class DockerSandboxExecutor implements SandboxExecutor {
  private readonly options: Required<Omit<DockerSandboxOptions, "sourceDir">> & { sourceDir?: string };
  private workspacePromise: Promise<string> | undefined;

  constructor(options: DockerSandboxOptions = {}) {
    this.options = {
      image: options.image ?? "node:22-bookworm-slim",
      sourceDir: options.sourceDir,
      allowedHosts: options.allowedHosts ?? [],
      allowContainerNetwork: options.allowContainerNetwork ?? false,
      commandTimeoutMs: options.commandTimeoutMs ?? 120_000,
    };
  }

  private async workspace() {
    this.workspacePromise ??= this.createWorkspace();
    return this.workspacePromise;
  }

  private async createWorkspace() {
    const directory = await mkdtemp(join(tmpdir(), "skillhydra-"));
    if (this.options.sourceDir) {
      const source = resolve(this.options.sourceDir);
      const stat = await lstat(source);
      if (!stat.isDirectory()) throw new Error("SANDBOX_SOURCE_DIR must be a directory");
      await cp(source, directory, {
        recursive: true,
        filter: (path) => {
          const rel = relative(source, path);
          if (!rel) return true;
          const first = rel.split(/[\\/]/)[0];
          return !["node_modules", ".next", ".git", ".turbo", "coverage"].includes(first);
        },
      });
    }
    return directory;
  }

  private async safePath(input: unknown) {
    const workspace = await this.workspace();
    const raw = typeof input === "string" && input.trim() ? input.trim() : ".";
    if (isAbsolute(raw)) throw new Error("Absolute paths are not allowed");
    const target = resolve(workspace, raw);
    const rel = relative(workspace, target);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Path escapes the sandbox workspace");
    return { workspace, target, relativePath: rel || "." };
  }

  async execute(request: ToolRequest): Promise<ToolResult> {
    const started = Date.now();
    try {
      let output: unknown;
      switch (request.tool) {
        case "repo.read":
          output = await this.readRepository(request.input.path);
          break;
        case "repo.write":
          output = await this.writeRepository(request.input.path, request.input.content);
          break;
        case "shell.exec":
          output = await this.runShell(request.input.command);
          break;
        case "http.fetch":
          output = await this.fetchAllowed(request.input.url);
          break;
        default:
          return { requestId: request.id, ok: false, output: { error: `Unsupported sandbox tool: ${request.tool}` }, durationMs: Date.now() - started };
      }
      return { requestId: request.id, ok: true, output, durationMs: Math.max(1, Date.now() - started) };
    } catch (error) {
      return {
        requestId: request.id,
        ok: false,
        output: { error: error instanceof Error ? error.message : "Sandbox execution failed" },
        durationMs: Math.max(1, Date.now() - started),
      };
    }
  }

  private async readRepository(path: unknown) {
    const { target, relativePath } = await this.safePath(path);
    const stat = await lstat(target);
    if (stat.isFile()) {
      if (stat.size > MAX_FILE_BYTES) throw new Error(`File exceeds ${MAX_FILE_BYTES} byte read limit`);
      return { path: relativePath, kind: "file", content: await readFile(target, "utf8") };
    }
    if (!stat.isDirectory()) throw new Error("Only regular files and directories can be read");

    const entries: string[] = [];
    const walk = async (directory: string) => {
      if (entries.length >= MAX_LIST_ENTRIES) return;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entries.length >= MAX_LIST_ENTRIES) break;
        if (["node_modules", ".git", ".next"].includes(entry.name)) continue;
        const absolute = join(directory, entry.name);
        const workspace = await this.workspace();
        entries.push(relative(workspace, absolute) + (entry.isDirectory() ? "/" : ""));
        if (entry.isDirectory()) await walk(absolute);
      }
    };
    await walk(target);
    return { path: relativePath, kind: "directory", entries, truncated: entries.length >= MAX_LIST_ENTRIES };
  }

  private async writeRepository(path: unknown, content: unknown) {
    if (typeof path !== "string" || !path.trim()) throw new Error("repo.write requires a path");
    if (typeof content !== "string") throw new Error("repo.write requires string content");
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error(`Write exceeds ${MAX_FILE_BYTES} byte limit`);
    const { target, relativePath } = await this.safePath(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    return { path: relativePath, bytesWritten: Buffer.byteLength(content) };
  }

  private async runShell(command: unknown) {
    if (typeof command !== "string" || !command.trim()) throw new Error("shell.exec requires a command");
    const workspace = await this.workspace();
    const args = [
      "run", "--rm",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", "256",
      "--cpus", "1",
      "--memory", "1g",
      "--read-only",
      "--tmpfs", "/tmp:rw,nosuid,size=128m",
      "--env", "HOME=/tmp",
      "--network", this.options.allowContainerNetwork ? "bridge" : "none",
      "--volume", `${workspace}:/workspace:rw`,
      "--workdir", "/workspace",
      this.options.image,
      "sh", "-lc", command,
    ];

    return await new Promise<{ exitCode: number; stdout: string; stderr: string; network: string }>((resolvePromise, reject) => {
      const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Sandbox command exceeded ${this.options.commandTimeoutMs}ms timeout`));
      }, this.options.commandTimeoutMs);

      child.stdout.on("data", (chunk) => { stdout = limitedAppend(stdout, chunk); });
      child.stderr.on("data", (chunk) => { stderr = limitedAppend(stderr, chunk); });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`Unable to start Docker sandbox: ${error.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolvePromise({
          exitCode: code ?? -1,
          stdout,
          stderr,
          network: this.options.allowContainerNetwork ? "bridge" : "none",
        });
      });
    });
  }

  private async fetchAllowed(rawUrl: unknown) {
    if (typeof rawUrl !== "string") throw new Error("http.fetch requires a URL");
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") throw new Error("Only HTTPS network requests are allowed");
    if (!allowedHost(url.hostname, this.options.allowedHosts)) {
      throw new Error(`Host ${url.hostname} is not declared in the skill network permission`);
    }
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    return {
      status: response.status,
      contentType,
      body: Buffer.from(text).subarray(0, MAX_OUTPUT_BYTES).toString("utf8"),
      truncated: Buffer.byteLength(text) > MAX_OUTPUT_BYTES,
    };
  }

  async close() {
    if (!this.workspacePromise) return;
    const workspace = await this.workspacePromise;
    await rm(workspace, { recursive: true, force: true });
    this.workspacePromise = undefined;
  }
}

export function createDockerSandboxForSkill(skill: SkillBundle) {
  const allowNetwork = process.env.SANDBOX_UNSAFE_ALLOW_NETWORK === "true" && skill.manifest.permissions.network.length > 0;
  return new DockerSandboxExecutor({
    image: process.env.SANDBOX_DOCKER_IMAGE,
    sourceDir: process.env.SANDBOX_SOURCE_DIR,
    allowedHosts: skill.manifest.permissions.network,
    allowContainerNetwork: allowNetwork,
    commandTimeoutMs: Number(process.env.SANDBOX_COMMAND_TIMEOUT_MS ?? 120_000),
  });
}

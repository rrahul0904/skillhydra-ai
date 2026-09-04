import { createHash } from "node:crypto";
import type { SkillBundle, SkillManifest, SkillPermissions } from "@skillhydra/core";

const defaultPermissions: SkillPermissions = {
  network: [],
  filesystem: { read: [], write: [] },
  subprocess: false,
  browser: false,
  deploy: false,
};

function scalar(value: string): string | boolean {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontMatter(frontMatter: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let top = "";
  let permissionSection = "";
  let filesystemSection = "";

  for (const rawLine of frontMatter.split("\n")) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    if (indent === 0 && line.includes(":")) {
      const [key, ...rest] = line.split(":");
      top = key.trim();
      permissionSection = "";
      filesystemSection = "";
      const rawValue = rest.join(":").trim();
      if (rawValue) result[top] = scalar(rawValue);
      else if (top === "permissions") result[top] = {};
      else result[top] = [];
      continue;
    }

    if (top === "permissions") {
      const permissions = result.permissions as Record<string, unknown>;
      if (indent === 2 && line.includes(":")) {
        const [key, ...rest] = line.split(":");
        permissionSection = key.trim();
        filesystemSection = "";
        const rawValue = rest.join(":").trim();
        if (permissionSection === "filesystem") permissions.filesystem = {};
        else if (rawValue) permissions[permissionSection] = scalar(rawValue);
        else permissions[permissionSection] = [];
        continue;
      }
      if (permissionSection === "filesystem" && indent === 4 && line.endsWith(":")) {
        filesystemSection = line.slice(0, -1).trim();
        const filesystem = permissions.filesystem as Record<string, unknown>;
        filesystem[filesystemSection] = [];
        continue;
      }
      if (line.startsWith("- ")) {
        const item = scalar(line.slice(2));
        if (permissionSection === "filesystem" && filesystemSection) {
          const filesystem = permissions.filesystem as Record<string, unknown>;
          (filesystem[filesystemSection] as unknown[]).push(item);
        } else if (Array.isArray(permissions[permissionSection])) {
          (permissions[permissionSection] as unknown[]).push(item);
        }
      }
      continue;
    }

    if (line.startsWith("- ") && Array.isArray(result[top])) {
      (result[top] as unknown[]).push(scalar(line.slice(2)));
    }
  }

  return result;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parseSkillMarkdown(markdown: string, source = "inline:skill"): SkillBundle {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("SKILL.md must include YAML front matter");

  const metadata = parseFrontMatter(match[1]);
  const instructions = match[2].trim();
  if (!metadata.name || typeof metadata.name !== "string") throw new Error("Skill name is required");

  const rawPermissions = (metadata.permissions ?? {}) as Record<string, unknown>;
  const rawFilesystem = (rawPermissions.filesystem ?? {}) as Record<string, unknown>;

  const manifest: SkillManifest = {
    name: metadata.name,
    version: typeof metadata.version === "string" ? metadata.version : "0.1.0",
    displayName: typeof metadata.displayName === "string" ? metadata.displayName : metadata.name,
    description: typeof metadata.description === "string" ? metadata.description : "Portable AI skill",
    source,
    tools: asStringArray(metadata.tools),
    permissions: {
      ...defaultPermissions,
      network: asStringArray(rawPermissions.network),
      filesystem: {
        read: asStringArray(rawFilesystem.read),
        write: asStringArray(rawFilesystem.write),
      },
      subprocess: rawPermissions.subprocess === true,
      browser: rawPermissions.browser === true,
      deploy: rawPermissions.deploy === true,
    },
    tags: asStringArray(metadata.tags),
  };

  const checksum = createHash("sha256").update(normalized).digest("hex");
  return { manifest, instructions, checksum };
}

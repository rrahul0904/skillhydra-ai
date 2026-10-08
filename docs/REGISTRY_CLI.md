# SkillHydra Registry CLI

The CLI is the local write-side companion to the hosted registry inspector. The web app can discover, pin and inspect public GitHub skills. The CLI performs local installation only after the user approves the exact content digest.

## Security contract

- planning is read-only;
- source directories and install targets refuse symlinks;
- only bounded text skill files are accepted in the current clean-room implementation;
- install destinations are derived from agent + scope + validated skill name, never arbitrary user paths;
- the exact SHA-256 content digest must be supplied again with `--approve-digest`;
- a second `--apply` flag is required before any filesystem write;
- static `blocked` findings refuse installation even with an approved digest;
- third-party scripts are copied but never executed by the installer;
- successful installs are re-read and checksum-verified;
- `.skillhydra/registry-lock.json` records the exact receipt;
- an existing target is backed up before replacement and can be restored by rollback.

## Commands

Read-only plan:

```bash
npm run registry:cli -- plan \
  --source ./path/to/pinned-skill \
  --name frontend-design \
  --agent codex \
  --scope project
```

The plan prints the exact source digest. After reviewing that exact content, install with both the digest and the explicit apply gate:

```bash
npm run registry:cli -- install \
  --source ./path/to/pinned-skill \
  --name frontend-design \
  --agent codex \
  --scope project \
  --approve-digest <64-character-sha256> \
  --apply
```

Rollback:

```bash
npm run registry:cli -- rollback \
  --name frontend-design \
  --agent codex \
  --scope project \
  --apply
```

Supported targets: Claude Code, Codex, Cursor, Gemini CLI, Windsurf, OpenCode and universal `.agents` layout.

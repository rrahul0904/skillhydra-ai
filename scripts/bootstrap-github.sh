#!/usr/bin/env bash
set -euo pipefail

OWNER="${GITHUB_OWNER:-rrahul0904}"
REPO="${GITHUB_REPO:-skillhydra-ai}"
VISIBILITY="${GITHUB_VISIBILITY:-public}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required: https://cli.github.com/" >&2
  exit 1
fi

gh auth status >/dev/null

if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO" \
    --"$VISIBILITY" \
    --description "Clean-room skill-to-agent platform with isolated runtimes, approvals, secure tools, and Talk-to-Skill workflows"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/$OWNER/$REPO.git"
fi

git push -u origin main

echo "Published: https://github.com/$OWNER/$REPO"

#!/usr/bin/env bash
# Pre-push branch-name gate. See skills/git-hygiene/SKILL.md § Step 4.
# Rejects pushes directly to `main` and enforces <type>/<kebab-slug> naming.
# Canonical copy lives at skills/git-hygiene/scripts/check-branch-name.sh;
# this root-level copy is what lefthook executes (CWD is repo root).

set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)

if [[ "$branch" == "main" ]]; then
  echo "Pushing directly to main is not allowed." >&2
  exit 1
fi

if ! [[ "$branch" =~ ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)/[a-z0-9-]+$ ]]; then
  echo "Branch name '$branch' does not follow <type>/<kebab-slug> convention." >&2
  echo "Examples: feat/rsc-boundary-audit, fix/frontmatter-schema-null, docs/readme-install" >&2
  exit 1
fi

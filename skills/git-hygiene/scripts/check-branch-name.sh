#!/usr/bin/env bash
# Pre-push branch-name gate. See skills/git-hygiene/SKILL.md § Step 4.
# Canonical source of the script; the repo's /scripts/check-branch-name.sh is
# an identical copy invoked by lefthook. Kept in sync by skills/git-hygiene
# evals (Step 2).

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

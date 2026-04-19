#!/usr/bin/env bash
# Pre-push branch-name gate. See skills/git-hygiene/SKILL.md § Step 4.
# This script lives at two paths that must stay byte-identical:
#   - scripts/check-branch-name.sh               (executed by lefthook)
#   - skills/git-hygiene/scripts/check-branch-name.sh   (skill asset)
# Parity is enforced by scripts/validate-skills.ts. Edit either file and the
# pre-push hook will fail on the typecheck step until they match.

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

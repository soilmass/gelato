---
name: git-hygiene
description: >
  Apply disciplined git practices: Conventional Commits format, atomic commits,
  imperative-mood subjects, meaningful bodies, clean branch names, rebase
  discipline, and pre-commit hook compliance. Produces commits that read as
  project history, not as a changelog of work sessions.
  Use when: committing code, writing a commit message, opening a PR, cleaning
  up a branch before merge, resolving commit hook failures, "what should the
  commit message be", "squash these commits", "should this be one commit or
  two".
  Do NOT use for: git troubleshooting (merge conflicts, detached HEAD, reflog
  recovery), setting up hooks (handled by lefthook.yml), release versioning
  (handled by Changesets).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: foundations
  phase: build
  type: procedural
  methodology_source:
    - name: "Conventional Commits 1.0.0"
      authority: "conventionalcommits.org (community spec)"
      url: "https://www.conventionalcommits.org/en/v1.0.0/"
      version: "1.0.0"
      verified: "2026-04-18"
    - name: "How to Write a Git Commit Message"
      authority: "Chris Beams"
      url: "https://cbea.ms/git-commit/"
      version: "2014 (stable canonical essay)"
      verified: "2026-04-18"
  stack_assumptions:
    - "git 2.40+"
    - "lefthook for hooks"
    - "commitlint for commit format"
    - "changesets for versioning"
    - "GitHub as remote"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.238Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Shipped pre-built in v0.1 handoff so Claude Code uses it
    from the first commit of repo scaffolding. Eval deferred until the eval
    runner exists (Step 2 of BRIEF.md build order).
---

# git-hygiene

Encodes Conventional Commits and Chris Beams's commit-message discipline for a Bun + Changesets + Lefthook repo. Produces commits that read as project history — atomic, imperative, explained — not as a timeline of what the author happened to save.

---

## Methodology Attribution

- **Primary:** Conventional Commits 1.0.0 — community spec for machine-parseable commit messages
  - URL: https://www.conventionalcommits.org/en/v1.0.0/
  - Version: 1.0.0
  - Verified: 2026-04-18
- **Secondary:** Chris Beams, *How to Write a Git Commit Message* — canonical essay on commit-message craft
  - URL: https://cbea.ms/git-commit/
  - Version: 2014 essay, stable
  - Verified: 2026-04-18
- **Drift-check:** `.github/workflows/drift-conventional-commits.yml` (weekly)

Encoded: message format, atomic commits, imperative subjects, body-when-needed discipline, branch naming, rebase-before-merge practice, hook compliance, secret hygiene, Claude co-authoring.

NOT encoded: merge-conflict resolution, reflog recovery, interactive rebase as a general tool, git aliases or tooling preferences, release versioning (Changesets owns that).

---

## Stack Assumptions

- git 2.40+
- Lefthook for commit-msg / pre-commit / pre-push hooks
- Commitlint with `@commitlint/config-conventional`
- Changesets for versioning and changelog
- GitHub for remote, PRs, CI

If your stack differs, fork the suite.

---

## When to Use

Activate when any of the following is true:
- About to run `git commit`
- Writing a commit message for someone else's change
- Opening a PR and writing its description
- Squashing commits before merge
- Asked "what should the commit message be"
- A pre-commit or commit-msg hook fails
- Reviewing a branch's commit history before merge

## When NOT to Use

Do NOT activate for:
- Merge conflict resolution — git knowledge, not hygiene
- Reflog recovery — diagnostic, not preventive
- Setting up hooks — handled by `lefthook.yml`, not a skill
- Release versioning and changelog generation — Changesets owns this
- Rewriting published history — don't, and this skill won't help you

---

## Procedure

### Step 1 — Decide the commit boundary before staging

Ask: does this change express one logical unit?

- **Yes** → stage and commit as one
- **No** → split. `git add -p` (patch mode) is the default tool

A commit is one logical unit when:
- Revertable cleanly (reverting does not leave the repo half-working)
- Describable in one sentence without "and"
- All files changed serve the same intent

Renames are one unit. Format-only changes are one unit. Refactors are one unit *per refactor*, not one commit for five.

### Step 2 — Write the subject line

Format:

```
<type>(<scope>): <subject>
```

Types (locked — extending requires a Commitlint config change):

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `docs` | Docs-only change |
| `style` | Formatting, whitespace (no behavior change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system, dependencies |
| `ci` | CI config, scripts |
| `chore` | Housekeeping (no prod code) |
| `revert` | Reverts a prior commit |

**Scope** is optional but preferred. For Gelato: `skills`, `evals`, `docs`, `scripts`, `deps`, `schema`, or a skill name (`core-web-vitals-audit`).

**Subject rules (Beams):**

1. Imperative mood — *"add"*, not *"added"* or *"adds"*
2. Capitalize the first word after the colon
3. No period at the end
4. ≤ 72 characters total line length
5. Describe the change, not the file touched — *"add auth middleware"* beats *"modify middleware.ts"*

**Examples:**

Good:
- `feat(skills): add core-web-vitals-audit skill`
- `fix(eval-runner): handle empty Lighthouse CI output`
- `docs: clarify stack assumptions in TEMPLATE.md`
- `chore(deps): bump vitest to 2.1`

Bad:
- `Updated files` — no type, no detail
- `feat: added new skill.` — past tense + period
- `fix(skills/core-web-vitals-audit/SKILL.md): fix typo in section 3.2.1` — file path in subject, too long
- `wip` — not a commit worth keeping

### Step 3 — Write the body when needed

Include a body when **any** of these is true:
- The change is not obvious from the subject
- The change has non-obvious rationale (why, not what)
- The change has consequences for other parts of the codebase
- The commit reverts, references, or fixes another commit
- This is a `feat` or `fix` touching user-facing behavior

Body rules:
- Blank line between subject and body
- Wrap at 72 characters
- Explain *why*, not *what* (the diff shows what)
- Reference issues/PRs at the bottom (`Refs: #42`, `Closes: #17`, `Reverts: abc123`)

**Example:**

```
feat(eval-runner): cache Promptfoo responses by input hash

LLM-as-judge calls were running twice per eval — once during
test collection and once during execution. Caching at the hash
layer (rather than the Promptfoo config layer) survives both.

Drops average eval runtime from 45s to 18s locally and cuts
Anthropic API spend per CI run by ~60%.

Refs: #14
```

### Step 4 — Branch naming

Format: `<type>/<short-slug>`

Examples:
- `feat/rsc-boundary-audit`
- `fix/frontmatter-schema-null`
- `docs/readme-install-instructions`
- `chore/bump-turbo`

Rules: lowercase, kebab-case, no trailing slashes, no author names, no ticket numbers unless tied to external tracking.

Never push to `main` directly. All work goes through a branch + PR, even for docs.

### Step 5 — Rebase before merge

Before opening a PR (or before merging if the PR is yours):

```bash
git fetch origin
git rebase origin/main
```

If conflicts arise, resolve them on the branch. **Never merge `main` into a feature branch** — history becomes unreadable.

Squash-merge is the default for small PRs. Keep-all-commits is correct only for PRs where individual commits tell a meaningful story (rare — most PRs are one logical unit developed incrementally).

### Step 6 — PR descriptions

Follow the template at `.github/PULL_REQUEST_TEMPLATE.md` (create during scaffolding if missing). Minimum fields:

- **What:** one sentence, same shape as the commit subject
- **Why:** the motivation
- **How:** notable implementation decisions
- **Testing:** evals run, manual testing performed
- **Rollback:** how to revert if this breaks (mandatory for `feat` and `fix`)

Link relevant commits, issues, methodology sources.

### Step 7 — Hook compliance

When a pre-commit, commit-msg, or pre-push hook fails:

1. Read the error output. Fix the underlying issue.
2. Re-stage. Re-commit.

**Do not bypass hooks** with `--no-verify`. The hook failed because something was wrong. If the hook itself is broken, fix the hook — do not route around it.

The only acceptable hook bypass: `git commit --allow-empty` for intentional empty commits (e.g., triggering CI). Document the reason in the commit body.

### Step 8 — Secret hygiene

Gitleaks runs pre-commit. If it fires:

1. **Never commit the secret, even in a subsequent commit** — it stays in git history
2. **Rotate the exposed secret immediately**
3. Remove the file or line, commit the clean version
4. If the secret was already pushed: rewrite history (BFG or `git filter-repo`) AND rotate AND notify anyone with clone access

`.gitignore` from commit 0:
- `.env`, `.env.*` (except `.env.example`)
- `*.pem`, `*.key`
- `.doppler.yaml`
- Any tool-specific secret file

### Step 9 — When Claude writes the commit

When Claude Code produces a commit during Gelato's own build:

- Compose the message per Steps 2–3
- Include a trailer identifying Claude as co-author if Claude wrote more than half of the change:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

GitHub renders this as a second author on the commit. **Do not stuff this into every commit** — only where Claude was the actual primary author. Do not sign commits as if they were human-authored when they were not.

---

## Hard Thresholds

Enforced by Commitlint + pre-commit hooks. The eval verifies these mechanically:

- Subject line ≤ 72 chars
- Subject uses one of the 11 locked Conventional Commits types
- Subject uses imperative mood (heuristic check; LLM-as-judge for ambiguous cases)
- Body wraps at 72 chars (when body is present)
- No commits with subject `wip`, `update`, `fix`, `misc`, or bare `chore` without a body

---

## Tool Integration

**Lefthook config (`lefthook.yml`, commit-related hooks):**

```yaml
commit-msg:
  commands:
    commitlint:
      run: bunx commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,jsx,json}"
      run: bunx biome check --apply {staged_files}
      stage_fixed: true
    gitleaks:
      run: gitleaks protect --staged --no-banner

pre-push:
  commands:
    branch-name:
      run: bash scripts/check-branch-name.sh
    typecheck:
      run: bunx tsc --noEmit
```

**Commitlint config (`commitlint.config.ts`):**

```ts
import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 72],
    'type-enum': [
      2,
      'always',
      [
        'feat', 'fix', 'docs', 'style', 'refactor',
        'perf', 'test', 'build', 'ci', 'chore', 'revert',
      ],
    ],
  },
};

export default config;
```

**PR template (`.github/PULL_REQUEST_TEMPLATE.md`):**

```markdown
## What

<one sentence>

## Why

<motivation>

## How

<notable implementation decisions>

## Testing

- [ ] Evals run locally
- [ ] Manual testing performed (describe)

## Rollback

<how to revert>

Refs: #
```

**Branch-name check (`scripts/check-branch-name.sh`):**

```bash
#!/usr/bin/env bash
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" == "main" ]]; then
  echo "Pushing directly to main is not allowed." >&2
  exit 1
fi

if ! [[ "$branch" =~ ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)/[a-z0-9-]+$ ]]; then
  echo "Branch name '$branch' does not follow <type>/<kebab-slug> convention." >&2
  exit 1
fi
```

---

## Examples

### Example 1 — Splitting a combined diff

**Input:** Claude has made three changes in one working tree: fixed a typo in README, added a new skill, bumped a dependency. Single unstaged diff.

**Output:**

```bash
# Commit the typo fix first
git add README.md
git commit -m "docs: fix typo in install instructions"

# Commit the dependency bump
git add package.json bun.lockb
git commit -m "chore(deps): bump vitest to 2.1"

# Commit the new skill
git add skills/core-web-vitals-audit/
git commit -m "feat(skills): add core-web-vitals-audit skill

Encodes web.dev's Core Web Vitals methodology (2024-Q4 revision,
post-INP) for Next.js App Router apps. Includes full eval with
a fixture app exhibiting known regressions.

Refs: #3

Co-Authored-By: Claude <noreply@anthropic.com>"
```

Three logical units, three commits, each revertable independently.

### Example 2 — Rewriting a vague message

**Input:** User proposes: `updated the thing for the stuff`

**Output:** Rewrite required. Answer three questions, then rewrite:
- What type? (`feat`, `fix`, `docs`, etc.)
- What scope? (which part of the codebase)
- What changed, and why?

Do not guess at what the message should be. Ask or read the diff. Once known, rewrite:
- `refactor(eval-runner): extract pass-rate writer into its own script`
- `fix(schema): accept array form for methodology_source`

### Example 3 — Hook failure

**Input:** Commit fails with Commitlint error: `subject may not be empty`.

**Output:** The commit message was malformed (likely missing subject after the colon). Fix:

```bash
git commit --amend
```

Write a proper subject. **Do not use `--no-verify`.** If the hook is firing on a legitimate message, the hook has a bug — fix the hook (file an issue, patch `commitlint.config.ts`), do not bypass it.

---

## Edge Cases

- **Work interrupted mid-commit:** `git stash` cleanly, resume later with `git stash pop`. Never `git commit -m "wip"` and push.
- **Squashing a messy branch before merge:** `git rebase -i origin/main`, squash into one clean commit, force-push with `--force-with-lease` (never plain `--force`).
- **Reverting a merged commit:** `git revert <sha>`. Never `git reset` on a pushed branch.
- **Mass refactor touching 200 files:** still one logical unit if the refactor is one change (e.g., renaming a function across the codebase). One commit, long body explaining the why and the tool used.
- **Dependabot / Renovate commits:** pass through as-is. They already follow Conventional Commits.
- **Initial scaffolding commit:** `chore: initial scaffolding` is acceptable for commit 0 only. Every subsequent commit follows the full discipline.

---

## Evaluation

See `/evals/git-hygiene/` for the canonical eval suite. Eval type: **hybrid** (quantitative format checks + qualitative judgment).

### Pass criteria

**Quantitative:**
- 100% of 30 fixture commit messages parse under Commitlint without error
- 0 false positives on 10 legitimate-but-unusual commits (reverts, squash-merges, dep bumps)
- Subject-line heuristics (length, imperative mood, forbidden subjects) catch ≥95% of fixture violations

**Qualitative (LLM-as-judge via Promptfoo):**
- Generated commit messages for 15 diverse diffs score ≥0.85 on "explains the why, not the what"
- Branch naming recommendations score ≥0.9 on adherence to `<type>/<kebab-slug>`
- PR descriptions include all five mandatory fields

### Eval status

This skill ships pre-built in the v0.1 handoff. Its formal eval is **deferred to Build Step 3** (alongside the first reference skill), because the eval runner needs to exist first.

Until the formal eval runs, this skill is validated by Claude Code's use of it during Gelato's own build. If the build's commit history passes `bunx commitlint --from=<initial-commit> --to=HEAD`, the skill is working.

---

## Handoffs

This skill is scoped to commit-level discipline. Explicitly NOT absorbed:

- **Release versioning and changelog generation** → Changesets (a tool, not a skill)
- **Merge conflict resolution** → separate skill if/when needed
- **Git tooling setup** (installing, aliases, config) → `project-scaffold` (v0.2+)
- **CI/CD pipeline** → `ci-cd-next-on-vercel` (v0.2)

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** git ≥ 2.40, Bun, Lefthook, Commitlint, Gitleaks (per TOOL_MANIFEST.md)

---

## References

- `references/conventional-commits-quick-ref.md` — cheat sheet for the 11 locked types
- `references/beams-seven-rules.md` — Chris Beams's seven rules summarized

## Scripts

- `scripts/check-branch-name.sh` — pre-push hook validating branch naming

# Gelato Tool Manifest

Use these tools. Do not substitute alternatives. If you think a tool is missing, stop and ask — do not write custom code for something a tool already solves.

Version pins shown are minimum versions. Use the latest stable within the major version unless otherwise noted.

---

## Core toolchain

### Bun — runtime + package manager
```bash
curl -fsSL https://bun.sh/install | bash
```
- Version: `1.1.x` or later
- Usage: all scripts, package management, monorepo workspaces
- Lockfile: `bun.lockb`
- `package.json` must have `"packageManager": "bun@1.1.0"` and `"engines": { "bun": ">=1.1.0" }`

### Turborepo — monorepo pipeline
```bash
bun add -D turbo
```
- Version: `2.x` or later
- Config: `turbo.json`
- Pipelines: `build`, `test`, `lint`, `eval`, `dev`

### TypeScript
```bash
bun add -D typescript
```
- Version: `5.5+`
- `strict: true`, `noUncheckedIndexedAccess: true`
- Root `tsconfig.json` extends to packages

---

## Code quality

### Biome — lint + format (replaces ESLint + Prettier)
```bash
bun add -D --exact @biomejs/biome
bunx biome init
```
- Version: `1.9+`
- Config: `biome.json`
- Do **not** install ESLint, Prettier, or their plugins

### Lefthook — git hooks (replaces Husky)
```bash
bun add -D lefthook
bunx lefthook install
```
- Version: `1.7+`
- Config: `lefthook.yml`
- Hooks to configure:
  - `pre-commit`: Biome format + Gitleaks scan
  - `commit-msg`: Commitlint
  - `pre-push`: typecheck (fast), skill-validator

### Commitlint + Conventional Commits
```bash
bun add -D @commitlint/cli @commitlint/config-conventional
```
- Config: `commitlint.config.ts`
- Extends: `@commitlint/config-conventional`
- Integrates with Lefthook `commit-msg` hook

### Changesets — versioning + changelog
```bash
bun add -D @changesets/cli @changesets/changelog-github
bunx changeset init
```
- Version: `2.27+`
- Config: `.changeset/config.json`
- Release automation: `.github/workflows/release.yml` uses `changesets/action@v1`

---

## Security

### Gitleaks — secret scanning
```bash
# Homebrew on macOS; binary on Linux/Windows
brew install gitleaks
```
- Invoked as a Lefthook `pre-commit` hook
- Config: `.gitleaks.toml` (default rules are fine; add `allowlist` if needed)

### Semgrep — SAST (CI only)
```bash
# Invoked in CI via official action
# uses: returntocorp/semgrep-action@v1
```
- **Do not** run Semgrep as a git hook — too slow for local use
- Config: `.semgrep.yml` with `p/javascript` and `p/typescript` rule packs
- CI workflow: `.github/workflows/ci.yml` includes a semgrep step

### Socket.dev — supply chain (GitHub App only)
- Install as a GitHub App on the repo: https://socket.dev
- No config files needed; it comments on PRs automatically
- **Do not** install an npm package or run locally

---

## Schema + parsing

### Zod — schema validation
```bash
bun add zod
```
- Version: `3.23+`
- Use for SKILL.md frontmatter schema in `packages/schema/`
- Export JSON Schema via `zod-to-json-schema` for IDE tooling

### gray-matter — frontmatter parsing
```bash
bun add gray-matter
```
- Version: `4.x`
- Use for reading/writing SKILL.md frontmatter in `scripts/update-pass-rate.ts` and validator

---

## Eval stack

### Vitest — test + eval runner
```bash
bun add -D vitest
```
- Version: `2.x` or later
- Config: `vitest.config.ts` per workspace
- Evals live in `evals/<skill>/eval.test.ts`
- Reporters: `default` for dev, `json` for CI (piped to `scripts/update-pass-rate.ts`)

### Promptfoo — prompt eval helper library
```bash
bun add -D promptfoo
```
- Version: `0.90+`
- Used as a **library** (imported from Vitest tests), not a separate runner
- Config files: `evals/<skill>/promptfoo.yaml`
- Supplies: LLM-as-judge, prompt templating, response caching
- Provider: Anthropic Claude (via `ANTHROPIC_API_KEY` env var)

### Lighthouse CI — performance eval
```bash
bun add -D @lhci/cli
```
- Invoked from metric-type eval tests (e.g., `core-web-vitals-audit`)
- Wrapped by `packages/eval-harness/src/lighthouse.ts`

### Playwright — E2E testing
```bash
bun add -D @playwright/test
bunx playwright install --with-deps chromium
```
- Used by fixture apps in metric evals and by `playwright-e2e` skill (v0.2)

---

## Skill discovery + search

### MiniSearch — client-side full-text search
```bash
bun add minisearch
```
- Version: `7.x`
- Used in the `/find-skill` slash command and the docs site skill search
- Index is built at docs-build time from all SKILL.md frontmatter + first paragraph

---

## Docs site

### Nextra 3 — Next.js-native docs framework
```bash
bun create nextra@latest docs
```
- Version: `3.x` (use the latest beta/stable as of 2026)
- Lives in `docs/` workspace
- Auto-generates skill pages from `skills/*/SKILL.md` via a custom loader
- Deploys to Vercel

### shadcn/ui charts (Recharts)
```bash
bunx shadcn@latest add chart
```
- Used in the docs-site benchmark dashboard (tiny surface in v0.1)
- Do not install Tremor

---

## CI + release

### GitHub Actions
All workflows in `.github/workflows/`:

| Workflow | Purpose | Trigger |
|---|---|---|
| `ci.yml` | Typecheck, Biome, Semgrep, skill-validator, eval smoke test | PR + push |
| `eval.yml` | Full eval run, updates pass rates, fails on regression > 0.05 | PR touching skills/** or evals/**, nightly |
| `release.yml` | Changesets → version bump → GitHub Release → npm publish | Push to main |
| `drift-check-*.yml` | Weekly: fetch upstream methodology sources; open PR on drift | Schedule |

### Renovate — dependency updates
```json
// renovate.json
{
  "extends": ["config:recommended", ":semanticCommits"]
}
```
- Enable via GitHub App: https://github.com/apps/renovate
- Do **not** install Dependabot

### publint — package.json sanity
```bash
bun add -D publint
```
- CI step: `bunx publint` after build
- Catches common publishing mistakes before release

---

## Scripting (the small custom surface)

These scripts are intentionally hand-rolled, not dependencies. Keep them short (≤100 lines each) and in plain TypeScript executed by Bun.

| Script | Purpose | Approx LOC |
|---|---|---|
| `scripts/new-skill.ts` | Scaffolds a new skill from TEMPLATE.md | ~40 |
| `scripts/validate-skills.ts` | Walks `skills/`, validates frontmatter via Zod schema | ~60 |
| `scripts/eval.ts` | Orchestrates Vitest eval runs across workspaces | ~40 |
| `scripts/update-pass-rate.ts` | Parses Vitest JSON, writes pass_rate to SKILL.md frontmatter | ~80 |

Do **not** import Plop.js, Hygen, or any scaffolding framework. These four scripts are simple enough to own.

---

## What NOT to install (common drift temptations)

| Avoid | Reason |
|---|---|
| Husky | Use Lefthook |
| ESLint, Prettier | Use Biome |
| npm, pnpm, yarn | Use Bun |
| Jest | Use Vitest |
| Dependabot | Use Renovate |
| Tremor | Defer; shadcn charts are enough |
| Fumadocs | Defer; Nextra 3 is safer |
| Plop.js, Hygen | Hand-roll the scaffolder |
| release-please | Use Changesets |
| Prisma | Drizzle is locked |
| ESLint + Prettier plugins of any kind | Biome covers both |

---

## Manifest version

This manifest is v1.0. If a tool choice needs to change, bump the manifest version and document the reason in `.changeset/` with a `minor` bump. Do not silently drift.

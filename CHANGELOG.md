# Changelog

All notable changes to Gelato are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-04-19

**Core 1 complete.** 19 skills shipped across 11 subsystems and three lifecycle phases (build, verify, run), each with methodology citations, a deterministic classifier eval at `pass_rate = 1.0`, and (for 16 of 19) a live LLM-as-judge qualitative rubric gated on `ANTHROPIC_API_KEY`.

### Added — new skills (15)

**Build phase:**

- `security-headers` — OWASP Secure Headers + Next.js header config. Four-class classifier over `middleware.ts` / `next.config.ts`. Fix-orderedness LLM rubric.
- `metadata-and-og` — Google Search Central + Next.js Metadata API. Four-class shape classifier over Metadata exports. Length-rewrite LLM rubric.
- `zod-validation` — Zod parse-at-the-boundary discipline. Four-class classifier over route handlers / Server Actions / env readers. Error-response-quality LLM rubric.
- `rsc-data-fetching` — Next.js 15 App Router caching (static / ISR / dynamic). Four-class classifier. Cross-file-tag-audit LLM rubric.
- `server-actions-vs-api` — Server Action vs route handler 4-criterion decision tree. Four-class classifier. Decision-tree-grounded LLM rubric.
- `form-with-server-action` — React 19 form idiom (action binding, uncontrolled inputs, pending state, error rendering). Four-class classifier. A11y-rubric LLM rubric.
- `shadcn-tailwind-v4` — Tailwind v4 migration + shadcn/ui conventions. Four-class classifier across CSS / JS-config / TSX fixtures. Cva-idiom LLM rubric.
- `auth-flow-review` — OWASP ASVS v4 + Auth.js v5 auth-flow checks. Four-class classifier. Session-architecture LLM rubric.

**Verify phase:**

- `bundle-budget` — Addy Osmani performance budget + `@next/bundle-analyzer`. Four-class classifier over JSON build reports. Library-severity LLM rubric.
- `playwright-e2e` — Playwright Best Practices (web-first assertions, semantic locators, no hardcoded waits, no committed `test.only`). Four-class classifier. E2e-test-meaningfulness LLM rubric.
- `tdd-cycle` — Kent C. Dodds Testing Trophy + testing-library guiding principles. Four-class classifier. Unit-test-meaningfulness LLM rubric.

**Run phase:**

- `structured-logging` — Pino + OpenTelemetry field conventions. Four-class classifier with scope-aware `console.*` detection. Log-design-quality LLM rubric.
- `sentry-setup` — `@sentry/nextjs` configuration discipline. Four-class classifier. Alert-coverage LLM rubric.
- `event-taxonomy-and-instrumentation` — PostHog + Amplitude North Star event naming. Four-class classifier. Taxonomy-coherence LLM rubric.
- `ci-cd-next-on-vercel` — GitHub Actions + Vercel deployment hygiene. Four-class classifier over workflow YAML. Pipeline-design LLM rubric.

### Added — already in v0.1.0 (4)

- `git-hygiene` — Conventional Commits + atomic commits. 60 fixtures. Three LLM rubrics (explains-the-why, branch-naming, pr-completeness).
- `core-web-vitals-audit` — web.dev metrics (CLS / LCP / INP → TBT). Lighthouse-driven. CWV thresholds are the rubric.
- `rsc-boundary-audit` — React Server Component boundary rules. 5-class classifier. Implementability + groundedness LLM rubrics.
- `drizzle-migrations` — PlanetScale expand/contract migrations. 4-class SQL classifier. Quant-only by design.

### Added — release infrastructure

- **LLM-as-judge harness** (`packages/eval-harness/src/judge.ts`): spawns Promptfoo as a subprocess, parses reports, returns averaged scores. Gated on `ANTHROPIC_API_KEY`.
- **Pass-rate regression gate** (`scripts/check-pass-rate-regression.ts` + `.github/workflows/eval.yml`): CI fails if any skill's `pass_rate` drops by > 0.05 vs the base branch.
- **Docs auto-generation** (`scripts/generate-docs.ts`): auto-discovers all skills from `skills/*/SKILL.md`; produces Nextra-ready `docs/app/skills/<name>/page.mdx` with frontmatter preamble.
- **Release scaffolding**: `.changeset/` configured; `publint` + `check:publish` scripts; first Changeset targeting `@gelato/schema@0.2.0` + `@gelato/eval-harness@0.2.0`.

### Added — eval hardening

- **git-hygiene fixtures 27 → 60**: all 11 Conventional Commit types covered, boundary cases at exactly 72 chars, unusual-but-legitimate GitHub merge commits / revert shapes / security-advisory bodies.
- **rsc-boundary-audit held-out 6 → 15**: every violation class now has adversarial stress cases plus three independent legitimate-client variants.
- **15 live Promptfoo rubrics** across 15 skills, each with one real test carrying canonical good content, one `llm-rubric` assertion, and a specific threshold (0.85 or 0.9).

### Fixed

- `scripts/generate-docs.ts` now reads `skills/` with `readdir` instead of a hardcoded 3-skill list — was blocking docs for every skill added after the pilot.
- `.changeset/config.json` repo URL corrected from `neopolitan/gelato` to `soilmass/gelato` so Changesets' Github changelog links resolve.

### Methodology source ledger

Every shipped skill cites named authorities in its frontmatter `methodology_source` array: web.dev (Addy Osmani), OWASP (ASVS v4, Secure Headers), Vercel / Next.js team (docs, deployment), Tailwind Labs, shadcn, Pino maintainers, OpenTelemetry / CNCF, Sentry, Amplitude, PostHog, Kent C. Dodds (Testing Trophy, testing-library), Microsoft (Playwright), Google Search Central, Zod (Colin McDonnell), Drizzle + PlanetScale, DORA. Each has a `verified` ISO date of 2026-04-18 and a drift-check workflow path.

### Stack assumptions (locked)

- `bun@1.1+` / `next@15+` App Router / `react@19+`
- Drizzle + Postgres (Supabase / Neon)
- Upstash Redis / Auth.js v5 / Zod / shadcn + Tailwind v4
- Vitest / Playwright / Lighthouse CI
- Pino / Sentry / PostHog / Axiom
- Vercel / GitHub Actions

### Known gaps (v0.2+)

- **Deferred sub-skills** (19 named): `seo-sitemap`, `structured-data` (JSON-LD), `cookie-hardening`, `subresource-integrity`, `file-upload-ux`, `visual-regression`, `axe-playwright`, `log-aggregation`, `otel-setup`, `server-metrics`, `pii-redaction`, `middleware-rate-limit`, `ab-testing`, `warehouse-etl`, `alert-coverage`, `session-architecture` (JWT vs session-cookie trade-offs, surfaced in `auth-flow-review`), `third-party-scripts` (CDN-loaded libs audit, surfaced in `bundle-budget`), `progressive-deploys` (blue-green / canary, surfaced in `ci-cd-next-on-vercel`), `privacy-compliance` (GDPR / CCPA beyond the mechanical PII check, surfaced in `event-taxonomy-and-instrumentation` and `structured-logging`).
- **AST upgrades**: `ts-morph` pilot for `rsc-boundary-audit` + `rsc-data-fetching`; `pg-query-parser` for `drizzle-migrations`. Regex classifiers are v0.1 territory and will evolve.
- **End-user CLI**: five `bun run <name>-audit` commands marked as v0.2 candidates across the skills — promote to `packages/cli/`.
- **Platform extensibility**: `@gelato/schema` and `@gelato/eval-harness` remain `private: true`; flipping public + publishing is a v0.2+ milestone.
- **Cores 2–6**: chartered but not scaffolded. Brand & Content, Growth & Distribution, Founder Ops, Research & Synthesis, Meta are v0.3.0+ targets.

### Verification

- `bun run validate` — 19 skills pass
- `bun run eval` — every skill at `pass_rate = 1.0` across 76 quantitative assertions
- `bun run docs:generate` — 19 pages regenerate cleanly
- `bun run publint` — `@neopolitan/gelato`, `@gelato/schema`, `@gelato/eval-harness` all "All good!"
- `bun run check:publish` — two workspace packages pending minor bump to 0.2.0

## [0.1.0] — 2026-03

Initial scaffolding plus four shipped skills (`git-hygiene`, `core-web-vitals-audit`, `rsc-boundary-audit`, `drizzle-migrations`). Deterministic classifiers, single metric skill via Lighthouse CI, full git-discipline and eval pipeline.

[0.2.0]: https://github.com/soilmass/gelato/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/soilmass/gelato/releases/tag/v0.1.0

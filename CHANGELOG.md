# Changelog

All notable changes to Gelato are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-04-19

**Core 6 — Meta.** 5 new skills that encode Gelato's own extensibility contracts, taking the suite from 32 → 37. This release also opens the schema to Cores 2–6: `core` is now a discriminated union (`web-dev` | `brand-content` | `growth-distribution` | `founder-ops` | `research-synthesis` | `meta`) with per-core `subsystem` enums, and the docs site moves from flat `/skills/<name>` to nested per-core routes `docs/app/<core>/skills/<name>/` with a 301 redirect for the prior paths.

### Added — new skills (5)

- `new-skill-review` — enforces `SKILL.md` frontmatter + body against TEMPLATE.md and the Zod `SkillMetadata` schema. Five violation classes (`frontmatter-schema-invalid`, `missing-mandated-section`, `missing-methodology-citation`, `skill-name-kebab-case-violation`, `skill-body-over-limit`). Classifier parses the candidate's own frontmatter (two-layer: the outer fixture wrapper and the inner SKILL.md content).
- `eval-harness-pattern` — enforces `evals/<name>/eval.test.ts` against the EVAL_SPEC.md Type-A / Type-B contract. Five violation classes (`eval-missing-quantitative`, `eval-missing-safe-dir`, `eval-missing-held-out`, `eval-missing-threshold`, `eval-judge-not-gated`). Metric-type evals (`runLighthouse` / `runSkillWithClaude`) are exempt from the fixture-directory rules but still subject to threshold and judge-gating rules.
- `plugin-manifest-validity` — enforces `.claude-plugin/plugin.json` against Anthropic's Plugin Reference. Five violation classes (`plugin-manifest-invalid-json`, `plugin-manifest-missing-name`, `plugin-name-not-kebab-case`, `plugin-version-not-semver`, `plugin-component-path-not-relative`). Inline object forms for `hooks` / `mcpServers` / `lspServers` are exempt from the `./`-prefix rule.
- `marketplace-submission` — enforces `.claude-plugin/marketplace.json` against Anthropic's Plugin Marketplaces reference. Five violation classes (`marketplace-missing-required-field`, `marketplace-name-reserved`, `marketplace-plugin-duplicate-name`, `marketplace-plugin-missing-source`, `marketplace-plugin-source-path-traversal`). Encodes the reserved-name list from the Plugin Marketplaces docs.
- `drift-check-workflow` — enforces `.github/workflows/drift-*.yml` against Gelato's own drift pattern (`drift-conventional-commits.yml` + BRIEF.md § build-tree + TEMPLATE.md § drift-check). Five violation classes (`drift-workflow-missing-schedule`, `drift-workflow-missing-dispatch`, `drift-workflow-missing-fetch`, `drift-workflow-missing-checkout`, `drift-workflow-missing-concurrency`). `curl`, `wget`, and `actions/checkout` are all accepted as pinned (`@v4`, full SHA).

### Added — infrastructure (prep PR)

- **`packages/schema/src/skill-frontmatter.ts`** — `core` migrated from `z.literal('web-dev')` to a discriminated union over all six cores. Each core carries its own `subsystem` enum (per-core scoping: no cross-core leakage). Exported new `CORES` tuple.
- **`scripts/generate-docs.ts`** — reads `metadata.core` and outputs to `docs/app/<core>/skills/<name>/page.mdx`.
- **`docs/next.config.mjs`** — 301 redirect from `/skills/:name` → `/web-dev/skills/:name` for external links to Core 1 pages to survive the routing migration.
- **`TEMPLATE.md`** — per-core subsystem enum table inlined.
- **`docs/app/<core>/` tree** — `meta/`, plus Core 1 skills now under `web-dev/`. `docs/app/page.mdx` still lists Core 1 only; Cores 2–5 sections appear per release.

### Changed

- `README.md` badge 32/32 → 37/37; Core 6 Meta section added.
- `SKILLS.md` rewritten as a two-core roster (Core 1 Web Dev × 32 + Core 6 Meta × 5).
- `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` version bumped to `0.4.0`; marketplace description extended to mention the Meta core.

### Fixed

_(no code fixes in v0.4.0; all changes are additive.)_

### Methodology source ledger (new)

Every new skill cites:

- **Gelato TEMPLATE.md** + `SkillMetadata` Zod schema — `new-skill-review`
- **Gelato EVAL_SPEC.md** — `eval-harness-pattern`
- **Anthropic Claude Code — Plugins Reference** (2026) — `plugin-manifest-validity`
- **Anthropic Claude Code — Plugin Marketplaces** (2026) — `marketplace-submission`
- **Gelato drift pattern** (`drift-conventional-commits.yml` + BRIEF § build-tree) — `drift-check-workflow`

Every source has a `verified: 2026-04-19` ISO date in its SKILL.md frontmatter.

### Stack assumptions (unchanged)

Still locked: `bun@1.1+`, `next@15+` App Router, `react@19+`, `typescript@5+`, `tailwindcss@4+`. Claude Code `v2.1+` called out explicitly for the plugin + marketplace skills (which encode Anthropic's current reference).

### Known gaps (v0.4+)

- **Cores 2–5 not yet shipped** — Brand & Content (12), Growth & Distribution (8), Founder Ops (7), Research & Synthesis (6). Plan is one minor release per core (v0.5 → v0.8), ending at v1.0.0 with 70 total skills.
- **Drift snapshots not yet committed** — the drift workflows fetch but only commit a sanity-check; `skills/<name>/references/` snapshots land in v0.5.0.
- **`drift-check-workflow` self-referential exemption** — the skill's own `methodology_source` is Gelato's repo file, so no external drift is needed. This is noted in the SKILL.md.
- **Plugin marketplace submission (external)** — the Gelato marketplace is ready to be listed in Anthropic's plugin marketplace, but that's a separate out-of-repo action. Tracked in follow-ups.

### Verification

- `bun run validate` — 38 skills (32 Core 1 + 5 Core 6 + `git-hygiene`) pass Zod-frontmatter validation
- `bun run eval` — every skill at `pass_rate = 1.0` across 120+ quantitative assertions
- `bun run docs:generate` — 36 pages regenerate cleanly into per-core subdirectories
- `bun run publint` — `@neopolitan/gelato`, `@gelato/schema`, `@gelato/eval-harness` all "All good!"
- `bun --cwd docs run build` — all static routes prerender

[0.4.0]: https://github.com/soilmass/gelato/compare/v0.3.0...v0.4.0

---

## [0.3.0] — 2026-04-19

**Frontend hardening pass.** 13 new skills shipped across five coordinated waves, taking Gelato from 19 → 32. Every new skill cites a canonical external authority (WCAG 2.2, WAI-ARIA APG, Deque axe-core, Next.js 15 docs, React 19 docs, Google Search Central, schema.org, sitemaps.org, BCP 47, Radix UI), ships a deterministic regex/AST classifier at `pass_rate = 1.0`, and carries a live LLM-as-judge rubric gated on `ANTHROPIC_API_KEY`.

### Added — new skills (13)

**Wave 1 — Accessibility foundation (3):**

- `a11y-mechanical-audit` — WCAG 2.2 AA + WAI-ARIA APG + axe-core 4.10 rule catalog. Five violation classes (`img-no-alt`, `input-no-label`, `interactive-without-role`, `tabindex-positive`, `target-size-too-small`). Static `.tsx` classifier; enforces WCAG 2.5.8 AA target-size at the 44×44 mobile bar. Remediation-implementability rubric.
- `radix-primitive-a11y` — Radix UI + WAI-ARIA APG per-pattern. Five composition rules (Dialog title/description, Trigger `asChild`, Combobox label, Portal for overlays). Import-gated (activates only when `@radix-ui/react-*` is imported). Composition-remediation rubric.
- `axe-playwright` — Deque axe-core + `@axe-core/playwright` + Playwright best practices. Four runtime-scan rules (spec without scan, violations ignored, disabled-rules undocumented, bestpractice-only tag set). Classifier over `*.spec.ts`. Scan-coverage-remediation rubric.

**Wave 2 — React 19 / Next.js 15 mechanics (3):**

- `error-boundary-hygiene` — Next.js error-handling + React 19 error-boundary reference. Four rules (`error.tsx` needs `'use client'`, needs `reset` prop, `global-error.tsx` needs `<html>`+`<body>`, custom class boundary needs catch method). Filename-scoped. Error-UI-implementability rubric.
- `suspense-streaming-boundaries` — Next.js streaming docs + React 19 Suspense. Four rules (async page without Suspense/loading, Suspense missing fallback, `loading.tsx` fetches data, force-dynamic with generateStaticParams). Streaming-remediation rubric.
- `intercepting-parallel-routes` — Next.js parallel + intercepting routes docs. Four filesystem rules (slot without layout prop, parallel missing default.tsx, intercepting prefix depth mismatch, intercepting without base route). Virtual-file-tree fixture format. Route-structure-remediation rubric.

**Wave 3 — Client-side discipline (2):**

- `effect-discipline` — "You Might Not Need an Effect" (react.dev) subset. Four anti-patterns (prop-to-state without reset, effect-for-derived-value, setState-without-guard infinite loop, effect-as-event-handler). Activates only on `'use client'` files; exempts subscription setup/teardown, refs, AbortController. Refactor-to-derived-value rubric.
- `optimistic-ui-wiring` — React 19 `useOptimistic` contract. Four rules (`addOptimistic` outside transition/action, fire-and-forget onClick, impure reducer, direct state mutation). Traces the setter name through callsites. Optimistic-remediation rubric.

**Wave 4 — Performance (1):**

- `next-image-font-script` — Next.js `next/image` + `next/font` + `next/script` docs. Five rules (bare `<img>` under app/, `<Image>` missing dims, page without `priority`, font init inside function body, `<Script>` without `strategy`). `opengraph-image.tsx` exempt from the bare-img rule. Asset-remediation rubric.

**Wave 5 — SEO + i18n (4):**

- `structured-data-json-ld` — Google Search Central required-field tables + schema.org. Five rules across Product, Article, BreadcrumbList, FAQPage (`@context` + required fields). Parses `<script type="application/ld+json">` bodies and `JSON.stringify(...)` expressions. Structured-data-remediation rubric.
- `seo-sitemap-robots` — sitemaps.org 0.9 + Next.js `MetadataRoute` + BCP 47. Four rules (sitemap missing `url`, bad `lastModified`, bad locale, robots missing `sitemap` ref). Sitemap-remediation rubric.
- `open-graph-image` — Next.js `opengraph-image` + `next/og` `ImageResponse`. Five rules (missing `size` / `contentType` exports, default not returning `ImageResponse`, Tailwind `className` in Satori, unsafe edge imports). OG-image-remediation rubric.
- `i18n-routing` — Next.js internationalization docs + BCP 47. Four rules (static `<html lang>` in locale tree, invalid locale literal, middleware matcher missing asset exclusions, hardcoded English when i18n lib imported). Filename-scoped. I18n-remediation rubric.

### Added — infrastructure

- **`packages/eval-harness/src/tsx-classifier.ts`** (new, 9 exports) — shared regex primitives (`stripComments`, `hasUseClient`, `hasUseServer`, `matchCloseBrace`, `matchCloseParen`, `iterateJsxOpenTags`, `parseJsxAttrs`, `extractClassNames`, `isFencedCode`) used by 9 of 13 new skills. Regex-only by contract; AST promotion is in-eval only.
- **`packages/eval-harness/src/tsx-classifier.test.ts`** — 17 unit tests covering every exported helper.
- **`vitest.config.ts`** — include pattern extended to `packages/*/src/**/*.test.ts` so harness unit tests run via `bunx vitest`.
- **`@axe-core/playwright@4.10+`** + **`axe-core@4.10+`** added as devDeps (used by `axe-playwright`).

### Changed

- `TOOL_MANIFEST.md` bumped to v1.1 — adds `@axe-core/playwright` under the eval stack; documents the Deque authority.

### Fixed

_(no code fixes in v0.3.0; all changes are additive or docs.)_

### Methodology source ledger (new)

Every new skill cites:
- **WCAG 2.2 AA** (W3C, Oct 2023) + **WAI-ARIA Authoring Practices 1.2** (2023) — `a11y-mechanical-audit`, `radix-primitive-a11y`, `axe-playwright`
- **Deque axe-core 4.10+** — `a11y-mechanical-audit`, `axe-playwright`
- **Next.js 15 docs** (error-handling, streaming, parallel routes, image/font/script, opengraph-image, sitemap, robots, internationalization) — 9 of 13 skills
- **React 19 docs** (error boundaries, Suspense, `useOptimistic`, `useTransition`, "You Might Not Need an Effect" essay) — 4 skills
- **Google Search Central** structured-data reference — `structured-data-json-ld`
- **schema.org v25** vocabulary — `structured-data-json-ld`
- **sitemaps.org 0.9 protocol** — `seo-sitemap-robots`
- **BCP 47 (RFC 5646)** — `seo-sitemap-robots`, `i18n-routing`
- **Radix UI v1.x docs** — `radix-primitive-a11y`

Every source has a `verified: 2026-04-19` ISO date in its SKILL.md frontmatter.

### Stack assumptions (unchanged)

Still locked: `bun@1.1+`, `next@15+` App Router, `react@19+`, `typescript@5+`, `tailwindcss@4+`. No new framework substitutions.

### Known gaps (v0.3+)

Still deferred from earlier:

- **View Transitions API** — React `<ViewTransition>` still experimental; Next.js integration at RFC stage. Revisit in a future release.
- **Dark-mode discipline** — `next-themes` README is blog-tier methodology; Tailwind v4 `dark:` variant is already enforced by `shadcn-tailwind-v4`. No new skill needed.
- **Rules-of-hooks / exhaustive-deps** — `eslint-plugin-react-hooks` owns this. Not a Gelato skill.
- **Visual regression** — snapshot baselines, not a mechanical classifier. Deferred.
- **`@next/eslint-plugin-next` overlap** — the `next-image-font-script` skill is mechanically a subset of Next's own ESLint plugin. Teams should run both.
- **End-user CLIs** (`bun run a11y-audit`, `bun run og-audit`, …) — still v0.2+ candidates per prior CHANGELOG; no CLI added in this release.
- **AST promotion** — classifiers that hit regex limits (Radix composition is the closest to the ceiling) will migrate to `@babel/parser` or `ts-morph` in-eval as accuracy data warrants.

### Verification

- `bun run validate` — 33 skills pass Zod-frontmatter validation
- `bun run eval` — every skill at `pass_rate = 1.0` across 108 quantitative assertions (76 existing + 32 new from the 13 Wave skills)
- `bun run docs:generate` — 32 pages regenerate cleanly
- `bun run publint` — `@neopolitan/gelato`, `@gelato/schema`, `@gelato/eval-harness` all "All good!"
- `bun --cwd docs run build` — 37 static routes prerender

[0.3.0]: https://github.com/soilmass/gelato/compare/v0.2.0...v0.3.0

---

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

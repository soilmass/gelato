# Gelato Core 1 Skill List

Core 1 — the **Web Dev** core — ships 32 skills with passing evals at v0.3.0. Every skill below has a deterministic classifier eval at `pass_rate = 1.0`, and every skill carries a live LLM-as-judge rubric. Methodology is cited upstream in each SKILL.md's `methodology_source` field.

---

## Legend

- **Type:** `procedural` (workflow discipline), `judgment` (decision tree), `metric` (hard numbers enforced by eval)
- **Phase:** `build` (Phase 1), `verify` (Phase 2), `run` (Phase 3)

---

## The 32 shipped skills

| # | Skill | Subsystem | Phase | Type | Methodology Source |
|---|---|---|---|---|---|
| 1 | [`git-hygiene`](./skills/git-hygiene/SKILL.md) | foundations | build | procedural | Conventional Commits 1.0 + Chris Beams |
| 2 | [`drizzle-migrations`](./skills/drizzle-migrations/SKILL.md) | data | build | procedural | PlanetScale expand/contract + Drizzle docs |
| 3 | [`rsc-data-fetching`](./skills/rsc-data-fetching/SKILL.md) | data | build | procedural | Next.js App Router caching docs |
| 4 | [`zod-validation`](./skills/zod-validation/SKILL.md) | data | build | procedural | Zod docs + Next.js Server Actions |
| 5 | [`server-actions-vs-api`](./skills/server-actions-vs-api/SKILL.md) | server | build | judgment | Vercel Server Actions guidance |
| 6 | [`form-with-server-action`](./skills/form-with-server-action/SKILL.md) | ui | build | procedural | Next.js Forms + React Hook Form |
| 7 | [`shadcn-tailwind-v4`](./skills/shadcn-tailwind-v4/SKILL.md) | ui | build | procedural | shadcn/ui + Tailwind v4 docs |
| 8 | [`rsc-boundary-audit`](./skills/rsc-boundary-audit/SKILL.md) | ui | verify | judgment | Next.js Server Components + React docs |
| 9 | [`error-boundary-hygiene`](./skills/error-boundary-hygiene/SKILL.md) | ui | build | procedural | Next.js error-handling + React 19 error boundaries |
| 10 | [`suspense-streaming-boundaries`](./skills/suspense-streaming-boundaries/SKILL.md) | ui | build | procedural | Next.js streaming docs + React 19 `<Suspense>` |
| 11 | [`intercepting-parallel-routes`](./skills/intercepting-parallel-routes/SKILL.md) | ui | build | procedural | Next.js parallel + intercepting routes docs |
| 12 | [`effect-discipline`](./skills/effect-discipline/SKILL.md) | ui | build | procedural | react.dev "You Might Not Need an Effect" |
| 13 | [`optimistic-ui-wiring`](./skills/optimistic-ui-wiring/SKILL.md) | ui | build | procedural | React 19 `useOptimistic` |
| 14 | [`a11y-mechanical-audit`](./skills/a11y-mechanical-audit/SKILL.md) | ui | verify | judgment | WCAG 2.2 AA + WAI-ARIA APG + axe-core |
| 15 | [`radix-primitive-a11y`](./skills/radix-primitive-a11y/SKILL.md) | ui | verify | judgment | Radix UI primitives + WAI-ARIA APG |
| 16 | [`i18n-routing`](./skills/i18n-routing/SKILL.md) | ui | build | procedural | Next.js i18n + BCP 47 + Unicode CLDR |
| 17 | [`tdd-cycle`](./skills/tdd-cycle/SKILL.md) | testing | verify | procedural | Kent C. Dodds Testing Trophy |
| 18 | [`playwright-e2e`](./skills/playwright-e2e/SKILL.md) | testing | verify | procedural | Playwright official best practices |
| 19 | [`axe-playwright`](./skills/axe-playwright/SKILL.md) | testing | verify | procedural | Deque axe-core + `@axe-core/playwright` + WCAG 2.2 AA |
| 20 | [`core-web-vitals-audit`](./skills/core-web-vitals-audit/SKILL.md) | performance | verify | metric | web.dev Core Web Vitals (2024-Q4) |
| 21 | [`bundle-budget`](./skills/bundle-budget/SKILL.md) | performance | verify | judgment | web.dev bundle budgets + Next.js analyzer |
| 22 | [`next-image-font-script`](./skills/next-image-font-script/SKILL.md) | performance | build | procedural | Next.js `next/image` + `next/font` + `next/script` |
| 23 | [`metadata-and-og`](./skills/metadata-and-og/SKILL.md) | seo | verify | procedural | Google Search Central + Next.js Metadata API |
| 24 | [`structured-data-json-ld`](./skills/structured-data-json-ld/SKILL.md) | seo | verify | procedural | Google Search Central + schema.org |
| 25 | [`seo-sitemap-robots`](./skills/seo-sitemap-robots/SKILL.md) | seo | build | procedural | sitemaps.org 0.9 + Next.js MetadataRoute + BCP 47 |
| 26 | [`open-graph-image`](./skills/open-graph-image/SKILL.md) | seo | build | procedural | Next.js `opengraph-image` + `next/og` `ImageResponse` |
| 27 | [`security-headers`](./skills/security-headers/SKILL.md) | security | build | procedural | OWASP Secure Headers + Next.js docs |
| 28 | [`auth-flow-review`](./skills/auth-flow-review/SKILL.md) | security | verify | judgment | OWASP ASVS v4 + Auth.js v5 |
| 29 | [`structured-logging`](./skills/structured-logging/SKILL.md) | observability | run | procedural | OpenTelemetry semantic conventions + Pino |
| 30 | [`sentry-setup`](./skills/sentry-setup/SKILL.md) | observability | run | procedural | Sentry Next.js official guide |
| 31 | [`event-taxonomy-and-instrumentation`](./skills/event-taxonomy-and-instrumentation/SKILL.md) | analytics | run | judgment | Amplitude North Star + PostHog |
| 32 | [`ci-cd-next-on-vercel`](./skills/ci-cd-next-on-vercel/SKILL.md) | deployment | run | procedural | Vercel deployment + DORA metrics |

---

## Deferred sub-skills (v0.2+)

Named in `CHANGELOG.md` § Known gaps. These are narrow cuts off existing Core 1 skills that are scoped but not yet scaffolded.

- `seo-sitemap`
- `structured-data` (JSON-LD)
- `cookie-hardening`
- `subresource-integrity`
- `file-upload-ux`
- `visual-regression`
- `axe-playwright`
- `log-aggregation`
- `otel-setup`
- `server-metrics`
- `pii-redaction`
- `middleware-rate-limit`
- `ab-testing`
- `warehouse-etl`
- `alert-coverage`

---

## Reference skills — origin

Two skills in the table were the first written and anchor the template:

- **`core-web-vitals-audit`** (metric, performance) — threshold enforcement via Lighthouse CI, spins up a real fixture app, asserts numbers. Exercises the metric-skill surface end-to-end.
- **`rsc-boundary-audit`** (judgment, ui) — no numeric thresholds, deep decision-tree procedure, multi-source methodology, LLM-as-judge eval. Exercises the judgment-skill surface end-to-end.

Between them they exercise every field in the frontmatter schema, both eval modes (Vitest with real tools, Promptfoo helpers for judgment), and both Procedure depth strategies (lean vs. deep). Every subsequent Core 1 skill was built against the template these two locked in.

---

## Cores 2–6 (chartered, post-v0.3.0)

Core 1 covers **Web Dev**. Five additional cores are chartered but not scaffolded:

- Core 2 — Brand & Content
- Core 3 — Growth & Distribution
- Core 4 — Founder Ops
- Core 5 — Research & Synthesis
- Core 6 — Meta

Each core ships as its own evaluation suite with its own dogmatic stack. See `BRIEF.md` for the wider project charter.

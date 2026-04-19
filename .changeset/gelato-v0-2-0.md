---
"@gelato/schema": minor
"@gelato/eval-harness": minor
---

## v0.2.0 — Core 1 complete

First meaningful release. All 19 Core 1 skills land with deterministic classifiers and passing evals (`pass_rate=1.0` across 4 assertions × 23 fixtures each).

**New in v0.2.0** (15 skills added since v0.1.0):

Build phase:
- `security-headers` — OWASP Secure Headers + Next.js header config
- `metadata-and-og` — Google Search Central + Next.js Metadata API
- `zod-validation` — Zod parse-at-the-boundary discipline
- `rsc-data-fetching` — Next.js 15 App Router caching (static / ISR / dynamic)
- `server-actions-vs-api` — Server Action vs route handler decision tree
- `form-with-server-action` — React 19 form-with-Server-Action idiom
- `shadcn-tailwind-v4` — Tailwind v4 migration + shadcn/ui conventions
- `auth-flow-review` — OWASP ASVS v4 + Auth.js v5 auth-flow checks

Verify phase:
- `bundle-budget` — Addy Osmani performance budget + `@next/bundle-analyzer`
- `playwright-e2e` — Playwright Best Practices (locators, auto-wait, no .only)
- `tdd-cycle` — Kent C. Dodds Testing Trophy + testing-library principles

Run phase:
- `structured-logging` — Pino + OpenTelemetry-aligned field conventions
- `sentry-setup` — `@sentry/nextjs` config discipline
- `event-taxonomy-and-instrumentation` — PostHog + Amplitude North Star event naming
- `ci-cd-next-on-vercel` — GitHub Actions + Vercel deployment hygiene

**Already in v0.1.0** (4 shipped skills carried forward):
- `git-hygiene` — Conventional Commits + atomic commits
- `core-web-vitals-audit` — web.dev metrics (CLS / LCP / INP → TBT)
- `rsc-boundary-audit` — React Server Component boundary rules
- `drizzle-migrations` — PlanetScale expand/contract migrations

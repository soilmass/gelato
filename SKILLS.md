# Gelato v0.1 Skill List (locked)

16 skills total. **Build only the 2 reference skills marked "✅ REF" in this handoff.** One skill (`git-hygiene`) is pre-built and ships in the handoff — you use it from the first commit but do not write it. The other 13 are scoped out for later commits.

---

## Legend

- **Type:** `procedural` (workflow discipline), `judgment` (decision tree), `metric` (hard numbers enforced by eval)
- **Phase:** `build` (Phase 1), `verify` (Phase 2), `run` (Phase 3)
- **Status:** ✅ REF = build in v0.1 as reference skill, 📦 PRE = ships pre-built in handoff, 🔜 = v0.2+

---

## The 16 skills

| # | Skill | Subsystem | Phase | Type | Methodology Source | Status |
|---|---|---|---|---|---|---|
| 0 | **`git-hygiene`** | foundations | build | procedural | Conventional Commits 1.0 + Chris Beams | **📦 PRE** |
| 1 | `drizzle-migrations` | data | build | procedural | PlanetScale expand/contract playbook + Drizzle docs | 🔜 |
| 2 | `rsc-data-fetching` | data | build | procedural | Next.js App Router Caching docs | 🔜 |
| 3 | `server-actions-vs-api` | server | build | judgment | Vercel Server Actions guidance | 🔜 |
| 4 | **`rsc-boundary-audit`** | ui | verify | judgment | Next.js Server Components docs + React docs | **✅ REF** |
| 5 | `form-with-server-action` | ui | build | procedural | Next.js Forms + React Hook Form docs | 🔜 |
| 6 | `tdd-cycle` | testing | verify | procedural | Kent C. Dodds Testing Trophy | 🔜 |
| 7 | `playwright-e2e` | testing | verify | procedural | Playwright official best practices | 🔜 |
| 8 | **`core-web-vitals-audit`** | performance | verify | metric | web.dev Core Web Vitals (2024 revision) | **✅ REF** |
| 9 | `metadata-and-og` | seo | verify | procedural | Google Search Central + Next.js Metadata API | 🔜 |
| 10 | `auth-flow-review` | security | verify | judgment | OWASP ASVS + Auth.js patterns | 🔜 |
| 11 | `security-headers` | security | build | procedural | OWASP Secure Headers + Next.js docs | 🔜 |
| 12 | `structured-logging` | observability | run | procedural | OpenTelemetry semantic conventions + Pino docs | 🔜 |
| 13 | `sentry-setup` | observability | run | procedural | Sentry Next.js official guide | 🔜 |
| 14 | `event-taxonomy-and-instrumentation` | analytics | run | judgment | Amplitude North Star + PostHog instrumentation | 🔜 |
| 15 | `ci-cd-next-on-vercel` | deployment | run | procedural | Vercel deployment + DORA metrics | 🔜 |

---

## Pre-built skill: `git-hygiene` (ships in handoff)

### Identity paragraph
Encodes Conventional Commits and Chris Beams's commit-message discipline for a Bun + Changesets + Lefthook repo. Produces atomic, imperative, explained commits.

### Methodology (multi-source)
- Primary: Conventional Commits 1.0.0 — https://www.conventionalcommits.org/en/v1.0.0/
- Secondary: Chris Beams, *How to Write a Git Commit Message* — https://cbea.ms/git-commit/
- Drift-check: `.github/workflows/drift-conventional-commits.yml`

### Why pre-built
This skill is used during Gelato's own construction. Claude Code follows its procedure from commit 0 (the initial scaffolding commit) onward. Writing it on the fly would mean the early commits don't follow it — which defeats the purpose and pollutes project history.

### Eval status
Deferred to Build Step 2. The eval runner does not exist yet at commit 0, so the skill ships with `pass_rate: null`. When Step 2 completes, git-hygiene's eval runs first as validation that the runner works end-to-end.

### Where it lives in the handoff
Already placed at `.claude/skills/git-hygiene/SKILL.md`. Claude Code auto-loads it the moment the repo opens — no install step required. Do not modify during v0.1 work unless the reference skills reveal a template problem (in which case, pause and report per BRIEF.md).

If Step 1 scaffolding moves it to a different path (e.g., top-level `skills/git-hygiene/` for plugin distribution), update all path references in the briefing docs in the same commit.

---

### Identity paragraph
Encodes web.dev's Core Web Vitals methodology for Next.js App Router apps. Scoped to the three metrics Google weights for ranking (LCP, INP, CLS). Not a general performance skill.

### Methodology
- Primary: web.dev Core Web Vitals (2024-Q4 revision — INP replaced FID in March 2024)
- URL: https://web.dev/articles/vitals
- Drift-check: `.github/workflows/drift-web-vitals.yml`

### Stack assumptions
- next@15+ App Router
- bun@1.x
- Lighthouse CI 0.13+
- @next/bundle-analyzer

### Hard Thresholds (enforced by eval)
- LCP ≤ 2.5s
- INP ≤ 200ms
- CLS ≤ 0.1
- Fix list ordered by impact, not alphabetically

### What the procedure covers
1. Run Lighthouse CI against a fixture Next.js app with known performance regressions
2. Parse metrics; identify which thresholds fail
3. Produce a prioritized fix list (images → fonts → bundle → caching, ordered by leverage per Addy Osmani)
4. Apply fixes; re-run; verify thresholds pass

### Eval type: metric
Fixture app lives at `evals/core-web-vitals-audit/fixtures/regressed-app/`. The eval runs Lighthouse CI against it, applies the skill's guidance, re-runs Lighthouse CI, and asserts the three thresholds pass.

### Handoffs
- Server-side latency: → `sentry-setup` (not yet built)
- Bundle-only audits: covered by this skill (no separate `bundle-budget` skill in v0.1)
- Non-Next.js apps: fork the suite

---

## Reference skill #2: `rsc-boundary-audit` (judgment-heavy)

### Identity paragraph
Audits a Next.js App Router codebase for Server/Client Component boundary violations: unnecessary `'use client'` directives, client components importing server-only code, serialization errors at the boundary, and hydration mismatches. Produces a prioritized remediation plan.

### Methodology (multi-source)
- Primary: Next.js App Router docs — Server Components
- Secondary: React docs — `use client` / `use server` directives
- URL (primary): https://nextjs.org/docs/app/building-your-application/rendering/server-components
- Drift-check: `.github/workflows/drift-rsc-docs.yml`

### Stack assumptions
- next@15+ App Router
- react@19+
- typescript@5+

### No Hard Thresholds (intentional)
This is a judgment skill. Procedure carries the enforcement weight. Do not add invented thresholds to fill the section — the template's Stage 5 refinement says omit cleanly.

### What the procedure covers
1. Inventory every `.tsx` file and its directive state
2. Classify each component against a four-criterion decision tree (interactivity, browser APIs, context, effects)
3. Detect serialization violations at the boundary
4. Produce a remediation plan ordered by measured bundle-size impact
5. Verify fixes do not break runtime (spawn fixture test run)

### Eval type: judgment
No hard numeric thresholds. The eval has two parts:
- **Quantitative:** classifies 23 fixture violations into five violation classes with ≥95% accuracy; zero false positives on 10 legitimate-`'use client'` fixtures; remediation plan ordered by measured bundle-size impact.
- **Qualitative:** LLM-as-judge (via Promptfoo helper) scores whether fix recommendations are implementable as-written and whether examples reference the actual codebase vs. invented scenarios.

### Handoffs
- General React performance: → `core-web-vitals-audit`
- Prop-drilling: → Vercel Labs `composition-patterns` (external, not built here)
- Server Action design: → `server-actions-vs-api` (not yet built)

---

## Why these two are the reference skills

`core-web-vitals-audit` and `rsc-boundary-audit` were chosen because they stress-test the template at opposite ends:

- **Metric-heavy skill** (`core-web-vitals-audit`): threshold enforcement via Lighthouse CI, spins up a real fixture app, asserts numbers. If the template handles this, it handles every metric skill.
- **Judgment-heavy skill** (`rsc-boundary-audit`): no numeric thresholds, deep decision-tree procedure, multi-source methodology, LLM-as-judge eval. If the template handles this, it handles every judgment skill.

Between them they exercise every field in the frontmatter schema, both eval modes (Vitest with real tools, Promptfoo helpers for judgment), and both Procedure depth strategies (lean vs. deep).

---

## Skills NOT in v0.1 (for transparency)

These were considered and deferred:

- `project-scaffold` — duplicates `create-next-app` + `create-t3-app`
- `zod-validation` — one-rule skill, folded into Server and Data subsystem skills
- `shadcn-tailwind-v4` — Tailwind v4 + shadcn integration still stabilizing; revisit once settled
- `bundle-budget` — merged into `core-web-vitals-audit` (bundle is an input to LCP)
- `structured-data` — lower-leverage than `metadata-and-og`
- `framework-upgrade` — hard to eval without a running-fork; needs infrastructure first

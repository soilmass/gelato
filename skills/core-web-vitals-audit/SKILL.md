---
name: core-web-vitals-audit
description: >
  Audit a Next.js App Router app against Google's Core Web Vitals and produce
  a prioritized, impact-ordered fix list for the three metrics Google weights
  for ranking (LCP, INP, CLS). Runs Lighthouse CI, parses the three metrics,
  identifies which thresholds fail, and recommends fixes in Addy Osmani's
  leverage order (images → fonts → bundle → caching).
  Use when: auditing Core Web Vitals, Lighthouse flagging LCP/INP/CLS,
  performance regression in production, "the site feels slow", preparing a
  launch perf pass, post-deploy perf check, "what should I optimize first",
  LCP above 2.5s, CLS above 0.1, INP above 200ms, bundle-size audit,
  image optimization audit.
  Do NOT use for: server-side latency issues (→ sentry-setup), backend
  database tuning, non-Next.js apps (fork the suite), general React perf
  outside of Web Vitals (→ rsc-boundary-audit for Server/Client boundary),
  synthetic benchmarks that don't reflect real-user experience.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: performance
  phase: verify
  type: metric
  methodology_source:
    - name: "Core Web Vitals"
      authority: "web.dev / Google Chrome team"
      url: "https://web.dev/articles/vitals"
      version: "2024-Q4 revision (INP replaced FID in March 2024)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
    - "@lhci/cli@0.13+"
    - "@next/bundle-analyzer"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T04:14:03.535Z"
    n_cases: 5
  changelog: >
    v1.0 — initial. Encodes web.dev Core Web Vitals (2024-Q4, post-INP) for
    Next.js 15+ App Router. Metric eval asserts LCP ≤ 2.5s, INP ≤ 200ms,
    CLS ≤ 0.1 on a fixed fixture app and ≥ one baseline regression on the
    paired regressed fixture.
---

# core-web-vitals-audit

Encodes web.dev's Core Web Vitals methodology for Next.js 15+ App Router apps. Scoped to the three metrics Google weights for ranking (LCP, INP, CLS). Produces a prioritized fix list in Addy Osmani's documented leverage order — not a general performance skill.

---

## Methodology Attribution

This skill encodes the **Core Web Vitals** methodology from **web.dev (Google Chrome team)**.

- **Source:** <https://web.dev/articles/vitals>
- **Version:** 2024-Q4 revision — INP replaced FID as the responsiveness metric in March 2024
- **Verified:** 2026-04-18
- **Drift-check:** `.github/workflows/drift-web-vitals.yml`

Encoded: the three-metric threshold set (LCP, INP, CLS), their canonical "good" boundaries, and the leverage-ordered fix-list ordering (images → fonts → bundle → caching) documented by Addy Osmani as the general guidance for addressing failures.

NOT encoded: server-side metrics (TTFB as a primary lever — treated as an input to LCP), Lighthouse's broader "Performance score" composite, synthetic-only metrics without real-user signal (TBT, Speed Index), non-Next.js-specific tooling paths. Those live in adjacent skills (`sentry-setup` for server-latency, `ci-cd-next-on-vercel` for deployment budgets) or are deliberately out of scope.

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+` (runtime + package manager)
- `@lhci/cli@0.13+` (Lighthouse CI)
- `@next/bundle-analyzer`

If your stack differs, fork the suite. This skill does not accept configuration flags.

---

## When to Use

Activate when any of the following is true:
- A Lighthouse run surfaces a Core Web Vitals failure (LCP > 2.5s, INP > 200ms, or CLS > 0.1)
- CrUX / PageSpeed Insights flags a regression
- A perf budget is exceeded in CI
- "The site feels slow" on a Next.js app
- A launch or post-deploy perf pass is due
- A stakeholder asks "what should I optimize first"

## When NOT to Use

Do NOT activate for:
- Server-side latency issues (high TTFB, slow API routes) — use `sentry-setup` and server-side tracing instead
- Backend database query tuning — out of scope for a web-vitals skill
- Non-Next.js apps — fork the suite, the Tool Integration section assumes Next 15 build output
- General React rendering-performance issues — that's the Server/Client boundary, use `rsc-boundary-audit`

---

## Procedure

Metric skills can have lean procedures — the Hard Thresholds do the mechanical enforcement. The procedure is the recommended walk.

### Step 1 — Measure a clean baseline

Build the app for production, start a production server, run Lighthouse CI against the routes that matter. Do not audit a `next dev` build; dev mode inflates every metric:

```bash
bun run build
bun run start &
bunx lhci autorun
```

A multi-URL audit uses `.lighthouserc.json` with a `collect.url` array. Always run against production builds, always against at least three URLs (home, a dynamic route, a high-traffic leaf).

### Step 2 — Identify which of the three thresholds fail

Parse the Lighthouse report:

- **LCP** (Largest Contentful Paint) — largest visible element paint time. Threshold: ≤ 2500ms.
- **INP** (Interaction to Next Paint) — responsiveness to the slowest interaction. Threshold: ≤ 200ms. (INP replaced FID in March 2024.)
- **CLS** (Cumulative Layout Shift) — unexpected layout movement across the session. Threshold: ≤ 0.1.

A single failing metric can reflect multiple causes. A passing metric is a passing metric — do not optimize what is not measurably broken.

### Step 3 — Produce a prioritized fix list in leverage order

Order recommended fixes by **leverage per unit of engineering effort**, not alphabetically and not by audit severity. Addy Osmani's documented ordering:

1. **Images.** Biggest LCP lever on almost every site. Use `next/image` with correct `width`/`height` (fixes CLS for free), `priority` on the hero, AVIF/WebP, right-sized variants via the built-in loader. Replace background-image where semantically possible — `next/image` cannot optimize what it cannot see.
2. **Fonts.** `next/font` with `display: swap`, preload the critical weights, subset to the glyphs used. Self-host — third-party font servers add a DNS round-trip to every first-paint.
3. **Bundle.** `@next/bundle-analyzer` to see what is shipped. Dynamic-import heavy client components. Server Components by default; reach for `'use client'` only where `rsc-boundary-audit` says it is required. Tree-shake and prune.
4. **Caching.** Route segment config (`export const revalidate`), `fetch({ next: { revalidate } })`, `force-cache` for genuinely static data, ISR for stale-while-revalidate, CDN + Vercel Edge for static assets. LCP failures with a fast build often trace here.

### Step 4 — Apply the fix list top-down, re-measure after each category

After each category is applied, re-run Lighthouse CI. A full re-run after every single change is wasted time; a category boundary is the right checkpoint.

### Step 5 — Gate on the three thresholds

Add Lighthouse CI to the deployment pipeline with the three threshold assertions. Regressions block the merge. See `references/lhci-assertions.md` for the canonical `.lighthouserc.json` assertions.

---

## Hard Thresholds

The skill fails if any threshold is missed (source: web.dev Core Web Vitals 2024-Q4):

- **LCP ≤ 2500 ms** — Lighthouse-measurable in lab.
- **INP ≤ 200 ms** — **field-only** as of March 2024; Lighthouse reports it as `null` in lab runs. The eval asserts on **TBT ≤ 300 ms** as Lighthouse's documented lab proxy for the same responsiveness concern. Production monitoring (PageSpeed Insights, CrUX, `web-vitals` library) is what enforces the real 200 ms INP budget on live traffic.
- **CLS ≤ 0.1** — Lighthouse-measurable in lab.
- **Fix list ordered by leverage**, not alphabetically or by audit severity — enforced by the eval's priority-order assertion.

LCP and CLS are asserted directly by the eval. INP is not; see TBT substitution above.

---

## Tool Integration

**`.lighthouserc.json`** (at project root — audits three routes, asserts three thresholds):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/dynamic-example",
        "http://localhost:3000/leaf"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

**`next.config.ts`** (enables the bundle analyzer behind an env gate):

```ts
import { withBundleAnalyzer } from '@next/bundle-analyzer';

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})({
  images: { formats: ['image/avif', 'image/webp'] },
  experimental: { optimizePackageImports: ['lucide-react'] },
});
```

**`package.json` scripts:**

```json
{
  "scripts": {
    "analyze": "ANALYZE=true next build",
    "lhci": "lhci autorun"
  }
}
```

---

## Examples

### Example 1 — LCP regression from a hero image

**Input:** Lighthouse reports LCP 4.2s. Hero is a 2.3 MB PNG served via `<img>`.

**Output:** Replace with `next/image`, specify `width`/`height`, add `priority`, let Next produce AVIF/WebP. Re-measure — typical recovery drops LCP to < 1.5s. One change, largest lever.

### Example 2 — CLS from a late-loading ad slot

**Input:** CLS 0.22. An ad iframe loads after first paint and pushes the fold.

**Output:** Reserve the iframe's space with an explicit `width`/`height` or CSS `aspect-ratio`. The ad slot's late load no longer shifts layout. CLS drops to ≤ 0.1.

### Example 3 — INP regression from an expensive click handler

**Input:** INP 340ms on the primary CTA. Click handler synchronously filters a 10k-row array.

**Output:** Move filtering off the main thread (web worker, or `startTransition` with deferred update, or server-side). Interaction returns to paint within ≤ 200ms.

---

## Edge Cases

- **Route-dependent failures:** audit every representative route. A homepage passing while a checkout route fails is still a product failure.
- **Third-party scripts dominating INP:** the fix is still ours — defer, partition with `Partytown`, or accept the vendor and renegotiate.
- **Synthetic vs. real-user divergence:** Lighthouse is synthetic. Confirm regressions via CrUX / PageSpeed Insights where real-user data exists before shipping large fixes.
- **Images from a CMS:** `next/image` handles remote images via `remotePatterns` in `next.config`. Do not proxy through a Route Handler to "help" — double-compresses for no reason.
- **Fonts from a third-party host:** self-host via `next/font/google` or `next/font/local`. A DNS round-trip on first paint is a real LCP cost.

---

## Evaluation

See `/evals/core-web-vitals-audit/` for the canonical eval suite.

### Pass criteria

**Quantitative (metric):**
- Fixed fixture app: LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1 (all three)
- Regressed fixture app: at least one of LCP / CLS fails its threshold (proves the thresholds are not vacuous)
- Fix list produced for a regressed app is ordered images → fonts → bundle → caching

**Qualitative:** not required for this skill. The thresholds enforce.

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate` in the frontmatter above.

---

## Handoffs

This skill is scoped to the three Core Web Vitals (LCP, INP, CLS) on Next.js App Router. Explicitly NOT absorbed:

- **Server-side latency / TTFB as a first-class metric** — use `sentry-setup` and Sentry tracing (not yet built)
- **Server/Client component boundary regressions that surface as bundle bloat** — use `rsc-boundary-audit`
- **Composite Lighthouse "Performance score"** — deliberately not a target; the three Web Vitals are the ranking-relevant signal
- **Non-Next.js apps** — fork the suite
- **Deployment-time perf budgets in CI** — `ci-cd-next-on-vercel` (v0.2) wires the budget into the pipeline

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Node-capable runtime (Bun), Chromium (for Lighthouse CI), `@lhci/cli@0.13+`, `next@15+`, `@next/bundle-analyzer`

---

## References

- `references/lhci-assertions.md` — canonical `.lighthouserc.json` assertions block, copy-paste ready
- `references/addy-osmani-fix-order.md` — one-page summary of the leverage order behind Step 3

## Scripts

- _(none — the skill is purely guidance; the eval ships the measurement harness)_

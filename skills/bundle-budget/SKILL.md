---
name: bundle-budget
description: >
  Apply a JavaScript performance budget to a Next.js 15 App Router
  build. Per-route First Load JS ≤ 150 KB compressed, shared chunks
  ≤ 100 KB, no known-heavy libs (`moment`, full `lodash`, `jquery`,
  `chart.js`) and no server-only libs (`@prisma/client`, `bcrypt`,
  `sharp`, node DB drivers) in the client bundle. Flags four
  violations from `@next/bundle-analyzer` / Next build output.
  Use when: reviewing a Next.js build report, wiring
  `@next/bundle-analyzer`, investigating "First Load JS too large",
  post-regression audit after a new dep, CI budget gate, "why is my
  dashboard 400 KB".
  Do NOT use for: runtime Core Web Vitals (→ core-web-vitals-audit),
  RSC boundary errors (→ rsc-boundary-audit), server response time,
  streaming SSR strategies.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: performance
  phase: verify
  type: judgment
  methodology_source:
    - name: "Performance Budgets 101 — web.dev"
      authority: "Addy Osmani / Google Chrome DevRel"
      url: "https://web.dev/articles/performance-budgets-101"
      version: "web.dev (2024 revision)"
      verified: "2026-04-18"
    - name: "@next/bundle-analyzer"
      authority: "Vercel / Next.js team"
      url: "https://www.npmjs.com/package/@next/bundle-analyzer"
      version: "@next/bundle-analyzer — Next.js 15 (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "@next/bundle-analyzer@15+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T11:54:26.917Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Judgment skill. Four-threshold decision tree
    backed by a deterministic classifier over Next build-report
    JSON fixtures.
---

# bundle-budget

Encodes a JavaScript performance budget for a Next.js 15 App Router build, backed by Addy Osmani's web.dev guidance and `@next/bundle-analyzer` output. Four checks on a post-build report. Judgment skill — the procedure is enforcement.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Performance Budgets 101
  - Source: [https://web.dev/articles/performance-budgets-101](https://web.dev/articles/performance-budgets-101)
  - Authority: Addy Osmani / Google Chrome DevRel
  - Verified: 2026-04-18
- **Secondary:** @next/bundle-analyzer
  - Source: [https://www.npmjs.com/package/@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
  - Authority: Vercel / Next.js team
  - Verified: 2026-04-18
- **Drift-check:** `.github/workflows/drift-next-bundle-analyzer.yml`

Encoded: the four mechanical budget checks (per-route size, shared-chunk total, known-heavy deps, server-only leaks). NOT encoded: subjective "feels slow" judgments, runtime performance (→ `core-web-vitals-audit`), server response time, HTTP/2 or caching tuning.

---

## Stack Assumptions

- `next@15+` App Router
- `@next/bundle-analyzer@15+` (produces Next build reports)
- `bun@1.1+`

If your bundler isn't webpack/Turbopack via Next, fork the suite — the report formats differ.

---

## When to Use

Activate when any of the following is true:
- Reviewing a Next.js build report after a PR
- Wiring `@next/bundle-analyzer` for the first time
- Investigating "First Load JS is too large" / "the dashboard is heavy"
- Post-regression audit after adding a new dependency
- Writing a CI job that gates on bundle size
- "Why is my route 400 KB?"

## When NOT to Use

Do NOT activate for:
- **Runtime Core Web Vitals** — `core-web-vitals-audit`.
- **RSC boundary errors** — `rsc-boundary-audit`.
- **Server response time / TTFB** — belongs in observability (v0.2 candidate).
- **Streaming SSR strategies** — v0.2 candidate `streaming-rsc` skill.

---

## Procedure

Run after every production build. Each check returns a verdict; any `fail` is a budget violation.

### Step 1 — Per-route First Load JS ≤ 150 KB

For every route in the Next build report (or `@next/bundle-analyzer` JSON): the **First Load JS** value must be ≤ 150 KB (compressed).

- Source for the threshold: Addy Osmani's "Performance Budgets 101" — a median-3G user hits Time-to-Interactive in ~5s only if total JS stays near 170 KB compressed. 150 KB leaves headroom for HTML + CSS + images.
- Violation: even one route > 150 KB — the heavy page is the breach, not the average.

Fix: dynamic-import the expensive component (`next/dynamic(() => import(…), { ssr: false })` when the feature only matters on interaction), swap the library for a lighter alternative, or move logic to the server.

### Step 2 — Shared chunks ≤ 100 KB

The "First Load JS shared by all" value must be ≤ 100 KB. Shared chunks inflate **every** route.

- Typical culprits: a global wrapper importing a large date/chart/icon library, a provider pulling an SDK, a polyfill bundle.
- Fix: move the offending import out of the root layout; load it on the specific route that needs it; tree-shake the library.

### Step 3 — No known-heavy libraries in the client bundle

If `@next/bundle-analyzer` shows any of these resolving into a client chunk, that's a violation:

| Heavy library | Lighter alternative |
|---|---|
| `moment` (~70 KB gz) | `date-fns`, `dayjs` (~2–3 KB) |
| `lodash` (full) | `lodash-es` + cherry-picked imports, or ES-native alternatives |
| `jquery` | none — remove |
| `chart.js` | `@visx/*`, `recharts` selectively imported, or server-rendered charts |
| `handlebars` (client) | none — move templating to the server |
| `lottie-web` (on a hero) | `@lottiefiles/lottie-player` web component loaded on interaction |

Fix: swap for the lighter alternative OR load on interaction via `next/dynamic` with `ssr: false`.

### Step 4 — No server-only libraries in the client bundle

If `@next/bundle-analyzer` shows any of these server-only deps in a client chunk, it's a bundler config bug OR an accidental `'use client'` boundary that pulled the dep across:

- `@prisma/client`
- `bcrypt` / `bcryptjs` / `argon2`
- `sharp`
- `pg`, `mysql2`, `sqlite3`, `mongodb`
- `nodemailer`
- Any `node:*` built-in (`node:fs`, `node:crypto`)

Fix: the file that imports the server-only lib must not be a `'use client'` component or a client-imported module. Move the lib behind a Server Action / route handler. See `rsc-boundary-audit`.

---

## Tool Integration

**Wire `@next/bundle-analyzer`:**

```js
// next.config.mjs
import withBundleAnalyzer from '@next/bundle-analyzer';

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default analyzer({
  // ...next config
});
```

```json
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true bun run build"
  }
}
```

**CI budget gate (pseudocode):**

```ts
// scripts/check-bundle-budget.ts
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('.next/analyze/client.json', 'utf8'));

for (const route of report.routes) {
  if (route.firstLoadJsKb > 150) {
    throw new Error(`${route.path}: ${route.firstLoadJsKb} KB > 150 KB budget`);
  }
}
if (report.sharedKb > 100) {
  throw new Error(`shared chunks: ${report.sharedKb} KB > 100 KB budget`);
}
```

---

## Examples

### Example 1 — Route over budget (`route-over-budget`)

**Input:** build report shows `/dashboard` at 281 KB First Load JS.

**Output:** the dashboard is over budget. Profile via `ANALYZE=true bun run build` and open the analyzer; identify which chunk dominates. Typical outcomes: dynamic-import the charting lib, split an admin-only tab into its own route, move heavy data munging to the server.

### Example 2 — Shared chunks over budget (`shared-budget-exceeded`)

**Input:** shared chunks total 120 KB.

**Output:** every route pays this tax. Find what the root layout / global provider is pulling in. Typical fix: a theme library or icon set imported globally that should be imported only where used.

### Example 3 — Known-heavy library in client bundle (`heavy-library-in-bundle`)

**Input:** analyzer shows `moment` imported in the `/events` client chunk.

**Output:** replace with `date-fns` (or `dayjs` if you need moment-like API). Moment alone is 60–70 KB gzipped and gzips poorly due to the locale bundle.

### Example 4 — Server-only library in client bundle (`server-only-leaked-to-client`)

**Input:** analyzer shows `@prisma/client` in a client chunk.

**Output:** a client component or a client-imported module is importing Prisma. Trace the import path; the file that pulls Prisma must be server-only. Guardrail: never `import { db } from '@/lib/db';` from a file that has `'use client';` or is imported by one.

---

## Edge Cases

- **First-load precisely at 150 KB** — safe. The budget is strict `>`, not `≥`. Close-to-the-line routes still deserve a plan.
- **`lodash-es` vs `lodash`** — `lodash-es` is tree-shakeable. Cherry-picked imports (`import debounce from 'lodash-es/debounce'`) are fine. Only whole-library `lodash` triggers the violation.
- **Polyfills** — Next.js ships polyfills conditionally based on browserslist. If your browserslist excludes legacy browsers, polyfill bytes shrink significantly. Verify browserslist before over-indexing on polyfill size.
- **CDN-loaded scripts** — libraries loaded via `<Script>` from a CDN don't appear in the Next build report. They still cost the user bytes; audit them separately (a v0.2 `third-party-scripts` skill will cover this).
- **App Router's `(group)` routes** — the report shows logical routes, not folder names. The budget still applies per logical route.

---

## Evaluation

See `/evals/bundle-budget/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

Fixtures are JSON snapshots of a Next build report. The classifier parses each fixture and applies the four rules. No LLM-as-judge half for v0.1 — the thresholds are numeric.

---

## Handoffs

- **Runtime performance** → `core-web-vitals-audit`
- **RSC boundary errors** → `rsc-boundary-audit`
- **Third-party script audit** → v0.2 candidate `third-party-scripts` skill
- **CI wiring patterns** → `ci-cd-next-on-vercel` (when built)

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, `@next/bundle-analyzer`

---

## References

- `references/heavyweight-libs.md` — list of known-heavy libraries and their lighter alternatives
- `references/server-only-libs.md` — list of libs that should never land in a client bundle

## Scripts

- _(none in v0.1 — eval ships the classifier; `scripts/check-bundle-budget.ts` is a v0.2 candidate after `@next/bundle-analyzer` stabilizes its JSON output format)_

# core-web-vitals-audit eval

Proves the three Core Web Vitals thresholds this skill encodes are enforceable against a real Next.js 15 app router build, not merely readable in prose.

## What the eval measures

A single fixture Next.js app at `fixtures/app/` exposes two routes:

- `/regressed` — deliberate LCP + CLS + TBT regressions (unoptimized `<img>` without dimensions, a late-rendered banner pushing content, a client-side busy loop blocking the main thread for 600 ms)
- `/fixed` — the skill's guidance applied (`next/image` with `priority` + explicit `width`/`height`, no late-inserted content, no blocking client work)

The eval runs Lighthouse CI on both in sequence and asserts:

| Assertion | Expected |
|---|---|
| `/fixed` LCP ≤ 2500 ms | pass |
| `/fixed` CLS ≤ 0.1 | pass |
| `/fixed` TBT ≤ 300 ms (INP lab proxy) | pass |
| `/regressed` fails at least one of LCP / CLS / TBT | pass |
| Lighthouse measured every audit we care about | pass |

The "≥ 1 regression" assertion is what proves the fixed-app assertions are not vacuous — if the fixed app were trivially small, all three thresholds would pass on both routes and the skill's Hard Thresholds section would measure nothing.

### Why TBT stands in for INP

INP is a **field-only** metric as of March 2024 — Lighthouse reports it as `null` in lab runs because responsiveness cannot be measured without a real user interaction. Lighthouse's own documentation nominates **TBT** as the lab proxy: both measure how long the main thread is blocked by long tasks after first contentful paint. The 300 ms TBT budget here is the standard "Good" threshold for the TBT audit.

If a future version of Lighthouse ships programmatic INP measurement via user flows, the eval moves to asserting `inp` directly and this README is updated.

## Fixture app layout

```
fixtures/app/
├── app/
│   ├── layout.tsx        # shared shell
│   ├── page.tsx          # index: links to both routes
│   ├── regressed/
│   │   ├── page.tsx      # <img> no dimensions, <LateShifter/>, <BusyClient/>
│   │   ├── busy-client.tsx
│   │   └── late-shifter.tsx
│   └── fixed/
│       └── page.tsx      # next/image, no late content, no blocking work
├── public/
│   └── hero.jpg          # ~620 KB fixture asset (ImageMagick plasma:fractal)
├── next.config.ts
├── package.json
└── tsconfig.json
```

The fixture has its own `node_modules` and lockfile because it simulates a consumer project, not a monorepo package. `bun install` runs only on the first eval invocation — subsequent runs rebuild and re-serve against the cached install.

## Running

```bash
bun run eval core-web-vitals-audit
```

On a cold run: install (~10 s) + build (~5 s) + server start (~4 s) + two Lighthouse runs (~30-45 s each) ≈ 90-110 seconds. Warm runs skip the install and complete in ~70 seconds.

## Chrome path

Lighthouse launches Chromium via `chrome-launcher`. The wrapper honors `CHROME_PATH` in the environment; in CI we point it at Playwright's installed Chromium binary (installed via `bunx playwright install --with-deps chromium` in a separate workflow step). Locally, chrome-launcher auto-detects Chrome / Chromium on the system.

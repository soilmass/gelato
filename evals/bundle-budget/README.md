# bundle-budget eval

Proves the four budget rules for a Next.js 15 App Router build are mechanically enforceable against `@next/bundle-analyzer`-style report JSON.

## What the eval measures

Deterministic classifier — JSON parse + threshold + set-membership rules. Four detection steps (priority order):

1. **server-only-leaked-to-client** — any bundle whose `chunk` name does NOT start with `server-` contains a dep in `SERVER_ONLY_LIBS` (`@prisma/client`, `bcrypt*`, `argon2`, `sharp`, `pg*`, `mysql*`, `sqlite3*`, `mongodb`, `mongoose`, `redis*`, `nodemailer`).
2. **heavy-library-in-bundle** — any client chunk contains a dep in `HEAVY_LIBS` (`moment`, `lodash`, `jquery`, `chart.js`, `handlebars`, `lottie-web`).
3. **route-over-budget** — any `route.firstLoadJsKb > 150`.
4. **shared-budget-exceeded** — `sharedKb > 100`.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 route at exactly 150 KB — budget is strict `>`, not `≥`
- 02 shared at exactly 100 KB — same
- 03 `@prisma/client` in a `server-dashboard` chunk (Server Component) — safe
- 04 `dayjs` in bundle — lightweight, not on heavy list
- 05 both route-over-budget AND shared-budget-exceeded — classifier picks route (higher priority)
- 06 `lottie-web` in main with route under budget — still flagged as heavy-library

## Why class priority matters

A fixture can exhibit multiple violations at once. The classifier returns the single "most severe / most actionable" one — server-leak first (bundler bug or security issue), then heavy-lib (swap needed), then route-budget (dynamic import), then shared-budget (refactor root layout). `rsc-boundary-audit` and this skill cover adjacent territory; a server-leak here often surfaces from a boundary violation there.

## Running

```bash
bun run eval bundle-budget
```

~70 ms. No env, no Chromium, no API keys.

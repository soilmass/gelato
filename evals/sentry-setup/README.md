# sentry-setup eval

Proves the four `@sentry/nextjs` configuration / integration violations are mechanically enforceable from single-file fixture text.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **hardcoded-dsn** — file text (comments stripped) contains a literal Sentry DSN (`https://…@…ingest[.region].sentry.io/<id>`).
2. **sample-rate-unbounded** — a `Sentry.init({...})` options object has `tracesSampleRate` / `replaysSessionSampleRate` / `replaysOnErrorSampleRate` set to a bare literal `1` or `1.0`. Ternary / env-guarded values are exempt; `tracesSampler` function form is exempt.
3. **missing-beforesend** — `Sentry.init({...})` options lacks both `beforeSend` (method shorthand or arrow) and `ignoreErrors` (alternative filter).
4. **no-capture-in-catch** — handler file (`'use server'`, route handler, middleware) that imports from `@sentry/*` AND has a `catch (…)` block that neither calls `Sentry.captureException(` nor re-throws (`throw`).

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 catch block calls `captureException` AND re-throws — safe (both satisfy the rule)
- 02 `tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1` — ternary, env-guarded
- 03 DSN mentioned in a `//` comment for documentation — safe (comments stripped)
- 04 `captureException` called from inside a `Sentry.withScope(…)` callback — safe (regex matches nested call)
- 05 replay sample rates env-guarded — safe
- 06 non-handler lib file with catch and no capture — safe (rule scoped to handler files)

## Running

```bash
bun run eval sentry-setup
```

~70 ms. No env, no network.

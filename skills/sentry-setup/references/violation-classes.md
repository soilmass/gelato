# Four violation classes

A fixture that triggers none is `safe`.

## 1. `hardcoded-dsn`

**Signal:** `Sentry.init({ ..., dsn: 'https://...' })` — the `dsn` field is a literal string starting with `https://` or `http://` (or containing `sentry.io`), NOT `process.env.*`.

**Remediation:** `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN`.

## 2. `sample-rate-unbounded`

**Signal:** `tracesSampleRate: 1.0` (or `1`) inside `Sentry.init` with no env check in the same expression, AND no `tracesSampler` function property. Same rule for `replaysSessionSampleRate` and `replaysOnErrorSampleRate` when present.

Guarded forms that PASS:

```ts
tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
tracesSampler: (ctx) => 0.1,
```

**Remediation:** guard by env OR switch to `tracesSampler`.

## 3. `missing-beforesend`

**Signal:** a `Sentry.init({...})` call whose options object has no `beforeSend` property AND no `ignoreErrors` property (either is acceptable as a filter).

**Remediation:** add a `beforeSend` that drops `NEXT_NOT_FOUND` / `NEXT_REDIRECT` and scrubs `authorization` / `cookie` headers.

## 4. `no-capture-in-catch`

**Signal:** handler file (route handler or `'use server'` Server Action) that imports from `@sentry/*` AND has a `catch (err)` block that does NOT call `Sentry.captureException(` inside.

**Remediation:** `Sentry.captureException(err)` alongside the logger call.

## Why exactly four

These are the four misconfigurations that (a) have real production consequences, and (b) are detectable from a single file without running the app. Release tracking, source-map upload, distributed tracing integration, and alert routing all need cross-file or cross-system analysis and belong in future skills.

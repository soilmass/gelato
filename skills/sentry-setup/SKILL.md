---
name: sentry-setup
description: >
  Configure Sentry for Next.js 15 via `@sentry/nextjs`. Four rules:
  DSN comes from `process.env`, never a hardcoded literal; every
  `Sentry.init` has a `beforeSend` hook that scrubs PII and drops
  noise; `tracesSampleRate` is NOT a fixed 1.0 in production (guard
  by env or use sampler function); every caught exception in a
  handler routes through `Sentry.captureException(err)` in addition
  to the logger. Flags the four corresponding violations.
  Use when: setting up Sentry for the first time, reviewing a PR
  that edits instrumentation.ts / sentry.client|server|edge.config.*,
  diagnosing "Sentry quota blown by noise", "no events reaching
  Sentry from my handler".
  Do NOT use for: structured logging (→ structured-logging), alert
  routing / on-call (operational, out of scope), PII-redaction
  strategy beyond the mechanical `beforeSend` check (v0.2 candidate
  `pii-redaction` skill).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: observability
  phase: run
  type: procedural
  methodology_source:
    - name: "Sentry — Next.js Setup"
      authority: "Sentry.io"
      url: "https://docs.sentry.io/platforms/javascript/guides/nextjs/"
      version: "@sentry/nextjs current docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "@sentry/nextjs@8+"
    - "next@15+ App Router"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T12:03:52.976Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four mechanical violations (hardcoded-dsn,
    sample-rate-unbounded, missing-beforesend, no-capture-in-catch)
    detected by a deterministic classifier over Sentry config and
    handler fixtures.
---

# sentry-setup

Encodes `@sentry/nextjs` configuration discipline for Next.js 15 App Router. Four rules that keep Sentry useful: no DSN in source code, every init scrubs PII via `beforeSend`, sampling is bounded in production, and every caught error reaches Sentry. Procedural skill.

---

## Methodology Attribution

- **Primary:** Sentry — Next.js Setup
  - Source: [https://docs.sentry.io/platforms/javascript/guides/nextjs/](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
  - Authority: Sentry.io
  - Verified: 2026-04-18
- **Drift-check:** `.github/workflows/drift-sentry-nextjs.yml`

Encoded: the four mechanical configuration rules detectable from a single Sentry config file or handler. NOT encoded: alert-routing policy, on-call rotation, PII-redaction strategy beyond the mechanical `beforeSend` check (v0.2 candidate `pii-redaction` skill), release-tracking integration with CI.

---

## Stack Assumptions

- `@sentry/nextjs@8+`
- `next@15+` App Router
- `bun@1.1+`

If your stack is on Sentry's older SDK API (pre-8.x) or raw `@sentry/browser` / `@sentry/node`, fork the suite — the init signatures differ.

---

## When to Use

Activate when any of the following is true:
- Setting up Sentry for the first time on a Next.js app
- Editing `instrumentation.ts` / `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`
- Reviewing a PR that touches Sentry config
- "Sentry quota is getting blown by noise"
- "Errors in my handler aren't showing up in Sentry"

## When NOT to Use

Do NOT activate for:
- **Structured logging** — `structured-logging`.
- **Alert routing / on-call** — operational, out of scope.
- **Deep PII redaction policy** — v0.2 candidate `pii-redaction` skill.
- **Source-map upload** — handled by `@sentry/nextjs` build integration; out of scope for this review skill.

---

## Procedure

### Step 1 — DSN comes from env, never a literal

```ts
// RIGHT
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

// WRONG — DSN in source
Sentry.init({
  dsn: 'https://abc123@o12345.ingest.sentry.io/67890',
});
```

Even though the DSN is a public identifier, committing it couples source to environment and makes rotation painful. Read from `process.env` exclusively. Client side uses `NEXT_PUBLIC_SENTRY_DSN`; server/edge use the same (or a server-only key if you want to restrict ingest).

### Step 2 — Every `Sentry.init` has a `beforeSend` hook

```ts
// RIGHT — scrub and filter at the boundary
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event, hint) {
    // Drop known noise.
    if (event.exception?.values?.[0]?.value?.includes('NEXT_NOT_FOUND')) return null;
    // Scrub headers that can carry PII.
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    return event;
  },
});
```

`beforeSend` is the single choke point for:
- Dropping framework-internal noise (`NEXT_NOT_FOUND`, `NEXT_REDIRECT`, canceled fetches).
- Scrubbing PII (emails in URLs, Authorization / Cookie headers, custom IDs you don't want exposed).
- Attaching request-level context (traceId, userId) when Sentry didn't capture it automatically.

An `init` without `beforeSend` ships raw events to Sentry — both noisy and a PII risk.

### Step 3 — `tracesSampleRate` is bounded in production

```ts
// RIGHT — 100% in dev, conservative in prod
Sentry.init({
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});

// RIGHT — sampler function for smarter sampling
Sentry.init({
  tracesSampler: (ctx) => ctx.transactionContext.op === 'http.server' ? 0.05 : 0.5,
});

// WRONG — 100% in production blows the quota
Sentry.init({
  tracesSampleRate: 1.0,
});
```

Sampling at `1.0` in production is a cost-control failure. Every request generates a trace, and on any real traffic the quota vaporizes. The rule: literal `tracesSampleRate: 1.0` (or `1`) must be guarded by an environment condition OR replaced with a `tracesSampler` function.

`replaysSampleRate` and `replaysOnErrorSampleRate` (Session Replay) follow the same rule when present.

### Step 4 — Caught errors route through `Sentry.captureException`

```ts
// RIGHT — both log AND capture
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export async function POST(req: Request) {
  try {
    await doWork(await req.json());
    return Response.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'posts.create failed');
    Sentry.captureException(err);
    return Response.json({ ok: false }, { status: 500 });
  }
}

// WRONG — caught and swallowed
} catch (err) {
  logger.error({ err }, 'posts.create failed');
  return Response.json({ ok: false }, { status: 500 });
}
```

A caught exception that doesn't reach Sentry is invisible at the monitoring layer. `Sentry.captureException` goes alongside the logger call — not instead of it. Both signals are useful: Sentry groups and alerts, the log is the audit trail.

Exception: if the exception is expected flow-control (auth redirect, known validation error), attach `ignoreErrors` to the init config or call `Sentry.withScope` to add a tag that `beforeSend` can drop.

---

## Tool Integration

**Canonical `sentry.server.config.ts`:**

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
  beforeSend(event) {
    const value = event.exception?.values?.[0]?.value ?? '';
    if (value.includes('NEXT_NOT_FOUND') || value.includes('NEXT_REDIRECT')) return null;
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    return event;
  },
  ignoreErrors: ['NEXT_NOT_FOUND', 'NEXT_REDIRECT', 'AbortError'],
});
```

**Canonical handler with `captureException`:**

```ts
// app/api/posts/route.ts
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const [row] = await db.insert(posts).values(body).returning();
    return Response.json({ ok: true, postId: row.id });
  } catch (err) {
    logger.error({ err }, 'posts.create failed');
    Sentry.captureException(err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
```

---

## Examples

### Example 1 — Hardcoded DSN (`hardcoded-dsn`)

**Input:** `Sentry.init({ dsn: 'https://abc@o12345.ingest.sentry.io/67890', ... });`.

**Output:** replace with `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN`. Move the value into Vercel env / `.env.local`. Rotation becomes config, not a code change.

### Example 2 — Unbounded sample rate (`sample-rate-unbounded`)

**Input:** `tracesSampleRate: 1.0` with no env guard, no sampler.

**Output:** guard with `process.env.NODE_ENV === 'production' ? 0.1 : 1.0` or use `tracesSampler`. 100% in prod is quota suicide.

### Example 3 — No `beforeSend` hook (`missing-beforesend`)

**Input:** a `Sentry.init({ dsn, tracesSampleRate })` with no `beforeSend` property.

**Output:** add a `beforeSend` that drops `NEXT_NOT_FOUND` / `NEXT_REDIRECT` and scrubs `authorization` / `cookie` headers. The hook is both noise-reduction and PII protection.

### Example 4 — Catch block without capture (`no-capture-in-catch`)

**Input:** a `catch (err)` block that logs via `logger.error` but doesn't call `Sentry.captureException`.

**Output:** add `Sentry.captureException(err);` inside the catch. Both log AND capture — they serve different needs (audit trail vs. alerting / grouping).

---

## Edge Cases

- **Client-only context** — `Sentry.init` may be called in `sentry.client.config.ts` with a slightly different shape (replay integration enabled). Same four rules apply.
- **Edge runtime** — `sentry.edge.config.ts` has reduced SDK surface; `tracesSampleRate` and `beforeSend` still apply.
- **Re-thrown errors** — if the catch block only exists to log + re-throw, `Sentry.captureException` may still be desirable for the extra context, but some teams prefer letting Sentry's global handler catch the re-throw. This skill flags missing captures in terminal catches (those that return without re-throwing).
- **`ignoreErrors` in config** — an alternative to `beforeSend` filtering. Acceptable; classifier accepts either.
- **Source-map upload** — handled by the `@sentry/nextjs` webpack plugin. Out of scope for this review skill.

---

## Evaluation

See `/evals/sentry-setup/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

No LLM-as-judge half for v0.1. A v0.2 `alert-routing` rubric would judge whether critical paths have adequate Sentry coverage — fuzzier than the four mechanical checks here.

---

## Handoffs

- **Structured logging** → `structured-logging`
- **PII redaction strategy** → v0.2 candidate `pii-redaction` skill
- **Alert routing / SLO-based paging** — out of scope, ops concern

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, `@sentry/nextjs@8+`

---

## References

- `references/violation-classes.md` — four-class taxonomy with canonical examples
- `references/sentry-config-template.md` — drop-in server / client / edge configs

## Scripts

- _(none in v0.1 — eval ships the classifier; a v0.2 codemod could apply the canonical beforeSend to a bare `Sentry.init`)_

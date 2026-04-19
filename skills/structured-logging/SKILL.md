---
name: structured-logging
description: >
  Emit structured logs from Next.js 15 server code using Pino + an
  OpenTelemetry-compatible field convention. Four rules:
  no `console.*` in production paths (route handlers, Server Actions,
  middleware), logs pass a structured object (not template literals),
  sensitive fields (password / token / secret / authorization /
  cookie) are never logged, and error logs carry the Error object so
  stack traces survive. Flags the four corresponding violations.
  Use when: adding a logger to a handler, reviewing a PR that adds
  logging, investigating "why are my logs unsearchable", migrating
  from console to Pino, "my Sentry traces don't correlate to logs".
  Do NOT use for: error-capture configuration (→ sentry-setup),
  OpenTelemetry instrumentation setup (v0.2 candidate `otel-setup`
  skill), metric counters / histograms (v0.2 candidate
  `server-metrics` skill), log aggregation platform config (v0.2
  candidate `log-aggregation` skill).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: observability
  phase: run
  type: procedural
  methodology_source:
    - name: "Pino — Best Practices"
      authority: "Pino maintainers"
      url: "https://getpino.io/#/docs/help"
      version: "pino v9+ docs (2025)"
      verified: "2026-04-18"
    - name: "OpenTelemetry — Logs Data Model"
      authority: "OpenTelemetry / CNCF"
      url: "https://opentelemetry.io/docs/specs/otel/logs/data-model/"
      version: "Logs Data Model v1.31 (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "pino@9+"
    - "next@15+ App Router"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T13:13:48.433Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four mechanical violations (console-in-handler,
    string-template-log, sensitive-data-logged, error-without-object)
    detected by a deterministic classifier over handler fixtures.
---

# structured-logging

Encodes structured-logging discipline for Next.js 15 server code using Pino + an OpenTelemetry-aligned field convention. Four rules a reviewer can verify from a handler file alone. Procedural skill.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Pino — Best Practices
  - Source: [https://getpino.io/#/docs/help](https://getpino.io/#/docs/help)
  - Authority: Pino maintainers
  - Verified: 2026-04-18
- **Secondary:** OpenTelemetry — Logs Data Model
  - Source: [https://opentelemetry.io/docs/specs/otel/logs/data-model/](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  - Authority: OpenTelemetry / CNCF
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the four mechanical logging-hygiene rules detectable from a single handler file — no `console.*`, structured-object payloads, no sensitive fields, error-object in error-level logs. NOT encoded: log-level selection judgment, log-aggregation platform choice (Axiom / Grafana Loki / DataDog), sampling strategy, PII redaction policy beyond the mechanical check.

---

## Stack Assumptions

- `pino@9+`
- `next@15+` App Router
- `bun@1.1+`

Pino is the dogmatic choice per `TOOL_MANIFEST.md`. If your stack is Winston / Bunyan, fork the suite.

---

## When to Use

Activate when any of the following is true:
- Adding a logger call to a route handler / Server Action / middleware
- Reviewing a PR that adds or modifies logging
- Migrating from `console.log` to a real logger
- "Why are my logs unsearchable?"
- "My Sentry traces don't correlate to logs"

## When NOT to Use

Do NOT activate for:
- **Sentry error capture** — `sentry-setup`.
- **OpenTelemetry instrumentation** — v0.2 candidate `otel-setup` skill.
- **Metrics (counters / histograms)** — v0.2 candidate `server-metrics` skill.
- **Log aggregation platform** — v0.2 candidate `log-aggregation` skill.

---

## Procedure

### Step 1 — Use a real logger; no `console.*` in handlers

```ts
// RIGHT
import { logger } from '@/lib/logger';
logger.info({ userId }, 'user signed in');

// WRONG
console.log('user signed in: ' + userId);
console.error('failed:', err);
```

`console.*` in Next server code (route handlers, Server Actions, middleware, `app/**/*.ts`) goes to stdout and is lost / unparseable. Use Pino.

Permitted: `console.warn` from `next.config.*` build-time hooks (logged to the build output, not runtime logs). Also permitted in `scripts/*.ts` one-off tooling.

### Step 2 — Pass a structured object, not a template literal

```ts
// RIGHT
logger.info({ userId, postId, action: 'create' }, 'post created');

// WRONG — unsearchable free-text
logger.info(`user ${userId} created post ${postId}`);
logger.info('user ' + userId + ' created post ' + postId);
```

The structured form indexes cleanly at the aggregator (search "userId=42"); the template form is free-text haystack. Pino's first argument is the context object and the second is the human-readable message.

### Step 3 — Never log sensitive fields

```ts
// WRONG
logger.info({ email, password }, 'login attempt');
logger.debug({ headers: req.headers }, 'request');
logger.info({ cookies, token, apiKey, authorization }, '...');
```

Banned fields in log payloads: `password`, `token`, `secret`, `apiKey` / `api_key`, `authorization`, `cookie`, `credit_card` / `creditCard`, `ssn`.

Pino has `redact` config — set it once in `lib/logger.ts`:

```ts
import pino from 'pino';

export const logger = pino({
  redact: {
    paths: [
      'password', '*.password',
      'token', '*.token',
      'secret', '*.secret',
      'authorization', '*.authorization',
      'cookie', '*.cookie',
      'headers.authorization', 'headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});
```

The skill flags direct inclusion of banned fields in log payloads regardless of redact config — the logger-wrapper should be written so these values never reach it.

### Step 4 — Error-level logs carry the Error object

```ts
// RIGHT — Pino serializes err as { message, stack, name, code }
try {
  await doThing();
} catch (err) {
  logger.error({ err, userId }, 'doThing failed');
}

// WRONG — stack trace and cause disappear
} catch (err) {
  logger.error('doThing failed');
  logger.error(`doThing failed: ${String(err)}`);
}
```

`logger.error` / `logger.fatal` must receive the Error object (conventionally under the `err` key) so Pino's built-in serializer captures the stack trace. A message-only error log is a dead end.

---

## Tool Integration

**Canonical `lib/logger.ts`:**

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'gelato-web',
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: [
      'password', '*.password',
      'token', '*.token',
      'secret', '*.secret',
      'authorization', '*.authorization',
      'cookie', '*.cookie',
      'headers.authorization', 'headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});
```

**Canonical handler with context:**

```ts
// app/api/posts/route.ts
import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';

export async function POST(req: Request) {
  const requestId = nanoid();
  const log = logger.child({ requestId });

  log.info({ url: req.url }, 'posts.create begin');
  try {
    // ... work ...
    log.info({ postId }, 'posts.create success');
    return Response.json({ ok: true, postId });
  } catch (err) {
    log.error({ err }, 'posts.create failed');
    return Response.json({ ok: false }, { status: 500 });
  }
}
```

---

## Examples

### Example 1 — `console.log` in a handler (`console-in-handler`)

**Input:** `app/api/auth/route.ts` uses `console.log('user signed in:', email);`.

**Output:** replace with `logger.info({ userEmail: email }, 'user signed in');`. The `console` output is free-text on stdout; the structured log is searchable by field at the aggregator.

### Example 2 — Template-literal log (`string-template-log`)

**Input:** `logger.info(\`post \${postId} created by \${userId}\`);`.

**Output:** `logger.info({ postId, userId }, 'post created');`. Fields become searchable; the message stays stable for grouping.

### Example 3 — Sensitive field logged (`sensitive-data-logged`)

**Input:** `logger.debug({ email, password, apiKey }, 'login attempt');`.

**Output:** remove `password` and `apiKey` from the payload. If you need to audit the attempt, log `{ email, hasPassword: !!password }`. Configure Pino `redact` so accidental inclusion gets censored at emission.

### Example 4 — Error log without the Error object (`error-without-object`)

**Input:** `logger.error('db.insert failed');` in a catch block.

**Output:** `logger.error({ err }, 'db.insert failed');` where `err` is the caught exception. Pino's error serializer captures `message`, `stack`, `name`, `code`.

---

## Edge Cases

- **`console.error` in a Sentry callback** — sometimes the only way to surface an error before the logger is initialized. Permitted at the module-load-time boundary, noted inline with a comment. This skill's fixtures do not flag top-of-file `console.*` outside a function body.
- **`logger.warn` from `next.config.*`** — the classifier treats only `route.ts` / `actions.ts` / `page.tsx` / `middleware.ts` as production paths; build-time scripts are exempt.
- **Pino's `bindings` / `child` loggers** — logging `{ password: '...' }` through a child logger still triggers the sensitive-data check. Redact at config time, don't whitelist at call site.
- **Logging a plain object that coincidentally has a `token` key** — a `{ csrfToken }` field in a debug log is still banned; use a boolean `{ hasCsrf: true }` instead if you need to audit presence.
- **Error re-raised after logging** — logging with `{ err }` then re-throwing is fine. Still flagged only if the log omits the Error object.

---

## Evaluation

See `/evals/structured-logging/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

No LLM-as-judge half for v0.1. A v0.2 `log-design-quality` rubric would judge whether log messages are useful during incident response (consistent verbs, right cardinality).

---

## Handoffs

- **Sentry error capture** → `sentry-setup`
- **OpenTelemetry setup** → v0.2 candidate `otel-setup` skill
- **Metrics** → v0.2 candidate `server-metrics` skill
- **Log aggregation platform** → v0.2 candidate `log-aggregation` skill

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, `pino@9+`

---

## References

- `references/violation-classes.md` — four-class taxonomy with canonical examples
- `references/otel-field-conventions.md` — OpenTelemetry-aligned field names

## Scripts

- _(none in v0.1 — eval ships the classifier; a codemod from console.* to logger is a v0.2 candidate)_

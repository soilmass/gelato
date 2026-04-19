# OpenTelemetry-aligned field conventions

Consistent field names make logs searchable across services and correlate cleanly with traces. These map to the OpenTelemetry Logs Data Model semantic conventions.

## Request / trace correlation

| Field | Type | Meaning |
|---|---|---|
| `requestId` | string | Unique per HTTP request. Generate at edge (middleware) or at handler entry. |
| `traceId` | string | OTel trace ID — W3C Trace Context format (32 hex chars). |
| `spanId` | string | OTel span ID (16 hex chars). Identifies the specific operation inside a trace. |
| `service` | string | Name of the service emitting the log (`gelato-web`). Set at logger-init via Pino `base`. |
| `env` | string | `development` / `preview` / `production`. Set via Pino `base`. |

## User / session identity (be careful with PII)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | Internal user identifier. Safe. |
| `tenantId` / `orgId` | string | Multi-tenant routing. Safe. |
| `sessionId` | string | Opaque session identifier — not the raw session token. |

**Never logged:** `email` unless masked, `userName`, `phoneNumber`, IP addresses without retention policy, browser fingerprints.

## Resource attributes

| Field | Type | Meaning |
|---|---|---|
| `route` | string | Next.js route (`/api/posts`, `/dashboard`). |
| `method` | string | HTTP method. |
| `statusCode` | number | Response status. |
| `durationMs` | number | Operation duration in milliseconds. |

## Error serialization

Pino's default serializer transforms the `err` key:

```json
{ "err": { "message": "Connection refused", "stack": "...", "name": "ECONNREFUSED", "code": "ECONNREFUSED" } }
```

Always log errors under the `err` key (`logger.error({ err }, 'msg')`). Don't spread the Error — the serializer loses the stack.

## Level policy

| Level | When | Example |
|---|---|---|
| `fatal` | Process must exit | Can't connect to primary DB on boot |
| `error` | Operation failed, user-visible | `posts.create failed` (caught + logged) |
| `warn` | Recoverable anomaly | Retry succeeded on 2nd attempt |
| `info` | Normal successful operation | `user signed in` |
| `debug` | Diagnostic detail | Raw query params in development |
| `trace` | Fine-grained flow | Auto-disabled in production |

Production runs at `info` or `warn` to keep cost sane.

## Relationship to Sentry

Errors go to Sentry via `sentry-setup`. This skill covers the log emission; Sentry handles the exception capture. Both should fire on the same event: `logger.error({ err })` AND `Sentry.captureException(err)`.

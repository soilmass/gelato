# Four violation classes

A fixture that triggers none is `safe`.

## 1. `console-in-handler`

**Signal:** `console.log(` / `console.warn(` / `console.error(` / `console.debug(` / `console.info(` called from inside a function body in a production handler file.

**Canonical example:**

```ts
export async function POST(req: Request) {
  const body = await req.json();
  console.log('got body:', body);
  return Response.json({ ok: true });
}
```

**Remediation:** `import { logger } from '@/lib/logger';` → `logger.info({ body }, 'received body');`.

## 2. `string-template-log`

**Signal:** `logger.<level>(` (info / warn / error / debug / trace / fatal) invoked with a template literal containing `${}` or a string built via `+` concatenation as the sole / first argument.

**Canonical example:**

```ts
logger.info(`user ${userId} signed in from ${ip}`);
logger.error('failed to save post ' + postId + ' for ' + userId);
```

**Remediation:**

```ts
logger.info({ userId, ip }, 'user signed in');
logger.error({ postId, userId }, 'failed to save post');
```

## 3. `sensitive-data-logged`

**Signal:** a structured log payload (first arg object to `logger.<level>`) that includes a key in `{password, token, secret, apiKey, api_key, authorization, cookie, credit_card, creditCard, ssn}`.

**Canonical example:**

```ts
logger.info({ email, password, apiKey }, 'login attempt');
logger.debug({ cookies: req.headers.cookie }, 'request');
```

**Remediation:** remove sensitive keys. Use boolean presence flags if audit is required:

```ts
logger.info({ email, hasPassword: !!password }, 'login attempt');
```

Configure Pino `redact` at logger-init time as a second line of defense.

## 4. `error-without-object`

**Signal:** `logger.error(` / `logger.fatal(` called with no Error object in the payload (first arg). Either no arguments, a string-only message, or a payload object that doesn't include an `err` / `error` / `cause` key.

**Canonical example:**

```ts
try {
  await doThing();
} catch (err) {
  logger.error('doThing failed');
  logger.error(`doThing failed: ${String(err)}`);
  logger.error({ userId }, 'doThing failed');
}
```

**Remediation:**

```ts
try {
  await doThing();
} catch (err) {
  logger.error({ err, userId }, 'doThing failed');
}
```

Pino's default serializer turns `err` into `{ message, stack, name, code }`.

## Why exactly four

These are the four logging anti-patterns that are both common in Next server code and detectable from the handler file alone. Log-level selection, sampling, and aggregator-routing are design / ops judgments and land in v0.2+ `log-design-quality` / `log-aggregation` skills.

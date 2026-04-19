# structured-logging eval

Proves the four Pino + OpenTelemetry-aligned logging rules are mechanically enforceable from single-handler fixture text.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **console-in-handler** — file is a handler (`'use server'`, `export function GET/POST/…`, `export … middleware`) AND `console.*()` appears inside a function body (not at module top-level).
2. **sensitive-data-logged** — first-arg object to `logger.*` / `log.*` contains a key in `{password, token, secret, apiKey, api_key, authorization, cookie, credit_card, creditCard, ssn}`.
3. **string-template-log** — first-arg to `logger.*` / `log.*` is a template literal with `${}` OR quoted string concatenated with `+`.
4. **error-without-object** — `logger.error` / `logger.fatal` first-arg is a string/template OR an object lacking `err`/`error`/`cause` key.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 error logged under `error` alias (classifier accepts err / error / cause)
- 02 `hasPassword: boolean` presence flag (word-boundary distinguishes from `password`)
- 03 `console.error` at module top-level inside an `if` guard — not inside a function body, so exempt
- 04 `tokenCount` field — substring-not-exact-match so `token` isn't triggered
- 05 `logger.info` without err — info level doesn't require an Error object
- 06 template literal used as a VALUE inside a structured payload — payload stays object-shaped

## Scope analysis for console detection

The classifier walks backwards from each `console.*()` position to find the enclosing `{`. It inspects what precedes `{`:
- `=>` or `) => ` → arrow function → inside-function = true
- `<identifier>( … )` where the identifier is NOT `if/for/while/switch/catch/do/else` → function
- Control-flow opener (`if/for/…`) → keep walking upward to find the next enclosing block

This lets us catch `console.log` inside a `try`/`if` nested inside a handler body while exempting `console.error` in a module-top-level `if (!process.env.X) { ... }` guard.

## Running

```bash
bun run eval structured-logging
```

~70 ms. No env, no network.

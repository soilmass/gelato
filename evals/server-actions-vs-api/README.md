# server-actions-vs-api eval

Proves the four Next.js-App-Router judgment violations (Server Action vs. route handler) are mechanically classifiable from the fixture file itself — no runtime, no network, no LLM.

## What the eval measures

Deterministic classifier — signal-based heuristics over the fixture text. Four detection steps (each short-circuits):

1. **mixed-concerns** — webhook-signature markers (`stripe-signature`, `x-hub-signature`, `x-webhook-…`, `stripe.webhooks.constructEvent`, or `user-agent`+`Webhook` branching) AND `req.formData()`, split by a positive `if (<var>) { …return… }` block whose closing brace is followed by the formData consumption.
2. **action-for-public-api** — `'use server'` file whose body OR JSDoc mentions Bearer / authToken / mobile / CLI / third-party / v1 API markers. Takes precedence over `action-no-revalidation` because a public-API Server Action is a more fundamental violation.
3. **action-no-revalidation** — `'use server'` file with `db.insert` / `db.update` / `db.delete` and no literal `revalidatePath(` / `revalidateTag(` call anywhere in the file.
4. **route-handler-for-form** — route handler (`export async function POST/PATCH/PUT/DELETE`) consuming formData AND having no webhook-signature or Bearer markers.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 `revalidateTag` inside a try block (present anywhere counts — no try/happy-path distinction)
- 02 webhook that parses multipart (guard-clause pattern, not branch — NOT mixed-concerns)
- 03 mutating action with `redirect()` but no revalidate (redirect ≠ revalidate)
- 04 React client fetching JSON from a GET route (no formData, no mutation — legitimate)
- 05 streaming POST route handler (uses `req.json()`, not formData — legitimate)
- 06 action whose revalidation is wrapped in a custom helper (literal call missing — still a violation; helpers don't satisfy the rule)

## Running

```bash
bun run eval server-actions-vs-api
```

~70 ms. No env, no Chromium, no API keys.

## Why these four, not more

See `skills/server-actions-vs-api/references/violation-classes.md` § "Why exactly four". A fifth class (e.g. "public API without a version prefix") drifts into API-design territory that belongs in a dedicated v0.2 skill.

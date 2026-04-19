# event-taxonomy-and-instrumentation eval

Proves the four PostHog + Amplitude North Star violations are mechanically enforceable from single-call-site fixture text.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **pii-in-event-properties** — any key of the capture's properties object matches `{email, password, token, secret, authorization, cookie, apiKey, api_key, creditCard, credit_card, ssn, firstName, first_name, lastName, last_name}`.
2. **email-as-distinct-id** — `posthog.identify(<expr>)` or `posthog.identify({distinctId: <expr>})` where `<expr>` contains a bare `email` identifier (word boundary).
3. **non-snake-case-event** — event name fails `^[a-z][a-z0-9_]*$` OR is in `{click, event, action, submit, page_view, user_event, button_clicked}`.
4. **missing-event-properties** — positional capture without a 2nd arg or with `undefined`; object-form capture without a `properties` key or `properties: undefined`.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 `hasEmail` presence flag — word-boundary distinguishes from `email`
- 02 `posthog.identify(user.id, { email: user.email })` — email in traits object (second arg), not as distinct-ID
- 03 event name with digits (`v2_onboarding_completed`) — snake_case regex accepts digits
- 04 `button_clicked` with context properties — still banned (on generic list)
- 05 posthog-node object form with `properties: {}` — explicit empty, not missing
- 06 `tokenCount` as a property key — word-boundary distinguishes from `token`

## Running

```bash
bun run eval event-taxonomy-and-instrumentation
```

~70 ms. No env, no network.

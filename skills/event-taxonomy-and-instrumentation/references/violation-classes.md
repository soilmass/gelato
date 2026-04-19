# Four violation classes

A fixture that triggers none is `safe`.

## 1. `non-snake-case-event`

**Signal:** first arg to `posthog.capture(...)` / `posthog.capture({ event: ... })` has uppercase letters, hyphens, spaces, OR is in the banned-generic set (`click`, `event`, `action`, `submit`, `page_view`, `user_event`, `button_clicked`).

**Remediation:** `snake_case` + object + verb (past tense). Prefer `post_created`, `invoice_paid`, `subscription_canceled`.

## 2. `missing-event-properties`

**Signal:** `posthog.capture('<name>')` called with no second argument, OR `posthog.capture('<name>', undefined)`.

**Remediation:** always pass a properties object, even if `{}`. Document intent with structure, not absence.

## 3. `pii-in-event-properties`

**Signal:** second arg (properties object) contains a key in `{email, password, token, secret, authorization, cookie, apiKey, api_key, credit_card, creditCard, ssn, firstName, first_name, lastName, last_name}`.

**Remediation:** move identity traits to the `identify()` call. Events are per-action facts.

## 4. `email-as-distinct-id`

**Signal:** `posthog.identify(<expr>, ...)` where `<expr>` references `email` (e.g., `user.email`, `email`, `session.email`, `body.email`).

**Remediation:** use an opaque user ID (`user.id`) as the distinct ID. Add the email as a trait: `posthog.identify(user.id, { email: user.email })`.

## Why exactly four

These are the four patterns that are mechanically detectable from a single instrumentation call site and have concrete downstream consequences: dashboard fragmentation (1), un-queryable events (2), PII leakage (3), broken identity resolution (4). Taxonomy design, property-schema design, funnel design, and cohort definitions are fuzzier and land in future skills / an LLM rubric.

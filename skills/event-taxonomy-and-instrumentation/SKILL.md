---
name: event-taxonomy-and-instrumentation
description: >
  Apply PostHog + Amplitude North Star event-taxonomy discipline to a
  Next.js app. Four rules: event names are snake_case and verb-phrased
  (`post_created`, never `PostCreated` / `post-created` / `click`),
  every `capture` call passes a structured properties object,
  properties never contain PII (email / password / authorization /
  token / credit_card / ssn), and `identify` uses an opaque
  distinct-ID — never the user's email. Flags the four corresponding
  violations.
  Use when: adding or reviewing event instrumentation, defining the
  event taxonomy for a new feature, "what should we name this
  event", "our analytics data is a mess", migrating from Mixpanel /
  GA to PostHog.
  Do NOT use for: dashboard / funnel / cohort design (operational),
  A/B-testing primitives (v0.2 candidate `ab-testing` skill),
  warehouse ETL routing (v0.2 candidate `warehouse-etl` skill),
  GDPR / CCPA compliance beyond the mechanical PII check.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: analytics
  phase: run
  type: judgment
  methodology_source:
    - name: "Amplitude — The North Star Playbook"
      authority: "Amplitude"
      url: "https://amplitude.com/north-star"
      version: "North Star Playbook 2023 edition"
      verified: "2026-04-18"
    - name: "PostHog — Event Data Design"
      authority: "PostHog"
      url: "https://posthog.com/docs/data/events"
      version: "PostHog docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "posthog-js@1.180+ OR posthog-node@4+"
    - "next@15+ App Router"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.238Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Judgment skill. Four mechanical violations
    (non-snake-case-event, missing-event-properties, pii-in-event-
    properties, email-as-distinct-id) detected by a deterministic
    classifier over PostHog capture/identify call sites.
---

# event-taxonomy-and-instrumentation

Encodes a small, strict subset of Amplitude's North Star + PostHog's event-data guidance as four mechanical rules over instrumentation call sites. Judgment skill — taxonomy design beyond these four is a team decision; the skill enforces what breaks downstream analytics when done wrong.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Amplitude — The North Star Playbook
  - Source: [https://amplitude.com/north-star](https://amplitude.com/north-star)
  - Authority: Amplitude
  - Verified: 2026-04-18
- **Secondary:** PostHog — Event Data Design
  - Source: [https://posthog.com/docs/data/events](https://posthog.com/docs/data/events)
  - Authority: PostHog
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the four mechanical rules detectable from a single instrumentation call site — name shape, properties shape, PII exclusion, distinct-ID discipline. NOT encoded: KPI / North Star metric selection, funnel design, dashboard layout, A/B test primitives, warehouse ETL routing.

---

## Stack Assumptions

- `posthog-js@1.180+` (client) OR `posthog-node@4+` (server)
- `next@15+` App Router
- `bun@1.1+`

If your stack is Mixpanel / Amplitude / Segment, the same principles apply; the regex shape of `capture` / `track` differs — fork the suite.

---

## When to Use

Activate when any of the following is true:
- Adding a `posthog.capture(...)` call
- Reviewing a PR that introduces new events
- Defining the event taxonomy for a new feature
- "What should we name this event?"
- "Our analytics data is a mess" / "we have 300 variants of the same event"

## When NOT to Use

Do NOT activate for:
- **Dashboard / funnel / cohort design** — operational, downstream.
- **A/B testing primitives** — v0.2 candidate `ab-testing` skill.
- **Warehouse ETL routing** — v0.2 candidate `warehouse-etl` skill.
- **GDPR / CCPA compliance beyond PII avoidance** — v0.2 candidate `privacy-compliance` skill.

---

## Procedure

### Step 1 — Name events as `noun_verb` (snake_case, past tense)

```ts
// RIGHT — consistent, searchable, past-tense
posthog.capture('post_created', { postId, length });
posthog.capture('invoice_paid', { invoiceId, amount });
posthog.capture('subscription_canceled', { plan, reason });

// WRONG
posthog.capture('PostCreated', {...});      // PascalCase
posthog.capture('post-created', {...});     // kebab-case
posthog.capture('createPost', {...});       // camelCase verb-first
posthog.capture('click', {...});            // generic, no object
posthog.capture('button_clicked', {...});   // almost there, but which button?
```

Rule: lowercase letters, digits, underscores only. Name contains a verb (past-tense preferred) AND an object (what was acted on). Ban the generic list: `click`, `event`, `action`, `submit`, `page_view` (without a qualifier), `user_event`, `button_clicked` (without object).

### Step 2 — Every capture passes a structured properties object

```ts
// RIGHT
posthog.capture('post_created', { postId, lengthChars: body.length, tags: post.tags });

// WRONG — no context, impossible to segment
posthog.capture('post_created');
posthog.capture('post_created', undefined);
```

Even when a payload feels obvious, commit to the second argument. A `capture('X')` with no properties means downstream queries can never answer "which kind of X?".

### Step 3 — No PII in event properties

```ts
// WRONG
posthog.capture('login_attempted', { email, password, ip });
posthog.capture('signup_completed', { email, firstName, lastName });
```

Banned keys in event properties: `email`, `password`, `token`, `secret`, `authorization`, `cookie`, `api_key` / `apiKey`, `credit_card` / `creditCard`, `ssn`, `firstName` / `first_name` + `lastName` / `last_name` (unless explicitly anonymized).

User traits (name, email) belong on the `identify` call, attached to the user record — not fired with every event. Event properties are per-action facts.

### Step 4 — Identify with an opaque ID, never email

```ts
// RIGHT
posthog.identify(user.id, { email: user.email, plan: user.plan });

// WRONG — email as distinct ID
posthog.identify(user.email, { plan: user.plan });
```

The distinct ID must be a stable, opaque user identifier. Using the email couples analytics to a PII-laden field and breaks when the user changes their email. PostHog's `$set` properties on `identify` are the right place for `email` as a trait — not the ID itself.

---

## Tool Integration

**Canonical client init:**

```ts
// components/PosthogProvider.tsx
'use client';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: 'history_change',
    autocapture: false,
  });
}

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

**Canonical capture in a Server Action:**

```ts
'use server';
import { PostHog } from 'posthog-node';
import { db, posts } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

const posthog = new PostHog(process.env.POSTHOG_KEY!, {
  host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
});

export async function createPost(formData: FormData) {
  const user = await getCurrentUser();
  const title = String(formData.get('title') ?? '');
  const body = String(formData.get('body') ?? '');

  const [row] = await db.insert(posts).values({ title, body, authorId: user.id }).returning();

  posthog.capture({
    distinctId: user.id,
    event: 'post_created',
    properties: { postId: row.id, lengthChars: body.length, hasTitle: title.length > 0 },
  });
  await posthog.shutdown();

  return { ok: true, postId: row.id };
}
```

Note: `posthog-node` uses an object form `{ distinctId, event, properties }`; the browser SDK uses `posthog.capture(event, properties)`. Same four rules apply.

---

## Examples

### Example 1 — Non-snake-case event (`non-snake-case-event`)

**Input:** `posthog.capture('SignUpCompleted', { plan });`.

**Output:** `posthog.capture('signup_completed', { plan });`. Consistent casing lets dashboards group identical events — a mix of `SignUpCompleted`, `signup_completed`, and `signup-completed` shows up as three separate events.

### Example 2 — Missing properties (`missing-event-properties`)

**Input:** `posthog.capture('invoice_paid');`.

**Output:** `posthog.capture('invoice_paid', { invoiceId, amount, currency });`. Even if the event feels self-descriptive, future segmentation requires context.

### Example 3 — PII in event properties (`pii-in-event-properties`)

**Input:** `posthog.capture('login_attempted', { email, password });`.

**Output:** remove `password` (never log) and move `email` to a trait on the `identify` call. Keep events PII-free; put identity on the user record.

### Example 4 — Email as distinct ID (`email-as-distinct-id`)

**Input:** `posthog.identify(user.email, { plan });`.

**Output:** `posthog.identify(user.id, { email: user.email, plan });`. The distinct ID is opaque and stable; email is a trait on the record.

---

## Edge Cases

- **Anonymous users before identify** — PostHog assigns an anonymous ID by default. First `identify(user.id)` call aliases it to the real user. That's the happy path, no violation.
- **Server-side `posthog-node` object form** — `posthog.capture({ distinctId, event, properties })`. The four rules still apply: `event` name snake_case, `properties` present, no PII in `properties`, `distinctId` not an email.
- **Event with no relevant property data** — pass `{}` explicitly. An empty object documents intent; missing it is ambiguous.
- **Email-as-identifier for pre-signup leads** — if you literally only have the email, use `alias()` to merge later when you get a real ID. Don't leave email as the permanent distinct ID.
- **Internal debug events** — staging / preview events can still follow the rules. Don't special-case.

---

## Evaluation

See `/evals/event-taxonomy-and-instrumentation/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

The roadmap flagged this skill as "hard" — taxonomy design beyond naming is judgment-heavy. v0.1 ships only the four mechanical checks. A v0.2 `taxonomy-coherence` LLM rubric would judge whether a set of events across a feature share a consistent verb/object shape.

---

## Handoffs

- **Dashboard / funnel design** — out of scope, product.
- **A/B testing** — v0.2 candidate `ab-testing` skill.
- **Warehouse ETL** — v0.2 candidate `warehouse-etl` skill.
- **Privacy compliance beyond PII avoidance** — v0.2 candidate `privacy-compliance` skill.

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, `posthog-js` OR `posthog-node`

---

## References

- `references/violation-classes.md` — four-class taxonomy with canonical examples
- `references/event-naming-reference.md` — verb-phrase reference list

## Scripts

- _(none in v0.1 — eval ships the classifier; a codemod for `EventName` → `event_name` is a v0.2 candidate)_

---
name: server-actions-vs-api
description: >
  Decide between a Next.js Server Action and a route handler for each
  mutation / read endpoint. Applies a four-criterion decision tree
  (progressive enhancement, non-React caller, streaming, third-party
  access) to classify the right tool. Flags four violations: route
  handler used where a Server Action would be idiomatic, Server Action
  used where a route handler is needed, Server Action mutating without
  calling revalidatePath/Tag, single endpoint handling both public API
  and React-form submission.
  Use when: adding a mutation, writing a form submission, exposing an
  endpoint to a mobile app or third-party, building a webhook receiver,
  reviewing a PR that adds a route handler, "should this be a Server
  Action or an API route", designing a public API surface.
  Do NOT use for: input validation (→ zod-validation), authentication
  middleware (→ auth-flow-review), CORS configuration details (→
  security-headers), form UI design (→ form-with-server-action).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: server
  phase: build
  type: judgment
  methodology_source:
    - name: "Next.js — Server Actions and Mutations"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
    - name: "Next.js — Route Handlers"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/routing/route-handlers"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T12:45:01.474Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Judgment skill, no Hard Thresholds. Deep procedure
    carries enforcement. Four-criterion decision tree; four violation
    classes detected by a deterministic classifier over fixture
    handler/action declarations.
---

# server-actions-vs-api

Encodes Next.js 15's documented split between Server Actions and Route Handlers. Server Actions for mutations from within your React app; route handlers for everything else (public API, webhooks, streaming, non-React callers). Judgment skill — procedure is the enforcement.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Next.js — Server Actions and Mutations
  - Source: [https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Secondary:** Next.js — Route Handlers
  - Source: [https://nextjs.org/docs/app/building-your-application/routing/route-handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the four decision criteria that determine when each tool is right, the tag-revalidation pairing requirement for mutating Server Actions, the separation-of-concerns rule that a single endpoint must pick one audience.

NOT encoded: request validation (`zod-validation`), authentication patterns (`auth-flow-review`), rate limiting details (belongs in a dedicated middleware skill), specific CORS configurations (`security-headers` overlaps with the response-header concern).

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+`

If your stack differs, fork the suite.

---

## When to Use

Activate when any of the following is true:
- Adding a mutation endpoint
- Writing a form submission flow
- Exposing an endpoint to a mobile app, CLI, or third party
- Building a webhook receiver (Stripe, GitHub, etc.)
- Reviewing a PR adding a route handler
- "Should this be a Server Action or an API route?"
- Designing a public API surface

## When NOT to Use

Do NOT activate for:
- **Input validation** — `zod-validation` owns parse-at-the-boundary.
- **Authentication / session handling** — `auth-flow-review`.
- **CORS configuration** — `security-headers` covers response-header concerns; CORS specifics here belong in a v0.2+ API-design skill.
- **Form UI design** — `form-with-server-action` handles the React form + Server Action wiring.

---

## Procedure

### Step 1 — Apply the four-criterion decision tree

Answer each question. The first "yes" decides.

1. **Is the caller a non-React client (mobile app, CLI, webhook, third-party)?**
   If yes → **Route handler**. Server Actions are React-coupled — they require the React runtime to invoke and don't have a stable HTTP interface. A mobile app calls your backend via a route handler.

2. **Does this endpoint need to stream a response (Server-Sent Events, long-running response body)?**
   If yes → **Route handler**. Server Actions return a single value; they can't stream.

3. **Is this a mutation from within a React UI (form submission, button click that changes server state)?**
   If yes → **Server Action**. This is the design center — progressive-enhancement form submit, type-safe RPC from React Server Components, built-in revalidation hooks.

4. **Is this a read that the page's Server Components can do at render time?**
   If yes → **Server Component direct call**, not a route handler and not a Server Action. Route handlers are for reads that the page can't pre-compute (dynamic JSON endpoints for client-side code).

If none apply and it's a mutation: **Server Action**. If none apply and it's a read exposed to non-React clients: **Route handler**.

### Step 2 — Pair every mutating Server Action with revalidation

A Server Action that changes server state must tell Next which caches to invalidate:

```ts
'use server';
import { revalidateTag, revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  await db.insert(posts).values({ /* ... */ });
  revalidateTag('posts');              // or revalidatePath('/posts');
}
```

A Server Action that writes to the DB but doesn't call either leaves the UI showing stale data. Pair mutation with invalidation in the same function body.

### Step 3 — One endpoint, one audience

A route handler that handles both `fetch` from your React app **and** fetches from a third-party webhook is a mixed-concern endpoint. The validation, auth, rate-limit, and error-response shape for each are different. Split into two handlers:

```
app/api/internal/posts/route.ts    # first-party React-app callers
app/api/webhooks/stripe/route.ts   # third-party webhooks
```

Don't route both through one `/api/posts` and branch on headers.

### Step 4 — CORS is a route-handler concern

If you need CORS (third-party domains calling your endpoint), it's a route handler. Server Actions don't expose a stable URL and can't be directly addressed via CORS preflight. The decision tree's criterion #1 handles this naturally.

### Step 5 — Verify on merge

A PR adding a new handler / action: run the classifier (eval). For each new endpoint:

- Confirm the decision-tree answer.
- If Server Action + mutating: confirm revalidate call present.
- If route handler: confirm it's not handling a React-form submission that should have been an action.

---

## Tool Integration

**Canonical Server Action (mutating, tag-invalidating):**

```ts
'use server';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';

const CreatePostSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export async function createPost(formData: FormData) {
  const result = CreatePostSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, errors: result.error.flatten() };
  await db.insert(posts).values(result.data);
  revalidateTag('posts');
  return { ok: true };
}
```

**Canonical webhook route handler:**

```ts
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  // handle event
  return new Response(null, { status: 204 });
}
```

**Canonical public read API:**

```ts
// app/api/public/posts/route.ts
export async function GET(req: Request) {
  const posts = await db.select().from(posts).limit(50);
  return Response.json({ posts });
}
```

---

## Examples

### Example 1 — Form submission implemented as a route handler (`route-handler-for-form`)

**Input:** `<form action="/api/contact" method="POST">` posting to a route handler that reads `await req.formData()`, inserts a contact row, and redirects.

**Output:** this is the exact use case Server Actions were designed for. Convert to a Server Action — the form gets progressive enhancement for free, the types are shared end-to-end, and the revalidate hooks pair cleanly with the mutation.

### Example 2 — Mobile API implemented as a Server Action (`action-for-public-api`)

**Input:** iOS app calls a Server Action to create a post. The app imports something like `createPost` and treats it as an RPC.

**Output:** Server Actions are not a stable HTTP interface. The action's ID can change between builds; the React binding rules are not the JSON the mobile app expects. Move to a versioned route handler (`app/api/v1/posts/route.ts`) with Bearer auth.

### Example 3 — Mutation with no revalidation (`action-no-revalidation`)

**Input:**

```ts
'use server';
export async function createPost(formData: FormData) {
  await db.insert(posts).values({ /* ... */ });
  return { ok: true };
}
```

**Output:** the server state changed but no cache is invalidated. The next render of `/posts` shows the old list until the cached data naturally ages out. Add `revalidateTag('posts')` or `revalidatePath('/posts')`.

### Example 4 — Mixed-concerns endpoint (`mixed-concerns`)

**Input:** `app/api/posts/route.ts` handles both the first-party React app's fetches AND a webhook from a partner service, branching on the User-Agent header.

**Output:** split into `app/api/internal/posts/route.ts` (React callers) and `app/api/webhooks/partner/route.ts` (webhook). Each has its own auth, validation, rate limiting, and error shape.

---

## Edge Cases

- **Internal JSON endpoints used only by your React app** — technically callable by anyone who opens DevTools, but the audience is React. If CORS is not needed and streaming is not needed, the Server Action is still the right shape; only convert to a route handler when non-React callers genuinely need it.
- **Server Actions called from client components** — valid. The React binding infrastructure makes the action callable from `'use client'` code via the React serialization boundary. Not a violation.
- **Streaming Server Actions via React generators** — experimental as of Next 15, not the decision point for this skill. Route handler remains the canonical choice for any real streaming.
- **Third-party webhooks that happen to be from services you control** — first-party or third-party, the endpoint is still a webhook (HTTP calls from outside your React app). Route handler.
- **File uploads** — Server Actions handle `FormData` with files directly. Route handlers also work. The decision tree still applies: is the caller React? If yes, Server Action.

---

## Evaluation

See `/evals/server-actions-vs-api/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

No LLM-as-judge half for v0.1. Decision-tree application is the v0.2 candidate for a qualitative rubric.

---

## Handoffs

- **Input validation** → `zod-validation`
- **Authentication** → `auth-flow-review`
- **Form UI design** → `form-with-server-action`
- **CORS configuration** → `security-headers` (overlaps with header-level concerns)
- **Rate limiting** — v0.2+ candidate middleware skill

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+

---

## References

- `references/decision-tree.md` — copy-paste four-criterion tree
- `references/violation-classes.md` — four-class taxonomy with canonical examples

## Scripts

- _(none in v0.1 — eval ships the classifier; a CLI audit walking app/ is a v0.2 candidate)_

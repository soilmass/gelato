---
name: zod-validation
description: >
  Apply Zod validation at every system boundary — route handlers, Server
  Actions, environment variables, webhooks, third-party API responses.
  Validates inputs where they enter the application, not at point-of-use.
  Four violation classes: missing-at-boundary, validation-after-consumption,
  parse-should-be-safe-parse, unsafe-cast-bypasses-schema.
  Use when: writing a route.ts handler, writing a Server Action taking
  FormData, reading process.env, parsing a webhook body, consuming a
  third-party API response, reviewing input-validation in a PR.
  Do NOT use for: database schema design (→ drizzle-migrations), UI-only
  validation (client checks are not security), ORM field constraints
  (Drizzle's notNull / length are different surface).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: data
  phase: build
  type: procedural
  methodology_source:
    - name: "Zod — Schema declaration and validation"
      authority: "Colin McDonnell (Zod author)"
      url: "https://zod.dev/"
      version: "Zod 3.23+"
      verified: "2026-04-18"
    - name: "Next.js — Server Actions and Mutations"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "zod@3.23+"
    - "next@15+ App Router"
    - "typescript@5+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T13:13:48.433Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four violation classes (missing-at-boundary,
    validation-after-consumption, parse-should-be-safe-parse,
    unsafe-cast-bypasses-schema). Deterministic classifier over
    Next.js route handlers, Server Actions, and env-reader patterns.
---

# zod-validation

Encodes Zod's "parse at the boundary" discipline applied to Next.js 15+ App Router. Every piece of untrusted input — HTTP request body, query string, form data, env var, webhook payload, third-party API response — is parsed with a Zod schema before any business logic touches it. Procedural skill; four Hard Thresholds; mechanical classifier catches the common failure modes.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Zod — *Schema declaration and validation*
  - Source: [https://zod.dev/](https://zod.dev/)
  - Version: Zod 3.23+
  - Verified: 2026-04-18
- **Secondary:** Next.js — *Server Actions and Mutations*
  - Source: [https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the "parse at the boundary" principle (validate inputs where they enter, not at point-of-use), the `.parse()` vs `.safeParse()` decision, the four common misuses that produce runtime exceptions or silent data corruption.

NOT encoded: schema *design* for domain-model tables (Drizzle's job), client-only validation patterns for UX (React Hook Form is a UX concern; this skill covers server enforcement), advanced Zod features like custom refinements beyond what the boundary patterns need, `.transform()` pipelines (separable concern).

---

## Stack Assumptions

- `zod@3.23+`
- `next@15+` App Router (route handlers + Server Actions)
- `typescript@5+`
- `bun@1.1+`

If your stack differs, fork the suite.

---

## When to Use

Activate when any of the following is true:
- Writing or editing a `route.ts` handler (GET/POST/PATCH/PUT/DELETE)
- Writing a Server Action that accepts `FormData` or structured input
- Reading `process.env` in application code (env-schema territory)
- Parsing a webhook body
- Consuming a third-party API response (Stripe, GitHub, Supabase Auth, etc.)
- Reviewing a PR that touches input-accepting code
- "Is this input validated correctly?"

## When NOT to Use

Do NOT activate for:
- **Database schema design** — that's `drizzle-migrations` (migration-shape) and Drizzle schema files (column types).
- **Client-only validation** for UX feedback — React Hook Form with a `zodResolver` is fine, but client validation is not security. Server-side validation is still required.
- **ORM-layer constraints** — `notNull`, `length()` in Drizzle schema are database-level, not application-level.
- **Non-Zod validation libraries** — Yup, Joi, Valibot all have their own idioms; fork the suite.

---

## Procedure

### Step 1 — Identify every boundary

A *boundary* is a place where untrusted input enters the application:

- **Route handlers** (`app/api/**/route.ts`): the request body, query string, path params, headers.
- **Server Actions** (functions tagged `'use server'`): the `FormData` or structured prop.
- **Environment variables**: `process.env.*` accessed anywhere.
- **Webhooks**: the request body from Stripe, GitHub, etc.
- **Third-party API responses**: `fetch(...).then(r => r.json())` — the response JSON.
- **URL parameters**: `params.slug` in a dynamic route; `searchParams.q`.

For each boundary: what Zod schema parses it on entry?

### Step 2 — Parse at the boundary, not at point-of-use

**Correct:**

```ts
// app/api/signup/route.ts
import { z } from 'zod';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const input = SignupSchema.parse(await req.json());  // boundary
  // input.email is now TRUSTED — downstream code can rely on its shape
  await db.insert(users).values({ email: input.email, ... });
}
```

**Incorrect (validation-after-consumption):**

```ts
export async function POST(req: Request) {
  const body = await req.json();
  await doSomething(body);       // ← already consumed
  SignupSchema.parse(body);       // ← validation useless
}
```

### Step 3 — Pick `.parse()` vs `.safeParse()` deliberately

| Use | When |
|---|---|
| `.parse()` | The input MUST be valid; invalid is a programmer error or a malformed request that should surface a 400. Throws on failure. |
| `.safeParse()` | The input MAY be invalid; you want to branch on success/failure without a try/catch. Returns `{ success, data, error }`. |

Route handlers and Server Actions accepting user input: prefer `.safeParse()` and return a structured error response. Env-var schemas on startup: `.parse()` is appropriate (hard fail early).

**Wrong:**

```ts
try {
  const input = Schema.parse(body);  // throws
  return Response.json(result);
} catch (err) {
  return new Response('Invalid', { status: 400 });  // swallows the real error
}
```

**Right:**

```ts
const result = Schema.safeParse(body);
if (!result.success) {
  return Response.json({ errors: result.error.flatten() }, { status: 400 });
}
const input = result.data;  // trusted
```

### Step 4 — Never cast around the schema

```ts
// WRONG — unsafe cast bypasses Zod entirely
const input = body as SignupInput;

// WRONG — cast-then-parse is not a thing; just parse
const input = Schema.parse(body as unknown);

// WRONG — non-null assertion on schema output erases error signal
const input = Schema.parse(body)!;
```

If TypeScript is unhappy with a narrowing, the fix is **to add a schema**, not to cast.

### Step 5 — Schema the environment once, import everywhere

```ts
// lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().min(10),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

export const env = EnvSchema.parse(process.env);
```

Every other file imports `env.STRIPE_SECRET_KEY`, not `process.env.STRIPE_SECRET_KEY`. A missing env var fails at startup, not when a request is served three hours later.

---

## Hard Thresholds

The eval fails this skill if any threshold is missed:

- **Every route handler / Server Action touching untrusted input has a Zod schema parse at the boundary** (before any business logic).
- **No validation-after-consumption** — a parse that occurs after the input has been used for side effects is not validation.
- **No `.parse()` inside a try/catch that swallows the error** — that's the `.safeParse()` shape badly spelled.
- **No `as <SchemaOutput>` casts** on inputs that a schema could validate.

The classifier inspects each fixture and matches one of four violation classes: `missing-at-boundary`, `validation-after-consumption`, `parse-should-be-safe-parse`, `unsafe-cast-bypasses-schema`.

---

## Tool Integration

**Route handler (canonical):**

```ts
// app/api/posts/route.ts
import { z } from 'zod';
import { NextResponse } from 'next/server';

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  tags: z.array(z.string()).max(10).optional(),
});

export async function POST(req: Request) {
  const result = CreatePostSchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json({ errors: result.error.flatten() }, { status: 400 });
  }
  const post = await createPost(result.data);
  return NextResponse.json(post, { status: 201 });
}
```

**Server Action with FormData:**

```ts
'use server';
import { z } from 'zod';

const SubscribeSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['starter', 'pro', 'team']),
});

export async function subscribe(formData: FormData) {
  const result = SubscribeSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { ok: false, errors: result.error.flatten() };
  }
  await createSubscription(result.data);
  return { ok: true };
}
```

**Env schema (single source of truth):**

```ts
// lib/env.ts
import { z } from 'zod';

export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .parse(process.env);
```

---

## Examples

### Example 1 — Route handler with no validation (`missing-at-boundary`)

**Input:**

```ts
export async function POST(req: Request) {
  const body = await req.json();
  await db.insert(posts).values({ title: body.title, body: body.body });
  return Response.json({ ok: true });
}
```

**Output:** `body.title` and `body.body` are untyped `any`. Drizzle will accept whatever shape ships. A client sending `{ title: { sql: "'; DROP TABLE posts;--" } }` lands unescaped into the query pipeline (Drizzle parameterizes, but the type erasure is a latent hazard). Add a Zod schema:

```ts
const Schema = z.object({ title: z.string().min(1), body: z.string().min(1) });
const result = Schema.safeParse(await req.json());
if (!result.success) return Response.json({ errors: result.error.flatten() }, { status: 400 });
await db.insert(posts).values(result.data);
```

### Example 2 — Validation after consumption (`validation-after-consumption`)

**Input:**

```ts
export async function POST(req: Request) {
  const body = await req.json();
  await sendNotification(body);        // used BEFORE validation
  Schema.parse(body);                    // validation is now cosmetic
  return Response.json({ ok: true });
}
```

**Output:** `sendNotification` already ran with whatever was posted. Move the parse to the top.

### Example 3 — `.parse()` in a try/catch (`parse-should-be-safe-parse`)

**Input:**

```ts
try {
  const input = Schema.parse(body);
  /* ... */
} catch (err) {
  return new Response('Invalid', { status: 400 });
}
```

**Output:** the `err` is typed as `unknown` — the structured `error.flatten()` diagnostic data Zod provides is thrown away. Use `.safeParse()`:

```ts
const result = Schema.safeParse(body);
if (!result.success) {
  return Response.json({ errors: result.error.flatten() }, { status: 400 });
}
```

---

## Edge Cases

- **Path parameters (`params.slug`):** types as `string`, but "string" includes unvalidated content. Parse through a Zod schema when the param has constraints (`z.string().regex(/^[a-z0-9-]+$/)`).
- **Search params (`searchParams.q`):** same as path params. `z.coerce.number()` for numeric search params since URL values are always strings.
- **Webhooks:** verify signature *before* parsing the body with Zod. Signature verification and schema validation are separate steps.
- **Third-party API responses:** schema the response shape too — "Stripe's docs say X" doesn't help when Stripe ships a breaking change. Your schema becomes the contract.
- **Union / discriminated union bodies:** prefer `z.discriminatedUnion('type', [...])` over plain `z.union([...])` for better error messages and runtime performance.
- **Streaming request bodies:** if the entire body must arrive before parse (typical), `await req.json()`. For streaming, Zod is the wrong shape — schema each chunk separately.

---

## Evaluation

See `/evals/zod-validation/` for the canonical eval suite.

### Pass criteria

**Quantitative:**
- Classifier flags ≥ 95% of violation fixtures across 4 classes
- Zero false positives on legitimate well-validated fixtures
- Every violation class covered by ≥ 1 fixture

No LLM-as-judge half for v0.1 — the four classes are syntactically detectable.

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate`.

---

## Handoffs

This skill is scoped to application-level input validation at boundaries. Explicitly NOT absorbed:

- **Database-schema design** — `drizzle-migrations` + Drizzle schema files
- **Client-only UX validation** — React Hook Form `zodResolver` is fine, but this skill is about server enforcement
- **ORM-layer constraints** — `notNull`, `length()` in Drizzle are database-level
- **Non-Zod libraries** — fork the suite

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Zod 3.23+, Next.js 15+

---

## References

- `references/boundary-types.md` — the six input boundaries every Next.js app has, with canonical-shape schemas
- `references/violation-classes.md` — four-class taxonomy with canonical examples per class

## Scripts

- _(none in v0.1 — eval ships the classifier; a `bun run zod-audit` CLI walking the repo is a v0.2 candidate)_

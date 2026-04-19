# Four violation classes

Each fixture classifies into exactly one. A fixture that triggers none is `safe`.

## 1. `route-handler-for-form`

A route handler is receiving React form submissions that should have been a Server Action.

**Signal:** `route.ts` exports `POST` / `PATCH` / `DELETE` / `PUT`, consumes `await req.formData()`, and the file does not reference webhook / third-party markers (no `stripe-signature` header check, no Bearer auth, no non-React caller indicators).

**Canonical example:**

```ts
// app/api/contact/route.ts
export async function POST(req: Request) {
  const data = await req.formData();
  await db.insert(contacts).values({ email: data.get('email'), body: data.get('body') });
  return Response.redirect('/thanks');
}
```

**Remediation:** convert to a Server Action. The form's `action` attribute binds the function directly, the types are end-to-end, progressive enhancement is automatic.

## 2. `action-for-public-api`

A Server Action is being used as a public API surface.

**Signal:** a `'use server'` file exports functions whose callers are documented as mobile / CLI / third-party / versioned-API. Typically accompanied by JSDoc like `/** v1 API */` or explicit Bearer token checks.

**Canonical example:**

```ts
'use server';

/**
 * Mobile-app-callable endpoint. Accepts a Bearer token.
 * Called by our iOS client.
 */
export async function createPost(args: { title: string; body: string; authToken: string }) {
  if (!verifyMobileToken(args.authToken)) throw new Error('unauthorized');
  await db.insert(posts).values({ title: args.title, body: args.body });
  return { ok: true };
}
```

**Remediation:** move to a versioned route handler (`app/api/v1/posts/route.ts`), keep the Bearer auth, drop the Server Action file.

## 3. `action-no-revalidation`

A mutating Server Action does not call `revalidatePath` or `revalidateTag`. The UI will show stale data after the mutation until caches naturally expire.

**Signal:** `'use server'` file with a function that calls `db.insert` / `db.update` / `db.delete` and returns without calling `revalidatePath(` or `revalidateTag(`.

**Canonical example:**

```ts
'use server';

export async function createPost(formData: FormData) {
  await db.insert(posts).values({ /* ... */ });
  return { ok: true };
  // missing: revalidateTag('posts') or revalidatePath('/posts')
}
```

**Remediation:** add `revalidateTag(...)` (preferred) or `revalidatePath(...)` after the mutation.

## 4. `mixed-concerns`

A single route handler handles both first-party React-app fetches and external callers (webhooks, third-party services), branching on headers or User-Agent.

**Signal:** a route handler file has BOTH `stripe-signature` / `x-webhook-` / `user-agent` branching AND `req.formData()` / React-form-submission markers in the same function.

**Canonical example:**

```ts
export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') ?? '';
  if (ua.includes('StripeWebhook')) {
    // webhook path
    const event = stripe.webhooks.constructEvent(/*...*/);
    // ...
  } else {
    // React-app path
    const formData = await req.formData();
    // ...
  }
}
```

**Remediation:** split into `app/api/webhooks/stripe/route.ts` (webhooks only) and either another route handler or a Server Action for the React path.

## Why exactly four

These are the four mechanically-detectable judgment violations that the Next.js docs + community experience converge on. A fifth (e.g. "public API without a version prefix") drifts into API-design territory that belongs in a dedicated v0.2 skill.

# The six input boundaries of a Next.js 15+ App Router app

Each row is an untrusted-input boundary and the canonical Zod schema shape for parsing it.

## 1. Route handler body (POST / PATCH / PUT)

```ts
// app/api/<resource>/route.ts
const Schema = z.object({ /* fields */ });
export async function POST(req: Request) {
  const result = Schema.safeParse(await req.json());
  if (!result.success) return NextResponse.json({ errors: result.error.flatten() }, { status: 400 });
  // use result.data
}
```

## 2. Route handler query / search params

```ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const Schema = z.object({
    q: z.string().min(1).max(100),
    page: z.coerce.number().int().positive().default(1),
  });
  const result = Schema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) return /* 400 */;
}
```

`z.coerce.*` is load-bearing here — URL values arrive as strings; coercion to number/boolean/date is the idiomatic shape.

## 3. Server Action FormData

```ts
'use server';
const Schema = z.object({ email: z.string().email() });
export async function action(formData: FormData) {
  const result = Schema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, errors: result.error.flatten() };
}
```

## 4. Dynamic route params

```ts
// app/posts/[slug]/page.tsx
const SlugSchema = z.string().regex(/^[a-z0-9-]+$/, 'invalid slug');
export default async function Page({ params }: { params: { slug: string } }) {
  const slug = SlugSchema.parse(params.slug);
  // slug is narrowed to the validated shape
}
```

`.parse()` is fine here because Next's route resolution already guarantees the param exists — we're validating its *shape*, not its presence.

## 5. Environment variables

```ts
// lib/env.ts
export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .parse(process.env);
```

Import `env.*` everywhere. Never read `process.env.*` from application code. One schema = one failure point at startup.

## 6. Third-party API responses

```ts
const StripeCustomerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  metadata: z.record(z.string()),
});
const response = await fetch('https://api.stripe.com/v1/customers/...', { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
const customer = StripeCustomerSchema.parse(await response.json());
```

Stripe's docs are not your contract — your schema is. When Stripe ships a breaking change, your parse fails loudly instead of your code reading `undefined` and proceeding.

## What about webhook bodies

Same as #1 (request body), with one extra step:

```ts
const signature = req.headers.get('stripe-signature');
const rawBody = await req.text();                              // verify BEFORE parse
stripe.webhooks.constructEvent(rawBody, signature, secret);    // signature verification
const event = WebhookEventSchema.parse(JSON.parse(rawBody));    // Zod parse
```

Signature verification is Stripe's library's job, not Zod's. Treat them as two separate checks, both required.

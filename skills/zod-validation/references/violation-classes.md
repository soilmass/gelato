# Four violation classes

The classifier inspects each fixture and flags exactly one class per fixture. A file that raises none is `safe`.

## 1. `missing-at-boundary`

The file accepts untrusted input but never calls a Zod parse on it before use.

**Canonical example:**

```ts
// app/api/posts/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  await db.insert(posts).values({ title: body.title, body: body.body });  // no parse
  return Response.json({ ok: true });
}
```

**Signal:** the handler/action consumes input (`req.json()`, `Object.fromEntries(formData)`, `params.slug`) but has no `.parse()` / `.safeParse()` call on that input.

**Remediation:** add a Zod schema and parse at the top.

## 2. `validation-after-consumption`

A parse exists, but it runs after the input has already been used for a side effect — rendering the validation cosmetic.

**Canonical example:**

```ts
export async function POST(req: Request) {
  const body = await req.json();
  await sendNotification(body);        // side effect with unvalidated input
  Schema.parse(body);                   // too late
}
```

**Signal:** a schema parse appears *after* a function-call expression consuming the same input identifier.

**Remediation:** move the parse to immediately after input arrival.

## 3. `parse-should-be-safe-parse`

`Schema.parse(...)` inside a try/catch that catches the error and returns a 400. This is `.safeParse()` badly spelled — and it throws away Zod's structured error data in the process.

**Canonical example:**

```ts
try {
  const input = Schema.parse(body);
  // ...
} catch (err) {
  return new Response('Invalid input', { status: 400 });  // err is unknown; .flatten() lost
}
```

**Signal:** a `Schema.parse(...)` expression appears inside a `try` block whose `catch` returns a Response.

**Remediation:** rewrite as `.safeParse()` branching on `result.success`.

## 4. `unsafe-cast-bypasses-schema`

A TypeScript `as <Type>` cast is used on the input, bypassing the Zod runtime check.

**Canonical example:**

```ts
export async function POST(req: Request) {
  const input = (await req.json()) as SignupInput;  // ← runtime check bypassed
  await db.insert(users).values(input);
}
```

**Signal:** `as <TypeName>` or `as unknown as <TypeName>` applied to an input expression.

**Remediation:** add a Zod schema whose output type matches `<TypeName>` and use `.safeParse()`.

## Why exactly four

These are the four *mechanically-detectable* failure modes for Zod-at-the-boundary on Next.js handlers. Adding a fifth (e.g. "uses `.parse()` on env without top-level await" or "forgot `.strict()` on an object schema") tends to duplicate one of these four at the regex level or requires full AST analysis that belongs in a v0.2 `ts-morph` upgrade.

Collapsing to three always hides a distinguishable remediation path — the `validation-after-consumption` and `missing-at-boundary` remediations are different enough (add schema vs. move existing schema) that conflating them is worse than naming them separately.

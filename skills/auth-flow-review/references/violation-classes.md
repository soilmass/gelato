# Four violation classes

A fixture that triggers none is `safe`.

## 1. `plaintext-password`

**Signal:** an insert / update persisting a `password` column (e.g. `password: input.password`, `password: body.password`, `values({ password, ... })`) where no `hash(` / `bcrypt.hash(` / `argon2.hash(` call appears earlier in the file.

Persisting a column literally named `passwordHash` / `password_hash` is safe (the hash is the value).

**Canonical example:**

```ts
'use server';
import { db, users } from '@/lib/db';

export async function signup(input: { email: string; password: string }) {
  await db.insert(users).values({ email: input.email, password: input.password });
}
```

**Remediation:**

```ts
import { hash } from 'bcrypt';
const passwordHash = await hash(input.password, 12);
await db.insert(users).values({ email: input.email, passwordHash });
```

## 2. `insecure-password-compare`

**Signal:** `===` / `==` comparison on a `password` or `passwordHash` field, NOT wrapped in a call to `compare` / `verify`.

**Canonical example:**

```ts
const user = await db.query.users.findFirst({ where: eq(users.email, email) });
if (user?.passwordHash === input.password) {
  return createSession(user.id);
}
```

**Remediation:**

```ts
import { compare } from 'bcrypt';
if (await compare(input.password, user.passwordHash)) {
  return createSession(user.id);
}
```

## 3. `insecure-session-cookie`

**Signal:** `cookies().set(...)` or `NextResponse.cookies.set(...)` where:

- The cookie name matches `session` / `auth` / `token` / `jwt` (case-insensitive), AND
- The options argument does NOT include all three of: `httpOnly: true`, `secure: ...`, `sameSite: ...`.

**Canonical example:**

```ts
cookies().set('session', token, {
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});
```

**Remediation:**

```ts
cookies().set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});
```

## 4. `unvalidated-redirect`

**Signal:** `redirect(<expr>)` or `NextResponse.redirect(<expr>)` where `<expr>` is derived from `searchParams.get(...)`, `formData.get(...)`, or `body.returnTo` / `body.callbackUrl` / `body.next`, with no allowlist check or same-origin guard in between.

**Canonical example:**

```ts
const returnTo = searchParams.get('returnTo') ?? '/';
redirect(returnTo);
```

**Remediation:**

```ts
const returnTo = searchParams.get('returnTo') ?? '/';
const safe = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
redirect(safe);
```

## Why exactly four

OWASP ASVS v4 identifies dozens of authentication requirements. These four are the most common / most impactful failures that are mechanically detectable from a single handler file. Session architecture (JWT vs cookie), MFA, credential recovery, and account lockout all need cross-file or flow-level analysis and belong in a v0.2+ `session-architecture` / `auth-flows` skill.

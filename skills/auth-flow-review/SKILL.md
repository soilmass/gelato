---
name: auth-flow-review
description: >
  Apply four mechanical auth-flow checks aligned with OWASP ASVS v4 +
  Auth.js v5 idioms on a Next.js 15 stack. Verify passwords are hashed
  before persistence (`bcrypt` / `argon2`), password comparison uses a
  constant-time `compare` / `verify` (never `===`), auth / session
  cookies carry `httpOnly`, `secure`, and `sameSite` flags, and
  redirect targets derived from user input are validated against an
  allowlist (no open-redirect from `returnTo` / `callbackUrl` /
  `next`). Flags the four corresponding violations.
  Use when: reviewing an auth PR, writing a login / signup / session
  handler, reviewing a cookie-set call, investigating an open-redirect
  report, auditing a password-storage path, validating Auth.js config.
  Do NOT use for: choosing an auth provider (product judgment), OAuth
  scope design, JWT vs session-cookie trade-offs (architectural —
  v0.2 candidate), rate-limiting the login endpoint (v0.2 candidate
  `middleware-rate-limit` skill), CORS config (→ security-headers).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: security
  phase: verify
  type: judgment
  methodology_source:
    - name: "OWASP ASVS v4 — Authentication Verification Requirements"
      authority: "OWASP Foundation"
      url: "https://owasp.org/www-project-application-security-verification-standard/"
      version: "ASVS v4.0.3 (2025)"
      verified: "2026-04-18"
    - name: "Auth.js v5 — Providers and Sessions"
      authority: "Auth.js maintainers"
      url: "https://authjs.dev/guides"
      version: "Auth.js v5 (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "next-auth@5+ (or @auth/core)"
    - "bcrypt@5+ or argon2@0.31+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T12:03:51.317Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Judgment skill. Four mechanical violations
    (plaintext-password, insecure-password-compare, insecure-
    session-cookie, unvalidated-redirect) detected by a deterministic
    classifier over auth-handler fixtures. Session-design trade-offs
    and rate-limiting are out of scope.
---

# auth-flow-review

Encodes four mechanical auth checks grounded in OWASP ASVS v4 authentication requirements and Auth.js v5 idioms. Each check maps to a single-file signal a reviewer can verify without running the app. Judgment skill — the procedure is the enforcement.

---

## Methodology Attribution

Two primary sources:

- **Primary:** OWASP ASVS v4 — Authentication Verification Requirements
  - Source: [https://owasp.org/www-project-application-security-verification-standard/](https://owasp.org/www-project-application-security-verification-standard/)
  - Authority: OWASP Foundation
  - Verified: 2026-04-18
- **Secondary:** Auth.js v5 — Providers and Sessions
  - Source: [https://authjs.dev/guides](https://authjs.dev/guides)
  - Authority: Auth.js maintainers
  - Verified: 2026-04-18
- **Drift-check:** `.github/workflows/drift-owasp-asvs-authjs.yml`

Encoded: the four mechanical checks detectable from a single handler file — password hashing, constant-time comparison, cookie flags, redirect validation. NOT encoded: provider-selection judgment, OAuth scope design, session-vs-JWT trade-offs (v0.2 candidate `session-architecture` skill), rate-limiting, MFA enforcement strategies, audit logging design.

---

## Stack Assumptions

- `next@15+` App Router
- `next-auth@5+` (or `@auth/core`) — Auth.js v5 stable
- `bcrypt@5+` OR `argon2@0.31+` (both acceptable — argon2 preferred for new projects per OWASP)
- `bun@1.1+`

If your stack is Auth.js v4 or homegrown sessions, the same principles apply; fork the suite if the API surface differs.

---

## When to Use

Activate when any of the following is true:
- Reviewing an auth-related PR (login, signup, logout, password reset, session management)
- Writing a `route.ts` or Server Action that sets a session cookie
- Reviewing a cookie-set call anywhere
- Investigating an open-redirect report
- Auditing a password-storage path
- Validating Auth.js v5 config

## When NOT to Use

Do NOT activate for:
- **Choosing an auth provider** (product judgment, out of scope).
- **OAuth scope design** (provider-specific, out of scope).
- **JWT vs session-cookie trade-offs** — v0.2 candidate `session-architecture` skill.
- **Rate-limiting login endpoints** — v0.2 candidate `middleware-rate-limit` skill.
- **CORS config** — `security-headers`.
- **CSRF** — Server Actions handle this implicitly; Route Handlers should use Auth.js's CSRF middleware (v0.2 candidate to encode).

---

## Procedure

### Step 1 — Hash every password before persistence

```ts
// RIGHT
import { hash } from 'bcrypt';
// OR: import { hash } from 'argon2';

const passwordHash = await hash(input.password, 12);
await db.insert(users).values({ email: input.email, passwordHash });
```

`hash()` returns a value that's safe to store. Do NOT persist the plain password:

```ts
// WRONG
await db.insert(users).values({
  email: input.email,
  password: input.password,   // plaintext in the DB
});
```

The signal: any `db.insert` or `db.update` statement that writes a `password` column where no `bcrypt.hash(` / `argon2.hash(` / `hash(` call appears earlier in the same handler. (Tables that store explicit hashes name the column `passwordHash`, `password_hash`, or similar — those are fine.)

### Step 2 — Use constant-time password comparison

```ts
// RIGHT
import { compare } from 'bcrypt';
const ok = await compare(input.password, user.passwordHash);

// OR argon2
import { verify } from 'argon2';
const ok = await verify(user.passwordHash, input.password);
```

`compare` / `verify` run in constant time — they don't leak via timing. Do NOT use `===` / `==`:

```ts
// WRONG — timing oracle, even on hashed values
if (hash(input.password) === user.passwordHash) { /* ... */ }
if (input.password === user.password) { /* plaintext + timing leak */ }
```

The signal: any `password` / `passwordHash` field appearing on either side of `===` / `==` outside a call to `compare` / `verify`.

### Step 3 — Session / auth cookies carry `httpOnly`, `secure`, `sameSite`

```ts
// RIGHT
cookies().set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
});
```

All three flags are non-negotiable:
- `httpOnly: true` — JavaScript cannot read the cookie (mitigates XSS stealing sessions)
- `secure: true` — only sent over HTTPS (dev/localhost may relax this via `NODE_ENV`)
- `sameSite: 'lax'` or `'strict'` — the cookie is not sent on cross-site subrequests (mitigates CSRF)

Any `cookies().set(name, value, options)` or `NextResponse.cookies.set(...)` call where the cookie name contains `session` / `auth` / `token` / `jwt` must include all three flags.

### Step 4 — Validate redirect targets from user input

```ts
// RIGHT — allowlist check
const ALLOWED_PATHS = new Set(['/', '/dashboard', '/settings']);
const returnTo = searchParams.get('returnTo') ?? '/';
const safe = ALLOWED_PATHS.has(returnTo) ? returnTo : '/';
redirect(safe);

// RIGHT — same-origin check
const returnTo = searchParams.get('returnTo') ?? '/';
if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
  redirect('/');
} else {
  redirect(returnTo);
}
```

Any `redirect(<expression>)` / `NextResponse.redirect(<expression>)` where the expression is derived from user-controlled input (`searchParams.get`, `body.returnTo`, `req.nextUrl.searchParams`) must check that the target is same-origin (starts with `/` and not `//`) OR is in an allowlist:

```ts
// WRONG — classic open-redirect
const returnTo = searchParams.get('returnTo') ?? '/';
redirect(returnTo);   // attacker crafts ?returnTo=https://evil.com/phish

// WRONG — URL() still allows cross-origin
const returnTo = new URL(body.next, req.url);
return NextResponse.redirect(returnTo);
```

The attacker's goal: make your domain's login page redirect to their phishing page, so the victim sees your brand then arrives on the attacker's site.

---

## Tool Integration

**Canonical signup action:**

```ts
'use server';
import { z } from 'zod';
import { hash } from 'bcrypt';
import { cookies } from 'next/headers';
import { db, users } from '@/lib/db';
import { createSession } from '@/lib/session';

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});

export async function signup(formData: FormData) {
  const result = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, errors: result.error.flatten() };

  const passwordHash = await hash(result.data.password, 12);
  const [user] = await db
    .insert(users)
    .values({ email: result.data.email, passwordHash })
    .returning();

  const token = await createSession(user.id);
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return { ok: true };
}
```

**Canonical login with validated redirect:**

```ts
'use server';
import { compare } from 'bcrypt';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/session';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const returnTo = String(formData.get('returnTo') ?? '/');

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error('invalid credentials');

  const ok = await compare(password, user.passwordHash);
  if (!ok) throw new Error('invalid credentials');

  const token = await createSession(user.id);
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  // Same-origin check — no open redirect
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  redirect(safeReturnTo);
}
```

---

## Examples

### Example 1 — Plaintext password (`plaintext-password`)

**Input:** signup action inserts `password: input.password` into the `users` table. No `hash()` / `bcrypt.hash()` / `argon2.hash()` call in the file.

**Output:** compromise of the DB leaks all passwords in plaintext. Add `const passwordHash = await hash(input.password, 12);` and store `passwordHash`, not `password`.

### Example 2 — Insecure password comparison (`insecure-password-compare`)

**Input:** `if (user.passwordHash === input.password) { /* grant session */ }`.

**Output:** `===` is a timing oracle on hashed strings; also compares a hash vs a plaintext, which will never match. Use `await compare(input.password, user.passwordHash)`.

### Example 3 — Insecure session cookie (`insecure-session-cookie`)

**Input:** `cookies().set('session', token, { maxAge: 604800, path: '/' });` — no `httpOnly`, no `secure`, no `sameSite`.

**Output:** JS in the page can read the session (XSS → account takeover), MITM can steal it (no `secure`), and CSRF becomes possible (no `sameSite`). Add all three flags.

### Example 4 — Unvalidated redirect (`unvalidated-redirect`)

**Input:** `const returnTo = searchParams.get('returnTo') ?? '/'; redirect(returnTo);`.

**Output:** attacker's `?returnTo=https://evil.com/phish` takes the victim from your login page to a phishing clone. Validate same-origin or allowlist.

---

## Edge Cases

- **Column named `passwordHash` / `password_hash`** — persisting a hash under this column is fine regardless of context; the signal is specifically `password: <value>` being persisted.
- **Auth.js managed cookies** — Auth.js sets session cookies with safe defaults. Files using Auth.js v5's `auth()` without manually setting cookies don't trigger Step 3.
- **Dev-mode `secure: false`** — `secure: process.env.NODE_ENV === 'production'` is acceptable (works over HTTPS in prod, HTTP in dev). The flag must be present in some form.
- **Redirect after successful payment / OAuth callback** — if `returnTo` is signed (HMAC'd with a server secret) or a state parameter, that's a valid approach. The signal here catches unsigned user-input-derived redirects.
- **Third-party URL redirects (outbound link trackers)** — if the redirect IS supposed to leave your domain, fine; but it should be on a route that's clearly labeled (`/out?url=…`) and the user sees it's external. Still needs an allowlist of target domains.

---

## Evaluation

See `/evals/auth-flow-review/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

The roadmap flagged this skill as "hard fixture build." Auth patterns carry more variability than other skills (framework conventions vary widely). v0.1 ships the four most-universal mechanical checks; subjective session-design trade-offs wait for v0.2.

---

## Handoffs

- **Security headers (CORS, CSP)** → `security-headers`
- **Input validation on the auth form** → `zod-validation`
- **Form UI (pending state, error display)** → `form-with-server-action`
- **Rate limiting** → v0.2 candidate `middleware-rate-limit` skill
- **Session architecture (JWT vs cookie)** → v0.2 candidate `session-architecture` skill

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, `bcrypt` or `argon2`, Auth.js v5 (optional)

---

## References

- `references/asvs-mapping.md` — OWASP ASVS v4 requirements mapped to the four classifier checks
- `references/violation-classes.md` — four-class taxonomy with canonical examples

## Scripts

- _(none in v0.1 — eval ships the classifier; a semgrep-based grep pack with the same rules is a v0.2 candidate)_

# OWASP ASVS v4 → auth-flow-review classifier mapping

Each classifier class maps to one or more ASVS v4 requirements. The skill doesn't claim to cover ASVS comprehensively — it covers the four most-universal single-file-detectable requirements.

## 1. `plaintext-password` → V2.1 / V2.4

- **V2.1.9** — Verify that passwords are not stored in a reversible form.
- **V2.4.1** — Verify that passwords are stored using an approved, computationally intensive hashing algorithm (argon2, bcrypt, scrypt, PBKDF2).

The skill enforces: if a user row persists a `password` column, a `hash(` / `bcrypt.hash(` / `argon2.hash(` call must appear in the same handler.

## 2. `insecure-password-compare` → V2.3

- **V2.3.1** — Verify that authentication is performed using proven secure methods (e.g., library-provided constant-time comparison), preventing timing attacks.

The skill enforces: comparison against a password hash uses `compare` / `verify` from `bcrypt` / `argon2`, never `===` / `==`.

## 3. `insecure-session-cookie` → V3.4

- **V3.4.1** — Verify that cookie-based session tokens have the 'Secure' attribute set.
- **V3.4.2** — Verify that cookie-based session tokens have the 'HttpOnly' attribute set.
- **V3.4.3** — Verify that cookie-based session tokens utilize the 'SameSite' attribute to limit exposure to cross-site request forgery.

The skill enforces: any cookie whose name contains `session` / `auth` / `token` / `jwt` has all three flags set when written.

## 4. `unvalidated-redirect` → V5.1 / A01:2021

- **V5.1.5** — Verify that the application will only redirect users to trusted destinations.
- Also aligned with [OWASP Top 10 A01:2021 — Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) (open redirects facilitate phishing + account takeover).

The skill enforces: any `redirect(<expr>)` where `<expr>` is derived from user input (`searchParams.get`, `formData.get`, `body.returnTo`) must be checked against an allowlist or a same-origin predicate before use.

## What's not covered

ASVS is a long document. The skill intentionally leaves out:

- **V2.2** (general authenticator) — too framework-specific
- **V2.5** (credential recovery) — flow design, not single-file
- **V2.7, V2.8** (MFA) — framework / provider choice
- **V3.2, V3.5** (session invalidation) — requires cross-file analysis
- **V4** (access control) — separate skill (v0.2 candidate `authorization-audit`)
- **V8** (data protection) — separate skill
- **V13** (API / web service security) — separate skill

Each future skill can cite its slice of ASVS by the same mapping convention.

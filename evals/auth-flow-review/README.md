# auth-flow-review eval

Proves the four mechanical OWASP-ASVS-aligned auth violations are enforceable from single-handler fixture text.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **plaintext-password** — file contains `db.insert` / `db.update` AND a `password` object-key (not `passwordHash`) AND no `hash()` / `bcrypt.hash()` / `argon2.hash()` call.
2. **insecure-password-compare** — a line contains both `password`/`passwordHash` and `===` / `==` (not `!==` / `!=`).
3. **insecure-session-cookie** — a `cookies().set(...)` / `NextResponse.cookies.set(...)` call whose first-arg name matches `session|auth|token|jwt` is missing one of `httpOnly` / `secure` / `sameSite`.
4. **unvalidated-redirect** — file has `redirect(...)` / `NextResponse.redirect(...)`, reads user input (`searchParams.get` / `formData.get` / `body.X` / `searchParams.X`), and has no guard (`.startsWith('/')`, `ALLOWED_`, `allowlist`, `.has(`, `verify*(`, `validate*(`).

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 persisting a pre-hashed `passwordHash` column — classifier distinguishes `passwordHash` from `password`
- 02 `timingSafeEqual` from `node:crypto` — constant-time compare, not `===`; no password word → skipped
- 03 signed-returnTo via `verifySignedPayload` — `verify*(` guard rescues from unvalidated-redirect
- 04 hardcoded literal redirect (`/dashboard`) even while file reads user input — classifier requires the redirect target to be user-derived; literal string rescues
- 05 full password-reset handler — every rule satisfied (hash call, all cookie flags, allowlist)
- 06 cookie named `session_layout` (UI preference) missing flags — classifier flags by name substring, doesn't attempt to distinguish semantic intent

## Running

```bash
bun run eval auth-flow-review
```

~70 ms. No env, no DB, no API keys.

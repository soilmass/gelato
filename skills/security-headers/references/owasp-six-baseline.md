# OWASP Secure Headers — six-header baseline

Copy-paste reference for Step 2 of `security-headers`. Each row is the minimum directive the audit expects; real apps frequently need to tighten further.

## The six

### 1. Content-Security-Policy

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
```

- **`default-src 'self'`** — deny by default; only this origin's resources load.
- **`script-src 'self'`** — never `'unsafe-inline'` or `'unsafe-eval'`; use `'nonce-<random>'` via middleware for legitimate inline scripts.
- **`object-src 'none'`** — blocks Flash / plugin objects.
- **`base-uri 'self'`** — prevents `<base>` hijacking.
- **`frame-ancestors 'none'`** — replaces `X-Frame-Options`; more expressive.

Real-world tightening: add `img-src`, `style-src`, `font-src`, `connect-src` tailored to your CDN and API origins.

### 2. Strict-Transport-Security

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

- **`max-age=63072000`** — 2 years. OWASP minimum.
- **`includeSubDomains`** — required for preload submission.
- **`preload`** — signals intent to be included in browser preload lists. Do not set unless you are ready for a one-way commitment: removing preload takes months to propagate.

### 3. X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

No other value exists. One line, no downside, ship it.

### 4. X-Frame-Options

```
X-Frame-Options: DENY
```

- **`DENY`** — prefer this.
- **`SAMEORIGIN`** — acceptable if the site legitimately frames itself.
- **`ALLOW-FROM <uri>`** — **deprecated**. Use CSP `frame-ancestors` instead.

Modern browsers honor both X-Frame-Options and CSP `frame-ancestors`; older browsers honor only X-Frame-Options. Set both (belt and suspenders).

### 5. Referrer-Policy

```
Referrer-Policy: strict-origin-when-cross-origin
```

Leaks the origin (not the full URL) on cross-origin navigation; full URL on same-origin. Reasonable default. For extra strictness, use `no-referrer`.

### 6. Permissions-Policy

```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Disable every browser feature by default; opt in per feature when pages need them. Full list of features: [MDN: Permissions-Policy directives](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy).

## What's excluded from the six

- **`Access-Control-Allow-Origin`** — CORS concern, not a baseline header. Covered by `server-actions-vs-api`.
- **`X-XSS-Protection`** — deprecated since 2019 (modern browsers ignore it; in IE/legacy Edge it was net-negative). Do not ship.
- **`Expect-CT`** — deprecated as of mid-2023. Certificate Transparency is now enforced automatically.
- **`Public-Key-Pins`** (HPKP) — deprecated since 2017. Never ship.

Setting any of the deprecated-or-harmful three is what the audit's `deprecated-value` class flags.

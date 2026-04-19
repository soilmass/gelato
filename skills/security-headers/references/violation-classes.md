# Four violation classes

The classifier inspects each fixture (a Next.js middleware or `next.config.ts` `headers()` shape) and flags exactly one class per fixture. A file that raises none is `safe`.

## 1. `missing-header`

One of the six baseline headers is not set at all.

**Canonical example:**

```ts
// next.config.ts — MISSING Strict-Transport-Security, Permissions-Policy
export default {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Content-Security-Policy', value: "default-src 'self';" },
      ],
    }];
  },
};
```

**Remediation:** add the missing headers per `owasp-six-baseline.md`.

## 2. `over-permissive`

A header is set, but its value weakens security below the OWASP minimum.

**Canonical examples:**

- `Content-Security-Policy: default-src *;` — allows any origin.
- `Content-Security-Policy: script-src 'self' 'unsafe-inline' 'unsafe-eval';` — allows inline scripts and eval. The single biggest XSS enabler in a CSP.
- `Strict-Transport-Security: max-age=0` — effectively disables HSTS (browsers drop the policy).
- `X-Frame-Options: ALLOWALL` — effectively disables frame protection.
- `Referrer-Policy: unsafe-url` — leaks full URL cross-origin including query strings.
- `Permissions-Policy: camera=*` — grants camera to any origin.

**Remediation:** tighten to the baseline directive. Over-permissive CSP is the most frequent real-world mistake.

## 3. `deprecated-value`

A header includes a directive or format that modern browsers ignore or flag as harmful.

**Canonical examples:**

- `X-Frame-Options: ALLOW-FROM https://...` — deprecated since 2019; modern browsers ignore.
- `X-XSS-Protection: 1; mode=block` — deprecated since 2019; setting it at all is the flag.
- `Expect-CT: max-age=86400` — deprecated 2023; CT is now automatic.
- `Public-Key-Pins: ...` — deprecated 2017; never ship.

**Remediation:** remove the deprecated header entirely; migrate to the modern equivalent if one exists (e.g. X-Frame-Options `ALLOW-FROM` → CSP `frame-ancestors`).

## 4. `conflicting-source`

The same header is set in two places (`next.config.ts` `headers()` AND `middleware.ts`), with different values. Middleware wins at runtime, but the discrepancy is a maintenance hazard — the author who edits `next.config` expects their value to apply.

**Canonical example:**

```ts
// next.config.ts
headers: [
  { key: 'Content-Security-Policy', value: "default-src 'self';" },
];

// middleware.ts
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self' https://cdn.example.com;",
);
```

**Remediation:** consolidate to one source. If CSP nonces are required, middleware is the only viable source — move the whole CSP there. Otherwise, prefer `next.config.ts`.

## Why exactly four

These are the four mechanically-detectable shapes that map to distinct remediations. Other real-world header problems (e.g. wrong `Content-Type` on an API response, a misconfigured CORS preflight) aren't about the OWASP baseline six — they're for other skills (`server-actions-vs-api` handles CORS).

Adding a fifth class tends to duplicate one of these; collapsing to three hides a distinguishable remediation path.

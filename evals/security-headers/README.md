# security-headers eval

Proves the OWASP Secure Headers baseline is mechanically enforceable against fixture `next.config.ts` / `middleware.ts` header configurations.

## What the eval measures

Deterministic header-string classifier that:

1. Strips comments.
2. Extracts all `{ key, value }` pairs (config form) and `response.headers.set(...)` calls (middleware form).
3. Splits config vs middleware by detecting the `middleware.ts` comment marker.
4. Classifies against the four violation classes in detection order: deprecated-value → conflicting-source → missing-header → over-permissive.

Four assertions:

| Assertion | Requirement |
|---|---|
| Violations classified correctly | ≥ 95% across 12 labeled violations (3 per class × 4) |
| Zero false positives on safe fixtures | 5/5 classify as `safe` |
| Held-out generalization | ≥ 90% across 6 adversarial cases |
| Fixture inventory matches SKILL.md | 5 safe + 12 violations, per-class ≥ 1 |

## Fixture layout

```
fixtures/
├── safe/                                # 5 baseline-compliant configs
│   ├── 01 canonical-config.txt          — full six-header config
│   ├── 02 middleware-with-nonce.txt     — CSP nonce pattern
│   ├── 03 hsts-without-preload.txt      — baseline without preload
│   ├── 04 same-origin-frame.txt         — X-Frame-Options SAMEORIGIN
│   └── 05 no-referrer.txt               — stricter Referrer-Policy
├── violations/
│   ├── missing-header/                  — 3 fixtures, each missing one of the six
│   ├── over-permissive/                 — CSP unsafe-inline, HSTS max-age=0, Permissions camera=*
│   ├── deprecated-value/                — X-XSS-Protection, ALLOW-FROM, Expect-CT
│   └── conflicting-source/              — CSP / HSTS / X-Frame-Options set in config AND middleware with different values
└── held-out/                            — 6 adversarial
    # 01 report-only CSP + enforcing CSP — both present, safe
    # 02 Permissions-Policy camera=(self) — allowlist-self, safe
    # 03 HSTS set in both sources with IDENTICAL values — not a conflict
    # 04 'unsafe-inline' mentioned only in a // comment — not actually set
    # 05 X-Frame-Options: DENY after distinguishing from the ALLOW-FROM class
    # 06 CSP with 'nonce-<value>' in script-src — safe, not 'unsafe-inline'
```

## Qualitative half

None in v0.1. Header configuration is a mechanical check. A v0.2 candidate rubric — `fix-orderedness` — would judge whether a generated remediation plan orders fixes per SKILL § Step 3 (HSTS → CSP → nosniff → Referrer → frame → Permissions).

## Running

```bash
bun run eval security-headers
```

Completes in < 100 ms. No env vars, no Chromium, no API keys.

---
name: i18n-routing
description: >
  Audit Next.js 15 App Router i18n routing for four mechanical
  violations: the root `<html>` tag carries a static `lang`
  attribute in a tree that exposes a `[locale]` segment (should
  be dynamic), an invalid BCP 47 locale literal appearing in
  `locales` config or middleware, a locale-detection middleware
  whose `matcher` doesn't exclude `_next/static` + static asset
  paths (causes 500s on assets), and hardcoded English strings
  in a `.tsx` file that imports from an i18n library (`next-intl`
  / `next-i18next` / `@lingui/macro`) where a translator call
  should live.
  Use when: adding i18n to an app, reviewing a PR that touches
  the `[locale]` segment or middleware, "why is my asset 500'ing
  after I added locale routing", "hardcoded English visible in
  the German tree".
  Do NOT use for: sitemap hreflang (→ seo-sitemap-robots),
  translation-key curation (out of scope), i18n library choice
  (product judgment).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: build
  type: procedural
  methodology_source:
    - name: "Next.js — Internationalization"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/routing/internationalization"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-19"
    - name: "BCP 47 — Tags for Identifying Languages"
      authority: "IETF"
      url: "https://www.rfc-editor.org/rfc/bcp/bcp47.txt"
      version: "RFC 5646"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T15:29:14.014Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Four mechanical violations
    over .tsx / middleware.ts fixtures with a `filename:`
    frontmatter field and optional `tree_has_locale_segment:
    true/false` to activate the static-lang rule.
---

# i18n-routing

Encodes Next.js 15 App Router i18n routing conventions + BCP 47 locale grammar as four mechanical rules.

---

## Methodology Attribution

- **Primary:** Next.js — Internationalization
  - Source: [https://nextjs.org/docs/app/building-your-application/routing/internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-19
- **Secondary:** BCP 47 (RFC 5646)
  - Source: [https://www.rfc-editor.org/rfc/bcp/bcp47.txt](https://www.rfc-editor.org/rfc/bcp/bcp47.txt)
  - Version: RFC 5646
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the four mechanical conventions at the intersection of Next.js i18n routing, BCP 47 locale grammar, and common i18n-library usage patterns. NOT encoded: translation-key completeness (needs cross-file analysis), fallback-chain design (per-app judgment), i18n-library choice (product decision — next-intl vs. next-i18next vs. Lingui), currency / date formatting (separate concern, not routing).

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Adding an App Router `[locale]` segment
- Editing `middleware.ts` for locale detection
- Reviewing a PR that touches the root `<html>` tag with locale in play
- "Static assets 500 after I added locale routing"
- "Hardcoded English visible on a /de/ page"

## When NOT to Use

Do NOT activate for:
- **Sitemap hreflang** → `seo-sitemap-robots`
- **Translation-key curation / missing-keys** — needs cross-file analysis; out of scope
- **Library choice (next-intl vs next-i18next vs Lingui)** — product judgment
- **Currency / date formatting** — separate from routing

---

## Procedure

Fixtures carry `filename:` (so the classifier knows layout.tsx vs middleware.ts vs a component) and optionally `tree_has_locale_segment: true/false` for Step 1.

### Step 1 — `<html lang>` must be dynamic when `[locale]` segment exists

```tsx
// RIGHT — dynamic lang from the segment
export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return <html lang={params.locale}><body>{children}</body></html>;
}

// WRONG — static lang="en" while the tree exposes [locale]
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

Rule: when `tree_has_locale_segment: true`, `<html>` must carry a dynamic expression (`lang={...}`), not a literal string.

### Step 2 — BCP 47 locale literals must be valid

Every string literal appearing in `locales: [...]`, `defaultLocale: '...'`, or `matcher: ['/:locale/...']` contexts must match BCP 47 grammar.

```tsx
// RIGHT
export const i18n = { locales: ['en', 'es-MX', 'zh-Hans'], defaultLocale: 'en' };

// WRONG
export const i18n = { locales: ['EN', 'espanol', 'zh_hans'], defaultLocale: 'English' };
```

### Step 3 — i18n middleware `matcher` must exclude static assets

Locale-detection middleware that runs on every request — including `_next/static/*` / image assets / API routes — causes 500s when the middleware can't parse a locale from a non-route URL.

```ts
// RIGHT
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};

// WRONG — unconstrained matcher; fires on static assets
export const config = { matcher: '/:path*' };
```

### Step 4 — Hardcoded English strings in a file that imports an i18n library

```tsx
// RIGHT — t() call with a key
import { useTranslations } from 'next-intl';
export default function Page() {
  const t = useTranslations('home');
  return <h1>{t('welcome')}</h1>;
}

// WRONG — next-intl imported but literal English shows up in JSX text
import { useTranslations } from 'next-intl';
export default function Page() {
  return <h1>Welcome to the blog</h1>;
}
```

Rule: if the file imports from `next-intl`, `next-i18next`, `@lingui/macro`, or `@lingui/react`, flag English-looking literal text inside JSX that isn't wrapped in a translator call. Heuristic: literal text ≥ 3 English words (simple ASCII word count) appearing between `>` and `<` in the JSX without being inside a `{t(...)}` or similar expression.

---

## Tool Integration

No CLI.

## Examples

### Example 1 — `middleware-missing-matcher-exclusions`

**Input:** `middleware.ts` with `matcher: '/:path*'`.
**Output:** middleware fires on `/favicon.ico`, `/_next/static/chunks/...`. Asset requests throw. Fix: exclude those prefixes in the negative-lookahead pattern.

### Example 2 — `html-lang-static-with-locale-segment`

**Input:** `app/[locale]/layout.tsx` renders `<html lang="en">`.
**Output:** locale-German users still see `lang="en"` in the DOM; hurts hreflang, screen-reader announcement, and RTL mirroring. Fix: `<html lang={params.locale}>`.

---

## Edge Cases

- **Single-locale apps:** no `[locale]` segment → Step 1 doesn't activate (fixture carries `tree_has_locale_segment: false`).
- **i18n imports without JSX:** a util module that imports from `next-intl` but has no JSX doesn't trigger Step 4.
- **Legacy tags like `i-klingon`:** intentionally rejected — not part of modern BCP 47 subset.
- **Dynamic locale via `searchParams`:** Step 1's rule applies only to the `[locale]` route-segment pattern; `?lang=en` flows are out of scope.

---

## Evaluation

See `/evals/i18n-routing/`.

**Quantitative:** ≥4 violation fixtures at ≥95%, 0 false positives on ≥4 safe, held-out ≥90%.
**Qualitative:** Promptfoo rubric `i18n-remediation-implementability` (≥0.85).

---

## Handoffs

- Sitemap hreflang → `seo-sitemap-robots`
- Translation-key curation → human review (out of scope)
- Currency / date formatting → `Intl.*` docs (out of scope)

---

## Dependencies

- **External skills:** `seo-sitemap-robots`
- **MCP servers:** none
- **Tools required in environment:** none

---

## References

- `references/nextjs-i18n-conventions.md` — Next.js i18n routing docs cheat sheet + BCP 47 grammar subset the skill accepts

## Scripts

- _(none)_

---
name: seo-sitemap-robots
description: >
  Audit `sitemap.ts` and `robots.ts` files in a Next.js 15 App
  Router app against the sitemaps.org 0.9 protocol + Next.js
  MetadataRoute conventions + BCP 47 locale validity. Four
  violation classes: a sitemap entry missing `url`, a
  `lastModified` that isn't a Date or ISO 8601 string, an
  `alternates.languages` key that isn't a valid BCP 47 tag,
  and a `robots.ts` default export missing a `sitemap` field.
  Use when: adding `sitemap.ts` or `robots.ts`, editing the
  routes emitted by either, preparing for Google Search Console
  submission, investigating "my sitemap isn't being crawled".
  Do NOT use for: page-level metadata (→ metadata-and-og),
  JSON-LD structured data (→ structured-data-json-ld), route-
  handler sitemaps (out of scope — Next 15 convention is
  `sitemap.ts` / `robots.ts`).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: seo
  phase: build
  type: procedural
  methodology_source:
    - name: "sitemaps.org 0.9 protocol"
      authority: "sitemaps.org (Google / Yahoo / MSN consortium)"
      url: "https://www.sitemaps.org/protocol.html"
      version: "0.9 (2008; current)"
      verified: "2026-04-19"
    - name: "Next.js — Metadata Files: sitemap.ts + robots.ts"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-19"
    - name: "BCP 47 — Tags for Identifying Languages"
      authority: "IETF"
      url: "https://www.rfc-editor.org/rfc/bcp/bcp47.txt"
      version: "RFC 5646 + RFC 4647"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T15:20:20.146Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Four mechanical violation
    classes over sitemap.ts / robots.ts fixtures. Classifier
    parses the default-export entries and validates per-entry
    fields against sitemaps.org 0.9 + Next MetadataRoute types.
---

# seo-sitemap-robots

Encodes sitemaps.org 0.9 + Next.js `MetadataRoute.Sitemap` / `MetadataRoute.Robots` + BCP 47 as four mechanical rules over Next 15 sitemap/robots files.

---

## Methodology Attribution

- **Primary:** sitemaps.org 0.9 protocol
  - Source: [https://www.sitemaps.org/protocol.html](https://www.sitemaps.org/protocol.html)
  - Version: 0.9 (2008; current)
  - Verified: 2026-04-19
- **Secondary:** Next.js — sitemap.ts / robots.ts docs
  - Source: [https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-19
- **Tertiary:** BCP 47 (RFC 5646)
  - Source: [https://www.rfc-editor.org/rfc/bcp/bcp47.txt](https://www.rfc-editor.org/rfc/bcp/bcp47.txt)
  - Version: RFC 5646
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the four mechanical rules at the intersection of sitemaps.org 0.9 required fields, Next's `MetadataRoute` type contract, and BCP 47 locale grammar. NOT encoded: crawl-budget tuning (product concern), priority / changefreq tuning (both deprecated in Google's crawler), XML output shape (Next generates it), hreflang cluster design (out of scope — Google's docs treat it as a cross-page correctness problem).

---

## Stack Assumptions

- `next@15+` App Router
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Adding `sitemap.ts` or `robots.ts` to `app/`
- Editing the routes the default export emits
- Preparing for Google Search Console submission
- "My sitemap isn't being crawled" / "robots.txt is blocking the wrong routes"

## When NOT to Use

Do NOT activate for:
- **Page-level metadata** → `metadata-and-og`
- **JSON-LD structured data** → `structured-data-json-ml`
- **Custom route-handler sitemaps** — out of scope (Next 15's convention is `sitemap.ts` / `robots.ts`)

---

## Procedure

Fixtures carry a `filename:` field (`app/sitemap.ts` or `app/robots.ts`) so the classifier applies the right rule set.

### Step 1 — Every sitemap entry must have `url`

sitemaps.org 0.9 requires `<loc>` (URL) per entry. Next's `MetadataRoute.Sitemap` type makes `url` required; the skill catches type-casts that bypass the check.

```ts
// RIGHT
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://ex.com/', lastModified: new Date(), priority: 1 },
  ];
}

// WRONG — missing url
export default function sitemap() {
  return [{ lastModified: new Date(), priority: 1 }];
}
```

### Step 2 — `lastModified` must be a `Date` or ISO 8601 string

Next accepts `Date` or ISO 8601 string and converts to `<lastmod>` in the XML. Raw timestamps (number) or human-readable strings break the output.

```ts
// RIGHT
lastModified: new Date()
lastModified: '2026-04-19T12:00:00Z'

// WRONG
lastModified: 1776611200000       // number
lastModified: 'April 19, 2026'    // not ISO 8601
```

### Step 3 — `alternates.languages` keys must be BCP 47 tags

Next's hreflang support uses `alternates.languages` — an object map of BCP 47 tag → URL. Invalid tags (typos, double-dashes, unknown regions) break hreflang entirely.

```ts
// RIGHT
alternates: { languages: { en: '...', 'es-MX': '...', 'zh-Hant': '...' } }

// WRONG
alternates: { languages: { EN: '...', 'espanol': '...', 'es--MX': '...' } }
```

### Step 4 — `robots.ts` default export must include `sitemap`

A `robots.ts` without a `sitemap` field tells crawlers where the rules are but not where the content is. Google's docs say every robots.txt should carry a Sitemap: line.

```ts
// RIGHT
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/admin' }],
    sitemap: 'https://ex.com/sitemap.xml',
  };
}

// WRONG — rules but no sitemap
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/admin' }] };
}
```

---

## Tool Integration

None.

## Examples

### Example 1 — `sitemap-bad-locale`

**Input:** `alternates.languages: { 'EN-us': '...' }`
**Output:** `EN-us` is uppercase-language; BCP 47 requires lowercase primary language. Fix: `'en-US'`.

### Example 2 — `robots-missing-sitemap-ref`

**Input:** `robots.ts` returns `{ rules: [...] }` with no `sitemap` field.
**Output:** crawlers won't find the sitemap automatically. Fix: add `sitemap: 'https://<host>/sitemap.xml'` at the top level.

---

## Edge Cases

- **Async `sitemap` default export:** legitimate; the classifier reads the return expression from the body.
- **Dynamic sitemap segments (`[[id]]/sitemap.ts`):** Next's paged-sitemap convention; `generateSitemaps()` + `sitemap(id)`. Classifier checks each return — all rules apply.
- **`MetadataRoute.Sitemap` type cast stripped:** `return [{ ...obj as any }]` is flagged if any element literal is missing `url`.
- **Locale tags with scripts + regions:** `zh-Hans-CN`, `sr-Cyrl-RS` are valid; classifier's regex allows up to 3 subtags.
- **`robots.ts` without rules:** valid per Next if you want to disallow-crawl everywhere; `sitemap` still required under Step 4.

---

## Evaluation

See `/evals/seo-sitemap-robots/`.

**Quantitative:** ≥4 violation fixtures at ≥95%, 0 false positives on ≥4 safe, held-out ≥90%.
**Qualitative:** Promptfoo rubric `sitemap-remediation-implementability` (≥0.85).

---

## Handoffs

- Page-level metadata (title / description / canonical / og) → `metadata-and-og`
- JSON-LD → `structured-data-json-ld`
- Open Graph images → `open-graph-image`

---

## Dependencies

- **External skills:** `metadata-and-og`, `structured-data-json-ld`
- **MCP servers:** none
- **Tools required in environment:** none

---

## References

- `references/sitemap-robots-schema.md` — sitemaps.org 0.9 shape + Next MetadataRoute types + BCP 47 grammar

## Scripts

- _(none)_

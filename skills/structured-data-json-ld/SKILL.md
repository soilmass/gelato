---
name: structured-data-json-ld
description: >
  Audit JSON-LD structured data emitted by a Next.js 15 page
  against Google Search Central's required-field tables and
  schema.org vocabularies. Five violation classes: JSON-LD
  without `@context: "https://schema.org"`, `@type: "Product"`
  missing `name` AND either `image` or `offers`, `@type:
  "Article"` missing `headline`/`author`/`datePublished`,
  `@type: "BreadcrumbList"` with non-sequential
  `itemListElement[].position`, and `@type: "FAQPage"` where
  any `mainEntity[].acceptedAnswer.text` is absent.
  Use when: adding a `<script type="application/ld+json">` to
  a page, reviewing a PR that emits structured data,
  preparing for Google rich-results eligibility, fixing a
  Search Console structured-data error.
  Do NOT use for: runtime metadata API (→ metadata-and-og),
  sitemap / robots generation (→ seo-sitemap-robots),
  Open Graph image generation (→ open-graph-image), non-
  JSON-LD forms of structured data (Microdata / RDFa — out
  of scope).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: seo
  phase: verify
  type: procedural
  methodology_source:
    - name: "Google Search Central — Structured data"
      authority: "Google"
      url: "https://developers.google.com/search/docs/appearance/structured-data/search-gallery"
      version: "Google Search Central (2025)"
      verified: "2026-04-19"
    - name: "schema.org vocabulary"
      authority: "schema.org"
      url: "https://schema.org/"
      version: "schema.org v25 (2025)"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T17:15:27.773Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Five mechanical violation
    classes over JSON-LD-emitting .tsx fixtures. Classifier parses
    the JSON-LD body (from <script type="application/ld+json">)
    and validates required-field tables per @type.
---

# structured-data-json-ld

Encodes Google Search Central's structured-data requirements as mechanical rules over the JSON-LD a Next.js page emits. Five rules — all straight from Google's required-vs-recommended tables — catch the most common eligibility failures for Search's rich-results features.

---

## Methodology Attribution

- **Primary:** Google Search Central — Structured data (search gallery)
  - Source: [https://developers.google.com/search/docs/appearance/structured-data/search-gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
  - Version: Google Search Central (2025)
  - Verified: 2026-04-19
- **Secondary:** schema.org vocabulary
  - Source: [https://schema.org/](https://schema.org/)
  - Version: schema.org v25 (2025)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the required-field tables Google publishes for Product, Article, BreadcrumbList, and FAQPage (the four most common rich-result types) plus the `@context` invariant that applies to all schema.org JSON-LD. NOT encoded: Microdata / RDFa serializations (out of scope — JSON-LD is the recommended form), recommended-but-not-required fields (the skill enforces minimum-viable; UX teams go further), other schema.org types (Review, Event, Recipe, JobPosting — add later), rich-results validation via Google's Rich Results Test (runtime concern).

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Adding a `<script type="application/ld+json">` to a page
- Reviewing a PR that emits structured data
- Preparing for Google rich-results eligibility
- Fixing a Search Console structured-data error

## When NOT to Use

Do NOT activate for:
- **Runtime metadata API (title / description / og / canonical)** → `metadata-and-og`
- **Sitemap / robots generation** → `seo-sitemap-robots`
- **Open Graph image generation** → `open-graph-image`
- **Microdata or RDFa** — out of scope (Google recommends JSON-LD)
- **schema.org types other than Product / Article / BreadcrumbList / FAQPage** — add to the skill in v0.4 when a canonical use case arises

---

## Procedure

The classifier extracts every `<script type="application/ld+json">` body, parses the JSON inside, and applies the rules below.

### Step 1 — Every JSON-LD object must have `@context: "https://schema.org"`

```html
<!-- RIGHT -->
<script type="application/ld+json">
  {"@context": "https://schema.org", "@type": "Product", ...}
</script>

<!-- WRONG -->
<script type="application/ld+json">
  {"@type": "Product", "name": "Widget"}
</script>
```

Rule: the top-level object must include `"@context"` with value `"https://schema.org"` (trailing slash allowed; http:// form deprecated but accepted).

### Step 2 — `Product` needs `name` + (`image` OR `offers`)

Google's Product rich result requires `name` plus at least one of `image` or `offers` to be eligible.

```json
// RIGHT
{ "@context": "https://schema.org", "@type": "Product",
  "name": "Widget", "image": ["https://example.com/widget.jpg"] }

// WRONG
{ "@context": "https://schema.org", "@type": "Product",
  "description": "A widget." }
```

### Step 3 — `Article` needs `headline` + `author` + `datePublished`

```json
// RIGHT
{ "@context": "https://schema.org", "@type": "Article",
  "headline": "...", "author": { "@type": "Person", "name": "A" },
  "datePublished": "2026-04-19" }

// WRONG — missing datePublished
{ "@context": "https://schema.org", "@type": "Article",
  "headline": "...", "author": "A" }
```

### Step 4 — `BreadcrumbList.itemListElement[].position` must be sequential (1, 2, 3, …)

Google uses `position` for breadcrumb ordering in SERPs. Out-of-order or missing positions break the trail.

```json
// RIGHT — positions 1, 2, 3
{ "@context": "https://schema.org", "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ex/" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://ex/blog" },
    { "@type": "ListItem", "position": 3, "name": "Post", "item": "https://ex/blog/x" }
  ]
}

// WRONG — 1, 3, 2
{ "@type": "BreadcrumbList",
  "itemListElement": [
    { "position": 1, ... },
    { "position": 3, ... },
    { "position": 2, ... }
  ]
}
```

### Step 5 — `FAQPage.mainEntity[].acceptedAnswer.text` required for every Q

Google's FAQ rich result requires an answer text for every question. Missing `acceptedAnswer.text` disqualifies the whole FAQPage.

```json
// RIGHT
{ "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Q1?",
      "acceptedAnswer": { "@type": "Answer", "text": "A1." } }
  ]
}

// WRONG — acceptedAnswer has no text
{ "@type": "FAQPage",
  "mainEntity": [{ "@type": "Question", "name": "Q1?", "acceptedAnswer": {} }]
}
```

---

## Tool Integration

No CLI. Test via Google's Rich Results Test after landing.

## Examples

### Example 1 — `product-missing-required`

**Input:** page emits `{"@type": "Product", "description": "..."}` — no `name`, no `image`, no `offers`.
**Output:** not eligible for Product rich result. Fix: add `name` + at least one of `image` (URL or array) or `offers` (nested Offer with `price` + `priceCurrency`).

### Example 2 — `breadcrumb-out-of-order`

**Input:** breadcrumb list with positions `[1, 3, 2]`.
**Output:** Google drops the trail on inconsistent positions. Fix: re-number sequentially starting at 1.

---

## Edge Cases

- **Array of JSON-LD objects:** a single `<script>` body may contain an array `[{...}, {...}]`. The classifier evaluates each element independently against its `@type`.
- **Dynamic interpolation (`dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}`):** the classifier parses the object literal passed to `JSON.stringify`. Nested object-spread (`{...base, name: foo}`) is a heuristic — the classifier extracts literal keys.
- **`author` as a string vs. Person object:** both accepted per schema.org; Step 3 only requires presence.
- **`image` as a single URL string vs. array of URLs:** both accepted per Google's docs.
- **Script body with dynamic variables (`${var}`):** the classifier can only check literal keys. Dynamic content is flagged only when a *required* key is provably absent from the literal.

---

## Evaluation

See `/evals/structured-data-json-ld/`.

**Quantitative:** ≥5 violation fixtures at ≥95% accuracy, 0 false positives on ≥4 safe fixtures, held-out ≥90%.
**Qualitative:** Promptfoo rubric `structured-data-remediation-implementability` (≥0.85).

---

## Handoffs

- Metadata API (title/description/canonical/og) → `metadata-and-og`
- Sitemap/robots → `seo-sitemap-robots`
- Open Graph image → `open-graph-image`

---

## Dependencies

- **External skills:** `metadata-and-og`, `seo-sitemap-robots`, `open-graph-image`
- **MCP servers:** none
- **Tools required in environment:** none

---

## References

- `references/json-ld-required-fields.md` — Google required-field tables for Product/Article/BreadcrumbList/FAQPage

## Scripts

- _(none)_

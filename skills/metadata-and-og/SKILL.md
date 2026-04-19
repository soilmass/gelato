---
name: metadata-and-og
description: >
  Audit a Next.js App Router app's page-level metadata output (title,
  description, canonical, OpenGraph, Twitter Card, robots, structured data
  hooks) against Google Search Central + Next.js Metadata API conventions.
  Produces a per-route audit of generateMetadata return shapes and flags
  four classes of drift: missing required field, wrong-length title/
  description, duplicate canonical, malformed OpenGraph.
  Use when: adding or changing a generateMetadata export, reviewing SEO
  readiness, "why isn't my OG image showing", canonical URL audit, title /
  description length check, indexable vs noindex decision on a route,
  structured-data / JSON-LD preflight.
  Do NOT use for: content strategy (→ brand-content / Core 2 v0.3+),
  general SEO keyword research, AI-search visibility (→ brand-domains-ai-
  search, Core 2+), sitemap generation (→ v0.2 seo-sitemap candidate).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: seo
  phase: verify
  type: procedural
  methodology_source:
    - name: "Google Search Central — Control your title links + snippets"
      authority: "Google"
      url: "https://developers.google.com/search/docs/appearance/title-link"
      version: "2024"
      verified: "2026-04-18"
    - name: "Next.js — Metadata API (App Router)"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/api-reference/functions/generate-metadata"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "generateMetadata or static metadata export"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T13:13:48.432Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four violation classes (missing-required,
    wrong-length, duplicate-canonical, malformed-og). Deterministic
    AST-free classifier over generateMetadata return-object fixtures.
---

# metadata-and-og

Encodes Google Search Central's title-snippet controls and Next.js's Metadata API conventions into a per-route audit. Scoped to *page-level metadata emission* — not content strategy, not keyword research, not AI-search visibility. A route either emits complete, well-formed metadata or it's flagged.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Google Search Central — *Control your title links in search results*
  - Source: [https://developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link)
  - Version: 2024
  - Verified: 2026-04-18
- **Secondary:** Next.js — Metadata API (App Router)
  - Source: [https://nextjs.org/docs/app/api-reference/functions/generate-metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the required-fields set (title, description, canonical), the length boundaries Google crops (title 50-60 chars, description 150-160 chars, OG title similar), the four canonical drift shapes, the Next-specific mechanics (static `metadata` export vs. `generateMetadata()` vs. layout-inherited defaults).

NOT encoded: keyword strategy, content calendar, on-page content quality, JSON-LD schema authoring (that's a v0.2 candidate `structured-data`), sitemap.xml / robots.txt generation (separate deployment concern), search-engine-specific directives beyond Google's baseline.

---

## Stack Assumptions

- `next@15+` App Router
- Metadata via `export const metadata` (static) or `export async function generateMetadata()` (dynamic)
- `bun@1.1+` for eval invocation

If your stack differs, fork the suite.

---

## When to Use

Activate when any of the following is true:
- Adding or editing a page's `metadata` or `generateMetadata` export
- Reviewing a pre-launch SEO pass
- "Why isn't my OG image showing on Twitter/LinkedIn/Slack"
- Canonical URL audit — are multi-locale routes consistent
- A title or description is unexpectedly truncated in SERPs
- Setting `robots: { index, follow }` on auth'd / draft routes

## When NOT to Use

Do NOT activate for:
- Content strategy or keyword research — Core 2 (v0.3+) territory
- AI search visibility (ChatGPT, Perplexity, Google AI Overviews) — `brand-domains-ai-search`, Core 2+
- Sitemap generation / robots.txt — `v0.2 seo-sitemap` candidate
- Structured data / JSON-LD authoring — `v0.2 structured-data` candidate (the skill was deferred from v0.1 for leverage reasons)

---

## Procedure

### Step 1 — Inventory every route's metadata shape

Walk `app/**/page.tsx` and `app/**/layout.tsx`. For each file record:

- Whether it exports `metadata` (static), `generateMetadata` (dynamic), both, or neither.
- The shape of the return value: which fields are set, which come from parent layouts.
- Whether the route is `noindex` (intentional) or `index` (audit target).

Layouts contribute defaults; the runtime merge at request time is what Google sees. The audit applies to the *effective* shape per route.

### Step 2 — Classify against four drift classes

| Class | Signal |
|---|---|
| **`missing-required`** | `title`, `description`, or `alternates.canonical` absent on a page-level route (not inherited from a layout default) |
| **`wrong-length`** | `title` > 60 chars, `description` < 70 or > 160 chars, `openGraph.title` > 70, `openGraph.description` > 200 |
| **`duplicate-canonical`** | Same `alternates.canonical` URL used by two different routes — Google drops the lower-authority one |
| **`malformed-og`** | `openGraph.images[*]` missing `url`, or `width`/`height` absent from an image that Next.js cannot infer (remote URL without dimensions), or `type` set to an unrecognized value |

Google's actual crop thresholds (2024 data): title ~600px ≈ 50-60 chars; description snippet 150-160 chars. The eval uses the upper bounds as the bar because short ≠ wrong; too-long is what gets truncated.

### Step 3 — Produce a remediation plan ordered by SERP impact

Priority (high to low):

1. **`missing-required` on an indexable route** — Google falls back to the document title or ignores the route entirely. Fix first.
2. **`duplicate-canonical`** — the "wrong" URL gets deranked. Fix before traffic shifts.
3. **`wrong-length` title** — truncated titles hurt CTR; fix to 50-60 chars.
4. **`malformed-og`** — social-share cards render as text-only. Annoying; not a search-ranking factor.
5. **`wrong-length` description** — lowest-impact; Google rewrites descriptions frequently anyway.

### Step 4 — Apply fixes in leverage order, re-inventory

After each class is fixed, re-run the audit. The fixture eval catches regressions when `title` drifts back over 60 chars during copy edits.

### Step 5 — Verify in production

- `curl -s https://<site>/route | grep -E 'title|description|canonical|og:'` — spot-check.
- Google Search Console's URL Inspection tool — authoritative source for what Google actually indexed.
- OG preview via `https://www.opengraph.xyz/` or native platform previewers (Twitter Card Validator, LinkedIn Post Inspector).

---

## Tool Integration

**Static metadata (canonical pattern):**

```tsx
// app/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gelato — the dogmatic Claude Code kit',
  description:
    'Opinionated Claude Code plugin for modern full-stack TypeScript. Every skill encodes a canonical external methodology and ships with a runnable, passing eval.',
  alternates: { canonical: 'https://gelato.dev/' },
  openGraph: {
    title: 'Gelato — the dogmatic Claude Code kit',
    description: 'Opinionated plugin for modern full-stack TypeScript.',
    url: 'https://gelato.dev/',
    siteName: 'Gelato',
    images: [
      { url: 'https://gelato.dev/og.png', width: 1200, height: 630, alt: 'Gelato' },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gelato — the dogmatic Claude Code kit',
    description: 'Opinionated plugin for modern full-stack TypeScript.',
    images: ['https://gelato.dev/og.png'],
  },
  robots: { index: true, follow: true },
};
```

**Dynamic metadata:**

```tsx
// app/posts/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `https://example.com/posts/${params.slug}` },
    openGraph: { /* ... */ },
  };
}
```

---

## Examples

### Example 1 — Missing description (`missing-required`)

**Input:** `export const metadata = { title: 'Home' };`

**Output:** Google uses the page's first meaningful text block as the snippet — rarely what you want. Add an explicit description (70-160 chars). Canonical should also be set, or this route risks duplicate-content penalties with the `/index` variant.

### Example 2 — Title 98 chars long (`wrong-length`)

**Input:** `title: 'Gelato — the dogmatic, eval-verified Claude Code kit for modern full-stack TypeScript builders and reviewers'`

**Output:** Google crops to ~60 chars. Rewrite with the high-leverage phrase in the first 50 chars: `title: 'Gelato — the dogmatic Claude Code kit for TypeScript'`.

### Example 3 — Image without dimensions (`malformed-og`)

**Input:** `openGraph: { images: [{ url: 'https://cdn.example.com/og.png' }] }` (remote URL, no width/height)

**Output:** Slack and LinkedIn refuse to render. Add `width: 1200, height: 630`. Next.js cannot infer dimensions for remote images at build time.

---

## Edge Cases

- **Layout-inherited defaults:** if `app/layout.tsx` sets a default `title.template`, a page's bare `title: 'About'` becomes `'About | Site Name'`. The audit applies to the *merged* shape, not the raw per-file shape.
- **`metadataBase`:** setting `metadataBase: new URL(...)` in a root layout makes relative `openGraph.images` URLs resolve correctly. Without it, images fail OG scraping.
- **`noindex` routes:** auth'd pages, draft previews, and admin dashboards should opt out with `robots: { index: false, follow: false }`. The audit flags a missing title on an *indexable* route; `noindex` routes are exempt.
- **Multi-locale canonicals:** `alternates: { canonical: ..., languages: { 'en-US': '...', 'de-DE': '...' } }`. The duplicate-canonical check scopes to the `canonical` field only; `languages` entries are hreflang territory.
- **Static vs dynamic:** `generateMetadata` can be `async` and fetch per-request. The audit runs on the *shape* of what it returns, not the runtime values — fixtures declare the shape directly.

---

## Evaluation

See `/evals/metadata-and-og/` for the canonical eval suite.

### Pass criteria

**Quantitative (deterministic shape classifier):**
- Classifies ≥ 95% of violation fixtures across 4 classes
- Zero false positives on well-formed fixtures
- Inventory matches SKILL.md targets

No LLM-as-judge half for v0.1 — the four classes are mechanical checks against the return-object shape.

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate`.

---

## Handoffs

This skill is scoped to page-level metadata output. Explicitly NOT absorbed:

- **Content strategy and editorial** — Core 2 (v0.3+).
- **AI-search visibility** (ChatGPT / Perplexity / Google AI Overviews) — `brand-domains-ai-search` in Core 2.
- **Sitemap / robots.txt generation** — v0.2 `seo-sitemap` candidate.
- **Structured data / JSON-LD** — v0.2 `structured-data` candidate (was deferred from v0.1; revisit post-v0.2.0).
- **Analytics / Search Console integration** — `event-taxonomy-and-instrumentation` + deployment-tooling skills.

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, `curl` (for production verification)

---

## References

- `references/required-fields.md` — what "required" means per route type
- `references/length-boundaries.md` — Google's 2024 crop numbers for title / description / OG

## Scripts

- _(none in v0.1 — a `bun run seo-audit` CLI that walks `app/` and runs the classifier is a v0.2 candidate)_

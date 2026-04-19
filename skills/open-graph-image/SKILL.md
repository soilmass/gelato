---
name: open-graph-image
description: >
  Audit `opengraph-image.tsx` (or `twitter-image.tsx`) files in a
  Next.js 15 App Router app against the Next.js docs for
  `opengraph-image` + `ImageResponse` from `next/og`. Five
  violation classes: missing `export const size`, missing
  `export const contentType`, default export not returning
  `ImageResponse`, Tailwind `className` used inside the JSX
  (Satori supports only inline `style={...}`), and importing
  non-edge-safe paths (`next/image`, `next/font/google`
  top-level) that break the Satori runtime.
  Use when: adding or editing `app/**/opengraph-image.tsx` or
  `twitter-image.tsx`, reviewing a PR that touches OG image
  generation, investigating "my OG image 500s at runtime".
  Do NOT use for: page-level metadata (→ metadata-and-og),
  JSON-LD (→ structured-data-json-ld), static OG PNGs in
  `public/` (they don't use Satori).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: seo
  phase: build
  type: procedural
  methodology_source:
    - name: "Next.js — opengraph-image metadata file"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-19"
    - name: "Next.js — ImageResponse (next/og)"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/api-reference/functions/image-response"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.239Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Five mechanical violation
    classes over opengraph-image.tsx / twitter-image.tsx fixtures.
---

# open-graph-image

Encodes Next.js 15's `opengraph-image` + `ImageResponse` (`next/og`) conventions. Five rules that keep an OG image file from 500'ing at runtime.

---

## Methodology Attribution

- **Primary:** Next.js — opengraph-image metadata file
  - Source: [https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-19
- **Secondary:** Next.js — ImageResponse (`next/og`)
  - Source: [https://nextjs.org/docs/app/api-reference/functions/image-response](https://nextjs.org/docs/app/api-reference/functions/image-response)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the five mechanical rules the Next docs explicitly call out (size export, contentType export, ImageResponse return, Satori inline-style constraint, edge-safe import paths). NOT encoded: OG image design (1200×630 is conventional but not mandated), caching strategy beyond the default, dynamic ImageResponse from CMS data beyond the shape.

---

## Stack Assumptions

- `next@15+` App Router
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Adding or editing `app/**/opengraph-image.tsx` or `twitter-image.tsx`
- Reviewing a PR that touches OG image generation
- "My OG image returns a 500 in production"
- "Twitter / LinkedIn previews show a blank image"

## When NOT to Use

Do NOT activate for:
- **Page-level metadata (title / description / og tags)** → `metadata-and-og`
- **JSON-LD structured data** → `structured-data-json-ld`
- **Static OG PNGs in `public/`** — no rules apply; Next just serves them

---

## Procedure

Fixtures carry a `filename:` like `app/opengraph-image.tsx` or `app/twitter-image.tsx`. Classifier activates on those paths.

### Step 1 — Export `size`

```tsx
export const size = { width: 1200, height: 630 };
```

Next uses this for both the metadata `<meta property="og:image:width">` + the ImageResponse's default viewport. Missing → runtime 500 OR incorrect meta.

### Step 2 — Export `contentType`

```tsx
export const contentType = 'image/png';
```

Without this, Next guesses based on the file extension (`.tsx` → wrong). Explicit avoids the guess.

### Step 3 — Default export must return `ImageResponse`

```tsx
// RIGHT
export default function OG() {
  return new ImageResponse(<div>Hi</div>, size);
}

// WRONG — returns a React element
export default function OG() {
  return <div>Hi</div>;
}
```

### Step 4 — No Tailwind `className` inside the JSX

Satori (the JSX-to-image runtime Next uses) supports only a subset of CSS and does NOT process Tailwind. Use inline `style={{...}}`.

```tsx
// RIGHT
<div style={{ display: 'flex', fontSize: 64, fontWeight: 'bold' }}>Gelato</div>

// WRONG — Tailwind classes silently ignored
<div className="flex text-6xl font-bold">Gelato</div>
```

### Step 5 — Don't import edge-incompatible paths at module scope

`next/image` and `next/font/google` at module-scope top level break Satori. Use only `ImageResponse` from `next/og` plus raw React elements.

```tsx
// RIGHT
import { ImageResponse } from 'next/og';

// WRONG
import { ImageResponse } from 'next/og';
import Image from 'next/image';          // breaks Satori
import { Inter } from 'next/font/google'; // breaks Satori
```

---

## Tool Integration

None. Verify with `curl https://<host>/opengraph-image` after deploy.

## Examples

### Example 1 — `non-imageresponse-default`

**Input:** default export returns plain JSX.
**Output:** Next hits a runtime error rendering the file as an image. Fix: wrap in `return new ImageResponse(<JSX />, size)`.

### Example 2 — `tailwind-in-satori`

**Input:** JSX uses `className="flex text-6xl"`.
**Output:** Satori ignores Tailwind; the rendered image is unstyled. Fix: replace `className` with inline `style={{ display: 'flex', fontSize: 96 }}`.

---

## Edge Cases

- **`twitter-image.tsx`:** same rules as `opengraph-image.tsx` (same file-convention family).
- **Dynamic `generateImageMetadata`:** the function must still export size + contentType. Classifier checks both.
- **CMS-driven content:** dynamic data is fine; violation is about the file's static exports + JSX-vs-ImageResponse shape.

---

## Evaluation

See `/evals/open-graph-image/`.

**Quantitative:** ≥5 violation fixtures at ≥95%, 0 false positives on ≥4 safe, held-out ≥90%.
**Qualitative:** Promptfoo rubric `og-image-remediation-implementability` (≥0.85).

---

## Handoffs

- `<meta>` og tags → `metadata-and-og`
- JSON-LD → `structured-data-json-ld`
- Sitemap / robots → `seo-sitemap-robots`

---

## Dependencies

- **External skills:** `metadata-and-og`, `structured-data-json-ld`, `seo-sitemap-robots`
- **MCP servers:** none
- **Tools required in environment:** none

---

## References

- `references/opengraph-image-api.md` — Next.js opengraph-image contract + Satori's CSS subset

## Scripts

- _(none)_

# metadata-and-og eval

Proves the four SEO-metadata violation classes are mechanically enforceable against Next.js App Router `metadata` exports.

## What the eval measures

Deterministic shape classifier. Splits each fixture into metadata-export blocks (at `export const metadata` or `generateMetadata` boundaries), extracts fields via regex, and matches against four classes: `missing-required`, `wrong-length`, `duplicate-canonical`, `malformed-og`.

Boundaries come from `skills/metadata-and-og/references/length-boundaries.md`: title ≤ 60, description 70-160, og.title ≤ 70. Remote openGraph images without explicit dimensions are flagged; local / metadataBase-relative images are exempt (Next.js infers dimensions for them).

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations classified across 4 classes | ≥ 95% |
| 5 safe fixtures classify as `safe` | 100% |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out cases

- 01 title exactly 60 chars (boundary)
- 02 local OG image without dimensions (safe — Next infers)
- 03 noindex without title/description (exempt)
- 04 description exactly 160 chars (boundary)
- 05 layout-inherited title.template (partial title is fine)
- 06 relative canonical path via metadataBase

## No qualitative half

Mechanical checks against the return-object shape. A v0.2 candidate rubric would judge whether a generated *rewrite* preserves meaning while hitting the length targets — LLM-as-judge territory.

## Running

```bash
bun run eval metadata-and-og
```

~60 ms. No env, no Chromium, no API keys.

# Length boundaries (Google Search Central, 2024)

Source: [https://developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) + [description snippet guidance](https://developers.google.com/search/docs/appearance/snippet).

| Field | Min | Max | Why |
|---|---|---|---|
| `title` | 30 chars | 60 chars | Google crops title links at ~600px — 50-60 chars of Roman text fits. |
| `description` | 70 chars | 160 chars | Too short means Google rewrites the snippet from page content. Too long gets cropped with ellipsis. |
| `openGraph.title` | 30 | 70 | Facebook/LinkedIn show more than Google; 70-char threshold is the practical upper bound. |
| `openGraph.description` | 70 | 200 | LinkedIn shows ~200, Twitter ~125, Slack ~300 — 200 is the "safe everywhere" upper bound. |
| `twitter.title` | 30 | 70 | Mirrors OG. |
| `twitter.description` | 70 | 200 | Mirrors OG. |

## What "chars" means

Character count, not byte count. Unicode combining marks count as the base character. The eval's classifier uses `String.length` (UTF-16 code units), which over-counts for emoji — an emoji-heavy title may look "too long" to the classifier while fitting fine on screen. Known limitation; corrective guidance is to use `Array.from(str).length` (code points) but fixture content avoids emoji-heavy examples to keep the count mechanical.

## The asymmetry between title and description

Title length has a linear CTR cost — every 10 characters over the bar loses some click-through. Description length has a step function: either Google shows yours (70-160 chars, well-targeted) or rewrites it from content (too short, too long, or off-topic). Fix titles first; descriptions are cheaper to lose.

## Language-specific variance

Google's char-count bars are for Roman alphabets. CJK / Hindi / Arabic text crops earlier because the glyphs are wider. A production audit should pass a locale parameter; the v0.1 eval classifier assumes Roman-script fixtures and flags that assumption in the SKILL's edge cases section.

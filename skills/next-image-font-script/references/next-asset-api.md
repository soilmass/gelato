# Next.js asset-component API — what the skill enforces

Quick reference for the three Next.js 15 asset components the classifier tracks, with the specific prop contracts each rule implements.

## `next/image`

```tsx
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Required — accessibility"
  width={1200}
  height={600}
  priority={true}     // optional but required for LCP candidate
  placeholder="blur"  // optional
  fetchPriority="high" // optional — implicit when priority=true
/>
```

**What the classifier checks:**

1. No bare `<img>` tag appears in the file (Step 1). Exempt: the file is `opengraph-image.tsx`, where Satori JSX requires `<img>`.
2. Every `<Image>` has either `width`+`height` OR `fill` (Step 2). The docs are explicit — rendering without dimensions throws at runtime.
3. If the file is a page (filename ends `/page.tsx`) and has one or more `<Image>`, at least one must carry `priority` (Step 3).

**What the classifier does NOT check:**

- Whether `priority` is on the *correct* image (LCP candidate identification is semantic)
- `sizes` prop tuning (performance craft, not correctness)
- `placeholder` + `blurDataURL` pairing (the skill doesn't enforce blur-up UX)
- `loader` / `unoptimized` props (advanced config)

## `next/font`

```tsx
// Google font
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// Local font
import localFont from 'next/font/local';

const custom = localFont({ src: './my-font.woff2' });

export default function Layout({ children }) {
  return <html className={inter.className}><body>{children}</body></html>;
}
```

**What the classifier checks:**

Step 4 — the initializer call (`Inter(...)`, `Geist(...)`, `localFont(...)`, any named import from `next/font/google` or `next/font/local` invoked as a function) must sit at module top level, NOT inside a function body.

Detection: after an `import { FontName } from 'next/font/google'` OR `import <name> from 'next/font/local'`, walk the file for `FontName(` call sites. A call site inside a function body (depth > 0 in brace counting) is a violation.

**What the classifier does NOT check:**

- `subsets` configuration (design choice)
- `display: 'swap'` vs `'optional'` vs `'block'` (UX judgment; the default `'optional'` is fine)
- Preload / preconnect concerns (handled by Next automatically when next/font is used at module scope)
- Whether `className` or `variable` is actually applied to the tree (that's a usage concern)

## `next/script`

```tsx
import Script from 'next/script';

<Script
  src="https://cdn.example/widget.js"
  strategy="lazyOnload"     // REQUIRED — the rule
  onLoad={() => console.log('loaded')}
/>
```

Four valid strategies per the docs:

- `beforeInteractive` — before React hydrates; blocks page interactivity
- `afterInteractive` — after hydration (Next's default if strategy is omitted)
- `lazyOnload` — during browser idle time, lowest priority
- `worker` — in a Partytown web worker (experimental)

**What the classifier checks:**

Step 5 — every `<Script>` open tag must have a `strategy=` attribute (value can be any of the four above, or a dynamic expression). Calls without `strategy` are flagged.

**What the classifier does NOT check:**

- Which strategy is correct for which script (analytics → `afterInteractive` or `lazyOnload`; marketing pixel → `lazyOnload`; polyfill → `beforeInteractive` — semantic judgment)
- Whether the script is from a trusted source (supply-chain; `bundle-budget` surfaces this for CDN-loaded libs in general)
- SRI (`integrity` attribute) — v0.3+ `subresource-integrity` skill candidate
- Whether `async`/`defer` is still specified alongside `strategy` (Next handles this internally)

## Why the skill ships as "performance" subsystem

Each of the three rules has a direct impact on a Core Web Vital:

- `next/image` → LCP + CLS (dimensions prevent shift; priority ensures eager-load)
- `next/font` → CLS + LCP (optimized fonts swap-in correctly; unoptimized fonts cause swap delay)
- `next/script` → INP + TTI (wrong strategy blocks main thread)

The `core-web-vitals-audit` skill measures the outcome; this skill prevents the most common causes of missing the budget.

## Why not just enforce the full Next.js lint rules?

Next.js's `@next/eslint-plugin-next` ships rules like `@next/next/no-img-element`, `@next/next/no-page-custom-font`, and others. This skill is mechanically a subset — the five most impactful rules for v0.3.0 — but it deliberately does NOT duplicate the full plugin. Teams adopting Gelato should still wire up `@next/eslint-plugin-next` alongside this skill. The Gelato skill gives you eval-verified discipline at PR-review time; the ESLint plugin gives you instant feedback in the editor.

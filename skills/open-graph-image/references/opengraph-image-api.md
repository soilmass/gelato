# `opengraph-image.tsx` contract

## Required file-level exports

```tsx
// File: app/opengraph-image.tsx (or app/<segment>/opengraph-image.tsx,
// twitter-image.tsx, etc.)
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };  // required
export const contentType = 'image/png';            // required
export const alt = 'Optional but recommended';     // optional

export default async function OG({ params }) {
  return new ImageResponse(<div>...</div>, size);
}
```

The skill enforces:

1. `export const size = {...}` present (Step 1).
2. `export const contentType = '...'` present (Step 2).
3. Default export returns `new ImageResponse(...)` (Step 3).

## Satori — the JSX-to-image runtime

`next/og`'s `ImageResponse` uses [Satori](https://github.com/vercel/satori) under the hood. Satori converts JSX to SVG, then Resvg converts SVG to PNG. Satori does NOT run React; it statically renders the JSX tree.

**Supported CSS (inline `style={...}` only):**

- Flexbox: `display: 'flex'`, `flexDirection`, `justifyContent`, `alignItems`, `gap`
- Positioning: `position: 'absolute' | 'relative'`, `top`, `left`, `right`, `bottom`
- Typography: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `textAlign`
- Colors: `color`, `backgroundColor` (hex, rgb, rgba)
- Spacing: `padding*`, `margin*`
- Borders: `border*`, `borderRadius`
- Sizing: `width`, `height`, `maxWidth`, `maxHeight`
- Overflow: `overflow: 'hidden'`
- Transforms: `transform: 'rotate(45deg)'`
- Backgrounds: `backgroundImage: 'linear-gradient(...)'` + hosted image URLs
- Text: `whiteSpace`, `wordBreak`

**Not supported (silently ignored → blank / default rendering):**

- `className` — no class resolution; Tailwind fully invisible
- CSS Grid
- Custom CSS variables (`var(--x)`)
- `calc()` with mixed units
- `@media` queries
- Keyframe animations
- Most pseudo-classes / pseudo-elements

That's why Step 4 flags `className`. Reviewers reaching for Tailwind's `flex text-6xl font-bold` must convert each class to an inline style property.

## Edge-safe imports

`ImageResponse` runs in Next's Edge Runtime by default (faster cold start). At edge, the V8 subset doesn't include:

- Most Node.js built-ins (`fs`, `child_process`, etc.)
- `next/image` (it's a React Server Component / requires Node's sharp)
- `next/font/google` top-level import (downloads fonts via network; at edge, the download is restricted)

**Use instead:**

- Load fonts via `fetch()` on a URL (CDN-hosted `.woff2`) passed to `ImageResponse`'s `fonts` option:

```tsx
const font = await fetch(new URL('./fonts/inter.woff2', import.meta.url)).then((r) => r.arrayBuffer());

return new ImageResponse(<div>...</div>, {
  ...size,
  fonts: [{ name: 'Inter', data: font, weight: 400 }],
});
```

- For images in the OG image, use `<img src="https://...">` with an absolute URL (Satori fetches + embeds at render time). `next/image` does NOT work.

## Static vs. dynamic OG

If your OG image is a static PNG that you ship in `public/og.png`, you don't need `opengraph-image.tsx` at all — set the `og:image` metadata to the URL. This skill applies only when the file-convention (Next generating the image per-route) is in use.

## Dynamic `generateImageMetadata`

```tsx
export async function generateImageMetadata({ params }) {
  return [
    { id: 'twitter', size: { width: 1200, height: 630 }, contentType: 'image/png' },
    { id: 'square', size: { width: 1200, height: 1200 }, contentType: 'image/png' },
  ];
}

export default async function OG({ params, id }) {
  return new ImageResponse(<div>{id}</div>, { width: 1200, height: 630 });
}
```

The skill's Step 1 + Step 2 apply to the top-level `size` / `contentType` exports; when `generateImageMetadata` is present, the per-variant `size` / `contentType` inside the generator's return array are recommended but not enforced (the generator provides them). For simplicity, the current classifier checks the file-level exports and is lenient when `generateImageMetadata` exists.

## What the skill doesn't check

- Whether the OG image actually renders (runs Satori) — build/runtime concern
- Whether the 1200×630 size is correct for the target platform (Twitter supports various sizes; Facebook is strict on 1.91:1 aspect ratio)
- Whether fonts render correctly (needs `fonts` option; the skill doesn't enforce font loading)
- Accessibility of the image (OG images are non-interactive; the `<meta property="og:image:alt">` text is metadata-and-og's concern)
- Caching + revalidate semantics (Next handles these; tuning is a perf judgment)

Use the Twitter Card Validator / LinkedIn Post Inspector / Facebook Sharing Debugger after deploy to verify real-world rendering.

# Tailwind v3 → v4 migration checklist

Three steps. Each one is a mechanical rewrite; none are judgment calls.

## 1. Replace the three `@tailwind` directives

Before:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

After:

```css
@import "tailwindcss";
```

One import replaces three directives. v4 generates the correct cascade automatically.

## 2. Rewrite the PostCSS plugin

Before:

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

After:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

The plugin is now `@tailwindcss/postcss`. Autoprefixer is bundled.

## 3. Move config into CSS

Before (`tailwind.config.ts`):

```ts
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: '#ff0080' },
    },
  },
};
```

After (in `globals.css`):

```css
@import "tailwindcss";

@theme {
  --color-brand: #ff0080;
}
```

Delete `tailwind.config.ts` unless you have plugins or legacy options. Source discovery is automatic; add `@source "path/to/glob";` in CSS only when auto-discovery misses a file.

## Known flex points

- Plugins (`@tailwindcss/typography`, etc.) load via `@plugin "..."` in CSS instead of `plugins: [...]` in JS.
- Custom utility functions still work but may have updated signatures — check the upgrade guide.
- Some v3 arbitrary-value edge cases render differently under v4's new engine; visual regression testing is prudent for large codebases.

## Verification

After migrating:

- `bun run build` — no build-time errors.
- `bun run dev` — open the app, verify no `[@tailwind base]` warnings in the console.
- Visual regression check — diff screenshots of 5-10 representative pages.
- Grep for leftovers: `@tailwind base`, `require('tailwindcss')`, `plugins: { tailwindcss:`.

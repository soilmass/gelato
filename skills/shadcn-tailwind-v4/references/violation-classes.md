# Four violation classes

Each fixture classifies into exactly one. A fixture that triggers none is `safe`.

## 1. `pre-v4-css-directives`

Entry CSS uses the v3 three-directive form instead of `@import "tailwindcss";`.

**Signal:** file contains `@tailwind base;` / `@tailwind components;` / `@tailwind utilities;`.

**Canonical example:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

.container { /* ... */ }
```

**Remediation:** replace with `@import "tailwindcss";` at the top of the file.

## 2. `v3-config-shape`

`tailwind.config.{js,ts}` with the v3 shape (`content:` array + `theme: { extend: {} }`).

**Signal:** file contains `module.exports = {` OR `export default {` AND `content:` AND `theme:` within the same top-level object.

**Canonical example:**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { brand: '#ff0080' },
    },
  },
  plugins: [],
};
```

**Remediation:** delete the file or strip to a plugins-only shape. Move theme values into a `@theme` CSS block.

## 3. `old-postcss-plugin`

`postcss.config.*` using the v3 plugin name `tailwindcss` instead of `@tailwindcss/postcss`.

**Signal:** file contains `plugins:` AND a key named `tailwindcss:` (quoted or unquoted) that is NOT `'@tailwindcss/postcss'`.

**Canonical example:**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Remediation:** replace with `'@tailwindcss/postcss': {}`. Drop autoprefixer (bundled in v4).

## 4. `string-concat-classname`

TSX component uses a template literal (or string concat) for `className` instead of `cn()`.

**Signal:** JSX `className=` attribute set to a template literal (`` `...${...}...` ``) with interpolated expressions AND the file does not wrap those in `cn(`.

**Canonical example:**

```tsx
export function Card({ isSelected }: { isSelected: boolean }) {
  return (
    <div
      className={`rounded-md border p-4 ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      …
    </div>
  );
}
```

**Remediation:** `<div className={cn('rounded-md border p-4', isSelected && 'ring-2 ring-primary')} />`.

## Why exactly four

These are the four mechanical rewrites that either break the build (#1, #3), silently produce wrong output (#2 — config ignored in v4), or produce wrong runtime CSS (#4 — no conflict resolution). Each is detectable from the fixture text without a build step. Visual / design / taxonomy choices are deliberately out of scope.

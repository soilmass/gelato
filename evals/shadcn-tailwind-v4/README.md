# shadcn-tailwind-v4 eval

Proves the four Tailwind-v4 migration + shadcn className rules are mechanically enforceable across CSS, JS-config, and TSX fixtures.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **pre-v4-css-directives** — a CSS line starting with `@tailwind base/components/utilities/screens/variants;`. CSS `/* … */` comments stripped first.
2. **old-postcss-plugin** — JS config with `tailwindcss: {}` key (unquoted, object-form) OR `require('tailwindcss')`.
3. **v3-config-shape** — JS config with `content: [` AND `theme: {` in the same file.
4. **string-concat-classname** — `className={…}` JSX expression that is a template literal with `${…}` OR a string-plus concat, and is NOT wrapped in `cn(...)`.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 `@tailwind` mention inside a CSS `/* */` comment (don't flag)
- 02 `@tailwindcss/postcss` alongside `cssnano` (extra plugins are fine)
- 03 template literal wrapped inside `cn(`…, className) — safe
- 04 static template literal with no interpolation (`` `my-6 h-px bg-border` ``) — safe
- 05 array-form `plugins: [require('tailwindcss'), …]` — still old-postcss-plugin
- 06 cva call passed directly to className with no cn — safe (no conditional merge)

## Running

```bash
bun run eval shadcn-tailwind-v4
```

~70 ms. No env, no Chromium, no API keys.

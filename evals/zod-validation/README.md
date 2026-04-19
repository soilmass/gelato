# zod-validation eval

Proves the four Zod-at-the-boundary violation classes are mechanically enforceable against Next.js handlers and Server Actions.

## What the eval measures

Deterministic classifier — position-based heuristics over the fixture text. Five detection steps (each can short-circuit):

1. **unsafe-cast-bypasses-schema** — `as <Type>` / `as unknown as <Type>` applied to `await req.json()` / `Object.fromEntries(formData)` / `params.slug`.
2. **parse-should-be-safe-parse** — `.parse(` inside a `try { ... }` whose `catch` returns a 4xx Response (and no `.safeParse(` in the same try body).
3. **hasBoundary** gate — file must look like a handler / action / env reader; pure helpers short-circuit to `safe`.
4. **missing-at-boundary** — input consumption present, no `.parse()` / `.safeParse()` anywhere.
5. **validation-after-consumption** — first parse call appears AFTER the first side-effect marker (`db.*`, `fetch(`, `send*(`, `notify*(`).

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 `.safeParse` inside a try (legitimate — try guards downstream work, not schema parse)
- 02 top-level `.parse(process.env)` (canonical env schema — fail fast is correct)
- 03 `as` cast on a local computed value (not input — not a boundary bypass)
- 04 a "before parse" mention in a comment with actual parse at the top (comments don't move code)
- 05 pure helper file with no boundary (no false missing-at-boundary)
- 06 discriminated-union schema (classifier recognizes complex Zod shapes)

## Running

```bash
bun run eval zod-validation
```

~60 ms. No env, no Chromium, no API keys.

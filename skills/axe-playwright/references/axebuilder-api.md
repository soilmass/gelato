# `@axe-core/playwright` API reference

Quick reference for the `AxeBuilder` surface the skill's classifier tracks.

## Canonical import

```ts
import AxeBuilder from '@axe-core/playwright';
```

The default export is `AxeBuilder`. Named imports (`import { AxeBuilder } from …`) are not the documented form; the classifier looks for the default-import identifier.

## Construction

```ts
new AxeBuilder({ page });
```

Required arg: an object with a `page` property (a Playwright `Page` from the test's fixture). The skill's classifier matches `new AxeBuilder(` regardless of the argument shape.

## Chainable options

All return `this`:

- `.include(selector: string | string[])` — scope the scan to a CSS selector / frame.
- `.exclude(selector: string | string[])` — remove subtrees from the scan.
- `.disableRules(rules: string | string[])` — silence specific axe rule IDs. **Requires a comment per the skill's Step 3.**
- `.withRules(rules: string | string[])` — opt-in to specific rules beyond the defaults.
- `.withTags(tags: string | string[])` — filter to specific tag buckets (`wcag2aa`, `wcag22aa`, `best-practice`, etc.).
- `.options(opts)` — low-level axe options forwarded to axe-core. Used by Step 4 to enforce tag-set discipline.
- `.setLegacyMode(legacy?: boolean)` — run in the pre-4.0 API mode. Discouraged; not whitelisted by this skill.

## Terminal call

```ts
const results = await axe.analyze();
```

Returns `axe.AxeResults`. The shape the skill asserts on:

```ts
interface AxeResults {
  violations: Result[];
  passes: Result[];
  incomplete: Result[];
  inapplicable: Result[];
}
interface Result {
  id: string;           // axe rule id, e.g. "color-contrast"
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  nodes: NodeResult[];
  // ...
}
```

The skill's Step 2 requires `results.violations` (or a filtered subset of the same array shape) to be asserted against `[]`. Other assertion targets:

- `results.incomplete` — needs human review; axe can't decide automatically. Treated as passes by this skill (up-to-the-author to review).
- `results.passes` / `results.inapplicable` — informational; no assertion required.

## Tag set defaults

Per axe-core 4.10 docs, with no `.withTags()` or `.options({ runOnly })`, axe runs every rule tagged:

- `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa`
- `best-practice`
- (Section 508 tags also apply but don't affect WCAG conformance.)

The skill's Step 4 is satisfied by this default. Violations only occur when an author explicitly narrows `runOnly` away from the WCAG buckets.

## Common patterns (canonical, match what the skill's safe fixtures do)

```ts
// Default (recommended)
const { violations } = await new AxeBuilder({ page }).analyze();
expect(violations).toEqual([]);

// Scoped to a subtree
const { violations } = await new AxeBuilder({ page })
  .include('main')
  .analyze();
expect(violations).toEqual([]);

// Explicit WCAG tags
const { violations } = await new AxeBuilder({ page })
  .options({ runOnly: { type: 'tag', values: ['wcag22aa'] } })
  .analyze();
expect(violations).toEqual([]);

// Allowlisted with documented rationale
const { violations } = await new AxeBuilder({ page })
  // color-contrast enforced by design tokens in CI; re-eval Q3 2026.
  .disableRules(['color-contrast'])
  .analyze();
expect(violations).toEqual([]);
```

## Patterns NOT covered

- **`.clone()`** for reusing a base AxeBuilder across tests — supported by axe but not audited by this skill (no canonical violation shape).
- **`.setLegacyMode()`** — the pre-4.0 one-arg signature (`.include(selector)` only). Deque discourages; not whitelisted.
- **axe-core directly** (`import * as axe from 'axe-core'` + `axe.run()` in a `page.evaluate`) — pre-`@axe-core/playwright` integration. Not the contemporary pattern; this skill does not detect it.

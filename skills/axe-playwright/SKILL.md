---
name: axe-playwright
description: >
  Run axe-core accessibility scans inside Playwright tests for a
  Next.js 15 App Router app. Four violation classes: a spec that
  navigates (`page.goto`) but never runs `AxeBuilder`, a scan whose
  result is never asserted on zero violations, `.disableRules([…])`
  without an adjacent comment explaining the suppression, and a
  scan scoped to only `best-practice` tags that skips the WCAG 2.2
  AA rule-pack. Uses @axe-core/playwright 4.10+ against a running
  Playwright test (`@playwright/test` 1.48+).
  Use when: wiring axe into Playwright for the first time,
  reviewing an e2e spec with AxeBuilder, investigating "my a11y
  scan is green but violations ship", coverage audit across pages,
  CI-gate a11y check.
  Do NOT use for: static markup audit (→ a11y-mechanical-audit),
  Radix composition (→ radix-primitive-a11y), non-Playwright test
  frameworks (fork the suite), WCAG AAA conformance (AA is the bar).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: testing
  phase: verify
  type: procedural
  methodology_source:
    - name: "axe-core — rule catalog"
      authority: "Deque Systems"
      url: "https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md"
      version: "axe-core 4.10+"
      verified: "2026-04-19"
    - name: "@axe-core/playwright — documentation"
      authority: "Deque Systems"
      url: "https://www.npmjs.com/package/@axe-core/playwright"
      version: "@axe-core/playwright 4.10+"
      verified: "2026-04-19"
    - name: "Playwright — Best Practices"
      authority: "Microsoft / Playwright team"
      url: "https://playwright.dev/docs/best-practices"
      version: "Playwright 1.48+"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "@playwright/test@1.48+"
    - "@axe-core/playwright@4.10+"
    - "axe-core@4.10+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.237Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Four mechanical violation
    classes detected by a deterministic classifier over *.spec.ts
    fixtures. Complements a11y-mechanical-audit (static) and
    radix-primitive-a11y (composition) with a runtime scan.
---

# axe-playwright

Encodes Deque's axe-core rule catalog + `@axe-core/playwright` + Playwright Best Practices into a four-rule discipline for Playwright test authors. Runtime a11y scanning, scoped to the mechanical check that axe-core runs against a live DOM — the complement to the static `a11y-mechanical-audit` and composition-focused `radix-primitive-a11y`.

---

## Methodology Attribution

Three primary sources:

- **Primary:** axe-core rule catalog
  - Source: [https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
  - Authority: Deque Systems
  - Version: axe-core 4.10+
  - Verified: 2026-04-19
- **Secondary:** @axe-core/playwright docs
  - Source: [https://www.npmjs.com/package/@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright)
  - Version: @axe-core/playwright 4.10+
  - Verified: 2026-04-19
- **Tertiary:** Playwright Best Practices
  - Source: [https://playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices)
  - Version: Playwright 1.48+
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the four discipline rules that keep an axe scan useful — actually run it, actually assert on results, don't silence rules without documentation, don't scope away from the WCAG rule-pack. NOT encoded: which specific axe rules to enable (axe-core's defaults cover WCAG 2.2 AA); screen-reader-specific testing (orthogonal — Playwright can't drive JAWS/NVDA/VoiceOver); perf-impact of running axe per-spec (Deque documents axe is fast enough to run per-page).

---

## Stack Assumptions

- `next@15+` App Router (pages under `app/`)
- `@playwright/test@1.48+`
- `@axe-core/playwright@4.10+`
- `axe-core@4.10+`
- `bun@1.1+`

If your e2e framework is Cypress or WebdriverIO, fork the suite — the `AxeBuilder` API is Playwright-specific.

---

## When to Use

Activate when any of the following is true:
- Writing a new Playwright spec that covers a user-visible route
- Reviewing an e2e spec PR
- Wiring axe into Playwright for the first time
- "My a11y scan is green but violations ship"
- Coverage audit: "which routes do we actually scan?"

## When NOT to Use

Do NOT activate for:
- **Static markup audit** — `a11y-mechanical-audit` catches issues without running the page
- **Radix composition rules** — `radix-primitive-a11y`
- **Non-Playwright test frameworks** — out of scope
- **WCAG AAA conformance** — axe-core's default tag set is AA; AAA is a separate, stricter target
- **Screen-reader announcement testing** — needs actual assistive tech, not axe

---

## Procedure

### Step 1 — Every spec that visits a route runs `AxeBuilder`

```ts
// RIGHT
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home renders without a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// WRONG — page.goto with no AxeBuilder call anywhere
test('home renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

Rule: a `*.spec.ts` file containing at least one `page.goto(...)` must also contain at least one `new AxeBuilder(...)` usage (or an imported wrapper around it). Coverage is per-file, not per-test, to allow "visit once, assert visually + a11y once" patterns.

### Step 2 — Scan results must be asserted on zero violations

```ts
// RIGHT
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);

// RIGHT — allowlisted with rationale
const results = await new AxeBuilder({ page }).analyze();
const relevantViolations = results.violations.filter((v) => v.id !== 'landmark-one-main');
expect(relevantViolations).toEqual([]);

// WRONG — scan runs but its result is never asserted
const results = await new AxeBuilder({ page }).analyze();
console.log(results.violations);
```

Rule: every `.analyze()` return value must be asserted against the empty list (`toEqual([])`, `toHaveLength(0)`, or a filtered subset of the same shape). A `.analyze()` whose return binding is never passed to an `expect()` is a violation.

### Step 3 — `.disableRules([…])` requires an adjacent explanatory comment

```ts
// RIGHT
const results = await new AxeBuilder({ page })
  // Color-contrast is enforced by our design tokens in CI; runtime scan
  // hits false positives on marketing-page backgrounds with layered SVG.
  // Re-evaluate Q3 2026 once tokens-in-SVG are normalized.
  .disableRules(['color-contrast'])
  .analyze();

// WRONG — silenced with no explanation
const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
```

Rule: every `.disableRules(['...'])` call must have a `//` comment on the line immediately above (or on the same line trailing the chain). Suppressions without documentation rot — a year later nobody knows why the rule was turned off.

### Step 4 — Scan must include the WCAG AA tag set (not only `best-practice`)

```ts
// RIGHT — default (axe runs AA + best-practice + WCAG 2.1/2.2 tags automatically)
const results = await new AxeBuilder({ page }).analyze();

// RIGHT — explicit AA opt-in
const results = await new AxeBuilder({ page })
  .options({ runOnly: { type: 'tag', values: ['wcag22aa', 'wcag2aa'] } })
  .analyze();

// WRONG — limited to best-practice only; misses WCAG AA rules
const results = await new AxeBuilder({ page })
  .options({ runOnly: { type: 'tag', values: ['best-practice'] } })
  .analyze();
```

Rule: any `.options({ runOnly: { type: 'tag', values: [...] } })` with a `values` array that does NOT contain at least one of `wcag2aa`, `wcag22aa`, `wcag2a`, or `wcag21aa` is a violation. Calls without `.options()` pass by default — axe runs the full AA-inclusive rule-pack.

---

## Tool Integration

Canonical test file:

```ts
// tests/e2e/a11y.spec.ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/pricing', '/docs', '/blog/hello-world'];

for (const route of ROUTES) {
  test(`${route} has no a11y violations`, async ({ page }) => {
    await page.goto(route);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}
```

Playwright config to pair (excerpt):

```ts
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000' },
  webServer: { command: 'bun run build && bun run start', url: 'http://localhost:3000' },
});
```

---

## Examples

### Example 1 — `page-without-axe-scan`

**Input:**
```ts
import { test, expect } from '@playwright/test';

test('home loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading')).toBeVisible();
});
```

**Output:** Spec visits `/` but never runs `AxeBuilder`. Runtime a11y violations could ship undetected. Fix: add one `new AxeBuilder({ page }).analyze()` with `expect(violations).toEqual([])` per visited route, either per-test or in a shared fixture.

### Example 2 — `disabled-rules-undocumented`

**Input:**
```ts
const { violations } = await new AxeBuilder({ page })
  .disableRules(['color-contrast', 'landmark-one-main'])
  .analyze();
expect(violations).toEqual([]);
```

**Output:** Two rules silenced with no adjacent explanation. Fix: add a trailing line comment on each rule's rationale (why silenced, when to re-evaluate), or file an issue and put its URL in the comment.

---

## Edge Cases

- **Imported `AxeBuilder` wrapper:** a helper like `import { scanA11y } from './helpers/axe'` that internally constructs `AxeBuilder` satisfies Step 1 when its import appears in the file AND the helper is called. The classifier accepts either `new AxeBuilder` OR an import from a local wrapper whose name contains `axe`.
- **Fixture-based axe wrapper:** Playwright's `test.extend` pattern where `{ a11yScan }` is injected via a fixture — treat the fixture import as the proxy for `AxeBuilder`.
- **Spec with only mock-out tests:** a spec that imports Playwright primitives but never calls `page.goto` isn't subject to Step 1. Rule activates only when `page.goto` is present.
- **Multi-route coverage:** a single spec file can cover multiple routes; Step 1 requires ONE AxeBuilder usage total, not one per route.
- **Shared test config with `global-setup` scanning:** not supported by the classifier. Inline axe usage is the enforced pattern.

---

## Evaluation

See `/evals/axe-playwright/` for the canonical eval suite.

### Pass criteria

**Quantitative:**
- Classifies ≥ 4 violation fixtures across 4 classes at ≥ 95% accuracy
- Zero false positives on ≥ 4 safe fixtures
- Held-out adversarial set (≥ 6 fixtures) at ≥ 90% accuracy

**Qualitative:**
- LLM-as-judge rubric `scan-coverage-remediation` scores ≥ 0.85

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate` in the frontmatter above.

---

## Handoffs

Scoped to **runtime a11y scans inside Playwright tests**. Explicitly NOT absorbed:

- Static markup discipline → `a11y-mechanical-audit`
- Radix primitive composition → `radix-primitive-a11y`
- Playwright best practices outside a11y (locators, waits, test.only) → `playwright-e2e`
- Non-Playwright test frameworks → out of scope
- Screen-reader announcement testing → no mechanical authority to cite

---

## Dependencies

- **External skills:** `a11y-mechanical-audit`, `radix-primitive-a11y`, `playwright-e2e`
- **MCP servers:** none
- **Tools required in environment:** `@axe-core/playwright@4.10+`, `axe-core@4.10+`, `@playwright/test@1.48+`

---

## References

- `references/axebuilder-api.md` — `@axe-core/playwright` API surface + common options

## Scripts

- _(none — classifier lives in `evals/axe-playwright/eval.test.ts`)_

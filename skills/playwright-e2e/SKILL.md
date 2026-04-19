---
name: playwright-e2e
description: >
  Write Playwright end-to-end tests following the official best-practices.
  Four rules: use web-first assertions (`expect(locator).toBeVisible()`,
  never `expect(await locator.isVisible()).toBe(true)`), use semantic
  locators (`getByRole` / `getByLabel` / `getByText`, never `.class`
  or `#id` CSS), no hardcoded waits (`page.waitForTimeout(N)` is banned),
  no committed `test.only`. Flags the four corresponding violations.
  Use when: writing a new Playwright test, reviewing a PR with e2e
  changes, investigating flaky CI, migrating from another e2e tool,
  "my test is flaky", "expect timed out waiting".
  Do NOT use for: unit / component tests (→ tdd-cycle), visual
  regression beyond the screenshot assertion (v0.2 candidate),
  accessibility auditing (axe-core patterns — v0.2 candidate).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: testing
  phase: verify
  type: procedural
  methodology_source:
    - name: "Playwright — Best Practices"
      authority: "Microsoft / Playwright team"
      url: "https://playwright.dev/docs/best-practices"
      version: "Playwright (latest stable, 2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "@playwright/test@1.48+"
    - "next@15+ App Router"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T12:45:01.473Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four mechanical violations (hardcoded waits,
    CSS/XPath locators, imperative assertions, committed test.only)
    detected by a deterministic classifier over .spec.ts fixtures.
---

# playwright-e2e

Encodes Playwright's "Best Practices" guidance for end-to-end tests on a Next.js 15 App Router stack. Four rules — web-first assertions, semantic locators, no hardcoded waits, no committed `.only` — each with a mechanical detection from the test file.

---

## Methodology Attribution

- **Primary:** Playwright — Best Practices
  - Source: [https://playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices)
  - Authority: Microsoft / Playwright team
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the four mechanical rules that produce flaky or fragile tests if broken. NOT encoded: test-design decisions (what to cover, when a feature is "done"), accessibility auditing (a v0.2 `axe-playwright` skill will cover `axe-core` scans), visual regression (a v0.2 `visual-regression` skill will cover per-page snapshots), network mocking strategy (context-specific judgment).

---

## Stack Assumptions

- `@playwright/test@1.48+`
- `next@15+` App Router (dev server or preview for tests)
- `bun@1.1+`

If your stack is older Playwright (pre-1.27 locators API), fork the suite — the API shapes differ.

---

## When to Use

Activate when any of the following is true:
- Writing a new `*.spec.ts` Playwright test
- Reviewing a PR that changes e2e tests
- Investigating flaky CI from Playwright runs
- Migrating from Cypress / Selenium to Playwright
- "My test keeps timing out" / "my test is flaky"

## When NOT to Use

Do NOT activate for:
- **Unit / component tests** — `tdd-cycle`.
- **Accessibility scanning** — v0.2 candidate `axe-playwright` skill.
- **Visual regression** — v0.2 candidate `visual-regression` skill.
- **CI wiring** — `ci-cd-next-on-vercel` (when built).

---

## Procedure

### Step 1 — Use web-first assertions (auto-waiting)

Playwright's `expect(locator)` assertions auto-wait up to `expect.timeout` for the condition to be met:

```ts
// RIGHT
await expect(page.getByRole('alert')).toBeVisible();
await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
await expect(page.getByRole('heading')).toHaveText('Welcome');
```

Do NOT call the query method imperatively and then assert on the raw value — that captures a single-point-in-time read and does not retry:

```ts
// WRONG — no auto-wait, flaky on any async update
expect(await page.getByRole('alert').isVisible()).toBe(true);
expect(await page.locator('h1').textContent()).toBe('Welcome');
```

### Step 2 — Use semantic locators

Prefer locators that encode the element's user-visible role / label / text:

```ts
// RIGHT — resilient to markup changes
page.getByRole('button', { name: 'Sign in' });
page.getByLabel('Email');
page.getByText('Welcome back');
page.getByPlaceholder('you@example.com');
page.getByTestId('settings-trigger');  // last resort, when semantics are missing
```

Do NOT use raw CSS / XPath selectors as the primary locator:

```ts
// WRONG — breaks when the class name changes, ships fragile tests
page.locator('.signin-btn');
page.locator('#email');
page.locator('button.primary[data-v-abc123]');
page.locator('xpath=//button[@class="signin"]');
page.click('.signin-btn');
```

`getByTestId` is the escape hatch when no semantic is available. Prefer role-based locators — they also double as accessibility coverage.

### Step 3 — No hardcoded waits

`page.waitForTimeout(N)` is banned. It's both slow (waits the full N even when ready earlier) and flaky (the element may not be ready at N ms):

```ts
// WRONG
await page.goto('/dashboard');
await page.waitForTimeout(2000);           // hope dashboard is ready
await page.getByRole('button').click();

// RIGHT — the locator auto-waits for the button to be actionable
await page.goto('/dashboard');
await page.getByRole('button', { name: 'New' }).click();
```

If you genuinely need to wait for a specific network response:

```ts
// RIGHT — wait for the specific request
await page.waitForResponse('**/api/posts');
```

`setTimeout` inside a test body is similarly banned.

### Step 4 — No committed `test.only`

`.only` is for local work. Committing it causes the CI suite to run only that test, silently skipping every other test:

```ts
// WRONG — if this lands on main, CI green-lights a half-tested PR
test.only('signup flow', async ({ page }) => {
  // ...
});
test.describe.only('admin', () => {
  // ...
});
```

Use a pre-commit grep or a CI check (`grep -RE "test\.only|describe\.only" tests/ && exit 1`) to catch these at the boundary.

---

## Tool Integration

**`playwright.config.ts` (canonical):**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // CI refuses .only
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

`forbidOnly: !!process.env.CI` is the config-level equivalent of Step 4 — CI fails the run if any `.only` is present.

**Canonical test:**

```ts
import { test, expect } from '@playwright/test';

test('user can sign up', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});
```

---

## Examples

### Example 1 — Hardcoded wait (`hardcoded-wait`)

**Input:** `await page.waitForTimeout(3000);` after a navigation, before asserting a button is visible.

**Output:** delete the timeout. The locator assertion (`await expect(page.getByRole('button')).toBeVisible();`) auto-waits. If you need to wait for a specific network response, `page.waitForResponse(...)` is the correct tool.

### Example 2 — CSS locator (`css-selector-locator`)

**Input:** `page.locator('.signin-btn').click();`.

**Output:** replace with `page.getByRole('button', { name: 'Sign in' }).click();`. The test becomes resilient to class renames and covers the accessible name too.

### Example 3 — Imperative assertion (`imperative-assertion`)

**Input:** `expect(await page.locator('h1').textContent()).toBe('Welcome');`.

**Output:** `await expect(page.getByRole('heading')).toHaveText('Welcome');`. The web-first assertion auto-waits; the imperative form takes a single snapshot and fails if the text isn't there at that microsecond.

### Example 4 — Committed `.only` (`test-only-committed`)

**Input:** `test.only('the one I care about', …)` committed to the repo.

**Output:** delete the `.only`. Optionally, add `grep -RE "test\.only|describe\.only" tests/` to the pre-commit hook and `forbidOnly: !!process.env.CI` to `playwright.config.ts`.

---

## Edge Cases

- **`page.waitForLoadState('networkidle')`** — allowed but fragile for apps with long-polling / SSE. Prefer waiting for a specific locator or response.
- **`page.waitForResponse`** — not banned; it waits on an observable signal, unlike `waitForTimeout`.
- **`getByTestId`** — permitted when no semantic alternative exists (e.g., a graphic canvas with no role). Document why in a comment.
- **Intentional `test.skip`** — not a violation. A skipped test with an inline reference to an issue tracker is a legitimate "known-broken, tracked" marker.
- **Serial tests** — `test.describe.configure({ mode: 'serial' })` is sometimes necessary (auth flow → dependent test). Not a violation of this skill; just a parallelism trade-off.

---

## Evaluation

See `/evals/playwright-e2e/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

No LLM-as-judge half for v0.1. A v0.2 `test-design-quality` rubric would judge whether a test's assertions are meaningful (not just "page loaded").

---

## Handoffs

- **Unit / component test design** → `tdd-cycle`
- **Accessibility scanning** → v0.2 candidate `axe-playwright` skill
- **Visual regression** → v0.2 candidate `visual-regression` skill
- **CI wiring** → `ci-cd-next-on-vercel` (when built)

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, `@playwright/test@1.48+`

---

## References

- `references/web-first-assertions.md` — full list of web-first assertion methods and their imperative anti-patterns
- `references/violation-classes.md` — four-class taxonomy with canonical examples

## Scripts

- _(none in v0.1 — eval ships the classifier; a codemod from CSS locators to `getByRole` is a v0.2 candidate, gated on Playwright's `codegen` maturity)_

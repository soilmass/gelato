# Four violation classes

A fixture that triggers none is `safe`.

## 1. `hardcoded-wait`

**Signal:** `page.waitForTimeout(` or `setTimeout(` inside a test body.

**Canonical example:**

```ts
test('dashboard loads', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForTimeout(3000);
  await expect(page.getByRole('heading')).toBeVisible();
});
```

**Remediation:** delete the timeout. `expect(locator).toBeVisible()` auto-waits. For specific network events use `page.waitForResponse` or `page.waitForURL`.

## 2. `css-selector-locator`

**Signal:** `page.locator('.foo')`, `page.locator('#foo')`, `page.locator('[attr=…]')`, `page.click('.foo')`, `page.locator('xpath=…')` — i.e. `locator()` called with a CSS selector (class, id, attribute-only) or an XPath expression.

**Canonical example:**

```ts
await page.locator('.signin-btn').click();
await expect(page.locator('#welcome')).toBeVisible();
```

**Remediation:** `page.getByRole('button', { name: 'Sign in' })`, `page.getByTestId('welcome')`, `page.getByLabel(...)`, etc.

## 3. `imperative-assertion`

**Signal:** `expect(await <locator>.isVisible()).toBe(…)` / `.isHidden` / `.isEnabled` / `.isDisabled` / `.isChecked` / `.textContent()` / `.inputValue()` / `.getAttribute(...)` / `.count()` with `toBe`/`toEqual`.

**Canonical example:**

```ts
expect(await page.locator('h1').textContent()).toBe('Welcome');
expect(await page.getByRole('alert').isVisible()).toBe(true);
```

**Remediation:** `await expect(page.getByRole('heading')).toHaveText('Welcome');` / `await expect(page.getByRole('alert')).toBeVisible();`.

## 4. `test-only-committed`

**Signal:** `test.only(` or `test.describe.only(` in committed source.

**Canonical example:**

```ts
test.only('flaky test I want to isolate', async ({ page }) => {
  // ...
});
```

**Remediation:** delete the `.only`. Configure `forbidOnly: !!process.env.CI` so the suite fails fast in CI if an `.only` slips through.

## Why exactly four

Every Playwright-docs "Best Practices" rule maps to one of these four when it's mechanically detectable. Rules that require runtime observation (e.g. "test is isolated and can run in parallel") are deferred to a v0.2 LLM rubric. Test-design quality, accessibility coverage, and visual regression are also out of scope.

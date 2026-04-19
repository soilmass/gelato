# Web-first assertions cheat-sheet

Every Playwright assertion in the left column auto-waits (up to `expect.timeout`, default 5s). The right column is the imperative anti-pattern — single-point-in-time, no retry, flaky.

| Web-first (good) | Imperative (bad) |
|---|---|
| `await expect(locator).toBeVisible()` | `expect(await locator.isVisible()).toBe(true)` |
| `await expect(locator).toBeHidden()` | `expect(await locator.isHidden()).toBe(true)` |
| `await expect(locator).toBeEnabled()` | `expect(await locator.isEnabled()).toBe(true)` |
| `await expect(locator).toBeDisabled()` | `expect(await locator.isDisabled()).toBe(true)` |
| `await expect(locator).toBeChecked()` | `expect(await locator.isChecked()).toBe(true)` |
| `await expect(locator).toHaveText('…')` | `expect(await locator.textContent()).toBe('…')` |
| `await expect(locator).toHaveValue('…')` | `expect(await locator.inputValue()).toBe('…')` |
| `await expect(locator).toHaveAttribute('k', 'v')` | `expect(await locator.getAttribute('k')).toBe('v')` |
| `await expect(locator).toHaveClass(/regex/)` | `expect(await locator.getAttribute('class')).toMatch(/regex/)` |
| `await expect(locator).toHaveCount(3)` | `expect(await locator.count()).toBe(3)` |
| `await expect(page).toHaveURL('/dashboard')` | `expect(page.url()).toBe('http://…/dashboard')` |
| `await expect(page).toHaveTitle('…')` | `expect(await page.title()).toBe('…')` |

## Why it matters

Server-rendered React UIs update asynchronously (hydration, client-side navigations, Suspense boundaries, optimistic updates). Every state transition is a few frames. A single-point-in-time assertion happens to pass when the timing is right and fails otherwise — you get green locally, red in CI, nobody knows why.

Web-first assertions poll at `expect.pollingInterval` (default 100ms) up to `expect.timeout` and succeed the moment the condition is met. A passing test means "the condition was true within the timeout" — a much stronger statement.

## When NOT to use web-first

You have an existing snapshot and are performing a diff over its shape (e.g. `expect(await page.locator('.row').allTextContents()).toEqual(['a', 'b'])`). The auto-waiting form is `toHaveText([...])` passed an array of expected texts on a locator that resolves to multiple elements — use that when possible.

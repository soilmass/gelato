# playwright-e2e eval

Proves the four Playwright "Best Practices" violations are mechanically enforceable against `*.spec.ts` fixtures.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **test-only-committed** — `test.only(` or `test.describe.only(` after comment-stripping.
2. **hardcoded-wait** — `page.waitForTimeout(` or `setTimeout(` in the test file.
3. **css-selector-locator** — `.locator('.foo')`, `'#id'`, `'[attr=…]'`, `'xpath=…'`, or any selector containing a CSS combinator (space, `>`, `+`, `~`).
4. **imperative-assertion** — `expect(await <x>.isVisible()).toBe(…)` / `textContent` / `inputValue` / `getAttribute` / `count` / `isHidden` / `isEnabled` / `isDisabled` / `isChecked`.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 `page.waitForResponse(...)` — an observable signal, not a hardcoded wait
- 02 `getByTestId` — the sanctioned fallback, not a CSS selector
- 03 `expect(response.ok()).toBe(true)` — assertion on a plain request value, not a Locator
- 04 `test.only` in a comment — classifier strips comments first
- 05 `.locator('li > .unread-indicator')` — nested CSS combinator still flagged
- 06 `.getByRole(...).locator('input')`-style scoping via `modal.getByRole(...)` — semantic chain, safe

## Running

```bash
bun run eval playwright-e2e
```

~70 ms. No env, no browser, no API keys.

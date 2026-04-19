---
name: tdd-cycle
description: >
  Write Vitest unit / integration tests aligned with Kent C. Dodds'
  Testing Trophy and testing-library guiding principles: test
  behavior, not implementation details. Four deterministic
  violations: tests with no assertion, tests that access private
  internals (`_foo`, `.prototype`, `__`), Enzyme-style shallow
  rendering (`shallow(`, `.state()`, `.instance()`), and skipped
  tests with no reason / issue link. Procedural skill over red-
  green-refactor loops.
  Use when: writing a new Vitest test, reviewing a PR that adds
  tests, investigating "tests pass but the feature is broken",
  migrating off Enzyme or Jest, teaching TDD to a team.
  Do NOT use for: Playwright end-to-end tests (→ playwright-e2e),
  visual regression (v0.2 candidate), accessibility testing (v0.2
  candidate `axe-playwright`).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: testing
  phase: verify
  type: procedural
  methodology_source:
    - name: "Kent C. Dodds — Testing Trophy and classifications"
      authority: "Kent C. Dodds"
      url: "https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications"
      version: "Original 2018, updated 2023"
      verified: "2026-04-18"
    - name: "Testing Library — Guiding Principles"
      authority: "Kent C. Dodds / Testing Library team"
      url: "https://testing-library.com/docs/guiding-principles"
      version: "testing-library current docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "vitest@2+"
    - "@testing-library/react@16+"
    - "@testing-library/jest-dom@6+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.240Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four mechanical violations (no assertion,
    implementation-detail coupling, shallow / Enzyme patterns,
    skipped without reason) detected by a deterministic classifier
    over *.test.ts fixtures. Fuzzy "test quality" rubric deferred
    to a v0.2 LLM judge.
---

# tdd-cycle

Encodes Kent C. Dodds' Testing Trophy guidance + testing-library principles for Vitest tests on a Next.js 15 / React 19 stack. Four rules — every test asserts something, tests exercise public API not internals, no Enzyme-style shallow rendering, no skipped tests without a written reason. Procedural skill over the red-green-refactor loop.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Kent C. Dodds — Testing Trophy and classifications
  - Source: [https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
  - Authority: Kent C. Dodds
  - Verified: 2026-04-18
- **Secondary:** Testing Library — Guiding Principles
  - Source: [https://testing-library.com/docs/guiding-principles](https://testing-library.com/docs/guiding-principles)
  - Authority: Kent C. Dodds / Testing Library team
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the four mechanically detectable anti-patterns that fail the "test behavior, not implementation" principle. NOT encoded: test-quality judgments (is this test *meaningful*?), arrange-act-assert structure, mock strategy (context-specific), coverage %. A v0.2 `test-meaningfulness` LLM rubric will attempt the fuzzy half.

---

## Stack Assumptions

- `vitest@2+`
- `@testing-library/react@16+`
- `@testing-library/jest-dom@6+`
- `bun@1.1+`

If your stack is Jest + Enzyme, fork the suite — the "Enzyme patterns" violation is specifically designed to flag that stack.

---

## When to Use

Activate when any of the following is true:
- Writing a new Vitest test file
- Reviewing a PR that adds or modifies tests
- "Our tests pass but the feature still breaks in production"
- Migrating off Enzyme / Jest to testing-library / Vitest
- Teaching TDD to a new teammate

## When NOT to Use

Do NOT activate for:
- **End-to-end tests** — `playwright-e2e`.
- **Visual regression** — v0.2 candidate `visual-regression` skill.
- **Accessibility scanning** — v0.2 candidate `axe-playwright` skill.
- **Coverage thresholds** — coverage-gating is a CI concern, not a test-design concern.

---

## Procedure

### Step 1 — Red: write a failing test first

```ts
// src/lib/slug.test.ts
import { describe, it, expect } from 'vitest';
import { toSlug } from './slug';

describe('toSlug', () => {
  it('lowercases and hyphenates a title', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });
});
```

Run `bun run test` — the test fails because `toSlug` doesn't exist yet. That's the RED step. It proves the test actually exercises the code; if it passes before you write the implementation, the test isn't wired correctly.

### Step 2 — Green: minimal implementation

```ts
// src/lib/slug.ts
export function toSlug(input: string): string {
  return input.toLowerCase().split(' ').join('-');
}
```

Just enough to turn the test green. Do not over-engineer.

### Step 3 — Refactor: improve without changing behavior

```ts
export function toSlug(input: string): string {
  return input.toLowerCase().replace(/\s+/g, '-');
}
```

Test still green. Clean up and commit.

### Step 4 — Test behavior, not internals

```ts
// RIGHT — asserts what the user of the API sees
expect(toSlug('Hello World')).toBe('hello-world');

// RIGHT (component level) — asserts rendered output
render(<PostList posts={fixture} />);
expect(screen.getByRole('list')).toBeInTheDocument();
expect(screen.getAllByRole('listitem')).toHaveLength(3);

// WRONG — asserts internal state
expect(toSlug._normalizeSpaces).toHaveBeenCalled();
expect(wrapper.state().posts).toHaveLength(3);
expect(wrapper.instance()._load).toHaveBeenCalled();
```

The tests that survive a refactor are the ones that target the public API surface. Tests that inspect `_private`, `.prototype`, `.state()`, or `.instance()` tie themselves to implementation details and must be rewritten every time internals shift.

### Step 5 — Every test asserts something

An `it(...)` with no `expect(...)` passes trivially — it's a false sense of coverage. At least one `expect(...)` per test.

```ts
// WRONG — always passes, tests nothing
it('renders', () => {
  render(<Button>Click</Button>);
});

// RIGHT
it('renders with the given label', () => {
  render(<Button>Click</Button>);
  expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
});
```

### Step 6 — Skipped tests need a written reason

```ts
// RIGHT — skipped with a tracker link
it.skip('handles Unicode slugs — see #1234', () => {
  expect(toSlug('héllo wörld')).toBe('hello-world');
});

// WRONG — silently skipped, no reason
it.skip('flaky thing', () => { /* ... */ });
```

A `.skip` without a reason (inline comment or name referencing an issue tracker) rots; a year later nobody knows why it's skipped.

### Step 7 — No Enzyme-style shallow rendering or instance introspection

testing-library renders the real DOM and asserts against what a user sees. Enzyme's `shallow(...)`, `.state()`, `.instance()`, `.props()` APIs are anti-patterns in this stack:

```ts
// WRONG — Enzyme-style shallow + instance access
const wrapper = shallow(<PostList />);
expect(wrapper.state('posts')).toHaveLength(3);
wrapper.instance().load();

// RIGHT — testing-library
render(<PostList />);
await screen.findByRole('list');
expect(screen.getAllByRole('listitem')).toHaveLength(3);
```

---

## Tool Integration

**Canonical `vitest.config.ts`:**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
});
```

**Canonical `test/setup.ts`:**

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

---

## Examples

### Example 1 — Test with no assertion (`no-assertion`)

**Input:** `it('renders', () => { render(<Button>Click</Button>); });` — no `expect(...)`.

**Output:** add at least one assertion: `expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();`. An empty test is not coverage; it's tooling for a missing test.

### Example 2 — Testing an implementation detail (`testing-implementation-detail`)

**Input:** `expect(normalize._splitWords).toHaveBeenCalledWith('foo bar');` — asserts on a private helper.

**Output:** delete the assertion and test the public API (`expect(normalize('foo bar')).toBe('foo-bar');`). The private helper's existence is an implementation choice; refactoring it shouldn't break the test.

### Example 3 — Enzyme-style pattern (`shallow-or-enzyme`)

**Input:** `const wrapper = shallow(<PostList />); expect(wrapper.state('posts')).toHaveLength(3);`.

**Output:** swap to `render()` from testing-library and assert against rendered output: `render(<PostList />); expect(screen.getAllByRole('listitem')).toHaveLength(3);`.

### Example 4 — Skip without reason (`skipped-no-reason`)

**Input:** `it.skip('bug', async () => { /* ... */ });`.

**Output:** either fix the test and un-skip, or replace with `it.skip('bug — see #2345', ...)`. A skip with a tracker link is a promise; a bare skip is technical debt.

---

## Edge Cases

- **Snapshot tests** — useful for preserving intentional output, but overuse leads to "accept all" updates. Prefer explicit assertions where practical.
- **Testing Trophy ratios** — the trophy prescribes many integration, some unit, few e2e. This skill enforces shape, not counts; a team imbalance is a judgment call.
- **Mocks** — mocking is not a violation per se. Mocking the unit under test (or so much of its inputs that the test is tautological) is. The v0.2 `test-meaningfulness` rubric will attempt this.
- **Legacy Jest test files** — this skill's fixtures are Vitest-shaped; the same patterns apply to Jest tests and the classifier detects both.

---

## Evaluation

See `/evals/tdd-cycle/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

The roadmap flagged this skill as "fuzzy eval." v0.1 ships only the deterministic half — the fuzzy half (whether a passing assertion is *meaningful*) is intentionally deferred to a v0.2 LLM rubric.

---

## Handoffs

- **End-to-end tests** → `playwright-e2e`
- **Visual regression** → v0.2 candidate `visual-regression` skill
- **Accessibility** → v0.2 candidate `axe-playwright` skill

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Vitest, `@testing-library/react`, `@testing-library/jest-dom`

---

## References

- `references/testing-trophy.md` — the Testing Trophy levels + what belongs where
- `references/violation-classes.md` — four-class taxonomy with canonical examples

## Scripts

- _(none in v0.1 — eval ships the classifier; a codemod from Enzyme to testing-library is a v0.2 candidate)_

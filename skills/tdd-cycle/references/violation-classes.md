# Four violation classes

A fixture that triggers none is `safe`.

## 1. `no-assertion`

**Signal:** an `it(...)` or `test(...)` body contains no `expect(` call.

**Canonical example:**

```ts
it('renders', () => {
  render(<Button>Click</Button>);
});
```

**Remediation:** add at least one assertion that exercises the public API:

```ts
it('renders with the given label', () => {
  render(<Button>Click</Button>);
  expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
});
```

## 2. `testing-implementation-detail`

**Signal:** the test accesses an underscore-prefixed name on an imported symbol (`toSlug._splitWords`, `module.__private`), or references `.prototype` on the unit under test, or spies on a private helper via `vi.spyOn(module, '_helper')`.

**Canonical example:**

```ts
import * as normalize from './normalize';
it('splits words before hyphenating', () => {
  const spy = vi.spyOn(normalize, '_splitWords');
  normalize.toSlug('foo bar');
  expect(spy).toHaveBeenCalledWith('foo bar');
});
```

**Remediation:** test through the public API:

```ts
it('slug is hyphenated', () => {
  expect(normalize.toSlug('foo bar')).toBe('foo-bar');
});
```

## 3. `shallow-or-enzyme`

**Signal:** calls `shallow(...)` (Enzyme) OR `.state(`, `.instance(`, `.props(` on a rendered wrapper (Enzyme chain).

**Canonical example:**

```ts
import { shallow } from 'enzyme';
it('loads posts', () => {
  const wrapper = shallow(<PostList />);
  expect(wrapper.state('posts')).toHaveLength(3);
});
```

**Remediation:** render with testing-library and assert on output:

```ts
import { render, screen } from '@testing-library/react';
it('loads posts', async () => {
  render(<PostList />);
  await screen.findByRole('list');
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});
```

## 4. `skipped-no-reason`

**Signal:** `it.skip(` / `test.skip(` / `describe.skip(` AND no adjacent comment mentioning a reason (e.g., `#1234`, "flaky because…", "TODO"). Bare skips rot.

**Canonical example:**

```ts
it.skip('flaky', () => {
  expect(something).toBe(true);
});
```

**Remediation:** either fix and un-skip, or add a reason that references a tracker / doc:

```ts
// See issue #1234 — Unicode normalization edge case.
it.skip('handles héllo → hello — see #1234', () => {
  expect(toSlug('héllo')).toBe('hello');
});
```

## Why exactly four

These are the four patterns Kent's "Testing Trophy" / testing-library principles deem anti-patterns that are detectable from the test file alone, without running the tests. Test-meaningfulness, over-mocking, mock-the-unit-under-test, and "is the integration level thick enough?" are fuzzier and land in the v0.2 LLM rubric.

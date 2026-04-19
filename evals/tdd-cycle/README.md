# tdd-cycle eval

Proves the four Testing-Trophy / testing-library anti-patterns are mechanically enforceable from Vitest test-file text.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **shallow-or-enzyme** — import from `enzyme`, call to `shallow(` or `mount(`, or `.state(` / `.instance(` method call.
2. **testing-implementation-detail** — `.prototype` access, `.__dunder` access, or `vi.spyOn(x, '_private')` (underscore-prefixed method name).
3. **skipped-no-reason** — `.skip(` with no adjacent issue marker (`#N`, TODO, FIXME, NOTE, "see", "waiting on", "tracked in").
4. **no-assertion** — a top-level `it(…)` / `test(…)` whose callback body contains no `expect(`.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 `it.skip` with `// TODO: waiting on …` comment — classifier accepts TODO + "waiting on" markers
- 02 assertion inside a `waitFor` callback — classifier scans full callback contents
- 03 variable named `state` (not `.state()` method call) — distinguishes
- 04 local variable named `_result` (not private-field access) — distinguishes
- 05 `it.only(` present but not `.skip` — different anti-pattern, out of scope here
- 06 `test.skip` with issue reference in the NAME (`— see #4567`) — classifier accepts either location

## Roadmap note

The roadmap marked this skill "fuzzy eval" — the intuition was "test meaningfulness can't be tested with regex." v0.1 ships only the shape-level classifier; the meaningfulness rubric is a v0.2 LLM-as-judge candidate.

## Running

```bash
bun run eval tdd-cycle
```

~70 ms. No env, no browser, no API keys.

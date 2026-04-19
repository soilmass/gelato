---
name: optimistic-ui-wiring
description: >
  Enforce React 19 `useOptimistic` wiring rules in client
  components. Four violation classes: `useOptimistic` used
  without wrapping updates in `useTransition` or a form action,
  `addOptimistic()` called in a fire-and-forget path (outside a
  transition or action), the reducer performing side effects
  (fetch, await, setState, side-effecting method calls), and
  direct mutation of the reducer's input (pushing to an array,
  assigning to an object) instead of returning a new value.
  Use when: adding optimistic UI to a mutation flow, reviewing
  a PR that uses `useOptimistic`, "my optimistic update flashes
  before the server response", "the UI reverts unexpectedly".
  Do NOT use for: Server Actions themselves (→
  form-with-server-action, server-actions-vs-api), Effects
  hygiene (→ effect-discipline), React Query Suspense mode, or
  third-party optimistic libraries.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: build
  type: procedural
  methodology_source:
    - name: "React 19 — useOptimistic"
      authority: "React team"
      url: "https://react.dev/reference/react/useOptimistic"
      version: "React 19 docs (2025)"
      verified: "2026-04-19"
    - name: "React 19 — useTransition"
      authority: "React team"
      url: "https://react.dev/reference/react/useTransition"
      version: "React 19 docs (2025)"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T15:02:51.081Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Four mechanical violation
    classes detected by a classifier over 'use client' files that
    import useOptimistic.
---

# optimistic-ui-wiring

Encodes the React 19 `useOptimistic` contract. Four rules that keep an optimistic UI from flickering or reverting unexpectedly.

---

## Methodology Attribution

- **Primary:** React 19 — `useOptimistic`
  - Source: [https://react.dev/reference/react/useOptimistic](https://react.dev/reference/react/useOptimistic)
  - Version: React 19 docs (2025)
  - Verified: 2026-04-19
- **Secondary:** React 19 — `useTransition`
  - Source: [https://react.dev/reference/react/useTransition](https://react.dev/reference/react/useTransition)
  - Version: React 19 docs (2025)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the four wiring rules from the React docs around how to call `addOptimistic`, what a valid reducer looks like, and where the transition boundary lives. NOT encoded: the UX design of the optimistic state, error-recovery after a failed server action (that's product-specific), when to reach for `useOptimistic` vs plain `useState` (judgment), Zustand or Valtio optimistic patterns.

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Adding `useOptimistic` to a mutation flow
- Reviewing a PR that introduces `useOptimistic`
- "My optimistic UI flashes before the server response"
- "The UI reverts unexpectedly after a successful action"

## When NOT to Use

Do NOT activate for:
- **Server Actions themselves** → `form-with-server-action`, `server-actions-vs-api`
- **Effect hygiene** → `effect-discipline`
- **Third-party optimistic libraries** (React Query, SWR, Zustand) — out of scope
- **`useTransition` outside `useOptimistic`** — covered transitively but the skill's rules target the optimistic wiring specifically

---

## Procedure

Classifier activates only when a file declares `'use client'` AND imports `useOptimistic` from `'react'` (`import { useOptimistic } from 'react'` or `import * as React from 'react'` with `React.useOptimistic` usage).

### Step 1 — Optimistic updates must happen inside a transition or form action

```tsx
// RIGHT — inside startTransition
const [isPending, startTransition] = useTransition();
const [optimisticTodos, addOptimistic] = useOptimistic(todos, reducer);

function handleAdd(newTodo: Todo) {
  startTransition(async () => {
    addOptimistic(newTodo);
    await createTodo(newTodo);
  });
}

// RIGHT — inside form action (Server Action form)
<form action={async (formData) => {
  const newTodo = parse(formData);
  addOptimistic(newTodo);
  await createTodo(newTodo);
}} />

// WRONG — addOptimistic called outside any transition/action
function handleAdd(newTodo: Todo) {
  addOptimistic(newTodo);
  createTodo(newTodo);
}
```

Rule: every `addOptimistic(` call site (using the identifier returned from `useOptimistic`) must be inside a `startTransition(...)` callback OR inside a `<form action={...}>` callback OR inside an `async` function body passed to `useActionState`.

### Step 2 — Don't call `addOptimistic` as fire-and-forget (no transition, no action)

This overlaps Step 1 but singles out the specific anti-pattern: calling `addOptimistic` in an event handler that is NOT wrapped in a transition. React 19 will warn at runtime; the skill catches it statically.

```tsx
// WRONG — event handler calls addOptimistic directly; no transition
<button onClick={() => addOptimistic(item)}>Add</button>

// RIGHT — wrap in startTransition
<button onClick={() => {
  startTransition(() => {
    addOptimistic(item);
  });
}}>Add</button>
```

### Step 3 — The reducer must be pure

```tsx
// RIGHT — pure reduction
function reducer(state: Todo[], optimisticValue: Todo): Todo[] {
  return [...state, { ...optimisticValue, pending: true }];
}

// WRONG — side effects inside the reducer
function reducer(state: Todo[], optimisticValue: Todo): Todo[] {
  fetch('/api/log', { method: 'POST', body: JSON.stringify(optimisticValue) });
  return [...state, optimisticValue];
}

// WRONG — await inside the reducer
async function reducer(state: Todo[], optimisticValue: Todo): Promise<Todo[]> {
  const enriched = await enrich(optimisticValue);
  return [...state, enriched];
}
```

Rule: the second argument to `useOptimistic(state, <reducer>)` — when the reducer is a named function or an inline function — must NOT contain `fetch(`, `await`, `setState`-style setter calls, `posthog.`, `sentry.`, `console.`, `logger.`, `new Date()`, or other side-effect tokens.

### Step 4 — The reducer must not mutate its input

```tsx
// RIGHT — returns a new array
function reducer(state: Todo[], optimisticValue: Todo): Todo[] {
  return [...state, optimisticValue];
}

// WRONG — mutates state
function reducer(state: Todo[], optimisticValue: Todo): Todo[] {
  state.push(optimisticValue);
  return state;
}

// WRONG — assigns to state object properties
function reducer(state: { todos: Todo[] }, optimisticValue: Todo): typeof state {
  state.todos.push(optimisticValue);
  return state;
}
```

Rule: the reducer body must not contain `state.push(`, `state.unshift(`, `state.splice(`, `state.pop(`, `state.shift(`, `state.sort(`, `state.reverse(`, `state[` assignment, or `state.<field> =` assignment. Return values should be constructed via spread / `.concat` / `.map` / `.filter`.

---

## Tool Integration

No shipped CLI. Classifier lives in the eval.

## Examples

### Example 1 — `useoptimistic-without-transition`

**Input:** `useOptimistic` is imported and `addOptimistic(item)` is called from an onClick handler without `startTransition`.
**Output:** React 19 warns at runtime; the update won't be treated as a transition and may not render consistently. Fix: wrap in `startTransition(() => addOptimistic(item))`, or — more idiomatically — submit the item via a Server Action form so React wraps the update automatically.

### Example 2 — `direct-mutation`

**Input:** reducer body contains `state.push(value)`.
**Output:** React reads the same reference back; it won't schedule a re-render reliably. Fix: `return [...state, value];` — a new array every time.

---

## Edge Cases

- **Custom hook wrapping `useOptimistic`:** `useOptimisticTodos()` that returns a `{ optimistic, add }` pair — the skill checks only the file where `useOptimistic(` is called. Downstream usage sites are not audited by this skill.
- **Naming other than `addOptimistic`:** the second element returned from `useOptimistic` can be any name. The classifier extracts the destructured name and checks its usage sites.
- **Inline reducer vs named function:** both forms are checked. Inline `(state, value) => [...state, value]` is read as the reducer when it's the second arg to `useOptimistic`.
- **`useActionState` wrapping:** `useActionState` already provides transition semantics; `addOptimistic` inside its action callback satisfies Step 1.
- **Multiple `useOptimistic` hooks in one component:** each is checked independently.

---

## Evaluation

See `/evals/optimistic-ui-wiring/`.

**Quantitative:** ≥4 violation fixtures at ≥95% accuracy, 0 false positives on ≥4 safe fixtures, held-out ≥90%.
**Qualitative:** Promptfoo rubric `optimistic-remediation-implementability` (≥0.85).

---

## Handoffs

- Server Actions mechanics → `form-with-server-action`
- Server-vs-handler routing → `server-actions-vs-api`
- Effect hygiene → `effect-discipline`
- Error recovery after a failed optimistic update → product UX (out of scope)

---

## Dependencies

- **External skills:** `form-with-server-action`, `server-actions-vs-api`, `effect-discipline`
- **MCP servers:** none
- **Tools required in environment:** none

---

## References

- `references/useoptimistic-contract.md` — React docs contract for useOptimistic + useTransition, the reducer purity requirement, and the "transition-or-action" wiring rule

## Scripts

- _(none)_

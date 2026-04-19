---
name: effect-discipline
description: >
  Enforce the "You Might Not Need an Effect" subset of React hooks
  hygiene on React 19 + Next.js 15 client components. Four
  mechanical anti-patterns detectable from a single .tsx file:
  `useState` initialized from a prop with no reset mechanism,
  `useEffect` whose only job is to compute a derived value (belongs
  as a `const` or `useMemo`), `setState` inside `useEffect` with no
  guard condition (infinite-loop risk), and `useEffect` whose body
  does only what a user-event handler should do.
  Use when: reviewing a client component PR that adds `useEffect`,
  investigating "my component loops", "state goes stale when a
  prop changes", or teaching React 19 idioms. Complements
  `eslint-plugin-react-hooks` which already enforces the
  rules-of-hooks + exhaustive-deps surface.
  Do NOT use for: rules-of-hooks enforcement (→
  eslint-plugin-react-hooks; already industry-standard), Server
  Components (they can't use these hooks anyway —
  rsc-boundary-audit), useOptimistic wiring (→ optimistic-ui-
  wiring), async event handlers.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: build
  type: procedural
  methodology_source:
    - name: "You Might Not Need an Effect"
      authority: "React team — Dan Abramov + Dmitry Savenkov"
      url: "https://react.dev/learn/you-might-not-need-an-effect"
      version: "react.dev (React 19 docs, 2025)"
      verified: "2026-04-19"
    - name: "React 19 — useEffect reference"
      authority: "React team"
      url: "https://react.dev/reference/react/useEffect"
      version: "React 19 docs (2025)"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.238Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Four mechanical violation
    classes detected by a classifier over client components.
    Activates only on files declaring 'use client' — Server
    Components can't use these hooks.
---

# effect-discipline

Encodes the mechanically detectable subset of the "You Might Not Need an Effect" essay from react.dev. Four rules that catch the most common `useEffect` misuses in React 19 client code. Complements `eslint-plugin-react-hooks` (which owns the rules-of-hooks and exhaustive-deps surfaces).

---

## Methodology Attribution

- **Primary:** You Might Not Need an Effect — react.dev
  - Source: [https://react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect)
  - Authority: React team (Dan Abramov + Dmitry Savenkov)
  - Version: react.dev (React 19 docs, 2025)
  - Verified: 2026-04-19
- **Secondary:** React 19 — `useEffect` reference
  - Source: [https://react.dev/reference/react/useEffect](https://react.dev/reference/react/useEffect)
  - Version: React 19 docs (2025)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the four anti-patterns from the essay that can be detected by a regex walk over a client component's hook calls. NOT encoded: rules-of-hooks (`eslint-plugin-react-hooks` is the industry standard — duplication avoided); exhaustive-deps analysis (same — the eslint rule's AST walk is more accurate than regex); cleanup correctness (needs semantic understanding of the subscription/resource being managed); SSR-vs-client rendering correctness (`rsc-boundary-audit`).

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Adding or reviewing a client component with `useEffect`
- A client component infinite-loops or re-renders unexpectedly
- "State goes stale when a prop changes"
- Teaching React idioms: "why can't I sync state to props?"

## When NOT to Use

Do NOT activate for:
- **Rules-of-hooks / exhaustive-deps** — `eslint-plugin-react-hooks` is the tool. Do NOT duplicate
- **Server Components** — can't use these hooks at all (`rsc-boundary-audit`)
- **`useOptimistic` wiring** — `optimistic-ui-wiring`
- **Async event handlers** — different surface; out of scope
- **Cleanup correctness** — needs semantic domain knowledge

---

## Procedure

Classifier activates only on files declaring `'use client'`. Server components fall through as `safe`.

### Step 1 — Don't `useState` from a prop without a reset mechanism

```tsx
// WRONG — state initialized once from the prop; never updates when
// the prop changes. Classic prop-to-state antipattern.
'use client';
function Form({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}

// RIGHT — use the prop directly (uncontrolled), or reset via key
<Form key={defaultName} defaultName={defaultName} />

// RIGHT — reset via useEffect with explicit intent
useEffect(() => { setName(defaultName); }, [defaultName]);
```

Rule: `useState(<prop-name>)` where the identifier passed to `useState` matches a parameter destructured from the component's props AND the file contains no `useEffect` that calls `setState` with the same prop is a violation.

### Step 2 — Don't `useEffect` + `setState` for a derived value

```tsx
// WRONG — derived value in a useEffect
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// RIGHT — const derivation (or useMemo if expensive)
const fullName = `${firstName} ${lastName}`;
```

Rule: `useEffect` whose body consists *only* of a single `setState(<expr>)` call, where `<expr>` references values the component already has access to, is a violation. The classifier flags when the effect has a dep array AND the effect body is a single setState AND the setState argument is a pure expression (no `await`, no `fetch`, no `new Xxx()`).

### Step 3 — Don't `setState` inside `useEffect` without a guard

```tsx
// WRONG — infinite loop; every render triggers the effect,
// every effect updates state, every update triggers a render
useEffect(() => {
  setCount(count + 1);
});

// WRONG — with deps but no condition; effect fires once,
// re-fires whenever `count` changes (which it does because of the
// effect itself)
useEffect(() => {
  setCount(count + 1);
}, [count]);

// RIGHT — guarded
useEffect(() => {
  if (count < 10) setCount(count + 1);
}, [count]);
```

Rule: `useEffect` whose body directly calls `setState` without an `if`/`switch`/`return` guard, where the setState value depends on existing state or the effect has no dep array, is flagged. Lenient: effects with no dep array are only flagged when the setState argument references state the effect itself will re-trigger on.

### Step 4 — Don't `useEffect` what an event handler should do

```tsx
// WRONG — after-submit side effects in an effect
const [submitted, setSubmitted] = useState(false);
useEffect(() => {
  if (submitted) {
    fetch('/api/analytics', { method: 'POST', body: JSON.stringify(data) });
    setSubmitted(false);
  }
}, [submitted]);

// RIGHT — do it in the handler
function handleSubmit(e: FormEvent) {
  e.preventDefault();
  fetch('/api/analytics', { method: 'POST', body: JSON.stringify(data) });
}
```

Rule: `useEffect` whose dep array contains a boolean-named state variable (`submitted`, `isSubmitting`, `confirmed`, `shouldFire`, etc.) AND whose body calls `fetch`/`sendBeacon`/posthog/sentry/log AND optionally resets the boolean back is flagged. The pattern is "effect re-emulates a handler"; the correct form puts the side-effect in the actual handler.

---

## Tool Integration

No shipped CLI. Classifier lives in the eval.

## Examples

### Example 1 — `state-from-prop-no-reset`

**Input:** `function Tag({ label }) { const [name, setName] = useState(label); … }` with no `useEffect` syncing `name` to `label`.
**Output:** when the parent re-renders with a new `label`, the child's `name` stays stale. Fix: either `<Tag key={label} label={label} />` at the callsite (resets component state), use `label` directly if no editing is needed, or add an explicit `useEffect(() => setName(label), [label])` with the intent documented.

### Example 2 — `effect-for-derived-value`

**Input:**

```tsx
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);
```

**Output:** derivation done in an effect runs a render cycle extra. Fix:

```tsx
const fullName = `${first} ${last}`;
```

as a `const`, or `useMemo` if the derivation is expensive.

---

## Edge Cases

- **External subscriptions:** `useEffect` setting up and tearing down a subscription (event listener, WebSocket, Redux store) is a legitimate pattern and is not flagged. The classifier looks for `addEventListener` / `subscribe(` / `new WebSocket` / `new EventSource` in the effect body to opt out of all four rules.
- **Effect-as-data-fetch with `AbortController`:** legitimate pattern (pre-`use(fetch())`); not flagged unless it overlaps one of the four rules.
- **Server-sync effects:** syncing a ref to the DOM via `useEffect` (focus management, scroll-restore) is not flagged — it's the intended use.
- **Higher-order hooks:** custom hooks (`useUser`, `useFormState`) that internally contain the anti-pattern aren't caught from their usage sites; the classifier flags the hook's definition file if it's in the repo.

---

## Evaluation

See `/evals/effect-discipline/`.

**Quantitative:** ≥4 violation fixtures at ≥95% accuracy, 0 false positives on ≥4 safe fixtures, held-out ≥90%.
**Qualitative:** Promptfoo rubric `refactor-to-derived-value-implementability` (≥0.85).

---

## Handoffs

- Rules-of-hooks / exhaustive-deps → `eslint-plugin-react-hooks` (not a Gelato skill)
- Server Components → `rsc-boundary-audit`
- useOptimistic → `optimistic-ui-wiring`
- Cleanup correctness → human review (out of scope)

---

## Dependencies

- **External skills:** `rsc-boundary-audit`, `optimistic-ui-wiring`
- **MCP servers:** none
- **Tools required in environment:** `eslint-plugin-react-hooks` is the companion industry-standard lint rule — encourage callers to wire it up. Does NOT ship with Gelato (out-of-manifest).

---

## References

- `references/you-might-not-need-an-effect.md` — condensed summary of the essay's four anti-patterns with the mechanical signals the classifier uses

## Scripts

- _(none)_

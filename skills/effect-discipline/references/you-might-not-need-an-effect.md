# "You Might Not Need an Effect" — the mechanical subset

The essay (react.dev) enumerates ~10 anti-patterns. This skill encodes the four that are mechanically detectable from a single client component without semantic understanding of the surrounding code. The remaining six live in human review.

| Class | Essay section | Mechanical signal | Recommended fix |
|---|---|---|---|
| `state-from-prop-no-reset` | "Updating state based on props or state" | `useState(<destructured prop>)` with no `useEffect(() => setX(prop), [prop])` syncing it | `<Child key={prop} />` OR use the prop directly |
| `effect-for-derived-value` | "Calculating derived data" | `useEffect` whose body is a single `setX(pureExpression)` with a dep array | `const derived = …` or `useMemo` |
| `setstate-in-effect-no-guard` | "Infinite loops" (implicit) | `useEffect` directly calling `setState` with no if/switch/return guard and a setState argument that self-references the state | Add a condition before setState |
| `effect-as-event-handler` | "Events vs effects" | `useEffect` deps include a boolean-named state + body does side effects (fetch/beacon/log) + resets the boolean | Move the side effect into the actual handler |

## The six rules the skill does NOT encode

1. **Chains of state updates** — needs multi-effect flow analysis
2. **Initializing app state** — distinguishing "bootstrap code" from "component lifecycle" is a context call
3. **Sending network requests on submit** — the classifier can't tell a submit handler from a mount effect reliably
4. **Application-wide event handlers** — setup patterns are legitimate; semantic judgment
5. **Chains of computations** — same as (1)
6. **Sharing logic between event handlers** — requires whole-component flow tracking

These six are left to reviewers armed with the essay itself.

## Why this skill doesn't encode rules-of-hooks

`eslint-plugin-react-hooks` (`react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`) is the industry-standard enforcement for:

- Hooks called at the top level (not inside `if`/`for`/`while`)
- Hooks called only from React functions or custom hooks
- Effect dependency arrays exhaustively listing referenced identifiers

These rules require real AST + control-flow analysis. A regex classifier would miss edge cases `eslint-plugin-react-hooks` catches trivially. The Gelato philosophy is to avoid duplicating what the existing lint rule already does well — so the four rules encoded here are a strict disjoint subset.

The companion recommendation: run `eslint-plugin-react-hooks` alongside this skill. They cover different surfaces.

## Mechanical signals the classifier uses

### `state-from-prop-no-reset`

Signal: `useState(<ident>)` where `<ident>` matches a destructured prop in the component's function signature. Exempt when a `useEffect(... , [<ident>])` also calls `setState` with that prop.

### `effect-for-derived-value`

Signal: `useEffect(() => { setX(<expr>) }, [...])` where the effect body is a single `setState` call AND `<expr>` is a pure expression (no `await`, no `fetch(`, no `new Something(`). Passed when the body contains other statements (suggests legitimate side effects).

### `setstate-in-effect-no-guard`

Signal: `useEffect(() => { setX(...) }, [...])` where the body has no `if`/`switch`/guarded early-return wrapping the `setState` call AND the setState argument references `x` itself. The "infinite loop" class per the essay.

### `effect-as-event-handler`

Signal: `useEffect(() => { ... })` whose dep array contains a boolean-looking identifier (`submitted`, `isDone`, `ready`, `confirmed`, `open`, `visible`, etc.) AND whose body calls a side-effecting API (`fetch`, `sendBeacon`, `posthog.capture`, `logger.*`). Exempt when the effect sets up a subscription (signal: `addEventListener`, `subscribe(`, `new WebSocket`, `new EventSource`).

## Exempt patterns

The classifier checks for exemption markers and short-circuits to `safe`:

- Subscription-teardown: body contains `addEventListener`/`subscribe(`/`new WebSocket`/`new EventSource` AND returns a cleanup function
- Ref-based DOM manipulation: body reads a ref (`ref.current`) and calls a DOM method
- Data fetching with `AbortController`: body creates a controller, passes it to `fetch`, and the cleanup aborts

Any of these exemption signals in an effect skips all four rules for that specific effect.

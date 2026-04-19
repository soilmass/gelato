---
name: rsc-boundary-audit
description: >
  Audit a Next.js App Router codebase for Server/Client Component boundary
  violations and produce a prioritized remediation plan ordered by measured
  bundle-size impact. Classifies violations into five classes: unnecessary
  `'use client'` directive, server-only imports inside a client component,
  non-serializable props across the boundary, barrel-file leakage that drags
  a large client tree into the bundle, and hydration-mismatch sources.
  Use when: auditing RSC boundaries, reviewing a PR that adds `'use client'`,
  "why is my bundle so big", unexpected hydration errors, serialization
  errors at the boundary, migrating from Pages Router to App Router,
  checking whether a component actually needs to be a client component,
  "can I make this a Server Component".
  Do NOT use for: general performance audits (→ core-web-vitals-audit),
  server-side data fetching patterns (→ rsc-data-fetching when built),
  form + server-action wiring (→ form-with-server-action when built),
  non-Next.js React apps.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: verify
  type: judgment
  methodology_source:
    - name: "Next.js App Router — Server Components"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/rendering/server-components"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
    - name: "React — 'use client' and 'use server' directives"
      authority: "React team"
      url: "https://react.dev/reference/rsc/use-client"
      version: "React 19 docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "typescript@5+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T10:52:56.292Z"
    n_cases: 5
  changelog: >
    v1.0 — initial. Judgment skill with no Hard Thresholds; procedure
    carries enforcement. Four-criterion decision tree for component
    classification and a five-class taxonomy for boundary violations.
    Eval has 23 labeled violations and 10 legitimate `'use client'` fixtures.
---

# rsc-boundary-audit

Encodes the Next.js App Router + React 19 guidance for Server/Client Component boundary decisions. Classifies violations against a four-criterion decision tree and a five-class taxonomy, and produces remediation plans ordered by measured bundle-size impact. Judgment skill — the procedure is the enforcement.

---

## Methodology Attribution

This skill encodes guidance from two primary sources:

- **Primary:** Next.js App Router — Server Components
  - Source: <https://nextjs.org/docs/app/building-your-application/rendering/server-components>
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Secondary:** React — `use client` / `use server` directives
  - Source: <https://react.dev/reference/rsc/use-client>
  - Version: React 19 docs (2025)
  - Verified: 2026-04-18
- **Drift-check:** `.github/workflows/drift-rsc-docs.yml`

Encoded: when a component *requires* `'use client'` (the four criteria), what crosses the Server/Client boundary (serialization rules for props), and the five named classes of violations the audit detects.

NOT encoded: Server Actions wire-up (that's `form-with-server-action`), data-fetching patterns across Server/Client (that's `rsc-data-fetching`), general React render performance (that's `core-web-vitals-audit`'s bundle-size lever). The three are coupled but owned by separate skills.

---

## Stack Assumptions

- `next@15+` App Router (the `app/` directory, not `pages/`)
- `react@19+` (full RSC and `'use server'` support)
- `typescript@5+`

If your stack differs, fork the suite. This skill does not accept configuration flags.

---

## When to Use

Activate when any of the following is true:
- A PR adds or removes `'use client'`
- Bundle analyzer surfaces an unexpectedly large client bundle
- Runtime hydration-mismatch errors appear in Sentry or the console
- A serialization error fires at the boundary ("Objects are not valid as a React child", "function cannot be serialized")
- Migration from Pages Router to App Router
- A stakeholder asks "why is this a client component"

## When NOT to Use

Do NOT activate for:
- General performance audits — use `core-web-vitals-audit`
- Server-side data fetching patterns (cache keys, revalidate, fetch options) — use `rsc-data-fetching` (v0.2+)
- Form handling and Server Actions — use `form-with-server-action` (v0.2+)
- Non-Next.js React apps — the skill assumes App Router semantics

---

## Procedure

Judgment skills have no Hard Thresholds — the procedure carries the enforcement weight. Follow every step; do not shortcut.

### Step 1 — Inventory every `.tsx` file and its directive state

Walk `app/`, `components/`, and any shared UI package. For each file record:

- **path** (project-relative)
- **directive** — `'use client'`, `'use server'`, or none
- **imports** — full list (raw module specifiers — matters for class detection in Step 2)
- **hooks** — which React hooks appear (`useState`, `useEffect`, etc.)
- **event handlers** — `onClick`, `onChange`, `onSubmit`, `on*`
- **browser API references** — `window`, `document`, `localStorage`, `navigator`
- **rendered children** — which other components are rendered (for boundary detection)

`grep -rln "use client" app/ components/` gives a fast first pass. For full inventory use the audit's scanner (which statically parses each file).

### Step 2 — Classify each component against the four-criterion decision tree

A component **requires** `'use client'` if and only if at least one of the following is true:

1. **Interactivity.** Handles user events directly: `onClick`, `onChange`, `onInput`, `onSubmit` (with client state, not a Server Action), keyboard, drag, pointer events.
2. **Browser APIs.** References globals that only exist at runtime in the browser: `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `DOMParser`, `IntersectionObserver`, `ResizeObserver`, `matchMedia`.
3. **Client-only React hooks.** `useState`, `useEffect`, `useLayoutEffect`, `useReducer`, `useRef`, `useSyncExternalStore`, `useTransition`, `useDeferredValue`, and — when they depend on client-side state — `useMemo` / `useCallback`.
4. **Client-only context consumption.** Reads a `React.Context` whose Provider lives in a client component. Common providers: theme stores, session state, motion libraries, form libraries.

**If NONE of the four apply, the `'use client'` directive is unnecessary.** A child component's client status does not propagate up — a server component may freely render a client component without itself becoming one.

### Step 3 — Detect serialization violations at the boundary

Props that cross the server→client boundary must be serializable to the RSC wire format. **Not serializable:**

- **Functions / handlers** (except Server Actions, which are specially tagged by Next at the `'use server'` boundary)
- **Classes / class instances** (unless the author writes a serializer)
- **`Date` objects** — pass ISO strings; hydrate to `Date` in the client if needed
- **`Map` / `Set`** — convert to plain arrays or objects
- **Non-plain objects** — `Request`, `Response`, `URL`, `FormData`, library instances with non-enumerable state
- **Circular references** — the serializer throws

A prop that violates these rules surfaces as a hydration error or a runtime panic. The skill flags these as the **`non-serializable-prop`** violation class.

### Step 4 — Produce a remediation plan ordered by impact

Order recommended fixes by **bundle-size leverage**, not alphabetically and not by file path. The canonical class-priority order (enforced by the v0.1 eval) is:

1. **`unnecessary-directive`** removals on heavily-imported wrappers — cheap fix, large win.
2. **`barrel-import-leakage`** — breaking a leaf import so the rest of the barrel no longer reaches the client tree.
3. **`server-only-import-in-client`** — usually a symptom of misplaced directive; often collapses into an `unnecessary-directive` fix.
4. **`non-serializable-prop`** — a boundary-shape change; more intrusive, usually smaller bundle win.
5. **`hydration-mismatch-source`** — defensive fixes; rarely cut bytes but unblock production.

**v0.1 eval scope:** the eval asserts class-priority ordering only. **Per-fixture measured bundle impact** (via `@next/bundle-analyzer` summing transitive weight of each client-tagged component) is a v0.2 refinement — landed as `feat(rsc-boundary-audit): bundle-impact measurement` alongside the ts-morph classifier upgrade. Until then, class priority is the enforced proxy; real projects should still measure their top-three offenders by hand with the analyzer before committing the remediation plan.

### Step 5 — Verify fixes do not break runtime

After each fix, spawn the fixture test (or a focused route test in the real app) and hit the affected route. Hydration mismatches and serialization errors surface at **runtime**, not at build time. A change that silences a warning but breaks hydration is worse than the original.

The eval enforces this: for each violation fixture, applying the recommended fix must not break the fixture's runtime assertion.

---

## Tool Integration

**Scanner invocation (the skill's Step 1 tool — v0.2 candidate, not yet shipped):**

```bash
# v0.2 candidate — the shipped v0.2.0 eval carries the deterministic classifier;
# a packaged CLI is scoped for the next release.
bun run rsc-audit              # walks app/ + components/, writes audit-report.json
bun run rsc-audit --fix        # writes a remediation patchset to audit-fixes.diff
```

**`@next/bundle-analyzer` for Step 4 measurements:**

```ts
// next.config.ts
import { withBundleAnalyzer } from '@next/bundle-analyzer';
export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})({});
```

```bash
ANALYZE=true bun run build
```

**Minimal safe-to-copy lint for "barrel-import-leakage"** (use as a hint, not a hard rule):

```json
{
  "name": "no-barrel-from-client",
  "severity": "warn",
  "match": {
    "directive": "'use client'",
    "imports": ["^@/components$", "^@/lib$"]
  }
}
```

---

## Examples

### Example 1 — `'use client'` on a purely-presentational card (`unnecessary-directive`)

**Input:**

```tsx
'use client';

export default function UserCard({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div>
      <img src={avatar} alt="" />
      <span>{name}</span>
    </div>
  );
}
```

**Output:** none of the four criteria apply. Remove `'use client'`. This component becomes a Server Component and drops its share of the client bundle.

### Example 2 — Server component passing a `Date` to a client child (`non-serializable-prop`)

**Input:**

```tsx
// app/page.tsx (Server Component)
import DatePicker from './date-picker';

export default async function Page() {
  const initial = new Date();
  return <DatePicker initial={initial} />;  // Date is not serializable
}
```

**Output:** convert to ISO string at the boundary, re-hydrate inside the client:

```tsx
<DatePicker initialIso={initial.toISOString()} />

// client side:
const initial = new Date(initialIso);
```

### Example 3 — Client component importing `db` (`server-only-import-in-client`)

**Input:**

```tsx
'use client';
import { db } from '@/lib/db';

export default function Form() {
  const handle = async () => {
    const rows = await db.select().from(users);  // ships db client to browser!
    // ...
  };
  return <button onClick={handle}>Go</button>;
}
```

**Output:** wrong layer. Move the query into a Server Action, call it from the client:

```tsx
// app/actions.ts
'use server';
import { db } from '@/lib/db';
export async function listUsers() { return db.select().from(users); }

// client:
'use client';
import { listUsers } from './actions';
// ...
```

---

## Edge Cases

- **`'use client'` inherited from a wrapper:** a child of a client component is itself "rendered in a client context" but does not need its own `'use client'`. The directive marks the boundary, not the subtree.
- **Third-party libraries that ship their own `'use client'`:** cannot be changed from outside. The skill notes them in the report as "external client tree" but does not flag as violations.
- **Server Actions passed as props:** functions are normally not serializable, but Server Actions are — they carry a special tag. A `handleSubmit={serverAction}` prop is a legal boundary crossing; the skill does not flag it.
- **`typeof window !== 'undefined'` in a Server Component:** almost always a `hydration-mismatch-source` — the server always sees `window` as undefined, the client always as an object. The skill flags it.
- **Dynamic imports:** `dynamic(() => import('./thing'), { ssr: false })` is the App Router-compatible escape hatch when a component truly needs to be browser-only. Not a violation.

---

## Evaluation

See `/evals/rsc-boundary-audit/` for the canonical eval suite.

### Pass criteria

**Quantitative (deterministic classifier against labeled fixtures):**

- Classifies each of **23 labeled violations** into the correct class out of the five above at **≥ 95%** accuracy.
- **Zero false positives** on **10 legitimate-`'use client'` fixtures** (cases where the directive is correctly applied).
- Remediation plan for the 23 violations is ordered by computed bundle-size impact (highest first).

**Qualitative (LLM-as-judge via Promptfoo, gated on `ANTHROPIC_API_KEY`):**

- **implementability** rubric scores ≥ 0.8 — generated fix recommendations are implementable as-written without additional context.
- **groundedness** rubric scores ≥ 0.85 — generated examples reference the actual codebase vs. invented scenarios.

The qualitative half `describe.skipIf(!process.env.ANTHROPIC_API_KEY)`. CI runs it whenever the secret is set; local dev without a key still passes the quantitative half end-to-end.

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate` in the frontmatter above.

---

## Handoffs

This skill is scoped to Server/Client Component boundary classification and remediation. Explicitly NOT absorbed:

- **General bundle / perf budget audits** — use `core-web-vitals-audit` (bundle is a lever there; this skill surfaces the specific boundary cause)
- **Data fetching across Server/Client** — `rsc-data-fetching` (v0.2+)
- **Form + Server Action wiring** — `form-with-server-action` (v0.2+)
- **Server Actions vs API route design** — `server-actions-vs-api` (v0.2+)
- **Non-Next.js apps** — fork the suite

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, TypeScript 5+, `@next/bundle-analyzer` for Step 4 bundle-impact measurements

---

## References

- `references/four-criterion-decision-tree.md` — canonical criteria list, copy-paste ready
- `references/five-violation-classes.md` — detailed taxonomy with canonical examples per class

## Scripts

- _(none in v0.1 — the eval ships the deterministic classifier; a `bun run rsc-audit` CLI lands in v0.2)_

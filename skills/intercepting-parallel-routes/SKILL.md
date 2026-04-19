---
name: intercepting-parallel-routes
description: >
  Audit Next.js 15 App Router parallel + intercepting route file
  structure. Four violation classes: a `@slot` folder whose parent
  layout doesn't destructure the slot as a prop, a `@slot` folder
  without a `default.tsx` (required for unmatched states), an
  intercepting prefix (`(.)`, `(..)`, `(..)(..)`, `(...)`) at a
  depth that doesn't match the computed base route, and an
  intercepting folder with no corresponding base route to
  intercept.
  Use when: adding `@slot` parallel routes, implementing a
  `(.)modal` intercepting route, reviewing a PR with
  `@`-prefixed or `(...)`-prefixed folders under `app/`, "my
  parallel slot renders `null` on hard refresh", "my intercepting
  modal shows up as a full page on reload".
  Do NOT use for: standard file-based routing (out of scope —
  Next.js handles it), layout inheritance (→ design judgment, not
  file-structure), middleware routing (out of scope), i18n
  segment layout (→ i18n-routing).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: build
  type: procedural
  methodology_source:
    - name: "Next.js — Parallel Routes"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/routing/parallel-routes"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-19"
    - name: "Next.js — Intercepting Routes"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.239Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Four mechanical violation
    classes detected by a classifier over virtual file-tree
    fixtures. Each fixture encodes a file tree using `// FILE:
    path` markers so the classifier can reason about directory
    structure without needing real directories.
---

# intercepting-parallel-routes

Encodes Next.js 15 App Router's parallel + intercepting route conventions. Four rules a reviewer can verify from the file tree alone, without running the app.

---

## Methodology Attribution

- **Primary:** Next.js — Parallel Routes
  - Source: [https://nextjs.org/docs/app/building-your-application/routing/parallel-routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-19
- **Secondary:** Next.js — Intercepting Routes
  - Source: [https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes](https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the four file-convention rules Next.js documents for `@slot` and `(.)`-prefixed folders. NOT encoded: when to USE parallel vs intercepting routes (design judgment); layout composition patterns; middleware-driven routing; i18n segment structure (`i18n-routing`).

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Adding a folder whose name starts with `@`
- Adding a folder whose name starts with `(.)`, `(..)`, `(..)(..)` , or `(...)`
- A PR introduces or modifies parallel / intercepting routes
- "My parallel slot renders `null` on hard refresh"
- "My intercepting modal opens as a full page on reload"

## When NOT to Use

Do NOT activate for:
- **Standard file-based routing** — handled by Next.js; no violations possible
- **Layout design / composition choices** — judgment, not file-structure
- **Middleware routing** — out of scope
- **i18n segment layout** → `i18n-routing`

---

## Procedure

The classifier ingests fixtures with a virtual file-tree encoding: each fixture is a `.txt` file where each virtual source file is prefixed with `// FILE: <path>\n` before its contents. The classifier parses the markers into a map of path → body, then runs the rules below.

### Step 1 — `@slot` folders require a matching prop in the parent layout

A parallel route `app/@modal/…` only renders if `app/layout.tsx` destructures `modal` from its props and places it in the render tree.

```tsx
// RIGHT — layout destructures every sibling @slot
export default function Layout({
  children,
  modal,
  feed,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  feed: React.ReactNode;
}) {
  return <>{children}{modal}{feed}</>;
}

// WRONG — @modal exists but layout doesn't destructure it
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

### Step 2 — every `@slot` must ship a `default.tsx`

When the URL doesn't match the slot's route, Next.js looks for `default.tsx` in that slot to render. Without it, hard-refresh / deep-linking scenarios render `null` in that slot, breaking layouts.

```
RIGHT
app/
  @modal/
    default.tsx        ← required
    page.tsx
  layout.tsx

WRONG
app/
  @modal/
    page.tsx           ← no default.tsx; hard refresh renders null
  layout.tsx
```

### Step 3 — intercepting prefix depth must match the computed base route

Intercepting prefixes are resolved relative to the intercepting folder's position:

- `(.)` — same segment
- `(..)` — one segment up
- `(..)(..)` — two segments up
- `(...)` — root of `app/`

```
app/
  feed/
    page.tsx
    (..)photo/         ← intercepts /photo (one level up from /feed/)
      [id]/page.tsx

RIGHT  — (..)photo intercepts app/photo (parent folder of feed)

WRONG — (.)photo would try to intercept app/feed/photo, which does not exist
```

### Step 4 — every intercepting folder must have a corresponding base route

`(.)photo` only works if `app/<same-segment>/photo/` exists. `(..)photo` only works if `app/<parent-of-intercepting>/photo/` exists. An intercepting folder without a base route is a dead hard-refresh — users landing on the intercepted URL directly get a 404.

```
app/
  feed/(..)photo/[id]/page.tsx   ← intercepts /photo/[id]
  photo/[id]/page.tsx            ← base route; REQUIRED

WRONG — intercepting folder with no base route anywhere
app/
  feed/(..)photo/[id]/page.tsx   ← intercepts a URL that doesn't exist
```

---

## Tool Integration

No shipped CLI. Classifier parses virtual file trees in fixtures.

## Examples

### Example 1 — `slot-without-layout-prop`

**Input:** file tree has `app/@modal/page.tsx` but `app/layout.tsx` destructures only `children`.
**Output:** the `@modal` slot is effectively dead code. Fix: add `modal: React.ReactNode` to the layout's props type and render `{modal}` somewhere in the tree.

### Example 2 — `parallel-missing-default`

**Input:** `app/@feed/page.tsx` exists, no `app/@feed/default.tsx`.
**Output:** on navigation away from the matching URL (or on hard-refresh to a sibling), the slot renders `null` and breaks the layout. Fix: add `default.tsx` rendering either `null` explicitly or a sensible fallback UI.

---

## Edge Cases

- **`children` is the implicit `@children` slot:** the layout must destructure `children` by convention; the classifier treats it as always-required regardless of whether sibling `@`-slots exist.
- **Nested `@slots`:** `app/dashboard/@analytics/page.tsx` — the parent `app/dashboard/layout.tsx` must destructure `analytics`. The classifier walks the tree to find the right layout.
- **Intercepting routes without `[dynamic]` segments:** `(..)about/page.tsx` is valid — the base `app/about/page.tsx` just needs to exist.
- **Interception of a parameterized route:** `(.)photo/[id]/page.tsx` → the base route must include `photo/[id]/page.tsx` (matching the dynamic segment).
- **Root-level intercepts `(...)`:** always resolves to `app/<folder-name>/`, regardless of where `(...)folder` lives.
- **The classifier doesn't verify intercept-pattern-specific semantics beyond the base-route presence check.** Catch-all `[[...slug]]` intercepts are out of scope — they rarely arise in practice.

---

## Evaluation

See `/evals/intercepting-parallel-routes/`. Fixtures use virtual file trees via `// FILE: <path>\n` markers.

**Quantitative:** ≥4 violation fixtures at ≥95% accuracy, 0 false positives on ≥4 safe fixtures, held-out ≥90%.
**Qualitative:** Promptfoo rubric `route-structure-remediation` (≥0.85).

---

## Handoffs

- Middleware routing → out of scope
- i18n segment structure → `i18n-routing`
- Layout design judgment → not covered; this skill is file-structure only
- Loading / error conventions under parallel slots → `suspense-streaming-boundaries`, `error-boundary-hygiene`

---

## Dependencies

- **External skills:** `error-boundary-hygiene`, `suspense-streaming-boundaries`, `i18n-routing`
- **MCP servers:** none
- **Tools required in environment:** none

---

## References

- `references/parallel-routes-cheatsheet.md` — a cheat sheet of the `@slot` / intercepting-prefix mental model + depth resolution table

## Scripts

- _(none)_

---
name: suspense-streaming-boundaries
description: >
  Enforce Next.js 15 App Router streaming + React 19 Suspense
  discipline for a single .tsx file. Four violation classes: an
  async Server Component (`export default async function Page`)
  in a page.tsx that awaits data without wrapping the suspending
  subtree in `<Suspense>` AND has no sibling `loading.tsx`,
  `<Suspense>` with no `fallback` prop, a `loading.tsx` that
  calls `fetch(`/`await`, and a page that exports both
  `dynamic = 'force-dynamic'` and `generateStaticParams`.
  Use when: writing a Server Component page that reads data,
  wiring a loading / streaming UI, reviewing a PR that adds
  `<Suspense>`, "my page feels slow before any content renders",
  "my streaming boundary flickers".
  Do NOT use for: client-side data fetching / React Query (out of
  scope), Partial Pre-Rendering (experimental; revisit at v0.4),
  error boundaries (→ error-boundary-hygiene), caching strategy
  (→ rsc-data-fetching).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: build
  type: procedural
  methodology_source:
    - name: "Next.js — Loading UI and Streaming"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-19"
    - name: "React 19 — <Suspense>"
      authority: "React team"
      url: "https://react.dev/reference/react/Suspense"
      version: "React 19 docs (2025)"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.240Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Four mechanical violation
    classes detected by a classifier over fixture .tsx files with a
    `filename:` frontmatter field so the classifier can tell page /
    loading / layout files apart.
---

# suspense-streaming-boundaries

Encodes Next.js 15 App Router streaming + React 19 `<Suspense>` discipline. Four rules a reviewer can check from a single file (given the file's name): async Page components need Suspense OR a sibling loading.tsx, every `<Suspense>` needs a `fallback`, loading.tsx must be synchronous, and `force-dynamic` conflicts with `generateStaticParams`.

---

## Methodology Attribution

- **Primary:** Next.js — Loading UI and Streaming
  - Source: [https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-19
- **Secondary:** React 19 — `<Suspense>`
  - Source: [https://react.dev/reference/react/Suspense](https://react.dev/reference/react/Suspense)
  - Version: React 19 docs (2025)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7)._

Encoded: the four mechanical rules around async Server Components, Suspense boundaries, loading file conventions, and the `dynamic`/`generateStaticParams` mutual-exclusion. NOT encoded: Partial Pre-Rendering (experimental in Next 15; will ship in a v0.4 skill when stable); cache-key design (`rsc-data-fetching`); error recovery inside the Suspense tree (`error-boundary-hygiene`); third-party Suspense integrations (SWR, React Query Suspense mode).

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `bun@1.1+`

---

## When to Use

Activate when any of the following is true:
- Writing or reviewing an async `page.tsx` that reads data
- Adding a `loading.tsx` or moving data fetching under `<Suspense>`
- "My page feels slow before any content renders"
- "My streaming boundary flickers between fallback and content"
- Adding `export const dynamic` or `generateStaticParams` to a segment

## When NOT to Use

Do NOT activate for:
- **Client-side data fetching** (React Query, SWR, `use(fetch())`) — out of scope
- **Partial Pre-Rendering (PPR)** — experimental; revisit at v0.4
- **Error boundaries** → `error-boundary-hygiene`
- **Caching strategy / cache keys** → `rsc-data-fetching`
- **Third-party Suspense data libraries** — out of scope

---

## Procedure

### Step 1 — Async Server Components must stream behind `<Suspense>` or a sibling `loading.tsx`

A `page.tsx` whose default export is `async` AND awaits a data read streams only if the rendering pipeline has a boundary. Next.js auto-wraps the segment when `loading.tsx` exists in the same folder; otherwise the author adds `<Suspense>` inside the page.

```tsx
// RIGHT — explicit Suspense inside async Page
export default async function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<PostsSkeleton />}>
        <PostsList />  {/* awaits inside */}
      </Suspense>
    </>
  );
}

// RIGHT — sibling loading.tsx exists (no Suspense needed inside)
// filename: app/blog/page.tsx
export default async function Page() {
  const posts = await getPosts();
  return <PostsList posts={posts} />;
}
// app/blog/loading.tsx covers this.

// WRONG — async + await + no Suspense, no loading.tsx sibling
export default async function Page() {
  const posts = await getPosts();
  return <PostsList posts={posts} />;
}
```

Classifier: activates for files whose `filename` ends with `/page.tsx`. If the default export is `async function` and the body contains an `await` AND the file has no `<Suspense>` element, classifier asks the fixture metadata whether a sibling `loading.tsx` exists (frontmatter `has_loading_sibling: true/false`). Missing loading AND missing Suspense → violation.

### Step 2 — `<Suspense>` must carry a `fallback` prop

React 19's `<Suspense>` requires `fallback`. Without it, the component crashes at runtime.

```tsx
// RIGHT
<Suspense fallback={<Skeleton />}>
  <LazyStuff />
</Suspense>

// WRONG
<Suspense>
  <LazyStuff />
</Suspense>
```

### Step 3 — `loading.tsx` must not read data

`loading.tsx` is Next's canonical skeleton — it must render synchronously. Fetching or awaiting inside defeats the purpose (the skeleton itself would suspend).

```tsx
// RIGHT — synchronous skeleton
// filename: app/blog/loading.tsx
export default function Loading() {
  return <div className="animate-pulse h-40 w-full" />;
}

// WRONG — loading.tsx performs a fetch
export default async function Loading() {
  const config = await fetch('/api/config').then((r) => r.json());
  return <div style={{ background: config.skeletonColor }} />;
}
```

Classifier: activates for files whose filename ends with `/loading.tsx`. Violation if the file contains `fetch(` or an `await` that isn't inside a nested component body.

### Step 4 — `dynamic = 'force-dynamic'` and `generateStaticParams` are mutually exclusive

Next.js refuses to build a segment that declares both — forcing dynamic rendering while asking for static-param enumeration is incoherent. Catch it statically before the build fails.

```tsx
// RIGHT — one or the other
export const dynamic = 'force-dynamic';
// (no generateStaticParams)

export async function generateStaticParams() { … }
// (no force-dynamic)

// WRONG — both exports present
export const dynamic = 'force-dynamic';
export async function generateStaticParams() { … }
```

---

## Tool Integration

No shipped CLI. Classifier lives in the eval.

## Examples

### Example 1 — `async-server-component-no-suspense`

**Input:** `app/posts/page.tsx` default-exports `async function Page() { const posts = await getPosts(); … }`; file has no `<Suspense>` and no sibling `loading.tsx`.
**Output:** the route will block TTFB until `getPosts()` resolves. Fix: either add an `app/posts/loading.tsx` sibling OR wrap the awaiting subtree in `<Suspense fallback={…}>` inside the page.

### Example 2 — `loading-tsx-fetches-data`

**Input:** `app/posts/loading.tsx` awaits a fetch before returning JSX.
**Output:** the skeleton itself suspends — defeats the purpose. Fix: make Loading synchronous; any data it needed becomes the page's concern (move into the component the skeleton stands in for).

---

## Edge Cases

- **Layout with `<Suspense>`:** layouts can hold Suspense boundaries; the classifier activates for any file whose `filename` ends with `page.tsx` or `layout.tsx`.
- **Nested async sub-components in a sync page:** a Page that isn't `async` but renders an `async ChildComponent` is still bound by Step 1 — the classifier looks for `<ChildComponent>` usage with no enclosing `<Suspense>` only when the child's definition is in the same file. Cross-file cases are out of scope (the callee owns the discipline).
- **`'use client'` pages:** Client pages don't stream server-side; Steps 1 and 3 don't apply. Classifier skips.
- **Router-level `dynamic = 'auto'`:** neutral; does not trigger Step 4.
- **`<Suspense>` from a re-export:** the classifier looks for `<Suspense` open tags regardless of import path. Custom `<MySuspense>` wrappers are NOT treated as Suspense.

---

## Evaluation

See `/evals/suspense-streaming-boundaries/`.

**Quantitative:** ≥4 violation fixtures at ≥95% accuracy, 0 false positives on ≥4 safe fixtures, held-out ≥90%.
**Qualitative:** Promptfoo rubric `streaming-remediation-implementability` (≥0.85).

---

## Handoffs

Scoped to Suspense + streaming conventions. Explicitly NOT absorbed:

- Error boundaries → `error-boundary-hygiene`
- Cache keys / revalidate → `rsc-data-fetching`
- Partial Pre-Rendering → deferred; v0.4 candidate once stable
- Client-side fetch libs → out of scope

---

## Dependencies

- **External skills:** `error-boundary-hygiene`, `rsc-data-fetching`
- **MCP servers:** none
- **Tools required in environment:** none

---

## References

- `references/loading-vs-suspense.md` — when to reach for `loading.tsx` vs inline `<Suspense>`

## Scripts

- _(none)_

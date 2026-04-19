# `loading.tsx` vs inline `<Suspense>` — when to reach for which

Both mechanisms stream. They differ in scope and in how much control the author wants over the fallback boundary.

## `loading.tsx`

- **Scope:** the whole route segment. Next.js auto-wraps the `page.tsx` default export in `<Suspense fallback={<Loading />}>`.
- **When it fits:** you want a single skeleton for the entire page and the page has a natural "loading" shape.
- **Prose rule:** "Any time one skeleton is enough, prefer `loading.tsx`." Less indirection than inline Suspense.

```
app/
  posts/
    page.tsx       # async; awaits getPosts()
    loading.tsx    # synchronous skeleton
```

## Inline `<Suspense>`

- **Scope:** the subtree you wrap. The rest of the page renders instantly; only the subtree streams.
- **When it fits:** the page has multiple regions that load at different speeds, or the hero/shell renders instantly while the data-heavy portion streams in.
- **Prose rule:** "Reach for inline Suspense when the above-the-fold content renders without the data, and only the below-the-fold piece is async."

```tsx
// app/posts/page.tsx
export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<PostsSkeleton />}>
        <PostsList />   {/* async; awaits inside */}
      </Suspense>
    </>
  );
}
```

## Combined

Both mechanisms compose. A page may have a top-level `loading.tsx` covering cold loads AND an inner `<Suspense>` around a below-the-fold region that revalidates independently on every visit. Next.js honors both boundaries.

## What the skill's Step 1 enforces

Step 1 says: if a `page.tsx` default export is `async` and its body contains `await`, **at least one** streaming affordance must be in place. That means either:

1. A sibling `loading.tsx` file exists in the same route directory (fixture metadata carries `has_loading_sibling: true`), OR
2. The page's JSX body contains a `<Suspense>` element that wraps the awaiting subtree.

The classifier does NOT attempt to verify that the Suspense boundary *actually* wraps the right subtree — static scope analysis is fragile. Presence of one `<Suspense fallback=…>` tag inside the file is taken as evidence the author has streaming in mind. Callers who wrap the wrong subtree are relying on runtime signals the skill doesn't try to model.

## Step 3 rationale: why `loading.tsx` must be synchronous

`loading.tsx` renders when the segment's `page.tsx` suspends. If `loading.tsx` itself suspends, Next.js has nowhere to fall back further — the user sees a blank page for the entire suspension window instead of the skeleton.

The rule is mechanical: no `fetch(` calls, no `await` keywords inside the default-export body. Skeleton components that need configuration values should receive them as props from the page, or the skeleton should be hard-coded. The rare case where a skeleton legitimately needs data (e.g. a server-computed theme) goes under a nested `<Suspense>` inside the page, not in loading.tsx.

## Step 4 rationale: `force-dynamic` vs `generateStaticParams`

- `export const dynamic = 'force-dynamic'` tells Next never to cache this segment; render on every request.
- `export async function generateStaticParams()` tells Next to enumerate params and pre-render each at build time.

Declaring both is incoherent: you're asking for always-dynamic rendering while also providing the list of static pages to generate. Next refuses to build. The skill catches it pre-build so the signal is in PR review, not in CI failure logs.

## What's out of scope

- **Partial Pre-Rendering (PPR):** Next 15's `experimental.ppr = true` + `dynamic = 'force-static'` + inner `<Suspense>` boundaries. PPR is still experimental (Next 15.2+); the skill does not encode rules about it. When PPR stabilizes (expected v0.4 of this skill line), the classifier will grow a `ppr-misconfigured` class.
- **`<Suspense>` name hoisting.** Custom wrappers (`MySuspense`, `LazyBoundary`) are not detected. The classifier only sees `<Suspense` literal.
- **Data libraries outside Next/React.** SWR/React Query Suspense mode has its own rules — not in scope for this skill.

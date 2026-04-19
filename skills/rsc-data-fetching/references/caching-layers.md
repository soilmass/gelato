# Next.js 15 App Router — the four-layer caching hierarchy

Read once to understand which layer you're addressing. Every decision in the skill's procedure maps to one of these.

## 1. Request Memoization

**Scope:** a single render pass of a single request.
**Addressed by:** automatic. No configuration.
**What it does:** deduplicates identical `fetch(url, options)` calls within one render pass. Call `getUser()` three times in three components; Next issues one HTTP request.

Nothing you do addresses this layer directly. It is not something to tune.

## 2. Data Cache (persists across requests, across deploys)

**Scope:** the `fetch` call and `unstable_cache` function.
**Addressed by:** `fetch(url, { cache, next })` and `unstable_cache(fn, keyParts, { tags })`.
**Invalidation:** time-based (`revalidate: N`) or tag-based (`revalidateTag(...)` called from a Server Action or route handler).

This is the layer where most decisions land. The four violation classes in `violation-classes.md` are primarily about this layer.

## 3. Full Route Cache (static route HTML + RSC payload)

**Scope:** a route segment's rendered output.
**Addressed by:** `export const revalidate = N` / `export const dynamic = 'force-static' | 'force-dynamic'` at the route-segment top level.
**Invalidation:** `revalidatePath(...)` from a Server Action / route handler, time-based via segment `revalidate`.

Dynamic APIs (`headers()`, `cookies()`, `searchParams`, `draftMode()`) force a route into dynamic rendering. `export const dynamic = 'force-static'` alongside these APIs is a build error — flagged as `dynamic-in-static`.

## 4. Router Cache (client-side, in-memory)

**Scope:** the browser. Short-lived.
**Addressed by:** `<Link prefetch>` hints, `router.refresh()`.
**Invalidation:** navigation events, `router.refresh()`, session tear-down.

The skill does not touch this layer. It's a client-side performance optimization, and "wrong router cache behavior" is almost always a symptom of wrong Data Cache or Full Route Cache setup, not the router cache itself.

## Decision tree (which layer applies)

```
Does this fetch data?
├── Yes, via fetch()
│   └── Data Cache layer → `fetch(url, { cache | next: { revalidate | tags } })`
├── Yes, via a non-fetch source (Drizzle, Prisma, ORM)
│   └── Data Cache layer → `unstable_cache(fn, keyParts, { tags })`
└── Is the whole route deterministic at build time?
    ├── Yes → Full Route Cache layer → `export const dynamic = 'force-static'`
    └── No, depends on request → Full Route Cache layer → `export const dynamic = 'force-dynamic'`
```

Request Memoization and Router Cache are not decisions — they are behaviors.

---
name: rsc-data-fetching
description: >
  Audit Next.js App Router data-fetching choices against the four-layer
  caching hierarchy (request memoization, Data Cache, Full Route Cache,
  Router Cache). Enforces explicit cache / revalidate / tags on every
  fetch, detects conflicting route-segment configs, flags incomplete
  unstable_cache usage, and catches dynamic APIs in static segments.
  Use when: writing a Server Component that fetches data, adding a
  route handler that proxies a fetch, setting route segment config
  (revalidate / dynamic / fetchCache), using unstable_cache for
  non-fetch data, using revalidateTag from a Server Action, "why is my
  data stale / over-fetching / not invalidating", migrating from
  unstable_cache to the new cache() API in Next 15.
  Do NOT use for: input validation on fetched data (→ zod-validation),
  client-side fetching patterns (React Query / SWR are out of scope),
  ORM query optimization (Drizzle territory), edge-runtime caching
  (Vercel's runtime cache is a separate skill candidate).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: data
  phase: build
  type: procedural
  methodology_source:
    - name: "Next.js — Caching"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/caching"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
    - name: "Next.js — Data Fetching Patterns and Best Practices"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/data-fetching/patterns"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T13:13:48.432Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four violation classes detected by a deterministic
    classifier: missing-cache-strategy, conflicting-revalidate,
    unstable_cache-incomplete, dynamic-in-static. Next 15's shift away
    from "fetch caches by default" is the primary tension this skill
    enforces.
---

# rsc-data-fetching

Encodes Next.js 15's App Router caching hierarchy into a per-fetch audit. Scoped to Server Component data fetching, route segment config, and the cache API. Not a general data-layer skill — the tension is specifically "what does Next do by default, what did you tell it to do, do those match."

---

## Methodology Attribution

Two primary sources:

- **Primary:** Next.js — Caching
  - Source: [https://nextjs.org/docs/app/building-your-application/caching](https://nextjs.org/docs/app/building-your-application/caching)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Secondary:** Next.js — Data Fetching Patterns and Best Practices
  - Source: [https://nextjs.org/docs/app/building-your-application/data-fetching/patterns](https://nextjs.org/docs/app/building-your-application/data-fetching/patterns)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the four caching layers and how each is addressed (request memoization is automatic, Data Cache via `fetch({ cache, next })`, Full Route Cache via route segment config, Router Cache via client-side prefetch hints), the Next 15 shift to opt-in caching, the four classes of cache-correctness bugs the audit catches.

NOT encoded: input validation on fetched data (`zod-validation` owns that), client-side fetching (React Query / SWR patterns are out of scope), ORM query optimization (Drizzle concern), edge-runtime caching via Vercel's runtime cache (separate v0.2+ skill candidate).

---

## Stack Assumptions

- `next@15+` App Router (the Next 15 caching-default shift is load-bearing for this skill)
- `react@19+`
- `bun@1.1+`

If your stack differs, fork the suite.

---

## When to Use

Activate when any of the following is true:
- Writing or editing a Server Component that calls `fetch`
- Writing or editing a route handler that proxies / fetches
- Setting `export const revalidate` / `dynamic` / `fetchCache`
- Using `unstable_cache` for non-fetch data (e.g. Drizzle query)
- Calling `revalidateTag` / `revalidatePath` from a Server Action
- Debugging stale data, over-fetching, or missed invalidations
- Migrating a codebase from Next 14 (cache-by-default) to Next 15 (no-cache-by-default)

## When NOT to Use

Do NOT activate for:
- **Input validation on fetched data** — `zod-validation` parses what you get back
- **Client-side fetching patterns** — React Query / SWR have their own idioms; out of scope
- **Database query performance** — Drizzle schema + index design is a separate concern
- **Edge runtime caching** — Vercel's runtime cache is a v0.2+ candidate skill

---

## Procedure

### Step 1 — Inventory every fetch and route-segment-config declaration

For each Server Component / route handler / layout, record:

- `fetch(url, options)` call sites — does `options` include `cache` or `next`?
- `export const revalidate = N` / `export const dynamic = 'force-static' | 'force-dynamic'` / `export const fetchCache = ...`
- `unstable_cache(fn, keyParts, options)` calls and their argument count
- Dynamic-API usage: `headers()`, `cookies()`, `searchParams`, `draftMode()`
- `revalidateTag(...)` / `revalidatePath(...)` calls anywhere in the file

### Step 2 — Classify each fetch against Next 15's explicit-cache expectation

Next 15 changed fetch's default from cached to uncached. Every `fetch` call in a Server Component must now state its intent explicitly:

| Intent | Syntax |
|---|---|
| Cache indefinitely (build-time, ISR) | `fetch(url, { cache: 'force-cache' })` |
| Revalidate every N seconds | `fetch(url, { next: { revalidate: 60 } })` |
| Cache by tag (imperative invalidation) | `fetch(url, { next: { tags: ['posts'] } })` |
| Never cache | `fetch(url, { cache: 'no-store' })` |
| Mutation (implicit no-store) | `fetch(url, { method: 'POST', body })` |

A `fetch(url)` with no options is ambiguous in a code review context even though Next's default is now `no-store` — the audit requires explicit `cache` or `next` on every non-mutation fetch.

### Step 3 — Resolve route-segment vs fetch-level conflicts

`export const revalidate = 3600` at the top of a route segment sets the **default** revalidate for all fetches in that segment. A per-fetch `{ next: { revalidate: 60 } }` **overrides** it — but Next's behavior when the two disagree is the minimum of the two, which is rarely what the author intended. The audit flags divergence.

Similarly, `export const dynamic = 'force-static'` at the top is incompatible with using `headers()`, `cookies()`, or `searchParams.*` in the same file. Next throws at build time, but the classifier catches this pre-build.

### Step 4 — Ensure `unstable_cache` has keyParts AND tags

`unstable_cache(fn, keyParts, options)` is Next's escape hatch for caching non-fetch work (e.g. a Drizzle query). Three arguments are required for invalidation to work:

- **`fn`** — the expensive function.
- **`keyParts`** — an array of strings that uniquely identifies the cache entry within a call site. Without this, different calls share the same cache and return wrong data.
- **`options.tags`** — an array of tags that `revalidateTag` can use to invalidate. Without tags, the cache entry can never be invalidated except by redeploy.

A common mistake: `unstable_cache(fn)` with one argument. Runs, caches, never invalidates. The classifier flags this.

### Step 5 — Pair `revalidateTag` with something that tags

Every cache that uses `next: { tags: [...] }` or `unstable_cache(..., { tags: [...] })` should have at least one call site that invokes `revalidateTag` with those tags — otherwise the tags are decorative. The audit scans file-level (v0.1) for paired tag + invalidator. A follow-up v0.2 upgrade extends to project-level via the `ts-morph` AST pass.

---

## Hard Thresholds

The eval fails this skill if any threshold is missed:

- **Every non-mutation `fetch` in a Server Component specifies `cache` or `next` explicitly.**
- **`export const revalidate = X` and a per-fetch `{ next: { revalidate: Y } }` must agree** — or the per-fetch override is intentional and documented.
- **`unstable_cache` calls must pass three arguments** (fn, keyParts, options-with-tags).
- **`export const dynamic = 'force-static'` must not appear alongside `headers()` / `cookies()` / `searchParams.*` in the same file.**

The eval's classifier matches each fixture against exactly one of four violation classes — `missing-cache-strategy`, `conflicting-revalidate`, `unstable_cache-incomplete`, `dynamic-in-static`.

---

## Tool Integration

**Canonical Server Component fetch (ISR, 60s revalidate, tag-invalidable):**

```ts
// app/posts/page.tsx
export default async function Page() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60, tags: ['posts'] },
  }).then((r) => r.json());
  return <PostList posts={posts} />;
}

// app/actions.ts
'use server';
import { revalidateTag } from 'next/cache';
export async function createPost(data: FormData) {
  await fetch('https://api.example.com/posts', { method: 'POST', body: data });
  revalidateTag('posts');
}
```

**`unstable_cache` (or `cache` in Next 15.2+) for a Drizzle query:**

```ts
import { unstable_cache } from 'next/cache';

export const getPostBySlug = unstable_cache(
  async (slug: string) => db.select().from(posts).where(eq(posts.slug, slug)).limit(1),
  ['post-by-slug'],                         // keyParts — unique identifier
  { revalidate: 60, tags: ['posts'] },      // options — tags enable invalidation
);
```

**Route segment config (canonical):**

```ts
// app/dashboard/page.tsx
export const revalidate = 30;                 // re-render every 30s
export const dynamic = 'force-dynamic';       // opt out of static generation
export const fetchCache = 'default-cache';    // default fetch behavior in this segment
```

---

## Examples

### Example 1 — `fetch` with no options (`missing-cache-strategy`)

**Input:**

```ts
export default async function Page() {
  const data = await fetch('https://api.example.com/posts').then((r) => r.json());
  return <PostList posts={data} />;
}
```

**Output:** Next 15 defaults `fetch` to `no-store`, which means every request re-fetches. On a home page, that's expensive and usually wrong. Add explicit intent:

```ts
await fetch(url, { next: { revalidate: 60, tags: ['posts'] } });
```

### Example 2 — Conflicting revalidate (`conflicting-revalidate`)

**Input:**

```ts
export const revalidate = 3600;                               // segment: 1 hour

const data = await fetch(url, { next: { revalidate: 60 } }); // per-fetch: 1 minute
```

**Output:** Next takes `min(3600, 60) = 60`. The author set segment-level 3600 expecting "cache for an hour" but gets 60-second revalidation. Either remove the segment config or remove the per-fetch override.

### Example 3 — `unstable_cache` without tags (`unstable_cache-incomplete`)

**Input:**

```ts
export const getPost = unstable_cache(async (id) => db.select()...);
```

**Output:** one argument. Cache works, but `revalidateTag('posts')` from a mutation elsewhere can't invalidate it. Add keyParts + tags:

```ts
export const getPost = unstable_cache(
  async (id) => db.select()...,
  ['post-by-id'],
  { tags: ['posts'] },
);
```

### Example 4 — `force-static` with `headers()` (`dynamic-in-static`)

**Input:**

```ts
export const dynamic = 'force-static';

import { headers } from 'next/headers';

export default async function Page() {
  const h = await headers();
  return <p>UA: {h.get('user-agent')}</p>;
}
```

**Output:** `headers()` is a dynamic API; its presence forces the segment to be dynamic. Next throws at build. Remove one of the two — either drop `force-static` or remove the `headers()` call.

---

## Edge Cases

- **Request memoization is automatic** — same-URL fetches within a single request dedupe without config. Don't over-think.
- **Mutations are implicitly uncached** — `fetch(url, { method: 'POST' })` does not need an explicit `cache: 'no-store'`; POST/PUT/DELETE/PATCH are never cached. The audit exempts non-GET fetches from the missing-cache-strategy check.
- **Parallel fetches in a single component** — `Promise.all([fetch(a), fetch(b)])` is idiomatic. Both still need explicit cache options.
- **`unstable_cache` → `cache` in Next 15.2+** — Next renamed; same rules apply. The classifier matches both names.
- **Third-party auth / db libraries that fetch internally** — you may not control their fetch-level options. The audit scopes to fetches written in the project code, not transitive library fetches.
- **`revalidatePath` vs `revalidateTag`** — `revalidatePath` is coarser (blows away the entire Full Route Cache for that path); `revalidateTag` is precise. Prefer tags.

---

## Evaluation

See `/evals/rsc-data-fetching/` for the canonical eval suite.

### Pass criteria

**Quantitative (deterministic classifier):**
- Classifier flags ≥ 95% of violation fixtures across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out adversarial set ≥ 90%
- Fixture inventory matches SKILL.md counts

### Current pass rate

Auto-updated by `bun run eval`.

---

## Handoffs

- **Input validation on fetched responses** → `zod-validation`
- **Client-side fetching patterns (React Query / SWR)** — out of scope
- **Database query performance and schema design** → Drizzle files + `drizzle-migrations`
- **Edge-runtime caching via Vercel** — v0.2+ candidate `vercel-runtime-cache`
- **Caching static assets on the CDN** — deployment / Vercel configuration, not a skill

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, TypeScript 5+

---

## References

- `references/caching-layers.md` — the four-layer hierarchy, when each applies, and how to address it
- `references/violation-classes.md` — four-class taxonomy with canonical examples per class

## Scripts

- _(none in v0.1 — eval ships the classifier; a `bun run rsc-cache-audit` CLI is a v0.2 candidate)_

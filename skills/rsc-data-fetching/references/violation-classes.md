# Four violation classes

The classifier flags exactly one class per fixture. A file that triggers none is `safe`.

## 1. `missing-cache-strategy`

A non-mutation `fetch` call in a Server Component has no `cache` or `next` option. Next 15 defaults to `no-store`, so the author silently opts into uncached fetches — rarely what they want on a render path.

**Canonical example:**

```ts
const data = await fetch('https://api.example.com/posts').then((r) => r.json());
```

**Signal:** `fetch(url)` with one argument, OR `fetch(url, { /* options */ })` whose options don't include `cache:` or `next:`. Non-GET methods (POST/PUT/DELETE/PATCH) are exempt — mutations are implicitly uncached.

**Remediation:** add explicit intent: `{ cache: 'force-cache' }`, `{ next: { revalidate: N } }`, `{ next: { tags: [...] } }`, or `{ cache: 'no-store' }`.

## 2. `conflicting-revalidate`

Route-segment `export const revalidate = X` and a per-fetch `{ next: { revalidate: Y } }` specify different values. Next takes `min(X, Y)`, which is rarely the intent.

**Canonical example:**

```ts
export const revalidate = 3600;
// ...
await fetch(url, { next: { revalidate: 60 } });  // min(3600, 60) = 60 — segment config ignored
```

**Signal:** file has both `export const revalidate = X` and at least one `fetch(..., { next: { revalidate: Y } })` with X ≠ Y.

**Remediation:** drop the segment-level revalidate (each fetch carries its own budget) OR drop the per-fetch override (segment default applies).

## 3. `unstable_cache-incomplete`

`unstable_cache(fn)` called with fewer than three arguments — missing either `keyParts` or the tags-bearing options object. The cache entry either collides with sibling calls (missing `keyParts`) or cannot be invalidated (missing `tags`).

**Canonical example:**

```ts
export const getPost = unstable_cache(async (id) => db.select()...);
```

**Signal:** `unstable_cache(` call (or `cache(` in Next 15.2+ nomenclature) with 1 or 2 arguments.

**Remediation:** pass all three — `fn`, `keyParts` array, `{ tags: [...] }` options.

## 4. `dynamic-in-static`

A file declares `export const dynamic = 'force-static'` but also uses a dynamic API (`headers()`, `cookies()`, `searchParams.*`, `draftMode()`). Next throws at build. The classifier catches this pre-build.

**Canonical example:**

```ts
export const dynamic = 'force-static';
import { headers } from 'next/headers';
export default async function Page() {
  const h = await headers();
  return <p>UA: {h.get('user-agent')}</p>;
}
```

**Signal:** `export const dynamic = 'force-static'` + usage of `headers()` / `cookies()` / `searchParams.` / `draftMode()` in the same file.

**Remediation:** one of them has to go. Either drop the `force-static` (the route is dynamic) or remove the dynamic-API usage (the route really is static).

## Why exactly four

These are the four *file-local* mechanically-detectable failure modes. Cross-file concerns (tag declared in file A, no revalidator anywhere in the repo) need AST analysis and are candidates for a v0.2 `ts-morph` classifier upgrade.

Adding a fifth (e.g. "revalidate: 0 on a force-static segment") tends to duplicate `dynamic-in-static`; collapsing to three hides a distinguishable remediation path.

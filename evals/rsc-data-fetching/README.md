# rsc-data-fetching eval

Proves the four Next.js 15 App Router caching violation classes are mechanically enforceable against fixture Server Components, route handlers, and cache-API call sites.

## What the eval measures

Deterministic classifier with depth-aware argument parsing for `unstable_cache` / `cache` calls and for `fetch` options objects. Detection order: `dynamic-in-static` → `unstable_cache-incomplete` → `conflicting-revalidate` → `missing-cache-strategy`. First match wins.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 POST mutation without cache options (exempt — mutations are implicitly uncached)
- 02 agreeing segment + per-fetch revalidate (same value, not a conflict)
- 03 force-dynamic with `headers()` (correct pairing, opposite of the violation class)
- 04 explicit `cache: 'no-store'` (legitimate opt-out, not missing)
- 05 Next 15.2 renamed `cache` API (classifier matches both names)
- 06 fetch inside a helper function (classifier catches per-call-site, not per-containing-function)

## No qualitative half

The four classes are syntactically detectable. A v0.2 `cross-file-tag-audit` rubric would check whether declared `tags` have matching `revalidateTag` callers anywhere in the project — cross-file territory, ts-morph required.

## Running

```bash
bun run eval rsc-data-fetching
```

~60 ms. No env, no Chromium, no API keys.

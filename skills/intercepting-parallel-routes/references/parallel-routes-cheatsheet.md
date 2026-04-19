# Parallel + intercepting routes — mental model

## Parallel routes (`@slot`)

A folder prefixed with `@` is a **named slot** in the parent layout. Each slot can navigate independently — `/home` + `/home/login` can coexist and render at the same time.

```
app/
  layout.tsx        ← must destructure every sibling @slot
  page.tsx          ← the implicit @children slot
  @modal/           ← named slot "modal"
    default.tsx     ← required: renders when no URL match
    page.tsx
  @feed/            ← named slot "feed"
    default.tsx
    page.tsx
```

The parent `layout.tsx` receives each slot as a prop:

```tsx
export default function Layout({
  children,
  modal,
  feed,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  feed: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
      {feed}
    </>
  );
}
```

**The `default.tsx` requirement.** When a URL matches the slot's route, Next renders that route in the slot. When it doesn't, Next falls back to `default.tsx`. Without `default.tsx`, the slot renders `null` on hard-refresh scenarios — the layout collapses.

## Intercepting routes (`(.)`, `(..)`, `(..)(..)`, `(...)`)

An intercepting route renders a different component when the user navigates to a URL client-side, while still rendering the base route on direct navigation / hard-refresh. Canonical example: a `/photo/[id]` route intercepted from `/feed` to show a modal instead of a full page.

### The prefixes and their depth resolution

| Prefix | Resolves from | Example |
|---|---|---|
| `(.)` | same segment | `feed/(.)photo` → `feed/photo` |
| `(..)` | one segment up | `feed/(..)photo` → `photo` (sibling of `feed`) |
| `(..)(..)` | two segments up | `feed/nested/(..)(..)photo` → `photo` |
| `(...)` | root of `app/` | `whatever/(...)photo` → `app/photo` |

**Rule of thumb:** `(..)` counts **route segments**, not filesystem folders. Route groups `(foo)` and intercepting prefixes `(.)` are not segments — they don't count in the hop.

### Base-route requirement

Every intercepting folder must have a corresponding **base route** elsewhere in the tree. Without it, users who land on the intercepted URL directly (by reload, shared link, or back-button from an external site) get a 404.

```
RIGHT
app/
  feed/
    (..)photo/[id]/page.tsx   ← intercepts client-navigation
  photo/[id]/page.tsx         ← base: handles direct nav

WRONG
app/
  feed/
    (..)photo/[id]/page.tsx   ← intercepts a URL that does not exist
  # (no app/photo/)
```

### Common confusion: `(..)` vs `(..)/`

There is **no** `/` after the closing paren of the intercepting prefix. The folder is literally named `(..)photo`, not `(..)/photo`. The classifier relies on this — folders matching `^\((?:\.|\.\.)+\)[\w-]+$` are intercepting; anything else isn't.

## Why both exist in the same skill

Parallel and intercepting routes are two halves of the same feature surface: **slot-based composition** (parallel) + **URL-driven vs code-driven rendering** (intercepting). They share:

- File-structure conventions
- Layout-level composition model
- Hard-refresh / direct-nav fallback rules (`default.tsx`, base route)

A team adopting either feature usually adopts both within the same PR cycle. Keeping them in one skill avoids the "did you remember to check the other?" coordination tax.

## What the classifier does NOT check

- **Whether a slot is ACTUALLY rendered in the right place in the layout tree.** The classifier only checks presence of the slot prop in the layout signature.
- **Dynamic-segment type compatibility.** A `(..)photo/[slug]` intercepting `/photo/[id]` (different param name) is not flagged — Next.js may or may not handle this correctly per version.
- **Whether the intercepted route's params match the intercepting route's params.** Catch-all `[[...slug]]` intercepts are out of scope.
- **Recursive / circular intercepts.** `(..)(..)` pointing back into the intercepting folder's own tree — not detected.

These gaps are intentional: the classifier's job is to catch the most common class of mistakes (dead slots, missing defaults, depth errors, missing base routes). Advanced cases require actual build-time validation from Next.js itself.

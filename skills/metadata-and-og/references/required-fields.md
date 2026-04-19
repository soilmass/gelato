# Required fields per route type

A page-level route (`app/**/page.tsx`) that is indexable must emit, at minimum:

1. **`title`** (string) — 50-60 chars is the Google-friendly range.
2. **`description`** (string) — 70-160 chars. Below 70 is underspecified; above 160 gets cropped.
3. **`alternates.canonical`** (URL or path) — declares the authoritative URL for this route. Duplicates cost ranking.

A layout-level metadata export (`app/**/layout.tsx`) is a *defaults provider* — it should NOT set `alternates.canonical` (canonicals are per-route, not per-subtree). Safe layout defaults:

- `title.template` — wraps per-page titles (`'%s | Site Name'`).
- `title.default` — used by routes that don't set their own.
- `metadataBase` — sets the URL base for relative `openGraph.images`.
- `robots` defaults (can be overridden per page).

A `noindex` route (`robots: { index: false }`) is *exempt* from the required-fields check. Auth'd pages, draft previews, and admin dashboards go here.

## Why these three, not more

Google Search Central names `title`, `meta description`, and `rel=canonical` as the three page-level controls it honors directly. Everything else (OG, Twitter Cards, robots directives) is either platform-specific or an overlay.

Adding `openGraph.*` or `twitter.*` to required-fields would force every page — including internal admin — to ship social-share metadata. That's the wrong default. The `malformed-og` class handles OG correctness when OG is present, not absence.

## Fixture conventions

Fixture files under `evals/metadata-and-og/fixtures/` declare the effective metadata shape (post layout-merge) as a TypeScript snippet. The eval classifier parses the return object without executing the page.

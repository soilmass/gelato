# Sitemap + robots schema — required fields

## sitemaps.org 0.9 — `<urlset>` / `<url>`

Every `<url>` child of `<urlset>` must have a `<loc>` (URL). Optional: `<lastmod>` (W3C datetime), `<changefreq>` (deprecated by Google), `<priority>` (deprecated by Google).

## Next.js `MetadataRoute.Sitemap`

```ts
type SitemapEntry = {
  url: string;                         // required
  lastModified?: string | Date;        // string must be ISO 8601
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  alternates?: { languages?: Record<string, string> };  // BCP 47
  images?: string[];
  videos?: unknown[];
};
export type Sitemap = SitemapEntry[];
```

## Next.js `MetadataRoute.Robots`

```ts
type Robots = {
  rules: Rule | Rule[];
  sitemap?: string | string[];  // skill requires this
  host?: string;
};
type Rule = {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
};
```

## BCP 47 grammar — simplified subset the classifier accepts

Valid shape for `alternates.languages` keys:

```
<lang>(-<Script>)?(-<REGION>)?

lang     ::= [a-z]{2,3}                 e.g. en, es, zh
Script   ::= [A-Z][a-z]{3}              e.g. Hans, Hant, Latn, Cyrl
REGION   ::= [A-Z]{2} | \d{3}           e.g. US, MX, 419
```

Rejected:
- Uppercase primary language: `EN-us` (must be `en-US`)
- Double hyphen: `es--MX`
- Common full-name forms: `english`, `espanol`, `mandarin`
- Missing region casing: `en-us`, `es-mx`

The classifier's regex is intentionally strict — a valid BCP 47 tag has deterministic casing per the spec. Unicode CLDR's `validateLanguageTag` would be more permissive on legacy tags (e.g. `i-klingon`), but modern Next.js apps don't emit those.

## Why this skill is small (4 rules, not 10)

Google has deprecated `priority` and `changefreq` for crawl-budget decisions — they're ignored by modern crawlers. The skill intentionally skips rules around those fields.

XML validity is handled by Next.js itself (it builds the XML from the `MetadataRoute` type). The skill only catches what the type system misses (runtime / type-assert casts that bypass field-presence checks).

Hreflang cluster correctness (cross-page consistency, return-link symmetry, x-default presence) is an entire sub-problem that Google documents separately. That's a future v0.4+ skill candidate (`hreflang-clusters`); this skill only checks per-entry BCP 47 validity.

## Pattern the classifier tracks

```ts
// app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://ex.com/', lastModified: new Date(), priority: 1 },
    { url: 'https://ex.com/about', lastModified: '2026-04-19T00:00:00Z' },
    { url: 'https://ex.com/docs',
      alternates: { languages: { en: '...', 'es-MX': '...' } },
    },
  ];
}

// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/admin' }],
    sitemap: 'https://ex.com/sitemap.xml',
  };
}
```

The classifier extracts the array of entries from sitemap's return statement (by finding the `return` keyword and the first array literal after it), or the object from robots's return, and validates fields in each.

## What the classifier can't see

- **Computed URLs from a CMS:** if the code does `return (await getAllPosts()).map((p) => ({ url: slugUrl(p) }))`, the classifier sees a `.map()` call with a function body it can inspect — if the function returns an object-literal missing `url`, it's flagged. But if `url` is computed from a variable, the classifier trusts the presence.
- **Dynamic imports:** async ESM patterns that load from files are not walked.
- **Cross-file locale lists:** if `alternates.languages` keys are computed from an imported constant, the classifier can't verify BCP 47 validity on runtime values.

Those concerns need the Rich Results Test / Search Console / a real crawl.

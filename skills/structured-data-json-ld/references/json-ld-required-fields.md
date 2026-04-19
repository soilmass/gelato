# Google Search Central — JSON-LD required fields

Condensed reference of the five rules the skill enforces. All rules come from Google Search Central's rich-results documentation + schema.org specs, verified 2026-04-19.

## `@context` — required for all types

Every JSON-LD object consumed by Google must carry `"@context": "https://schema.org"`. The http:// form is deprecated but still accepted by Google; the skill accepts both. A missing or non-schema.org context disqualifies the structured data entirely.

## Product — rich result

Google source: Structured Data Markup Reference — Product (search.google.com/rich-results/test).

| Field | Required? |
|---|---|
| `@context` | Yes (global) |
| `@type` | Yes (`"Product"`) |
| `name` | **Yes** |
| `image` | **At least one of `image` or `offers`** |
| `offers` | **At least one of `image` or `offers`** |
| `description` | Recommended |
| `brand` | Recommended |
| `aggregateRating` | Recommended |
| `review` | Recommended |
| `sku` / `gtin*` / `mpn` | Recommended |

Rule: `name` present AND (`image` present OR `offers` present).

`offers` can be a single Offer or an AggregateOffer. If present, Google additionally requires `priceCurrency` + (`price` OR `lowPrice`) inside the Offer — the skill flags this as a sub-violation of `product-missing-required` when the `offers` is structurally empty.

## Article — rich result

Google source: Article structured data.

| Field | Required? |
|---|---|
| `@context` | Yes |
| `@type` | Yes (`"Article"`, `"NewsArticle"`, or `"BlogPosting"`) |
| `headline` | **Yes** |
| `author` | **Yes** (Person, Organization, or a string name) |
| `datePublished` | **Yes** (ISO 8601) |
| `image` | Recommended |
| `dateModified` | Recommended |

Rule: all three — `headline`, `author`, `datePublished` — present.

`NewsArticle` and `BlogPosting` are Article subclasses and get the same treatment.

## BreadcrumbList — rich result

Google source: Breadcrumb structured data.

| Field | Required? |
|---|---|
| `@context` | Yes |
| `@type` | Yes (`"BreadcrumbList"`) |
| `itemListElement` | **Yes (array of ListItem)** |

Each `ListItem` needs:

| ListItem field | Required? |
|---|---|
| `@type` | Yes (`"ListItem"`) |
| `position` | **Yes (integer starting at 1, sequential)** |
| `name` | Yes |
| `item` | Required for all but the last position |

Rule: `itemListElement[*].position` must be `[1, 2, 3, …]` in order. The skill specifically flags arrays where `position` sequence is not strictly ascending starting from 1.

## FAQPage — rich result

Google source: FAQ structured data.

| Field | Required? |
|---|---|
| `@context` | Yes |
| `@type` | Yes (`"FAQPage"`) |
| `mainEntity` | **Yes (array of Question)** |

Each `Question` needs:

| Question field | Required? |
|---|---|
| `@type` | Yes (`"Question"`) |
| `name` | Yes (the question text) |
| `acceptedAnswer` | Yes (Answer object) |
| `acceptedAnswer.text` | **Yes (the answer text)** |

Rule: every element in `mainEntity` must have `acceptedAnswer` with a non-empty `text` field.

Important: Google has SIGNIFICANTLY narrowed FAQPage rich-result eligibility since 2023 — only well-known authoritative health / government sites tend to get the treatment. The skill still enforces the rule because emitting incomplete FAQPage JSON-LD is bad hygiene regardless of whether Google promotes it; teams should revisit whether emitting FAQPage at all is worth the complexity.

## What the classifier does NOT check

- **Schema validity beyond required fields.** `priceCurrency` = "FOO" is not validated against ISO 4217.
- **URL reachability.** `image` URLs aren't fetched; broken images pass the rule.
- **Duplicate emission.** A page with two Product blocks (different variants) isn't merged or deduped.
- **Cross-page consistency.** The same product on two pages with different prices is not compared.
- **Schema.org type freshness.** A type deprecated in schema.org v25 but still present in older docs isn't flagged.

Those concerns belong in Google's Rich Results Test and Search Console — run them after landing.

## JSON-LD authoring tips (soft guidance, not enforced)

- Use `JSON.stringify(obj, null, 2)` inside `dangerouslySetInnerHTML` for readable diffs.
- Keep the JSON object in a `.ts` module near the route it serves so reviewers see it in PR context.
- For dynamic data (e.g. Product from a CMS), cast the CMS response into a typed JSON-LD shape — then the skill's literal-key extraction can still catch required-field absence.

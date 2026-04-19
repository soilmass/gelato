# Next.js i18n conventions + BCP 47 subset

## The `[locale]` segment pattern

Next.js 15 doesn't ship built-in i18n routing at the App Router level — teams wire it up via a `[locale]` dynamic segment + middleware:

```
app/
  [locale]/
    layout.tsx        ← receives { params: { locale } }
    page.tsx
    blog/
      page.tsx
  (api)/              ← API routes outside the locale segment
    route.ts
middleware.ts         ← rewrites / at the edge
```

The middleware detects the user's locale (Accept-Language, cookie, path prefix) and rewrites the URL to include the locale segment.

## `<html lang>` rule

When the tree has a `[locale]` segment, every layout that renders `<html>` (typically `app/[locale]/layout.tsx`) must pass the locale through:

```tsx
export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={params.locale} dir={rtlLocales.has(params.locale) ? 'rtl' : 'ltr'}>
      <body>{children}</body>
    </html>
  );
}
```

Static `lang="en"` in a tree that serves German traffic shows up in the DOM as `lang="en"` for every user — hurts screen-reader pronunciation, hreflang alignment, and translation-service heuristics.

## Middleware matcher

The canonical Next.js docs pattern:

```ts
import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['en', 'es-MX', 'zh-Hans'];
const DEFAULT = 'en';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`);
  if (hasLocale) return NextResponse.next();
  const accept = request.headers.get('accept-language') ?? '';
  const chosen = pickLocale(accept, LOCALES) ?? DEFAULT;
  return NextResponse.redirect(new URL(`/${chosen}${pathname}`, request.url));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js)$).*)',
  ],
};
```

Critical: the matcher **must** exclude `_next/static`, `_next/image`, `api/*`, and common asset extensions. Without those exclusions, middleware fires on every asset request and returns a redirect for `.png` / `.svg` URLs. Asset 500s ensue.

## BCP 47 subset (what the classifier accepts)

The skill's regex for valid locale literals:

```
^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$
```

Matches:

- `en`, `es`, `fr`, `zh`, `ja` (primary only)
- `en-US`, `es-MX`, `zh-CN`, `pt-BR` (primary + region)
- `zh-Hans`, `zh-Hant`, `sr-Latn`, `sr-Cyrl` (primary + script)
- `zh-Hans-CN`, `sr-Cyrl-RS`, `uz-Latn-UZ` (primary + script + region)

Rejects:

- Uppercase primary: `EN-us`, `FR`
- Underscore separator: `zh_hans`, `en_US`
- Double hyphen: `es--MX`
- Legacy tags: `i-klingon`, `x-custom` (modern apps don't emit these)
- Full-name forms: `english`, `espanol`

## i18n-library detection

The skill treats these imports as "i18n library in use":

- `next-intl` — most popular in Next.js 15 App Router
- `next-i18next` — Pages Router legacy; still common
- `@lingui/macro`, `@lingui/react` — Lingui
- `react-intl` — Format.js family

When any of these imports appears in a file AND the file has JSX with hardcoded English-looking text outside `t()` / `<Trans>` / similar, the skill flags `hardcoded-string-with-i18n-lib-present`.

The "English-looking" heuristic is simple: 3+ ASCII words separated by spaces inside `>...<` JSX text. Heuristic can miss camelCase / short strings but avoids false-positives on identifiers and code comments. Teams with a larger set of hardcoded-string patterns can extend the regex per-project.

## What the skill does NOT check

- **Translation-key completeness** — `t('welcome')` assumes `welcome` exists in every locale file; verifying that is cross-file analysis, out of scope
- **Fallback chain** — if `zh-CN` has no translation, does it fall back to `zh-Hans` or `en`? Per-app judgment
- **RTL handling** — `dir={rtlLocales.has(locale) ? 'rtl' : 'ltr'}` is a convention; the skill doesn't require it
- **Locale-aware URL routing beyond the segment** — e.g. translated slugs (`/es/blog` vs `/es/articulos`) — out of scope
- **Accept-Language parsing correctness** — a middleware that accepts `*` naively is out of scope

## Modern i18n library notes

- **next-intl** (v4) has built-in App Router + middleware helpers. Use `createMiddleware` to avoid writing matcher logic by hand; the matcher it generates excludes assets automatically.
- **Paraglide-JS** (bundler-based) is gaining adoption in 2026 but the Next integration is still early. Out of scope for this skill.
- **Lingui** works cleanly with App Router via `@lingui/macro`. The compiled output reaches the same `t()` shape the skill checks for.

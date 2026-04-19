# Addy Osmani's Core Web Vitals leverage order

The procedure in `SKILL.md` § Step 3 orders recommendations **images → fonts → bundle → caching**. That ordering is not alphabetical, not audit-severity, and not what Lighthouse itself recommends. It reflects the measured leverage of each category on real Next.js apps, documented across Addy Osmani's talks and the web.dev performance archive.

Source: Addy Osmani, *"The Cost of JavaScript"* and follow-ups on web.dev (2018-2024).

## Why this order

### 1. Images — biggest LCP lever on most sites

On a median e-commerce page, the hero image is the LCP element. A 2 MB unoptimized PNG replaced with `next/image` in AVIF at the right size moves LCP from 4s+ to under 2s. The fix is also nearly free — one component swap per image — which is why it goes first.

### 2. Fonts — second-biggest LCP lever, and often a CLS lever too

Web fonts block text paint unless `font-display: swap` is set. A FOUT (flash of unstyled text) is survivable; a multi-hundred-millisecond delay on first paint is not. Worse, font-swap can shift layout if the fallback and final metrics diverge — `next/font` sizes the fallback to minimise that shift. Always self-host; a DNS round-trip on first paint is a real cost.

### 3. Bundle — INP lever, occasional LCP lever via render-blocking JS

Large JS bundles hurt INP (main-thread blocking), sometimes LCP (render-blocking scripts), and are invisible in a Lighthouse screenshot until you measure. `@next/bundle-analyzer` surfaces what is shipped. Dynamic-import heavy client code; default to Server Components; tree-shake ruthlessly. Bundle work is effort-intensive, which is why it sits below images and fonts — you want the easy wins first.

### 4. Caching — route-level LCP lever, everything-else lever at scale

Route segment config (`revalidate`, `force-cache`), `fetch({ next: { revalidate } })`, ISR, the Vercel Edge cache — these are how you turn a fast build into a fast end-user experience. They go last because they presume the upstream three are in order. A cache-hit on a 2 MB hero image is still a bad LCP on a cold viewport.

## Anti-patterns

- **Ordering by audit severity.** Lighthouse's audit list sorts by points-available, not engineering leverage. A high-severity audit recommending a tiny change can live below a low-severity audit recommending a category-wide refactor.
- **Ordering alphabetically.** No real leverage signal; skills that do this are surfacing tooling, not judgment.
- **Skipping images because "we use a CDN".** A CDN caches the asset; it does not resize it. An unoptimized 4000×3000 PNG served from a CDN is still a 3 MB LCP resource.

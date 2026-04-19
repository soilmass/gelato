# Known-heavy libraries (client bundle)

If any of these resolve into a client chunk, the `bundle-budget` skill flags it as `heavy-library-in-bundle`.

| Library | Approx gz size | Alternative |
|---|---|---|
| `moment` | ~70 KB | `date-fns` (2–5 KB cherry-picked), `dayjs` (2 KB), native `Intl.DateTimeFormat` |
| `lodash` (whole) | ~25 KB | `lodash-es` + named imports, or ES-native equivalents |
| `jquery` | ~30 KB | Remove. Modern browsers have `fetch`, `querySelector`, `classList` natively. |
| `chart.js` | ~55 KB | `@visx/*` with only the primitives you need, `recharts` with named imports, or server-rendered SVG charts |
| `handlebars` (client) | ~40 KB | Move templating to the server; return rendered HTML. |
| `lottie-web` | ~140 KB | `@lottiefiles/lottie-player` web component loaded on interaction, or an MP4 |
| `three` (for tiny use cases) | ~150 KB | Consider CSS 3D transforms or a preview image — Three.js is only worth it if 3D is core. |
| `leaflet` | ~40 KB | Acceptable if maps are core; otherwise use a static map image. |
| `quill` / `tinymce` / `ckeditor` | 100+ KB | `tiptap` with only the extensions you need; dynamic-import on interaction. |
| `firebase` (whole) | 100+ KB | Cherry-pick modular SDK: `firebase/auth`, `firebase/firestore` individually. |

## How to detect

Run `ANALYZE=true bun run build` and open the generated HTML. Look for any of the above names in a **client** chunk. A `server` chunk containing `moment` is fine (Server Components don't ship to the browser).

## The underlying rule

A library is "heavy" if swapping it for a lighter equivalent saves >20 KB gzipped. The list above is not exhaustive; any new dep that lands in a client chunk and weighs >20 KB gzipped earns the same scrutiny.

// Deliberate Core Web Vitals regressions:
//   - LCP: raw <img> without next/image optimization; large unoptimized asset
//     served as-is over the throttled Lighthouse connection.
//   - CLS: no width/height on the image; when it loads, everything below it
//     shifts down by the image's rendered height.
//   - TBT (INP proxy): a client-side busy loop that blocks the main thread
//     for 600ms right after hydration.
//
// All three are fixed in app/fixed/page.tsx — that route uses next/image
// with dimensions and priority, and omits the blocking client component.

import BusyClient from './busy-client';
import LateShifter from './late-shifter';

export default function Regressed() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Regressed</h1>
      {/* biome-ignore lint/a11y/useAltText: fixture deliberately triggers the audit. */}
      {/* biome-ignore lint/performance/noImgElement: fixture deliberately avoids next/image. */}
      <img src="/hero.jpg" />
      <LateShifter />
      <p>
        Text below the image. When the late-inserted banner above renders, it
        pushes this paragraph down — that is the cumulative layout shift
        Lighthouse records.
      </p>
      <BusyClient />
    </main>
  );
}

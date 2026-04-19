// Skill-guided version of /regressed. Three changes:
//   - next/image with explicit width/height (no CLS) and priority (fast LCP)
//   - No blocking client component on the main thread
//   - Same /hero.jpg asset — next/image auto-generates AVIF/WebP variants
//     sized to the layout width

import Image from 'next/image';

export default function Fixed() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Fixed</h1>
      <Image
        src="/hero.jpg"
        alt="Hero image — skill-optimized via next/image"
        width={1600}
        height={1200}
        priority
        sizes="(max-width: 800px) 100vw, 800px"
        style={{ height: 'auto', maxWidth: '100%' }}
      />
      <p>
        Text below the image. The image's explicit width and height reserve
        layout space at parse time, so nothing below shifts when the image
        decodes.
      </p>
    </main>
  );
}

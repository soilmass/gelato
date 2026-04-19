'use client';

import { useEffect, useState } from 'react';

// Blocks the main thread for 600ms after hydration. Lighthouse records this
// as Total Blocking Time because it is a single > 50ms task after TTI. The
// skill's /fixed route omits this component entirely.

export default function BusyClient() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    // biome-ignore lint/correctness/noUnusedVariables: intentional busy loop
    let junk = 0;
    while (performance.now() - start < 600) {
      junk += Math.sqrt(Math.random() * 10_000);
    }
    setDone(true);
  }, []);

  return (
    <p style={{ marginTop: 16, color: done ? '#0a7' : '#a70' }}>
      Busy client {done ? 'finished' : 'running'}.
    </p>
  );
}

'use client';

import { useEffect, useState } from 'react';

// Late-rendered block that appears after first paint with no reserved space.
// Forces a measurable Cumulative Layout Shift on the /regressed route.
// The /fixed route omits this component entirely — that is the skill's
// "reserve the slot" guidance applied.

export default function LateShifter() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Fires within Lighthouse's navigation trace window so the shift is
    // captured. The skill's /fixed route simply omits this component and
    // reserves no phantom space that needs filling.
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 24,
        background: '#fee',
        border: '1px solid #f88',
        // Deliberately tall so the shift is unambiguous in Lighthouse's
        // viewport. A marginal shift would measure under the 0.1 threshold.
        minHeight: 400,
      }}
    >
      <h2 style={{ margin: 0 }}>Late-inserted banner</h2>
      <p>
        This block appears after hydration with no reserved height. When it
        renders it pushes the content below down — that is the cumulative
        layout shift Lighthouse records.
      </p>
      <p>Filler line 1 to guarantee the block occupies a large share of the viewport.</p>
      <p>Filler line 2.</p>
      <p>Filler line 3.</p>
      <p>Filler line 4.</p>
    </div>
  );
}

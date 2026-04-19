# Canonical `.lighthouserc.json` assertions for Core Web Vitals

Drop-in configuration for the three threshold assertions this skill enforces. Source: web.dev Core Web Vitals (2024-Q4 revision).

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/"
      ],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

## Notes on the shape

- **Three runs, aggregated.** `numberOfRuns: 3` gives Lighthouse CI three samples. It reports the median, which absorbs noise better than a single run.
- **Desktop preset.** The default preset is mobile and throttled, which is correct for real-user assessment but noisy for a CI fixture. Switch to `mobile` once your fixture app is stable.
- **`maxNumericValue` uses the web.dev "good" boundary.** Do not relax these in the repo config to make CI green. Fix the underlying performance cause or pause the assertion behind an issue tracker.
- **`interaction-to-next-paint`** replaced `first-input-delay` in Lighthouse 11 (March 2024). If your `@lhci/cli` is pinned below 0.13, the assertion falls back to FID — upgrade.
- **`temporary-public-storage`** uploads the run to a short-lived Lighthouse-hosted URL so CI comments can link to the full report. Swap to a self-hosted LHCI server if your compliance surface forbids third-party uploads.

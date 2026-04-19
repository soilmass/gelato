// Lighthouse wrapper for metric-type skill evals.
//
// Single entry point: `runLighthouse(url, options)` launches a headless
// Chrome, runs one Lighthouse audit, and returns the four Web-Vitals
// relevant numbers. The skill's eval decides which it asserts on.
//
// Notes on the shape:
//   - INP is a field-only metric as of March 2024. Lighthouse reports it as
//     null in lab runs. Metric skills that care about responsiveness should
//     assert on TBT as the documented lab proxy.
//   - Lighthouse's default preset is mobile (4G throttling + CPU slowdown).
//     Override with options.preset when your fixture is desktop-primary.
//   - Chrome is launched via chrome-launcher; CHROME_PATH in the environment
//     wins over the default lookup (Playwright's installed chromium works).

import { type LaunchedChrome, launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

export interface CWVMetrics {
  // All in milliseconds, except CLS (unitless). `null` when Lighthouse could
  // not measure the audit — always true for INP in lab, sometimes true for
  // others on very simple pages.
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  inp: number | null;
}

export interface RunLighthouseOptions {
  preset?: 'mobile' | 'desktop';
  // Chrome flags appended after defaults. Defaults are safe in CI sandboxes.
  chromeFlags?: string[];
  // Logs lighthouse progress to stderr at the given level.
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'verbose';
  // Optional override of the chrome binary. Falls back to CHROME_PATH env or
  // chrome-launcher's auto-detection.
  chromePath?: string;
}

const DEFAULT_CHROME_FLAGS = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'];

export async function runLighthouse(
  url: string,
  options: RunLighthouseOptions = {},
): Promise<CWVMetrics> {
  const chromeFlags = [...DEFAULT_CHROME_FLAGS, ...(options.chromeFlags ?? [])];
  const chromePath = options.chromePath ?? process.env.CHROME_PATH;

  let chrome: LaunchedChrome | undefined;
  try {
    chrome = await launch({ chromeFlags, ...(chromePath ? { chromePath } : {}) });
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: options.logLevel ?? 'error',
      onlyCategories: ['performance'],
      ...(options.preset === 'desktop' ? { preset: 'desktop' as const } : {}),
    });
    if (!result) {
      throw new Error(`lighthouse returned no result for ${url}`);
    }
    const audits = result.lhr.audits;
    return {
      lcp: numericOrNull(audits['largest-contentful-paint']?.numericValue),
      cls: numericOrNull(audits['cumulative-layout-shift']?.numericValue),
      tbt: numericOrNull(audits['total-blocking-time']?.numericValue),
      inp: numericOrNull(audits['interaction-to-next-paint']?.numericValue),
    };
  } finally {
    await chrome?.kill();
  }
}

function numericOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

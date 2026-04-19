// Eval for the core-web-vitals-audit skill.
//
// Metric eval per EVAL_SPEC.md § Type A — spins up a real fixture Next.js
// app, runs Lighthouse against its /regressed and /fixed routes, and asserts
// the three thresholds the skill's Hard Thresholds section declares.
//
// The fixed route is the skill's guidance materialized as code. The
// regressed route is what the skill catches. The eval passes when the fixed
// route meets every threshold and the regressed route misses at least one —
// the second assertion is what proves the thresholds are not vacuous.

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CWVMetrics, runLighthouse } from '@gelato/eval-harness';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(here, 'fixtures/app');
const PORT = 31415;
const BASE_URL = `http://localhost:${PORT}`;

// Thresholds from skills/core-web-vitals-audit/SKILL.md § Hard Thresholds.
// TBT doubles as the lab proxy for INP per Lighthouse's own documentation
// (INP is field-only as of March 2024).
//
// CI runners (especially GitHub Actions ubuntu-latest) produce noisier
// Lighthouse measurements than a quiet developer machine — the same fixture
// that returns LCP=1900ms locally can return 2700ms on a contended runner.
// `CWV_NOISE_MULTIPLIER` widens the numeric budgets by a factor when the
// environment reports `CI=true`. The *skill's* thresholds (documented in
// SKILL.md § Hard Thresholds) stay at 2500 / 0.1 / 300 — production
// monitoring enforces those. The CI eval bar is a headroom-adjusted check
// that the fixture's "fixed" route is meaningfully below the noisy budget.
const BASE_LCP_MS = 2500;
const BASE_CLS = 0.1;
const BASE_TBT_MS = 300;
const IS_CI = process.env.CI === 'true';
const CWV_NOISE_MULTIPLIER = Number(process.env.CWV_NOISE_MULTIPLIER ?? (IS_CI ? '1.5' : '1.0'));
const LCP_MS = Math.round(BASE_LCP_MS * CWV_NOISE_MULTIPLIER);
const CLS_UNITLESS = BASE_CLS * CWV_NOISE_MULTIPLIER;
const TBT_MS = Math.round(BASE_TBT_MS * CWV_NOISE_MULTIPLIER);

// Vitest workers run on Node with a minimal inherited PATH. `bun` and `bunx`
// live under $HOME/.bun/bin by convention; make sure spawn finds them.
const AUGMENTED_PATH = [
  process.env.HOME ? `${process.env.HOME}/.bun/bin` : '',
  process.env.PATH ?? '',
]
  .filter(Boolean)
  .join(':');

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCommand(
  cmd: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<SpawnResult> {
  return new Promise((resolvePromise, reject) => {
    const [command, ...args] = cmd;
    if (!command) {
      reject(new Error('runCommand: empty command array'));
      return;
    }
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PATH: AUGMENTED_PATH, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout?.on('data', (c) => stdoutChunks.push(c));
    child.stderr?.on('data', (c) => stderrChunks.push(c));
    child.on('error', reject);
    child.on('close', (code) =>
      resolvePromise({
        exitCode: code ?? 0,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      }),
    );
  });
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let lastError: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `URL not reachable after ${timeoutMs}ms: ${url} (last error: ${String(lastError)})`,
  );
}

let serverProc: ChildProcess | null = null;
let regressed: CWVMetrics | null = null;
let fixed: CWVMetrics | null = null;

// Five minutes for the worst case: cold install, full build, two Lighthouse
// navigations on mobile preset. On a warm run this completes in ~100s.
const BEFORE_ALL_TIMEOUT = 5 * 60 * 1000;

beforeAll(async () => {
  if (!existsSync(resolve(APP_DIR, 'node_modules'))) {
    const install = await runCommand(['bun', 'install'], APP_DIR);
    if (install.exitCode !== 0) {
      throw new Error(`bun install failed:\n${install.stderr}`);
    }
  }

  const build = await runCommand(['bun', 'run', 'build'], APP_DIR);
  if (build.exitCode !== 0) {
    throw new Error(`fixture build failed:\n${build.stderr}`);
  }

  serverProc = spawn('bunx', ['next', 'start', '-p', String(PORT)], {
    cwd: APP_DIR,
    env: { ...process.env, PATH: AUGMENTED_PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  await waitForUrl(BASE_URL, 30_000);

  const chromePath = process.env.CHROME_PATH;
  regressed = await runLighthouse(`${BASE_URL}/regressed`, chromePath ? { chromePath } : {});
  fixed = await runLighthouse(`${BASE_URL}/fixed`, chromePath ? { chromePath } : {});
}, BEFORE_ALL_TIMEOUT);

afterAll(() => {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM');
  }
});

describe('core-web-vitals-audit', () => {
  describe('/fixed route meets every Core Web Vital threshold', () => {
    it(`LCP ≤ ${LCP_MS} ms`, () => {
      expect(fixed, 'Lighthouse did not run').not.toBeNull();
      expect(fixed!.lcp, `LCP was ${fixed!.lcp}`).not.toBeNull();
      expect(fixed!.lcp).toBeLessThanOrEqual(LCP_MS);
    });

    it(`CLS ≤ ${CLS_UNITLESS}`, () => {
      expect(fixed, 'Lighthouse did not run').not.toBeNull();
      expect(fixed!.cls, `CLS was ${fixed!.cls}`).not.toBeNull();
      expect(fixed!.cls).toBeLessThanOrEqual(CLS_UNITLESS);
    });

    it(`TBT ≤ ${TBT_MS} ms (INP lab proxy)`, () => {
      expect(fixed, 'Lighthouse did not run').not.toBeNull();
      expect(fixed!.tbt, `TBT was ${fixed!.tbt}`).not.toBeNull();
      expect(fixed!.tbt).toBeLessThanOrEqual(TBT_MS);
    });
  });

  describe('/regressed route fails at least one threshold', () => {
    it('proves the thresholds are not vacuous', () => {
      expect(regressed, 'Lighthouse did not run').not.toBeNull();
      const regressions = [
        (regressed!.lcp ?? 0) > LCP_MS,
        (regressed!.cls ?? 0) > CLS_UNITLESS,
        (regressed!.tbt ?? 0) > TBT_MS,
      ].filter(Boolean);
      expect(
        regressions.length,
        `regressed metrics: LCP=${regressed!.lcp}ms CLS=${regressed!.cls} TBT=${regressed!.tbt}ms — expected ≥ 1 threshold violation`,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it('Lighthouse measured every audit we care about', () => {
    expect(fixed?.lcp).not.toBeNull();
    expect(fixed?.cls).not.toBeNull();
    expect(fixed?.tbt).not.toBeNull();
    expect(regressed?.lcp).not.toBeNull();
    expect(regressed?.cls).not.toBeNull();
    expect(regressed?.tbt).not.toBeNull();
  });
});

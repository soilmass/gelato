// Eval for the ci-cd-next-on-vercel skill.
//
// Deterministic classifier over GitHub Actions workflow YAML fixtures.
// Detects the four workflow-hygiene violations in SKILL.md § Procedure:
//
//   - unpinned-action            — `uses: org/action@main|master|HEAD|
//     latest` OR `uses: org/action` with no @version. Local reusable
//     workflows (`./.github/workflows/x.yml`) are exempt.
//   - secret-echoed-in-run       — a `run:` line contains either a
//     direct `echo ${{ secrets.X }}`, an `env | grep/>` dump, or an
//     `echo $VAR` where VAR is bound to `${{ secrets.Y }}` in the
//     file's env: blocks.
//   - missing-concurrency-cancel — top-level `concurrency:` block is
//     absent. Cancel-true / cancel-false both accepted.
//   - no-timeout-minutes         — any job with `runs-on:` (i.e. a
//     normal job, not a reusable-workflow call) lacks
//     `timeout-minutes:`.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'unpinned-action',
  'secret-echoed-in-run',
  'missing-concurrency-cancel',
  'no-timeout-minutes',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// --- unpinned-action ----------------------------------------------------

const USES_LINE_RE = /^\s*-?\s*uses\s*:\s*(.+?)\s*$/;
const FLOATING_REFS = new Set(['main', 'master', 'head', 'latest']);

function hasUnpinnedAction(body: string): boolean {
  for (const line of body.split('\n')) {
    const m = USES_LINE_RE.exec(line);
    if (!m) continue;
    const ref = (m[1] ?? '').trim();
    if (ref.startsWith('./') || ref.startsWith('../')) continue;
    const atIdx = ref.lastIndexOf('@');
    if (atIdx === -1) return true;
    const version = ref.slice(atIdx + 1).toLowerCase();
    if (FLOATING_REFS.has(version)) return true;
  }
  return false;
}

// --- secret-echoed-in-run -----------------------------------------------

function hasSecretEchoedInRun(body: string): boolean {
  // Collect env var names bound to secrets (e.g. `VERCEL_TOKEN: ${{ secrets.X }}`).
  const secretBoundVars: string[] = [];
  for (const line of body.split('\n')) {
    const m = /^\s+([A-Z_][A-Z0-9_]*)\s*:\s*\$\{\{\s*secrets\./.exec(line);
    if (m) secretBoundVars.push(m[1] ?? '');
  }

  for (const line of body.split('\n')) {
    // Direct secrets interpolation in echo / printf / cat / printenv.
    if (/\b(?:echo|printf|cat|printenv)\b.*\$\{\{\s*secrets\./i.test(line)) return true;
    // env dump (env | grep / env > / env >> ...).
    if (/\benv\s*[|>]/.test(line)) return true;
    // echo of a secret-bound env var.
    for (const name of secretBoundVars) {
      const echoRe = new RegExp(`\\b(?:echo|printf)\\b[^\\n]*\\$${name}\\b`);
      if (echoRe.test(line)) return true;
    }
  }
  return false;
}

// --- missing-concurrency-cancel ----------------------------------------

function hasMissingConcurrency(body: string): boolean {
  return !/^concurrency\s*:/m.test(body);
}

// --- no-timeout-minutes ------------------------------------------------

function hasMissingJobTimeout(body: string): boolean {
  const lines = body.split('\n');
  const JOB_KEY_RE = /^ {2}([a-zA-Z_][\w-]*)\s*:\s*$/;
  const jobBoundaries: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (JOB_KEY_RE.test(lines[i] ?? '')) jobBoundaries.push(i);
  }
  if (jobBoundaries.length === 0) return false;
  jobBoundaries.push(lines.length);

  for (let k = 0; k < jobBoundaries.length - 1; k++) {
    const start = jobBoundaries[k] ?? 0;
    const end = jobBoundaries[k + 1] ?? lines.length;
    const block = lines.slice(start, end).join('\n');
    // Skip reusable-workflow jobs: no `runs-on:` at 4-space indent.
    if (!/^ {4}runs-on\s*:/m.test(block)) continue;
    if (!/^ {4}timeout-minutes\s*:/m.test(block)) return true;
  }
  return false;
}

// --- Top-level classifier ----------------------------------------------

function classify(body: string): Classification {
  if (hasUnpinnedAction(body)) return 'unpinned-action';
  if (hasSecretEchoedInRun(body)) return 'secret-echoed-in-run';
  if (hasMissingConcurrency(body)) return 'missing-concurrency-cancel';
  if (hasMissingJobTimeout(body)) return 'no-timeout-minutes';
  return 'safe';
}

describe('ci-cd-next-on-vercel', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies 12 violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBe(12);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const accuracy = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        accuracy,
        `misclassified: ${
          wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') ||
          '(none)'
        }`,
      ).toBeGreaterThanOrEqual(0.95);
    });

    it('zero false positives on 5 safe fixtures', async () => {
      const fixtures = await loadFixtures(SAFE_DIR);
      expect(fixtures.length).toBe(5);
      const falsePositives = fixtures
        .map((f) => ({ name: f.name, predicted: classify(f.content) }))
        .filter((r) => r.predicted !== 'safe');
      expect(
        falsePositives.map((r) => `${r.name} (got ${r.predicted})`),
        'every safe fixture must classify as safe',
      ).toEqual([]);
    });

    it('classifier generalizes to held-out adversarial fixtures at ≥ 90%', async () => {
      const fixtures = await loadFixtures(HELD_OUT_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(6);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = (f.metadata.class ?? f.metadata.expected) as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const accuracy = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        accuracy,
        `held-out misclassified: ${
          wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') ||
          '(none)'
        }`,
      ).toBeGreaterThanOrEqual(0.9);
    });
  });

  it('fixture inventory matches SKILL.md § Evaluation', async () => {
    const safe = await loadFixtures(SAFE_DIR);
    const violations = await loadFixtures(VIOLATIONS_DIR);
    expect(safe.length).toBe(5);
    expect(violations.length).toBe(12);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });
});

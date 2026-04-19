// Eval for the bundle-budget skill.
//
// Deterministic classifier over Next.js build-report JSON fixtures.
// Detects the four budget violations in SKILL.md § Procedure using
// threshold rules:
//
//   - server-only-leaked-to-client — any client chunk's deps include
//     a server-only library (e.g. @prisma/client, bcrypt, sharp, pg).
//     Chunks whose name starts with `server-` are exempt (RSC-only).
//   - heavy-library-in-bundle       — any chunk's deps include a
//     known-heavy library (moment, full lodash, jquery, chart.js,
//     handlebars, lottie-web).
//   - route-over-budget             — any route.firstLoadJsKb > 150.
//   - shared-budget-exceeded        — sharedKb > 100.
//
// No LLM-as-judge half for v0.1 — the thresholds are numeric and the
// lists are literal sets. A v0.2 LLM rubric could reason about
// ambiguous libraries (e.g. "is recharts heavy in context?").

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isJudgeAvailable, judgeWithPromptfoo, loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'server-only-leaked-to-client',
  'heavy-library-in-bundle',
  'route-over-budget',
  'shared-budget-exceeded',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

interface Route {
  path: string;
  firstLoadJsKb: number;
}
interface Bundle {
  chunk: string;
  deps: string[];
}
interface Report {
  routes: Route[];
  sharedKb: number;
  bundles: Bundle[];
}

const SERVER_ONLY_LIBS = new Set([
  '@prisma/client',
  'bcrypt',
  'bcryptjs',
  'argon2',
  'sharp',
  'pg',
  'pg-native',
  'mysql',
  'mysql2',
  'sqlite3',
  'better-sqlite3',
  'mongodb',
  'mongoose',
  'redis',
  'ioredis',
  'nodemailer',
]);

const HEAVY_LIBS = new Set(['moment', 'lodash', 'jquery', 'chart.js', 'handlebars', 'lottie-web']);

const ROUTE_BUDGET_KB = 150;
const SHARED_BUDGET_KB = 100;

function classify(content: string): Classification {
  const report = JSON.parse(content) as Report;

  // 1. Server-only library leaked into a client chunk.
  for (const bundle of report.bundles ?? []) {
    if (bundle.chunk.startsWith('server-')) continue;
    for (const dep of bundle.deps ?? []) {
      if (SERVER_ONLY_LIBS.has(dep)) return 'server-only-leaked-to-client';
    }
  }

  // 2. Heavy library anywhere in the client bundles.
  for (const bundle of report.bundles ?? []) {
    if (bundle.chunk.startsWith('server-')) continue;
    for (const dep of bundle.deps ?? []) {
      if (HEAVY_LIBS.has(dep)) return 'heavy-library-in-bundle';
    }
  }

  // 3. Any route over 150 KB First Load JS.
  for (const route of report.routes ?? []) {
    if (route.firstLoadJsKb > ROUTE_BUDGET_KB) return 'route-over-budget';
  }

  // 4. Shared chunks over 100 KB.
  if ((report.sharedKb ?? 0) > SHARED_BUDGET_KB) return 'shared-budget-exceeded';

  return 'safe';
}

describe('bundle-budget', () => {
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

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"library-severity" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'library-severity',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

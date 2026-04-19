// Eval for the eval-harness-pattern skill.
//
// Meta eval — every fixture is a candidate `evals/<name>/eval.test.ts`
// source. Classifier checks five rules from EVAL_SPEC.md.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isJudgeAvailable,
  judgeWithPromptfoo,
  loadFixtures,
  stripComments,
} from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'eval-missing-quantitative',
  'eval-missing-safe-dir',
  'eval-missing-held-out',
  'eval-missing-threshold',
  'eval-judge-not-gated',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// Metric-type exemption: if the file imports runLighthouse or
// runSkillWithClaude (the real-tool halves), skip Steps 1-3.
function isMetricEval(source: string): boolean {
  return /\brunLighthouse\b|\brunSkillWithClaude\b/.test(source);
}

function refersTo(source: string, constant: string): boolean {
  // Match either `loadFixtures(<CONSTANT>)` or the bare constant usage.
  const re = new RegExp(`\\bloadFixtures\\s*\\(\\s*${constant}\\b|\\b${constant}\\b`);
  return re.test(source);
}

function hasAnyQuantitative(source: string): boolean {
  return /\bloadFixtures\s*\(\s*VIOLATIONS_DIR\b/.test(source);
}

function hasNumericThreshold(source: string): boolean {
  // Find every toBeGreaterThanOrEqual(<N>); at least one must be ≥ 0.8.
  const re = /\.toBeGreaterThanOrEqual\s*\(\s*([\d.]+)\s*\)/g;
  let found = false;
  for (;;) {
    const m = re.exec(source);
    if (!m) break;
    const n = Number.parseFloat(m[1] ?? '0');
    if (!Number.isNaN(n) && n >= 0.8) found = true;
  }
  return found;
}

function hasJudgeNotGated(source: string): boolean {
  // If judgeWithPromptfoo is called, every call site must be inside a
  // describe.skipIf(!isJudgeAvailable())(...) block. Simple check:
  // count judge calls and skipIf blocks. If judge calls > 0 and
  // describe.skipIf is absent anywhere in the file, flag.
  if (!/\bjudgeWithPromptfoo\s*\(/.test(source)) return false;
  return !/describe\.skipIf\s*\(\s*!\s*isJudgeAvailable\s*\(\s*\)\s*\)/.test(source);
}

function classify(body: string): Classification {
  const source = stripComments(body);
  const metric = isMetricEval(source);
  // Step 5 (judge gating) applies to all eval types.
  if (hasJudgeNotGated(source)) return 'eval-judge-not-gated';
  // Step 4 (threshold) — applies to any eval with a toBeGreaterThanOrEqual.
  // Only flag if the file has at least one such assertion but none ≥ 0.8.
  if (/\.toBeGreaterThanOrEqual\s*\(/.test(source) && !hasNumericThreshold(source)) {
    return 'eval-missing-threshold';
  }
  if (metric) return 'safe';
  // Steps 1-3 (fixture coverage) — Type-A only.
  if (!hasAnyQuantitative(source)) return 'eval-missing-quantitative';
  if (!refersTo(source, 'SAFE_DIR')) return 'eval-missing-safe-dir';
  if (!refersTo(source, 'HELD_OUT_DIR')) return 'eval-missing-held-out';
  return 'safe';
}

describe('eval-harness-pattern', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 5 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const acc = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        acc,
        `misclassified: ${
          wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') ||
          '(none)'
        }`,
      ).toBeGreaterThanOrEqual(0.95);
    });

    it('zero false positives on safe fixtures', async () => {
      const fixtures = await loadFixtures(SAFE_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
      const fp = fixtures
        .map((f) => ({ name: f.name, predicted: classify(f.content) }))
        .filter((r) => r.predicted !== 'safe');
      expect(fp.map((r) => `${r.name} (got ${r.predicted})`)).toEqual([]);
    });

    it('classifier generalizes to held-out adversarial fixtures at ≥ 90%', async () => {
      const fixtures = await loadFixtures(HELD_OUT_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = (f.metadata.class ?? f.metadata.expected) as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const acc = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        acc,
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
    expect(safe.length).toBeGreaterThanOrEqual(4);
    expect(violations.length).toBeGreaterThanOrEqual(5);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"eval-contract-thoroughness" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'eval-contract-thoroughness',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

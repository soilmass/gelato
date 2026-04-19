// Eval for the drift-check-workflow skill.
//
// Meta eval — every fixture is a candidate `.github/workflows/drift-*.yml`
// source. Classifier checks five shape rules per Gelato's own drift pattern
// (see skills/drift-check-workflow/references/drift-pattern.md).

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
  'drift-workflow-missing-schedule',
  'drift-workflow-missing-dispatch',
  'drift-workflow-missing-fetch',
  'drift-workflow-missing-checkout',
  'drift-workflow-missing-concurrency',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// Strip `#` comments line by line so commented-out `- cron:` etc. don't
// satisfy the check. Preserves inline comments only before # appears.
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      // naive: drop everything after the first unquoted #
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (ch === '#' && !inSingle && !inDouble) return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

function hasSchedule(source: string): boolean {
  return /^\s*schedule\s*:/m.test(source) && /^\s*-\s*cron\s*:/m.test(source);
}

function hasWorkflowDispatch(source: string): boolean {
  return /^\s*workflow_dispatch\s*:/m.test(source);
}

function hasFetch(source: string): boolean {
  return /\b(curl|wget)\b/.test(source);
}

function hasCheckout(source: string): boolean {
  return /\bactions\/checkout(?:@|\b)/.test(source);
}

function hasConcurrency(source: string): boolean {
  return /^concurrency\s*:/m.test(source);
}

function classify(body: string): Classification {
  const source = stripComments(body);
  if (!hasSchedule(source)) return 'drift-workflow-missing-schedule';
  if (!hasWorkflowDispatch(source)) return 'drift-workflow-missing-dispatch';
  if (!hasFetch(source)) return 'drift-workflow-missing-fetch';
  if (!hasCheckout(source)) return 'drift-workflow-missing-checkout';
  if (!hasConcurrency(source)) return 'drift-workflow-missing-concurrency';
  return 'safe';
}

describe('drift-check-workflow', () => {
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
    it('"drift-workflow-thoroughness" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'drift-workflow-thoroughness',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

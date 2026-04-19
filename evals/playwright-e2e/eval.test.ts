// Eval for the playwright-e2e skill.
//
// Deterministic classifier over Playwright `*.spec.ts` fixtures. Detects
// the four "Best Practices" violations in SKILL.md § Procedure:
//
//   - test-only-committed    — test.only( or test.describe.only( in
//     committed code (outside comments)
//   - hardcoded-wait         — page.waitForTimeout( or setTimeout( in
//     a test file (the slow/flaky anti-pattern)
//   - css-selector-locator   — .locator('.foo'), '#id', '[attr]',
//     'xpath=...', or any combinator selector (space, >, +, ~)
//   - imperative-assertion   — expect(await <x>.isVisible()).toBe(…)
//     / textContent / inputValue / getAttribute / count — single-
//     point-in-time, no auto-wait
//
// No LLM-as-judge half for v0.1. A v0.2 rubric could judge test
// meaningfulness beyond "page loaded".

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'test-only-committed',
  'hardcoded-wait',
  'css-selector-locator',
  'imperative-assertion',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function stripComments(body: string): string {
  const noBlock = body.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return noBlock.replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

const TEST_ONLY_RE = /\btest\s*\.\s*(?:only|describe\s*\.\s*only)\s*\(/;

const HARDCODED_WAIT_RE = /\bpage\s*\.\s*waitForTimeout\s*\(|\bsetTimeout\s*\(/;

// Match `.locator('...')` where the inner string is delimited by matching
// quotes. Use a backreference so an inner `"` inside a single-quoted string
// doesn't terminate the match (e.g. `'xpath=//[@class="x"]'`).
const LOCATOR_CALL_RE = /\.locator\s*\(\s*(['"`])((?:(?!\1).)*)\1/g;

function hasCssSelectorLocator(body: string): boolean {
  for (const match of body.matchAll(LOCATOR_CALL_RE)) {
    const selector = match[2] ?? '';
    if (selector.startsWith('.')) return true;
    if (selector.startsWith('#')) return true;
    if (selector.startsWith('[')) return true;
    if (selector.startsWith('xpath=')) return true;
    if (/[\s>+~]/.test(selector)) return true;
  }
  return false;
}

const IMPERATIVE_METHODS = [
  'isVisible',
  'isHidden',
  'isEnabled',
  'isDisabled',
  'isChecked',
  'textContent',
  'inputValue',
  'getAttribute',
  'count',
];

// Scan `expect( await <anything>.methodName( ... ) )` allowing nested parens
// inside <anything> (e.g. `page.getByRole('heading')`). Track paren depth
// from the open paren after `expect`.
function hasImperativeAssertion(body: string): boolean {
  const expectAwaitRe = /\bexpect\s*\(\s*await\s+/g;
  for (const match of body.matchAll(expectAwaitRe)) {
    if (match.index === undefined) continue;
    const start = match.index + match[0].length;
    let depth = 1; // consumed `expect(`
    let innerEnd = -1;
    for (let i = start; i < body.length; i++) {
      const ch = body[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          innerEnd = i;
          break;
        }
      }
    }
    if (innerEnd === -1) continue;
    const inner = body.slice(start, innerEnd);
    for (const method of IMPERATIVE_METHODS) {
      const methodRe = new RegExp(`\\.${method}\\s*\\(`);
      if (methodRe.test(inner)) return true;
    }
  }
  return false;
}

function classify(raw: string): Classification {
  const body = stripComments(raw);

  if (TEST_ONLY_RE.test(body)) return 'test-only-committed';
  if (HARDCODED_WAIT_RE.test(body)) return 'hardcoded-wait';
  if (hasCssSelectorLocator(body)) return 'css-selector-locator';
  if (hasImperativeAssertion(body)) return 'imperative-assertion';

  return 'safe';
}

describe('playwright-e2e', () => {
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

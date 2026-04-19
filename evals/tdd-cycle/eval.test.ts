// Eval for the tdd-cycle skill.
//
// Deterministic classifier over Vitest test fixtures. Detects the four
// Testing-Trophy / testing-library anti-patterns in SKILL.md § Procedure:
//
//   - shallow-or-enzyme           — imports/uses Enzyme (`shallow(`,
//     `mount(`) or calls `.state(` / `.instance(` on a wrapper
//   - testing-implementation-detail — `.prototype` / `.__dunder` access,
//     or `vi.spyOn(x, '_private')` on an underscore-prefixed name
//   - skipped-no-reason           — `.skip(` with no adjacent issue
//     marker (`#N`, TODO, FIXME, "see", "waiting on", "tracked")
//   - no-assertion                — top-level `it(...)` / `test(...)`
//     (not `.skip`/`.only`/`.todo`/`.each`) whose callback contains no
//     `expect(`
//
// The "test quality" rubric (is the assertion meaningful?) is fuzzy
// and deferred to a v0.2 LLM judge — per the roadmap flag.

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
  'shallow-or-enzyme',
  'testing-implementation-detail',
  'skipped-no-reason',
  'no-assertion',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function stripComments(body: string): string {
  const noBlock = body.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return noBlock.replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// Matching close-paren scan tracking depth from the `(` at openParenIdx.
function matchCloseParen(body: string, openParenIdx: number): number {
  if (body[openParenIdx] !== '(') return -1;
  let depth = 0;
  for (let i = openParenIdx; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// --- shallow-or-enzyme --------------------------------------------------

function hasEnzymePattern(body: string): boolean {
  if (/\bfrom\s+['"]enzyme['"]/.test(body)) return true;
  if (/\bshallow\s*\(/.test(body)) return true;
  if (/\bmount\s*\(/.test(body)) return true;
  // wrapper.state(...) / wrapper.instance() — method calls on a wrapper
  if (/\.state\s*\(/.test(body)) return true;
  if (/\.instance\s*\(/.test(body)) return true;
  return false;
}

// --- testing-implementation-detail --------------------------------------

function hasImplementationDetailAccess(raw: string): boolean {
  // .prototype anywhere in a test file — tests shouldn't poke at prototypes.
  if (/\.prototype\b/.test(raw)) return true;
  // .__something — dunder access on an object (not a local variable).
  if (/\.__\w+/.test(raw)) return true;
  // spyOn(module, '_private') — mocking a private helper.
  if (/spyOn\s*\([^,]+,\s*['"`]_\w+['"`]/.test(raw)) return true;
  return false;
}

// --- skipped-no-reason --------------------------------------------------

const REASON_MARKER_RE =
  /#\d+|\b(?:TODO|FIXME|NOTE)\b|\bsee\s+(?:issue|#|\[|\w)|\bwaiting\s+on\b|\btracked\s+in\b/i;

function isSkippedWithoutReason(raw: string): boolean {
  const skipRe = /\b(?:it|test|describe)\.skip\s*\(/g;
  for (const match of raw.matchAll(skipRe)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(raw, openParen);
    const windowStart = Math.max(0, match.index - 200);
    const windowEnd = closeParen === -1 ? Math.min(raw.length, match.index + 200) : closeParen;
    const window = raw.slice(windowStart, windowEnd);
    if (!REASON_MARKER_RE.test(window)) return true;
  }
  return false;
}

// --- no-assertion -------------------------------------------------------
//
// Iterate over every `it(…)` / `test(…)` call (NOT `.skip` / `.only` /
// `.todo` / `.each`) and check its contents for `expect(`.

function hasNoAssertionTest(body: string): boolean {
  const testCallRe = /\b(?:it|test)\b(?!\s*\.)\s*\(/g;
  for (const match of body.matchAll(testCallRe)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(body, openParen);
    if (closeParen === -1) continue;
    const inner = body.slice(openParen + 1, closeParen);
    if (!/\bexpect\s*\(/.test(inner)) return true;
  }
  return false;
}

// --- Top-level classifier -----------------------------------------------

function classify(raw: string): Classification {
  const body = stripComments(raw);

  if (hasEnzymePattern(body)) return 'shallow-or-enzyme';
  if (hasImplementationDetailAccess(body)) return 'testing-implementation-detail';
  // Use raw (not stripped) for skipped-no-reason: the adjacent comment is
  // what rescues a skip from violation, so stripping comments would over-flag.
  if (isSkippedWithoutReason(raw)) return 'skipped-no-reason';
  if (hasNoAssertionTest(body)) return 'no-assertion';

  return 'safe';
}

describe('tdd-cycle', () => {
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
    it('"unit-test-meaningfulness" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'unit-test-meaningfulness',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

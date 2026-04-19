// Eval for the axe-playwright skill.
//
// Procedural eval per EVAL_SPEC.md § Type B. Deterministic
// classifier over Playwright *.spec.ts fixtures.

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
  'page-without-axe-scan',
  'violations-ignored',
  'disabled-rules-undocumented',
  'scan-limited-to-bestpractice-only',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// ---------- signals ----------

const PAGE_GOTO_RE = /\bpage\.goto\s*\(/;
const AXE_BUILDER_NEW_RE = /\bnew\s+AxeBuilder\s*\(/;
const AXE_WRAPPER_IMPORT_RE = /\bfrom\s+['"][^'"]*axe[^'"]*['"]/i;
const ANALYZE_CALL_RE = /\.analyze\s*\(\s*\)/g;
const DISABLE_RULES_RE = /\.disableRules\s*\(/g;
const OPTIONS_RUN_ONLY_RE = /\.options\s*\(\s*\{\s*runOnly\s*:\s*\{[^}]*\}/;

function hasPageWithoutScan(stripped: string, raw: string): boolean {
  if (!PAGE_GOTO_RE.test(stripped)) return false;
  if (AXE_BUILDER_NEW_RE.test(stripped)) return false;
  // Allow an imported wrapper whose import path contains `axe`.
  if (AXE_WRAPPER_IMPORT_RE.test(raw)) return false;
  return true;
}

// Step 2: every .analyze() call must produce a result that ends up in an
// assertion of the form expect(<X>).toEqual([]) / toStrictEqual([]) /
// toHaveLength(0), where <X> references `violations` (directly or via a
// derived binding). Two classes of violation:
//   (a) `.analyze()` call with no assignment (fire-and-forget).
//   (b) `.analyze()` calls exist but no violations-shaped assertion.
const ANALYZE_WITH_ASSIGN_RE =
  /(?:const|let|var)\s+(?:\{[\s\S]{1,120}?\}|\w+)\s*=\s*(?:await\s+)?[\s\S]{0,200}?\.analyze\s*\(\s*\)/g;

function hasViolationsIgnored(stripped: string): boolean {
  ANALYZE_CALL_RE.lastIndex = 0;
  const analyzeCount = (stripped.match(ANALYZE_CALL_RE) ?? []).length;
  if (analyzeCount === 0) return false;
  ANALYZE_WITH_ASSIGN_RE.lastIndex = 0;
  const assignedCount = (stripped.match(ANALYZE_WITH_ASSIGN_RE) ?? []).length;
  if (assignedCount < analyzeCount) return true;
  const assertionShapes = [
    /expect\([^)]*\bviolations\b[^)]*\)\.(?:toEqual|toStrictEqual)\s*\(\s*\[\s*\]\s*\)/,
    /expect\([^)]*\bviolations\b[^)]*\)\.toHaveLength\s*\(\s*0\s*\)/,
    // Filtered subset pattern: const relevant = results.violations.filter(...);
    // expect(relevant).toEqual([]). Accept any expect([^)]*).toEqual([]) when a
    // variable downstream of `.violations.filter(` was bound earlier in the file.
    /\.violations\.filter\s*\([\s\S]*?\)[\s;\S]{0,120}?expect\([^)]*\)\.(?:toEqual|toStrictEqual)\s*\(\s*\[\s*\]\s*\)/,
  ];
  if (!assertionShapes.some((r) => r.test(stripped))) return true;
  return false;
}

// Step 3: .disableRules([...]) must have an adjacent comment (either a
// // line comment on the preceding non-blank line, or a trailing //
// comment on the same line). Run this against the RAW source (comments
// preserved), not the stripped copy.
function hasDisabledRulesUndocumented(raw: string): boolean {
  DISABLE_RULES_RE.lastIndex = 0;
  for (;;) {
    const m = DISABLE_RULES_RE.exec(raw);
    if (!m) break;
    // Find the start of the line containing this match.
    const lineStart = raw.lastIndexOf('\n', m.index) + 1;
    const lineEnd = raw.indexOf('\n', m.index);
    const thisLine = raw.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    // Trailing // on same line?
    if (/\/\/\s*\S/.test(thisLine.slice(m.index - lineStart))) continue;
    // Preceding non-blank line with //?
    const priorChunk = raw.slice(0, lineStart);
    const lines = priorChunk.split('\n');
    let prior: string | undefined;
    for (let i = lines.length - 1; i >= 0; i--) {
      const candidate = lines[i]?.trim();
      if (candidate === undefined || candidate === '') continue;
      prior = candidate;
      break;
    }
    if (prior && /^\/\//.test(prior)) continue;
    return true;
  }
  return false;
}

// Step 4: .options({ runOnly: { type: 'tag', values: [...] } }) that
// doesn't include one of the WCAG AA tags.
const WCAG_TAGS = ['wcag2aa', 'wcag22aa', 'wcag2a', 'wcag21aa', 'wcag22a'];

function hasScanLimitedToBestPracticeOnly(stripped: string): boolean {
  const m = OPTIONS_RUN_ONLY_RE.exec(stripped);
  if (!m) return false;
  const VALUES_RE = /values\s*:\s*\[([^\]]*)\]/;
  const vm = VALUES_RE.exec(m[0]);
  if (!vm) return false;
  const body = vm[1] ?? '';
  const tags = [...body.matchAll(/['"]([\w-]+)['"]/g)].map((x) => x[1] ?? '');
  if (tags.length === 0) return false;
  return !tags.some((t) => WCAG_TAGS.includes(t));
}

// ---------- top-level classifier ----------

function classify(body: string): Classification {
  const stripped = stripComments(body);
  // Check in SKILL.md § Procedure order.
  if (hasPageWithoutScan(stripped, body)) return 'page-without-axe-scan';
  if (hasViolationsIgnored(stripped)) return 'violations-ignored';
  if (hasDisabledRulesUndocumented(body)) return 'disabled-rules-undocumented';
  if (hasScanLimitedToBestPracticeOnly(stripped)) return 'scan-limited-to-bestpractice-only';
  return 'safe';
}

// ---------- tests ----------

describe('axe-playwright', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
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

    it('zero false positives on safe fixtures', async () => {
      const fixtures = await loadFixtures(SAFE_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
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
    expect(safe.length).toBeGreaterThanOrEqual(4);
    expect(violations.length).toBeGreaterThanOrEqual(4);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"scan-coverage-remediation" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'scan-coverage-remediation',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

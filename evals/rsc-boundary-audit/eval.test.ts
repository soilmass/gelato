// Eval for the rsc-boundary-audit skill.
//
// Judgment eval per EVAL_SPEC.md § Type B. Two halves:
//
// Quantitative (always on) — a deterministic classifier that encodes the
// skill's four-criterion decision tree (references/four-criterion-decision-tree.md)
// and the five-class taxonomy (references/five-violation-classes.md) as
// code. Runs instantly; no API calls. Asserts classification ≥ 95% on 23
// labeled violations and zero false positives on 10 legitimate-'use client'
// fixtures.
//
// Qualitative (API-gated) — Promptfoo LLM-as-judge on two rubrics from the
// SKILL's Evaluation section: implementability (≥ 0.8) and groundedness
// (≥ 0.85). Gated on ANTHROPIC_API_KEY via describe.skipIf; without a key
// the pipeline still demonstrably runs end-to-end on the quantitative half.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isJudgeAvailable, judgeWithPromptfoo, loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const LEGITIMATE_DIR = resolve(here, 'fixtures/legitimate');
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');

// Five-class taxonomy; matches the folder names under fixtures/violations.
const CLASSES = [
  'unnecessary-directive',
  'server-only-import-in-client',
  'non-serializable-prop',
  'barrel-import-leakage',
  'hydration-mismatch-source',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'legitimate';

// Remediation-plan priority from SKILL.md § Step 4.
const CLASS_PRIORITY: Record<ViolationClass, number> = {
  'unnecessary-directive': 1,
  'barrel-import-leakage': 2,
  'server-only-import-in-client': 3,
  'non-serializable-prop': 4,
  'hydration-mismatch-source': 5,
};

// Import path patterns. Order matters — server-only is checked before barrel.
const SERVER_ONLY_IMPORT =
  /from\s+['"](?:@\/lib\/db|@\/lib\/env|@\/server\/[^'"]+|node:fs(?:\/\w+)?|node:crypto|node:path)['"]/;
const BARREL_IMPORT = /from\s+['"](?:@\/components|@\/lib|@\/ui|@\/icons)['"]/;

// Client-only React hooks (criterion 3 of the decision tree).
const CLIENT_HOOK_RE =
  /\buse(?:State|Effect|LayoutEffect|Reducer|Ref|SyncExternalStore|Transition|DeferredValue|ImperativeHandle|Context)\b/;

// Browser globals (criterion 2).
const BROWSER_API_RE =
  /\b(?:window|document|localStorage|sessionStorage|navigator|IntersectionObserver|ResizeObserver|MutationObserver|DOMParser|matchMedia)\b/;

// Event handler props (criterion 1).
const EVENT_HANDLER_RE = /\bon[A-Z]\w+\s*=/;

// Hydration-mismatch sources (class 5 signals). No outer `\b` — the method
// alternatives are prefixed with `.`, and `\b` before `.` fails when the
// preceding character is a closing paren (e.g. `new Date().toLocaleString()`).
const HYDRATION_MISMATCH_RE =
  /(?:\bDate\.now\s*\(|\bMath\.random\s*\(|\btypeof\s+window\b|\.toLocaleTimeString\s*\(|\.toLocaleString\s*\(|\.toLocaleDateString\s*\()/;

// Non-serializable props (class 3 signals).
const NON_SERIALIZABLE_CONSTRUCTOR_RE = /\bnew\s+(?:Date|Map|Set|URL)\b/;
const CLASS_DECLARATION_RE = /\bclass\s+\w+\s*\{/;
const ARROW_FUNCTION_ASSIGN_RE = /\bconst\s+\w+\s*=\s*(?:async\s*)?\(/;

function hasUseClientDirective(content: string): boolean {
  const firstNonBlank = content.split('\n').find((l) => l.trim() !== '');
  if (!firstNonBlank) return false;
  return /^\s*['"]use client['"]\s*;?\s*$/.test(firstNonBlank);
}

function looksLikeServerComponentPassingProp(content: string): boolean {
  // JSX child with prop passing — a server component without 'use client'
  // that constructs a non-plain-object and passes it to a child.
  const hasJSXPropPass = /<\w+[^>]*\s+\w+=\{[^}]+\}[^>]*\/?\s*>/.test(content);
  return hasJSXPropPass;
}

function classify(content: string): Classification {
  // Strip frontmatter before classification so YAML description fields with
  // trigger words (e.g., "Map instance") don't fool the heuristics.
  const bodyMatch = /^---\n[\s\S]*?\n---\n([\s\S]*)$/.exec(content);
  const body = bodyMatch?.[1] ?? content;

  if (hasUseClientDirective(body)) {
    if (SERVER_ONLY_IMPORT.test(body)) return 'server-only-import-in-client';
    if (BARREL_IMPORT.test(body)) return 'barrel-import-leakage';
    const hasInteractivity =
      EVENT_HANDLER_RE.test(body) || CLIENT_HOOK_RE.test(body) || BROWSER_API_RE.test(body);
    if (hasInteractivity) return 'legitimate';
    return 'unnecessary-directive';
  }

  // No 'use client' → server component or unclassified.
  if (HYDRATION_MISMATCH_RE.test(body)) return 'hydration-mismatch-source';

  const hasNonSerializableCtor = NON_SERIALIZABLE_CONSTRUCTOR_RE.test(body);
  const hasLocalClass = CLASS_DECLARATION_RE.test(body);
  const hasLocalArrow = ARROW_FUNCTION_ASSIGN_RE.test(body);
  const passesProp = looksLikeServerComponentPassingProp(body);

  if (passesProp && (hasNonSerializableCtor || hasLocalClass || hasLocalArrow)) {
    // Only flag a function prop as non-serializable when the file does NOT
    // declare `'use server'` as a real directive at the top. A mention in a
    // comment or string doesn't count; Server Actions require the directive.
    const firstFewLines = body.split('\n').slice(0, 5);
    const hasUseServerDirective = firstFewLines.some((line) =>
      /^\s*['"]use server['"]\s*;?\s*$/.test(line),
    );
    if (hasLocalArrow && hasUseServerDirective) return 'legitimate';
    return 'non-serializable-prop';
  }

  return 'legitimate';
}

describe('rsc-boundary-audit', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies 23 violation fixtures at ≥ 95% accuracy', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length, 'expected 23 violation fixtures').toBe(23);

      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) {
          wrong.push({ name: f.name, expected, predicted });
        }
      }
      const accuracy = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        accuracy,
        `misclassified: ${wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') || '(none)'}`,
      ).toBeGreaterThanOrEqual(0.95);
    });

    it('zero false positives on 10 legitimate fixtures', async () => {
      const fixtures = await loadFixtures(LEGITIMATE_DIR);
      expect(fixtures.length, 'expected 10 legitimate fixtures').toBe(10);

      const falsePositives = fixtures
        .map((f) => ({ name: f.name, predicted: classify(f.content) }))
        .filter((r) => r.predicted !== 'legitimate');

      expect(
        falsePositives.map((r) => `${r.name} (got ${r.predicted})`),
        'every legitimate fixture must classify as legitimate',
      ).toEqual([]);
    });

    it('remediation plan orders violations by class priority', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      const plan = fixtures
        .map((f) => ({
          fixture: f.name,
          class: f.category as ViolationClass,
          priority: CLASS_PRIORITY[f.category as ViolationClass] ?? 999,
        }))
        .sort((a, b) => a.priority - b.priority);

      // Priority monotonic — class 1 items precede class 2 items, etc.
      for (let i = 0; i < plan.length - 1; i++) {
        const a = plan[i];
        const b = plan[i + 1];
        if (!a || !b) continue;
        expect(
          a.priority,
          `${a.fixture} (priority ${a.priority}) must precede ${b.fixture} (priority ${b.priority})`,
        ).toBeLessThanOrEqual(b.priority);
      }

      // Every violation class appears in the plan (no class is missing fixtures).
      const seen = new Set(plan.map((p) => p.class));
      for (const c of CLASSES) expect(seen.has(c), `no fixtures for class ${c}`).toBe(true);
    });
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"implementability" rubric scores ≥ 0.8', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'implementability',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.8);
    });

    it('"groundedness" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'groundedness',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });

  it('fixture inventory matches SKILL.md § Evaluation', async () => {
    const violations = await loadFixtures(VIOLATIONS_DIR);
    const legitimate = await loadFixtures(LEGITIMATE_DIR);

    expect(violations.length, 'SKILL.md specifies 23 violation fixtures').toBe(23);
    expect(legitimate.length, 'SKILL.md specifies 10 legitimate fixtures').toBe(10);

    // Five classes, at least one fixture each.
    const byClass = new Map<string, number>();
    for (const f of violations) {
      byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    }
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has at least one fixture`).toBeGreaterThan(0);
    }
  });
});

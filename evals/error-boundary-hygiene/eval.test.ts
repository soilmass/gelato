// Eval for the error-boundary-hygiene skill.
//
// Procedural eval per EVAL_SPEC.md § Type B. Deterministic classifier
// over fixture files whose frontmatter carries a `filename:` field so
// the classifier knows whether a given fixture represents an
// error.tsx / global-error.tsx / or other file.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasUseClient,
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
  'error-tsx-missing-use-client',
  'error-tsx-missing-reset-prop',
  'global-error-missing-html-body',
  'error-boundary-missing-derived',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function filenameOf(metadata: Record<string, unknown>): string {
  const fn = metadata.filename;
  return typeof fn === 'string' ? fn : '';
}

function isErrorFile(filename: string): boolean {
  return /(^|\/)error\.tsx$/.test(filename);
}

function isGlobalErrorFile(filename: string): boolean {
  return /(^|\/)global-error\.tsx$/.test(filename);
}

// Default export function signature. Accept either:
//   export default function X({ …, reset, … }: …) { }
//   export default function X(props: …) { }    (props carries reset; we accept)
const DEFAULT_EXPORT_FN_RE = /export\s+default\s+function\s+\w+\s*\(([^)]*)\)/;

function defaultExportAcceptsReset(source: string): boolean {
  const m = DEFAULT_EXPORT_FN_RE.exec(source);
  if (!m) return false;
  const signature = m[1] ?? '';
  // Case 1: destructured { …, reset, … }
  if (/\{[^}]*\breset\b[^}]*\}/.test(signature)) return true;
  // Case 2: single props parameter with type containing `reset:` (type
  // alias or inline interface). This is permissive — if the param type
  // mentions reset, we trust it.
  if (/:\s*[\s\S]*\breset\s*:/.test(signature)) return true;
  return false;
}

function globalErrorHasHtmlBody(source: string): boolean {
  return /<html[\s>]/.test(source) && /<body[\s>]/.test(source);
}

// Class-based ErrorBoundary: class X extends Component (or React.Component)
// must declare at least one of componentDidCatch / getDerivedStateFromError.
const CLASS_BOUNDARY_RE = /class\s+\w*(?:Error)?Boundary\w*\s+extends\s+(?:React\.)?Component\b/;

function classBoundaryMissingDerived(source: string): boolean {
  if (!CLASS_BOUNDARY_RE.test(source)) return false;
  const hasCatch = /\bcomponentDidCatch\s*\(/.test(source);
  const hasDerived = /\bgetDerivedStateFromError\s*\(/.test(source);
  return !(hasCatch || hasDerived);
}

function classify(body: string, metadata: Record<string, unknown>): Classification {
  const source = stripComments(body);
  const filename = filenameOf(metadata);

  if (isErrorFile(filename) || isGlobalErrorFile(filename)) {
    if (!hasUseClient(source)) return 'error-tsx-missing-use-client';
    if (!defaultExportAcceptsReset(source)) return 'error-tsx-missing-reset-prop';
  }
  if (isGlobalErrorFile(filename)) {
    if (!globalErrorHasHtmlBody(source)) return 'global-error-missing-html-body';
  }
  if (classBoundaryMissingDerived(source)) return 'error-boundary-missing-derived';
  return 'safe';
}

describe('error-boundary-hygiene', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content, f.metadata);
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
      const fp = fixtures
        .map((f) => ({ name: f.name, predicted: classify(f.content, f.metadata) }))
        .filter((r) => r.predicted !== 'safe');
      expect(fp.map((r) => `${r.name} (got ${r.predicted})`)).toEqual([]);
    });

    it('classifier generalizes to held-out adversarial fixtures at ≥ 90%', async () => {
      const fixtures = await loadFixtures(HELD_OUT_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = (f.metadata.class ?? f.metadata.expected) as Classification;
        const predicted = classify(f.content, f.metadata);
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
    it('"error-ui-implementability" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'error-ui-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

// Eval for the suspense-streaming-boundaries skill.
//
// Procedural eval per EVAL_SPEC.md § Type B. Deterministic classifier
// over single .tsx fixtures with a `filename:` field (so the classifier
// can tell page.tsx / loading.tsx / layout.tsx apart) and an optional
// `has_loading_sibling: true/false` field that Step 1 consults.

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
  'async-server-component-no-suspense',
  'suspense-missing-fallback',
  'loading-tsx-fetches-data',
  'force-dynamic-with-static-params',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function filename(metadata: Record<string, unknown>): string {
  return typeof metadata.filename === 'string' ? metadata.filename : '';
}

function hasLoadingSibling(metadata: Record<string, unknown>): boolean {
  return metadata.has_loading_sibling === true;
}

function isPageFile(fn: string): boolean {
  return /(^|\/)page\.tsx$/.test(fn);
}

function isLoadingFile(fn: string): boolean {
  return /(^|\/)loading\.tsx$/.test(fn);
}

// ---------- rule implementations ----------

const ASYNC_DEFAULT_RE = /export\s+default\s+async\s+function\s+\w+\s*\(/;
const AWAIT_IN_BODY_RE = /\bawait\b/;
const SUSPENSE_OPEN_RE = /<Suspense\b/;

function hasAsyncPageNoSuspense(source: string, fn: string, siblingLoading: boolean): boolean {
  if (!isPageFile(fn)) return false;
  if (!ASYNC_DEFAULT_RE.test(source)) return false;
  if (!AWAIT_IN_BODY_RE.test(source)) return false;
  if (SUSPENSE_OPEN_RE.test(source)) return false;
  if (siblingLoading) return false;
  return true;
}

// Step 2: <Suspense> without fallback prop.
// Walk every <Suspense …> opening and check the attrs.
const SUSPENSE_TAG_RE = /<Suspense\b([^>]*)>/g;

function hasSuspenseMissingFallback(source: string): boolean {
  SUSPENSE_TAG_RE.lastIndex = 0;
  for (;;) {
    const m = SUSPENSE_TAG_RE.exec(source);
    if (!m) break;
    const attrs = m[1] ?? '';
    if (!/\bfallback\s*=/.test(attrs)) return true;
  }
  return false;
}

// Step 3: loading.tsx has fetch() or await in the default-export body.
function hasLoadingFetchesData(source: string, fn: string): boolean {
  if (!isLoadingFile(fn)) return false;
  if (/\bfetch\s*\(/.test(source)) return true;
  if (/\bawait\b/.test(source)) return true;
  // Also catch `async function` default export on a loading file — implies await semantics.
  if (ASYNC_DEFAULT_RE.test(source)) return true;
  return false;
}

// Step 4: page.tsx exports both dynamic = 'force-dynamic' AND
// generateStaticParams().
const FORCE_DYNAMIC_RE = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/;
const GEN_STATIC_PARAMS_RE = /export\s+(?:async\s+)?function\s+generateStaticParams\s*\(/;

function hasForceDynamicWithStaticParams(source: string): boolean {
  return FORCE_DYNAMIC_RE.test(source) && GEN_STATIC_PARAMS_RE.test(source);
}

function classify(body: string, metadata: Record<string, unknown>): Classification {
  const source = stripComments(body);
  const fn = filename(metadata);
  const siblingLoading = hasLoadingSibling(metadata);

  // Client components are out of scope for streaming rules.
  if (hasUseClient(source)) {
    // Still check Step 2 (<Suspense> fallback) since Suspense can live in client components.
    if (hasSuspenseMissingFallback(source)) return 'suspense-missing-fallback';
    return 'safe';
  }

  if (hasForceDynamicWithStaticParams(source)) return 'force-dynamic-with-static-params';
  if (hasLoadingFetchesData(source, fn)) return 'loading-tsx-fetches-data';
  if (hasSuspenseMissingFallback(source)) return 'suspense-missing-fallback';
  if (hasAsyncPageNoSuspense(source, fn, siblingLoading))
    return 'async-server-component-no-suspense';
  return 'safe';
}

// ---------- tests ----------

describe('suspense-streaming-boundaries', () => {
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
    expect(violations.length).toBeGreaterThanOrEqual(4);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"streaming-remediation-implementability" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'streaming-remediation-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

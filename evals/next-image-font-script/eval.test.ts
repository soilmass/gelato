// Eval for the next-image-font-script skill.
//
// Procedural eval per EVAL_SPEC.md § Type B. Classifier over .tsx
// fixtures with a `filename:` frontmatter field (to apply the LCP
// rule only on page files) and a `filename` path that may imply
// exemption (opengraph-image.tsx).

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isJudgeAvailable,
  iterateJsxOpenTags,
  judgeWithPromptfoo,
  loadFixtures,
  matchCloseBrace,
  parseJsxAttrs,
  stripComments,
} from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'bare-img-under-app',
  'image-missing-dims',
  'no-priority-on-lcp',
  'font-not-module-scope',
  'script-missing-strategy',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function filenameOf(metadata: Record<string, unknown>): string {
  return typeof metadata.filename === 'string' ? metadata.filename : '';
}

function isPageFile(fn: string): boolean {
  return /(^|\/)page\.tsx$/.test(fn);
}

function isOpenGraphImageFile(fn: string): boolean {
  return /(^|\/)opengraph-image\.tsx$/.test(fn);
}

// Rule 1: bare <img> under app/ or components/.
function hasBareImgUnderApp(source: string, fn: string): boolean {
  if (isOpenGraphImageFile(fn)) return false;
  if (fn && !/^(?:app|components)\//.test(fn)) return false;
  for (const tag of iterateJsxOpenTags(source)) {
    if (tag.tag === 'img') return true;
  }
  return false;
}

// Rule 2: <Image> missing width+height AND fill.
function hasImageMissingDims(source: string): boolean {
  for (const tag of iterateJsxOpenTags(source)) {
    if (tag.tag !== 'Image') continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if ('fill' in attrs) continue;
    if ('width' in attrs && 'height' in attrs) continue;
    return true;
  }
  return false;
}

// Rule 3: page.tsx with one-or-more <Image> but no priority anywhere.
function hasNoPriorityOnLcp(source: string, fn: string): boolean {
  if (!isPageFile(fn)) return false;
  let imageCount = 0;
  let anyPriority = false;
  for (const tag of iterateJsxOpenTags(source)) {
    if (tag.tag !== 'Image') continue;
    imageCount++;
    const attrs = parseJsxAttrs(tag.attrsText);
    if ('priority' in attrs) anyPriority = true;
  }
  return imageCount > 0 && !anyPriority;
}

// Rule 4: next/font initializer called inside a function body.
function hasFontNotModuleScope(source: string): boolean {
  // Collect the identifier(s) imported from next/font/google or
  // next/font/local.
  const names: string[] = [];
  const googRe = /import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g;
  for (;;) {
    const m = googRe.exec(source);
    if (!m) break;
    for (const raw of (m[1] ?? '').split(',')) {
      const name =
        raw
          .trim()
          .split(/\s+as\s+/)[0]
          ?.trim() ?? '';
      if (name) names.push(name);
    }
  }
  const localRe = /import\s+(\w+)\s+from\s*['"]next\/font\/local['"]/;
  const localMatch = localRe.exec(source);
  if (localMatch?.[1]) names.push(localMatch[1]);
  if (names.length === 0) return false;
  // For each name, walk call sites; each must be at depth 0 (module
  // scope), not inside any function body.
  for (const name of names) {
    const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
    for (;;) {
      const m = re.exec(source);
      if (!m) break;
      // Depth check: count unmatched `{` before the call site.
      const before = source.slice(0, m.index);
      let depth = 0;
      for (let i = 0; i < before.length; i++) {
        const ch = before[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth > 0) return true;
    }
  }
  return false;
}

// Rule 5: <Script> without strategy.
function hasScriptMissingStrategy(source: string): boolean {
  // Only activate when `import Script from 'next/script'` is present.
  if (!/\bfrom\s+['"]next\/script['"]/.test(source)) return false;
  for (const tag of iterateJsxOpenTags(source)) {
    if (tag.tag !== 'Script') continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if (!('strategy' in attrs)) return true;
  }
  return false;
}

function classify(body: string, metadata: Record<string, unknown>): Classification {
  const source = stripComments(body);
  const fn = filenameOf(metadata);
  if (hasBareImgUnderApp(source, fn)) return 'bare-img-under-app';
  if (hasImageMissingDims(source)) return 'image-missing-dims';
  if (hasNoPriorityOnLcp(source, fn)) return 'no-priority-on-lcp';
  if (hasFontNotModuleScope(source)) return 'font-not-module-scope';
  if (hasScriptMissingStrategy(source)) return 'script-missing-strategy';
  return 'safe';
}

// ---------- tests ----------

describe('next-image-font-script', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 5 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
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
    expect(violations.length).toBeGreaterThanOrEqual(5);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"asset-remediation-implementability" scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'asset-remediation-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

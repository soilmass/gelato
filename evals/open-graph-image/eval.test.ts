// Eval for the open-graph-image skill.
//
// Procedural classifier over opengraph-image.tsx / twitter-image.tsx.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isJudgeAvailable,
  iterateJsxOpenTags,
  judgeWithPromptfoo,
  loadFixtures,
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
  'missing-size-export',
  'missing-content-type',
  'non-imageresponse-default',
  'tailwind-in-satori',
  'unsafe-import',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function isOgImageFile(fn: string): boolean {
  return /(^|\/)(opengraph|twitter)-image\.tsx$/.test(fn);
}

function filenameOf(metadata: Record<string, unknown>): string {
  return typeof metadata.filename === 'string' ? metadata.filename : '';
}

const SIZE_EXPORT_RE = /export\s+const\s+size\s*=/;
const CONTENTTYPE_EXPORT_RE = /export\s+const\s+contentType\s*=/;
const IMAGE_RESPONSE_IMPORT_RE =
  /\bImageResponse\b[\s\S]*?from\s+['"]next\/og['"]|\bfrom\s+['"]next\/og['"]/;
const DEFAULT_EXPORT_RE = /export\s+default\s+(?:async\s+)?function\s+\w+\s*\(/;
const GENERATE_METADATA_RE = /export\s+(?:async\s+)?function\s+generateImageMetadata\b/;

function defaultExportReturnsImageResponse(source: string): boolean {
  // Heuristic: in the default-export function body, at least one `return`
  // is followed by `new ImageResponse(` before the next `return`.
  const m = DEFAULT_EXPORT_RE.exec(source);
  if (!m) return false;
  const bodyStart = source.indexOf('{', m.index);
  if (bodyStart === -1) return false;
  const body = source.slice(bodyStart);
  return /\breturn\s+new\s+ImageResponse\s*\(/.test(body);
}

function hasTailwindClassName(source: string): boolean {
  for (const tag of iterateJsxOpenTags(source)) {
    const attrs = parseJsxAttrs(tag.attrsText);
    if ('className' in attrs) return true;
  }
  return false;
}

// Module-scope unsafe imports: next/image default import or
// `import { Inter } from 'next/font/google'` at top level.
const UNSAFE_IMPORT_RE = /\bfrom\s+['"](?:next\/image|next\/font\/google|next\/font\/local)['"]/;

function hasUnsafeImport(source: string): boolean {
  return UNSAFE_IMPORT_RE.test(source);
}

function classify(body: string, metadata: Record<string, unknown>): Classification {
  const source = stripComments(body);
  const fn = filenameOf(metadata);
  if (!isOgImageFile(fn)) return 'safe';
  if (!IMAGE_RESPONSE_IMPORT_RE.test(source)) {
    // If ImageResponse isn't imported at all, the default export almost
    // certainly fails Step 3. Leave missing-size / missing-content-type
    // checks running in their own right first.
  }
  if (hasUnsafeImport(source)) return 'unsafe-import';
  if (!SIZE_EXPORT_RE.test(source) && !GENERATE_METADATA_RE.test(source)) {
    return 'missing-size-export';
  }
  if (!CONTENTTYPE_EXPORT_RE.test(source) && !GENERATE_METADATA_RE.test(source)) {
    return 'missing-content-type';
  }
  if (!defaultExportReturnsImageResponse(source)) return 'non-imageresponse-default';
  if (hasTailwindClassName(source)) return 'tailwind-in-satori';
  return 'safe';
}

describe('open-graph-image', () => {
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
    it('"og-image-remediation-implementability" scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'og-image-remediation-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

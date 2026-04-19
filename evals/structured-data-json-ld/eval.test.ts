// Eval for the structured-data-json-ld skill.
//
// Procedural eval per EVAL_SPEC.md § Type B. Parses the JSON-LD
// body(ies) from each fixture and validates against Google's
// required-field tables per @type.

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
  'missing-context',
  'product-missing-required',
  'article-missing-required',
  'breadcrumb-out-of-order',
  'faq-missing-accepted-answer',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// Extract every JSON-LD body from the fixture. Finds
//   <script type="application/ld+json">{...}</script>  (literal)
//   dangerouslySetInnerHTML={{ __html: JSON.stringify(<obj>) }}  (Next pattern)
function extractJsonLdObjects(source: string): unknown[] {
  const out: unknown[] = [];
  // Literal scripts
  const litRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
  for (;;) {
    const m = litRe.exec(source);
    if (!m) break;
    const body = (m[1] ?? '').trim();
    try {
      out.push(JSON.parse(body));
    } catch {
      // ignore — malformed JSON won't match any class-specific rule
    }
  }
  // JSON.stringify(<obj>) inside dangerouslySetInnerHTML
  const stringifyRe = /JSON\.stringify\s*\(([\s\S]+?)\)/g;
  for (;;) {
    const m = stringifyRe.exec(source);
    if (!m) break;
    const expr = (m[1] ?? '').trim();
    // Try to parse as a JS object literal by wrapping in parens and evaluating
    // via a lax parser. Fall back to extracting "@type" / required keys via
    // regex when JSON.parse can't handle JS object literals (unquoted keys).
    try {
      out.push(JSON.parse(expr));
    } catch {
      out.push(parseJsLike(expr));
    }
  }
  return out;
}

// Lax parser for JS object-literal-shaped JSON-LD. Extract top-level keys
// and their literal values where the value is a primitive or array of
// primitives. Nested objects are represented as `{ __nested: true, ... }`.
function parseJsLike(src: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // Strip trailing commas + convert unquoted keys to quoted for a final
  // JSON.parse attempt.
  const normalized = src
    .replace(/([{,]\s*)(\w[\w$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(normalized) as Record<string, unknown>;
  } catch {
    // Give up — top-level regex fallback on key presence only.
    const topRe = /"?([A-Za-z@_][\w$]*)"?\s*:/g;
    for (;;) {
      const m = topRe.exec(src);
      if (!m) break;
      const k = m[1];
      if (k) out[k] = '__present__';
    }
    return out;
  }
}

// ---------- rule implementations ----------

function hasContext(obj: Record<string, unknown>): boolean {
  const ctx = obj['@context'];
  if (typeof ctx !== 'string') return false;
  return /^https?:\/\/schema\.org\/?$/.test(ctx);
}

function typeOf(obj: Record<string, unknown>): string | null {
  const t = obj['@type'];
  return typeof t === 'string' ? t : null;
}

function isArticleType(t: string | null): boolean {
  return t === 'Article' || t === 'NewsArticle' || t === 'BlogPosting';
}

function classifyOne(obj: unknown): Classification | null {
  if (typeof obj !== 'object' || obj === null) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const c = classifyOne(item);
      if (c !== null && c !== 'safe') return c;
    }
    return null;
  }
  const o = obj as Record<string, unknown>;
  if (!hasContext(o)) return 'missing-context';
  const t = typeOf(o);

  if (t === 'Product') {
    if (!('name' in o)) return 'product-missing-required';
    if (!('image' in o) && !('offers' in o)) return 'product-missing-required';
  }

  if (isArticleType(t)) {
    if (!('headline' in o) || !('author' in o) || !('datePublished' in o)) {
      return 'article-missing-required';
    }
  }

  if (t === 'BreadcrumbList') {
    const items = o.itemListElement;
    if (!Array.isArray(items)) return 'breadcrumb-out-of-order';
    const positions = items
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => (typeof x.position === 'number' ? x.position : Number.NaN));
    // Must be 1..n sequential without gaps.
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] !== i + 1) return 'breadcrumb-out-of-order';
    }
  }

  if (t === 'FAQPage') {
    const main = o.mainEntity;
    if (!Array.isArray(main)) return 'faq-missing-accepted-answer';
    for (const q of main) {
      if (typeof q !== 'object' || q === null) return 'faq-missing-accepted-answer';
      const question = q as Record<string, unknown>;
      const ans = question.acceptedAnswer;
      if (typeof ans !== 'object' || ans === null) return 'faq-missing-accepted-answer';
      const text = (ans as Record<string, unknown>).text;
      if (typeof text !== 'string' || text.length === 0) {
        return 'faq-missing-accepted-answer';
      }
    }
  }

  return null;
}

function classify(body: string): Classification {
  const source = stripComments(body);
  const objects = extractJsonLdObjects(source);
  for (const obj of objects) {
    const c = classifyOne(obj);
    if (c) return c;
  }
  return 'safe';
}

describe('structured-data-json-ld', () => {
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
    it('"structured-data-remediation-implementability" scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'structured-data-remediation-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

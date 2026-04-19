// Eval for the i18n-routing skill.
//
// Procedural classifier over layout.tsx / middleware.ts / component
// fixtures. Uses `filename:` + optional `tree_has_locale_segment`
// frontmatter fields.

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
  'html-lang-static-with-locale-segment',
  'invalid-bcp47-locale',
  'middleware-missing-matcher-exclusions',
  'hardcoded-string-with-i18n-lib-present',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function filenameOf(metadata: Record<string, unknown>): string {
  return typeof metadata.filename === 'string' ? metadata.filename : '';
}

function treeHasLocaleSegment(metadata: Record<string, unknown>): boolean {
  return metadata.tree_has_locale_segment === true;
}

const BCP47_RE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/;

// Rule 1: static <html lang="..."> when locale segment exists.
function hasStaticHtmlLang(source: string): boolean {
  const m = /<html[^>]*\blang\s*=\s*(['"])([^'"]+)\1/.exec(source);
  return m !== null; // literal string present
}

// Rule 2: invalid BCP 47 locale in locales:[ ... ] or defaultLocale: '...'.
function hasInvalidLocale(source: string): boolean {
  // locales: [ 'en', 'EN-us', ... ]
  const localesRe = /locales\s*:\s*\[([^\]]+)\]/;
  const m = localesRe.exec(source);
  if (m) {
    const items = m[1] ?? '';
    const strRe = /'([^']+)'|"([^"]+)"/g;
    for (;;) {
      const sm = strRe.exec(items);
      if (!sm) break;
      const s = sm[1] ?? sm[2] ?? '';
      if (!BCP47_RE.test(s)) return true;
    }
  }
  // defaultLocale: 'English'
  const defRe = /defaultLocale\s*:\s*(?:'([^']+)'|"([^"]+)")/;
  const dm = defRe.exec(source);
  if (dm) {
    const s = dm[1] ?? dm[2] ?? '';
    if (!BCP47_RE.test(s)) return true;
  }
  return false;
}

// Rule 3: middleware matcher doesn't exclude _next/static, favicon, api.
function hasMiddlewareMissingMatcherExclusions(source: string): boolean {
  const cfgRe = /export\s+const\s+config\s*=\s*(\{[\s\S]*?\})/;
  const m = cfgRe.exec(source);
  if (!m) return false;
  const cfgBlock = m[1] ?? '';
  const matcherRe = /matcher\s*:\s*(\[[\s\S]*?\]|'[^']+'|"[^"]+")/;
  const mm = matcherRe.exec(cfgBlock);
  if (!mm) return false;
  const matcher = mm[1] ?? '';
  // Must mention _next/static (or _next|static) and api in the exclusion.
  if (/\(\?!.*_next.*api/i.test(matcher)) return false;
  if (/_next\/static/.test(matcher) && /\bapi\b/.test(matcher)) return false;
  return true;
}

// Rule 4: file imports i18n library AND has hardcoded English text in JSX.
const I18N_IMPORT_RE =
  /\bfrom\s+['"](?:next-intl|next-i18next|@lingui\/(?:macro|react)|react-intl)['"]/;

function hasHardcodedString(source: string): boolean {
  if (!I18N_IMPORT_RE.test(source)) return false;
  // Look for JSX text nodes `>...<` with >=3 ASCII words not wrapped
  // in a curly expression.
  // Simple heuristic: match `>([A-Za-z][^<{>}]*?)<` and check word count.
  const re = />([^<{}]+)</g;
  for (;;) {
    const m = re.exec(source);
    if (!m) break;
    const text = (m[1] ?? '').trim();
    if (!text) continue;
    const wordCount = text.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z']*$/.test(w)).length;
    if (wordCount >= 3) return true;
  }
  return false;
}

function classify(body: string, metadata: Record<string, unknown>): Classification {
  const source = stripComments(body);
  const fn = filenameOf(metadata);
  const withLocale = treeHasLocaleSegment(metadata);
  if (/middleware\.ts$/.test(fn)) {
    if (hasInvalidLocale(source)) return 'invalid-bcp47-locale';
    if (hasMiddlewareMissingMatcherExclusions(source)) {
      return 'middleware-missing-matcher-exclusions';
    }
  }
  if (/layout\.tsx$/.test(fn)) {
    if (hasInvalidLocale(source)) return 'invalid-bcp47-locale';
    if (withLocale && hasStaticHtmlLang(source)) {
      return 'html-lang-static-with-locale-segment';
    }
  }
  if (hasHardcodedString(source)) return 'hardcoded-string-with-i18n-lib-present';
  return 'safe';
}

describe('i18n-routing', () => {
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
    it('"i18n-remediation-implementability" scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'i18n-remediation-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

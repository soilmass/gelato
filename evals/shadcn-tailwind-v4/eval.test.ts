// Eval for the shadcn-tailwind-v4 skill.
//
// Deterministic classifier over CSS / JS-config / TSX fixtures. Detects
// the four v4-migration violations in SKILL.md § Examples:
//
//   - pre-v4-css-directives  — CSS file with `@tailwind <layer>;`
//   - v3-config-shape        — tailwind.config.* with content: [ ]
//     AND theme: { } (v3 JS-first shape)
//   - old-postcss-plugin     — postcss config using the legacy
//     `tailwindcss` plugin name (object-form key or require())
//   - string-concat-classname — className={…} JSX attribute whose
//     expression is a template literal with interpolation or a
//     string concat, not wrapped in cn(...)
//
// No LLM-as-judge half for v0.1. Each violation is a syntactic
// rewrite; a cva-idiom rubric is a v0.2 candidate.

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
  'pre-v4-css-directives',
  'v3-config-shape',
  'old-postcss-plugin',
  'string-concat-classname',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// --- Comment stripping --------------------------------------------------
//
// Hold-out includes `@tailwind …` inside a CSS /* … */ comment — don't
// flag that. Also strip `//` line comments for JS/TSX files so a commented
// `className` in a code sample can't fool the classifier.

function stripComments(body: string): string {
  const noBlock = body.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return noBlock.replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// --- Signals -------------------------------------------------------------

const TAILWIND_DIRECTIVE_RE =
  /(^|\n)\s*@tailwind\s+(?:base|components|utilities|screens|variants)\b/;

const TAILWIND_CONFIG_CONTENT_RE = /\bcontent\s*:\s*\[/;
const TAILWIND_CONFIG_THEME_RE = /\btheme\s*:\s*\{/;

const POSTCSS_LEGACY_KEY_RE = /(?:^|[,{\s])tailwindcss\s*:\s*\{/;
const POSTCSS_LEGACY_REQUIRE_RE = /\brequire\s*\(\s*['"]tailwindcss['"]\s*\)/;

const CLASSNAME_ATTR_RE = /className=\{/g;

function matchBrace(source: string, openIdx: number): number {
  if (source[openIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function hasInterpolatedTemplate(expr: string): boolean {
  // backtick-delimited template literal AND contains `${`
  if (!expr.includes('`')) return false;
  // Find the backtick-delimited region and check for `${`
  const tickStart = expr.indexOf('`');
  const tickEnd = expr.lastIndexOf('`');
  if (tickStart === -1 || tickEnd === -1 || tickEnd <= tickStart) return false;
  const inside = expr.slice(tickStart + 1, tickEnd);
  return inside.includes('${');
}

function hasStringConcat(expr: string): boolean {
  // String literal (`'…'` or `"…"`) adjacent to ` + ` or ` + <ident>`.
  // Use a simple check: presence of `'…' + ` or `"…" + ` patterns, or
  // identifier + string-literal with `+` on either side.
  if (/['"][^'"]*['"]\s*\+/.test(expr)) return true;
  if (/\+\s*['"][^'"]*['"]/.test(expr)) return true;
  return false;
}

function extractClassNameExpressions(body: string): string[] {
  const exprs: string[] = [];
  for (const match of body.matchAll(CLASSNAME_ATTR_RE)) {
    if (match.index === undefined) continue;
    const openBrace = body.indexOf('{', match.index);
    if (openBrace === -1) continue;
    const closeBrace = matchBrace(body, openBrace);
    if (closeBrace === -1) continue;
    exprs.push(body.slice(openBrace + 1, closeBrace).trim());
  }
  return exprs;
}

function hasStringConcatClassName(body: string): boolean {
  const exprs = extractClassNameExpressions(body);
  for (const expr of exprs) {
    // If the expression starts with cn(, the whole expression is
    // conflict-resolved via tailwind-merge — safe.
    if (/^cn\s*\(/.test(expr)) continue;
    if (hasInterpolatedTemplate(expr)) return true;
    if (hasStringConcat(expr)) return true;
  }
  return false;
}

// --- Top-level classifier -----------------------------------------------

function classify(raw: string): Classification {
  const body = stripComments(raw);

  // 1. Pre-v4 CSS directives.
  if (TAILWIND_DIRECTIVE_RE.test(body)) return 'pre-v4-css-directives';

  // 2. Old PostCSS plugin (legacy `tailwindcss` name).
  if (POSTCSS_LEGACY_KEY_RE.test(body) || POSTCSS_LEGACY_REQUIRE_RE.test(body)) {
    return 'old-postcss-plugin';
  }

  // 3. v3-shaped tailwind config (content: [] + theme: {}).
  if (TAILWIND_CONFIG_CONTENT_RE.test(body) && TAILWIND_CONFIG_THEME_RE.test(body)) {
    return 'v3-config-shape';
  }

  // 4. String-concat className (template literal with interpolation or
  //    string-plus concat in a className={…} JSX attribute, not wrapped
  //    in cn()).
  if (hasStringConcatClassName(body)) return 'string-concat-classname';

  return 'safe';
}

describe('shadcn-tailwind-v4', () => {
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
    it('"cva-idiom" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'cva-idiom',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

// Eval for the a11y-mechanical-audit skill.
//
// Judgment eval per EVAL_SPEC.md § Type B. Two halves:
//
// Quantitative (always on) — a deterministic classifier over .tsx
// fixtures that encodes the five mechanical rules from SKILL.md's
// Procedure. Asserts ≥ 95% accuracy on 5 labeled violations (one per
// class), zero false positives on 5 safe fixtures, and ≥ 90% accuracy
// on 6 held-out adversarial fixtures (sr-only labels, dynamic alts,
// py-based sizing, custom-tag onClick, nested decorators).
//
// Qualitative (API-gated) — Promptfoo LLM-as-judge rubric
// `remediation-implementability` (≥ 0.85) from SKILL.md §
// Evaluation. Gated on ANTHROPIC_API_KEY via describe.skipIf.

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
  'img-no-alt',
  'input-no-label',
  'interactive-without-role',
  'tabindex-positive',
  'target-size-too-small',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// ---------- rule implementations ----------

const NATIVE_INTERACTIVE = new Set([
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
  'details',
  'label',
]);

const FORM_CONTROL = new Set(['input', 'select', 'textarea']);

// axe `image-alt` — every `<img>` must have an `alt` attribute (may be empty).
function hasImgNoAlt(body: string): boolean {
  for (const tag of iterateJsxOpenTags(body)) {
    if (tag.tag !== 'img') continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if (!('alt' in attrs)) return true;
  }
  return false;
}

// axe `label` — every form control must have a label.
// We consider: id->htmlFor match in same source, aria-label, aria-labelledby,
// or the input's `type` being in the auto-labelled set.
const AUTO_LABELLED_INPUT_TYPES = new Set(['submit', 'reset', 'button', 'hidden', 'image']);

function collectLabelIds(body: string): Set<string> {
  const ids = new Set<string>();
  for (const tag of iterateJsxOpenTags(body)) {
    if (tag.tag !== 'label') continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    const htmlFor = attrs.htmlFor;
    if (typeof htmlFor === 'string') ids.add(htmlFor);
  }
  return ids;
}

function hasInputNoLabel(body: string): boolean {
  const labelFor = collectLabelIds(body);
  for (const tag of iterateJsxOpenTags(body)) {
    if (!FORM_CONTROL.has(tag.tag)) continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if (tag.tag === 'input') {
      const type = typeof attrs.type === 'string' ? attrs.type : 'text';
      if (AUTO_LABELLED_INPUT_TYPES.has(type)) continue;
    }
    if (typeof attrs['aria-label'] === 'string' || attrs['aria-label'] === null) continue;
    if (typeof attrs['aria-labelledby'] === 'string' || attrs['aria-labelledby'] === null) continue;
    const id = attrs.id;
    if (typeof id === 'string' && labelFor.has(id)) continue;
    return true;
  }
  return false;
}

// WCAG 4.1.2 — non-interactive element with onClick must carry
// role + tabIndex={0} + onKeyDown/onKeyUp.
function hasInteractiveWithoutRole(body: string): boolean {
  for (const tag of iterateJsxOpenTags(body)) {
    // Only flag lowercase HTML tags; custom components (PascalCase / Foo.Bar) are
    // owned by their library — under-detection is safer for a judgment skill.
    if (!/^[a-z]/.test(tag.tag)) continue;
    if (NATIVE_INTERACTIVE.has(tag.tag)) continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if (!('onClick' in attrs)) continue;
    const hasRole = typeof attrs.role === 'string';
    const hasTabIndex = 'tabIndex' in attrs; // checked separately below for 0 vs -1
    const tabVal = attrs.tabIndex;
    const tabIsZero = tabVal === null || tabVal === '0';
    const hasKeyboard = 'onKeyDown' in attrs || 'onKeyUp' in attrs || 'onKeyPress' in attrs;
    if (!(hasRole && hasTabIndex && tabIsZero && hasKeyboard)) return true;
  }
  return false;
}

// WCAG 2.4.3 — positive tabIndex reorders focus; violation.
// tabIndex={N} is a JSX expression; parseJsxAttrs returns null for that.
// Re-scan the raw attrsText for a literal integer.
const POSITIVE_TABINDEX_RE = /\btabIndex\s*=\s*(?:\{(\d+)\}|"(\d+)"|'(\d+)')/;

function hasPositiveTabIndex(body: string): boolean {
  for (const tag of iterateJsxOpenTags(body)) {
    const m = POSITIVE_TABINDEX_RE.exec(tag.attrsText);
    if (!m) continue;
    const raw = m[1] ?? m[2] ?? m[3];
    const n = Number.parseInt(raw ?? '0', 10);
    if (n > 0) return true;
  }
  return false;
}

// WCAG 2.5.8 — interactive elements must be ≥ 44×44 CSS px (44px = Tailwind 11).
// We accept h-N / min-h-N / size-N where N >= 11, and the width-axis analog.
// Inline heuristic: `py-3`+ with default line-height on a text-content control
// passes the height axis.
const HEIGHT_TOKEN_RE =
  /\b(?:min-)?(?:h|size)-(\d+)(?!\S)|\bh-\[(\d+)(?:px|rem|em)?\]|\bpy-(\d+)(?!\S)/g;
const WIDTH_TOKEN_RE =
  /\b(?:min-)?(?:w|size)-(\d+)(?!\S)|\bw-\[(\d+)(?:px|rem|em)?\]|\bpx-(\d+)(?!\S)/g;

// Full-extent tokens satisfy the axis — the element stretches to its
// parent or viewport, both of which comfortably exceed 44px in practical
// layouts.
const FULL_HEIGHT_TOKENS = new Set([
  'h-full',
  'h-screen',
  'h-auto',
  'h-max',
  'h-fit',
  'min-h-full',
  'min-h-screen',
]);
const FULL_WIDTH_TOKENS = new Set([
  'w-full',
  'w-screen',
  'w-auto',
  'w-max',
  'w-fit',
  'min-w-full',
  'min-w-screen',
]);

function hasAnyToken(classes: string, tokens: Set<string>): boolean {
  for (const t of classes.split(/\s+/)) if (tokens.has(t)) return true;
  return false;
}

function meetsHeight(classes: string): boolean {
  if (hasAnyToken(classes, FULL_HEIGHT_TOKENS)) return true;
  HEIGHT_TOKEN_RE.lastIndex = 0;
  for (;;) {
    const m = HEIGHT_TOKEN_RE.exec(classes);
    if (!m) return false;
    const tokenVal = m[1] ?? m[2] ?? m[3];
    if (!tokenVal) continue;
    const n = Number.parseInt(tokenVal, 10);
    if (m[3] !== undefined) {
      // py-* — accept 3+ (py-3 = 12px top + 12px bottom; with default
      // text line-height this comfortably exceeds 44px on a button).
      if (n >= 3) return true;
    } else if (m[2] !== undefined) {
      // arbitrary h-[N] — accept when >= 44 (assumes px).
      if (n >= 44) return true;
    } else if (n >= 11) {
      return true;
    }
  }
}

function meetsWidth(classes: string): boolean {
  if (hasAnyToken(classes, FULL_WIDTH_TOKENS)) return true;
  WIDTH_TOKEN_RE.lastIndex = 0;
  for (;;) {
    const m = WIDTH_TOKEN_RE.exec(classes);
    if (!m) return false;
    const tokenVal = m[1] ?? m[2] ?? m[3];
    if (!tokenVal) continue;
    const n = Number.parseInt(tokenVal, 10);
    if (m[3] !== undefined) {
      if (n >= 3) return true;
    } else if (m[2] !== undefined) {
      if (n >= 44) return true;
    } else if (n >= 11) {
      return true;
    }
  }
}

function hasTargetSizeTooSmall(body: string): boolean {
  for (const tag of iterateJsxOpenTags(body)) {
    const attrs = parseJsxAttrs(tag.attrsText);
    const isClickable =
      'onClick' in attrs ||
      tag.tag === 'button' ||
      (tag.tag === 'a' && 'href' in attrs) ||
      tag.tag === 'select' ||
      tag.tag === 'summary' ||
      (tag.tag === 'input' &&
        typeof attrs.type === 'string' &&
        ['submit', 'button', 'reset', 'checkbox', 'radio'].includes(attrs.type));
    if (!isClickable) continue;
    const className = typeof attrs.className === 'string' ? attrs.className : '';
    if (!className) continue; // no classes at all — under-detect (many unstyled test fixtures)
    if (meetsHeight(className) && meetsWidth(className)) continue;
    return true;
  }
  return false;
}

// ---------- top-level classifier ----------

function classify(body: string): Classification {
  const source = stripComments(body);
  if (hasImgNoAlt(source)) return 'img-no-alt';
  if (hasInputNoLabel(source)) return 'input-no-label';
  if (hasInteractiveWithoutRole(source)) return 'interactive-without-role';
  if (hasPositiveTabIndex(source)) return 'tabindex-positive';
  if (hasTargetSizeTooSmall(source)) return 'target-size-too-small';
  return 'safe';
}

// ---------- tests ----------

describe('a11y-mechanical-audit', () => {
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
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
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
    expect(safe.length).toBeGreaterThanOrEqual(5);
    expect(violations.length).toBeGreaterThanOrEqual(5);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"remediation-implementability" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'remediation-implementability',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

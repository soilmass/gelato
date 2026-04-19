// Eval for the radix-primitive-a11y skill.
//
// Judgment eval per EVAL_SPEC.md § Type B. Deterministic classifier
// over .tsx fixtures using Radix primitives; activates only when a
// `@radix-ui/react-*` import is present in the source (see
// references/radix-patterns.md § Required imports).

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
  'dialog-without-title',
  'dialog-content-without-description',
  'trigger-without-aschild-role',
  'combobox-without-label',
  'portal-missing-for-overlay',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// ---------- import detection ----------

const RADIX_IMPORT_RE = /\bfrom\s+['"]@radix-ui\/react-([\w-]+)['"]/g;

function importedRadixPrimitives(body: string): Set<string> {
  const prims = new Set<string>();
  RADIX_IMPORT_RE.lastIndex = 0;
  for (;;) {
    const m = RADIX_IMPORT_RE.exec(body);
    if (!m) break;
    if (m[1]) prims.add(m[1]);
  }
  return prims;
}

// ---------- rule implementations ----------

// Utility: given a start offset (just after a `.Content` open tag)
// and the source, return the substring between that open tag and its
// matching close. Uses simple depth tracking on `<Tag` and `</Tag`.
function contentBody(source: string, afterStart: number, tagName: string): string {
  let depth = 1;
  const openRe = new RegExp(`<${tagName}\\b`, 'g');
  const closeRe = new RegExp(`</${tagName}\\b`, 'g');
  openRe.lastIndex = afterStart;
  closeRe.lastIndex = afterStart;
  let idx = afterStart;
  while (depth > 0) {
    openRe.lastIndex = idx;
    closeRe.lastIndex = idx;
    const o = openRe.exec(source);
    const c = closeRe.exec(source);
    if (!c) return source.slice(afterStart);
    if (o && o.index < c.index) {
      depth++;
      idx = o.index + 1;
    } else {
      depth--;
      if (depth === 0) return source.slice(afterStart, c.index);
      idx = c.index + 1;
    }
  }
  return source.slice(afterStart);
}

const DIALOG_PRIMITIVES = new Set(['dialog', 'alert-dialog']);

function hasDialogWithoutTitle(source: string, prims: Set<string>): boolean {
  const active = [...prims].some((p) => DIALOG_PRIMITIVES.has(p));
  if (!active) return false;
  for (const tag of iterateJsxOpenTags(source)) {
    if (tag.tag !== 'Dialog.Content' && tag.tag !== 'AlertDialog.Content') continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if ('aria-labelledby' in attrs) continue;
    const tagName = tag.tag.replace('.', '\\.');
    const body = contentBody(source, tag.end, tagName);
    const titleTag = tag.tag === 'Dialog.Content' ? 'Dialog.Title' : 'AlertDialog.Title';
    if (new RegExp(`<${titleTag.replace('.', '\\.')}\\b`).test(body)) continue;
    return true;
  }
  return false;
}

function hasDialogWithoutDescription(source: string, prims: Set<string>): boolean {
  const active = [...prims].some((p) => DIALOG_PRIMITIVES.has(p));
  if (!active) return false;
  for (const tag of iterateJsxOpenTags(source)) {
    if (tag.tag !== 'Dialog.Content' && tag.tag !== 'AlertDialog.Content') continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if ('aria-describedby' in attrs) continue;
    const tagName = tag.tag.replace('.', '\\.');
    const body = contentBody(source, tag.end, tagName);
    const descTag = tag.tag === 'Dialog.Content' ? 'Dialog.Description' : 'AlertDialog.Description';
    if (new RegExp(`<${descTag.replace('.', '\\.')}\\b`).test(body)) continue;
    return true;
  }
  return false;
}

const TRIGGER_PRIMITIVES_RE =
  /\b(Dialog|AlertDialog|Popover|DropdownMenu|Tooltip|HoverCard)\.Trigger$/;
const TRIGGER_PRIMITIVES_PACKAGES = new Set([
  'dialog',
  'alert-dialog',
  'popover',
  'dropdown-menu',
  'tooltip',
  'hover-card',
]);

function hasTriggerWithoutAsChildRole(source: string, prims: Set<string>): boolean {
  const active = [...prims].some((p) => TRIGGER_PRIMITIVES_PACKAGES.has(p));
  if (!active) return false;
  for (const tag of iterateJsxOpenTags(source)) {
    if (!TRIGGER_PRIMITIVES_RE.test(tag.tag)) continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if ('asChild' in attrs) continue;
    // Look at the first child element inside this trigger (between end+1 and
    // the matching close tag). Flag when that first child is PascalCase.
    const tagName = tag.tag.replace('.', '\\.');
    const inner = contentBody(source, tag.end, tagName);
    const firstOpen = /<([A-Za-z][\w.]*)/.exec(inner);
    if (!firstOpen) continue;
    const firstTag = firstOpen[1] ?? '';
    // PascalCase child (custom component) — Radix contract requires asChild.
    if (/^[A-Z]/.test(firstTag)) return true;
  }
  return false;
}

const SELECT_PACKAGES = new Set(['select', 'combobox']);

function hasComboboxWithoutLabel(source: string, prims: Set<string>): boolean {
  const active = [...prims].some((p) => SELECT_PACKAGES.has(p));
  if (!active) return false;
  // Collect <Label htmlFor="..."> ids present in the source.
  const labelFor = new Set<string>();
  for (const tag of iterateJsxOpenTags(source)) {
    if (tag.tag !== 'Label' && tag.tag !== 'label') continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if (typeof attrs.htmlFor === 'string') labelFor.add(attrs.htmlFor);
  }
  for (const tag of iterateJsxOpenTags(source)) {
    if (!/^(Select|Combobox)\.(Trigger|Input)$/.test(tag.tag)) continue;
    const attrs = parseJsxAttrs(tag.attrsText);
    if ('aria-label' in attrs) continue;
    if ('aria-labelledby' in attrs) continue;
    const id = typeof attrs.id === 'string' ? attrs.id : null;
    if (id && labelFor.has(id)) continue;
    return true;
  }
  return false;
}

const OVERLAY_CONTENT_RE = /^(Dialog|AlertDialog|Popover|DropdownMenu|Tooltip|HoverCard)\.Content$/;
const OVERLAY_PACKAGES = new Set([
  'dialog',
  'alert-dialog',
  'popover',
  'dropdown-menu',
  'tooltip',
  'hover-card',
]);

function hasPortalMissingForOverlay(source: string, prims: Set<string>): boolean {
  const active = [...prims].some((p) => OVERLAY_PACKAGES.has(p));
  if (!active) return false;
  // For each overlay *.Content, check that a *.Portal open tag appears
  // earlier in the source with the matching primitive prefix.
  for (const tag of iterateJsxOpenTags(source)) {
    const m = OVERLAY_CONTENT_RE.exec(tag.tag);
    if (!m) continue;
    const prefix = m[1]; // Dialog / Popover / …
    const portalRe = new RegExp(`<${prefix}\\.Portal\\b`);
    // Look between the nearest preceding *.Root and the Content position.
    const rootRe = new RegExp(`<${prefix}\\.Root\\b`, 'g');
    let lastRoot = -1;
    rootRe.lastIndex = 0;
    for (;;) {
      const rm = rootRe.exec(source);
      if (!rm || rm.index > tag.start) break;
      lastRoot = rm.index;
    }
    if (lastRoot === -1) continue;
    const between = source.slice(lastRoot, tag.start);
    if (!portalRe.test(between)) return true;
  }
  return false;
}

// ---------- top-level classifier ----------

function classify(body: string): Classification {
  const source = stripComments(body);
  const prims = importedRadixPrimitives(source);
  if (hasDialogWithoutTitle(source, prims)) return 'dialog-without-title';
  if (hasDialogWithoutDescription(source, prims)) return 'dialog-content-without-description';
  if (hasTriggerWithoutAsChildRole(source, prims)) return 'trigger-without-aschild-role';
  if (hasComboboxWithoutLabel(source, prims)) return 'combobox-without-label';
  if (hasPortalMissingForOverlay(source, prims)) return 'portal-missing-for-overlay';
  return 'safe';
}

// ---------- tests ----------

describe('radix-primitive-a11y', () => {
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
    it('"composition-remediation" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'composition-remediation',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

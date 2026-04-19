// Eval for the form-with-server-action skill.
//
// Deterministic classifier over React 19 + Next.js 15 form components.
// Detects the four tenet violations in SKILL.md § Examples:
//
//   - action-not-bound-to-form     — file imports a Server Action,
//     has 'use client' and an onSubmit/onClick handler, but no
//     action={} attribute on any form element
//   - controlled-inputs-with-action — form has action={} AND at
//     least one input with value={...} (or checked={...}) +
//     onChange={...}
//   - missing-pending-state        — 'use client' + action={} +
//     submit button, but no disabled={…} on a button and no
//     useFormStatus() anywhere
//   - errors-not-rendered          — useActionState present AND
//     state shape declares `errors`, but no JSX ever reads
//     state.errors / destructured errors
//
// No LLM-as-judge half for v0.1. A v0.2 a11y rubric would judge
// whether rendered error JSX carries role="alert" / aria-describedby
// appropriately.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'action-not-bound-to-form',
  'controlled-inputs-with-action',
  'missing-pending-state',
  'errors-not-rendered',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// --- Signals -------------------------------------------------------------

const USE_CLIENT_RE = /^\s*['"]use client['"]\s*;?\s*$/m;

const IMPORT_FROM_ACTIONS_RE = /import\s+[\s\S]*?\s+from\s+['"](?:\.{1,2}\/|@\/)[\w/-]*actions['"]/;

const ACTION_ATTR_RE = /\baction=\{/;

const USE_ACTION_STATE_RE = /useActionState\s*(?:<[^>]*>)?\s*\(/;
const USE_FORM_STATUS_RE = /useFormStatus\s*\(/;

const DISABLED_ATTR_RE = /\bdisabled=\{[^}]+\}/;

const CONTROLLED_VALUE_RE = /\bvalue=\{/;
const CONTROLLED_CHECKED_RE = /\bchecked=\{/;
const ONCHANGE_RE = /\bonChange=\{/;

const ONSUBMIT_RE = /\bonSubmit=\{/;
const ONCLICK_RE = /\bonClick=\{/;

const BUTTON_TAG_RE = /<button\b/;

const STATE_ERRORS_JSX_RE = /\bstate(?:\?)?\.errors\b/;
const DESTRUCTURED_ERRORS_DECL_RE =
  /const\s*\{\s*(?:[\w,:\s?]*,\s*)?errors\b[\s\S]*?\}\s*=\s*state\b/;
const ERRORS_FIELD_ACCESS_RE = /\berrors(?:\?)?\.\w+/;

const ERRORS_IN_STATE_SHAPE_RE = /\berrors\s*[:?]/;

// --- Predicates ----------------------------------------------------------

function hasControlledInput(body: string): boolean {
  const hasValueOrChecked = CONTROLLED_VALUE_RE.test(body) || CONTROLLED_CHECKED_RE.test(body);
  return hasValueOrChecked && ONCHANGE_RE.test(body);
}

function hasPendingState(body: string): boolean {
  if (USE_FORM_STATUS_RE.test(body)) return true;
  return DISABLED_ATTR_RE.test(body);
}

function rendersErrors(body: string): boolean {
  if (STATE_ERRORS_JSX_RE.test(body)) return true;
  if (DESTRUCTURED_ERRORS_DECL_RE.test(body) && ERRORS_FIELD_ACCESS_RE.test(body)) return true;
  return false;
}

function stateDeclaresErrors(body: string): boolean {
  return ERRORS_IN_STATE_SHAPE_RE.test(body);
}

function isActionNotBound(body: string): boolean {
  if (!USE_CLIENT_RE.test(body)) return false;
  if (!IMPORT_FROM_ACTIONS_RE.test(body)) return false;
  if (ACTION_ATTR_RE.test(body)) return false;
  return ONSUBMIT_RE.test(body) || ONCLICK_RE.test(body);
}

// --- Comment stripping --------------------------------------------------
//
// `//` line comments inside component bodies can mention `useFormStatus` /
// `state.errors` etc. without the code actually using them. Strip those
// before signal matching. Block comments (`/* … */`) stripped first so the
// line-comment regex can't be fooled by `/*` tokens.

function stripComments(body: string): string {
  const noBlock = body.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return noBlock.replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// --- Top-level classifier -----------------------------------------------

function classify(raw: string): Classification {
  const content = stripComments(raw);

  // 1. Action-not-bound is the most specific — no action={} at all.
  if (isActionNotBound(content)) return 'action-not-bound-to-form';

  const isClient = USE_CLIENT_RE.test(content);
  const hasAction = ACTION_ATTR_RE.test(content);

  // Everything below requires a client form with an action={} binding.
  // Server-component forms with action={...} satisfy the "zero-JS form"
  // pattern — pending + errors tenets require client hooks and don't
  // apply.
  if (!isClient || !hasAction) return 'safe';

  // 2. Controlled inputs — breaks progressive enhancement.
  if (hasControlledInput(content)) return 'controlled-inputs-with-action';

  // 3. Missing pending state — any submit button with no pending wiring.
  if (BUTTON_TAG_RE.test(content) && !hasPendingState(content)) {
    return 'missing-pending-state';
  }

  // 4. Errors-not-rendered — state shape declares errors but JSX doesn't
  //    surface them.
  if (
    USE_ACTION_STATE_RE.test(content) &&
    stateDeclaresErrors(content) &&
    !rendersErrors(content)
  ) {
    return 'errors-not-rendered';
  }

  return 'safe';
}

describe('form-with-server-action', () => {
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
});

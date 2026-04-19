// Eval for the optimistic-ui-wiring skill.
//
// Procedural eval per EVAL_SPEC.md § Type B. Activates only when
// the file declares 'use client' AND imports useOptimistic.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasUseClient,
  isJudgeAvailable,
  judgeWithPromptfoo,
  loadFixtures,
  matchCloseBrace,
  matchCloseParen,
  stripComments,
} from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'useoptimistic-without-transition',
  'addoptimistic-fire-and-forget',
  'impure-reducer',
  'direct-mutation',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// ---------- helpers ----------

function importsUseOptimistic(source: string): boolean {
  if (/\bfrom\s+['"]react['"]/.test(source) === false) return false;
  if (/\buseOptimistic\b/.test(source) === false) return false;
  return true;
}

// Extract the second destructured name from
//   const [<state>, <setter>] = useOptimistic(...)
function optimisticSetterNames(source: string): string[] {
  const names: string[] = [];
  const re = /const\s+\[\s*\w+\s*,\s*(\w+)\s*\]\s*=\s*useOptimistic\s*\(/g;
  for (;;) {
    const m = re.exec(source);
    if (!m) break;
    if (m[1]) names.push(m[1]);
  }
  return names;
}

// Find the useOptimistic(state, reducer) reducer body. Returns the
// body text (inline fn or the named function's body if declared in
// the same file).
function extractReducerBodies(source: string): string[] {
  const bodies: string[] = [];
  const re = /useOptimistic\s*\(/g;
  for (;;) {
    const m = re.exec(source);
    if (!m) break;
    const openParen = m.index + m[0].length - 1;
    const close = matchCloseParen(source, openParen);
    if (close === -1) continue;
    const argsText = source.slice(openParen + 1, close);
    // Split on top-level comma; we want arg2.
    let depth = 0;
    let commaIdx = -1;
    for (let i = 0; i < argsText.length; i++) {
      const ch = argsText[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === ',' && depth === 0) {
        commaIdx = i;
        break;
      }
    }
    if (commaIdx === -1) continue;
    const reducerArg = argsText.slice(commaIdx + 1).trim();
    // Inline arrow function with a block body:  (s, v) => { ... }
    const block = /=>\s*\{/.exec(reducerArg);
    if (block) {
      const openIdx = reducerArg.indexOf('{', block.index);
      const closeIdx = matchCloseBrace(reducerArg, openIdx);
      if (closeIdx !== -1) {
        bodies.push(reducerArg.slice(openIdx + 1, closeIdx));
        continue;
      }
    }
    // Inline arrow with expression body:  (s, v) => [...]
    const exprArrow = /=>\s*(.+)/.exec(reducerArg);
    if (exprArrow?.[1]) {
      bodies.push(exprArrow[1]);
      continue;
    }
    // Named function reference — look it up in the same source.
    const identMatch = /^(\w+)$/.exec(reducerArg);
    if (identMatch?.[1]) {
      const fnName = identMatch[1];
      // Find `function <name>` then scan forward for the first `{` at
      // depth 0 w.r.t. parens (skipping the signature's own `()`).
      const declRe = new RegExp(`(?:async\\s+)?function\\s+${fnName}\\b`);
      const fm = declRe.exec(source);
      if (fm) {
        // Walk forward from end of `function reducer`, find the opening `(`,
        // match its close, then find the next `{`, match its close.
        const afterName = fm.index + fm[0].length;
        const openParenIdx = source.indexOf('(', afterName);
        if (openParenIdx !== -1) {
          const closeParenIdx = matchCloseParen(source, openParenIdx);
          if (closeParenIdx !== -1) {
            const openBraceIdx = source.indexOf('{', closeParenIdx);
            if (openBraceIdx !== -1) {
              const closeBraceIdx = matchCloseBrace(source, openBraceIdx);
              if (closeBraceIdx !== -1) {
                bodies.push(source.slice(openBraceIdx + 1, closeBraceIdx));
              }
            }
          }
        }
      }
    }
  }
  return bodies;
}

// Find every call site of a given identifier (addOptimistic name).
function callSiteOffsets(source: string, name: string): number[] {
  const out: number[] = [];
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  for (;;) {
    const m = re.exec(source);
    if (!m) break;
    out.push(m.index);
  }
  return out;
}

// Return true if `offset` lies inside a startTransition(...) callback,
// a <form action={...}> callback, or a useActionState action callback.
function isInsideTransitionOrAction(source: string, offset: number): boolean {
  // Look at a window of 500 chars before and 30 after — enough to
  // catch the enclosing call expression without over-scanning.
  const start = Math.max(0, offset - 800);
  const window = source.slice(start, offset + 1);
  // Token-based guards: one of these should appear in the window.
  if (/\bstartTransition\s*\(/.test(window)) return true;
  if (/\baction\s*=\s*\{/.test(window) || /\baction\s*:\s*/.test(window)) return true;
  if (/\buseActionState\s*\(/.test(window)) return true;
  return false;
}

// ---------- rule implementations ----------

function checkUseOptimisticWithoutTransition(
  source: string,
  setterNames: string[],
): { violation: 'useoptimistic-without-transition' | 'addoptimistic-fire-and-forget' | null } {
  for (const name of setterNames) {
    const sites = callSiteOffsets(source, name);
    if (sites.length === 0) continue;
    for (const off of sites) {
      if (!isInsideTransitionOrAction(source, off)) {
        // Fire-and-forget vs no-transition distinction: if the caller has
        // a visible onClick or handler context, classify as fire-and-forget;
        // otherwise as missing-transition. Heuristic via the window.
        const window = source.slice(Math.max(0, off - 200), off);
        if (/onClick\s*=\s*\{|\bonClick\s*:\s*/.test(window) || /=>\s*\{?\s*$/.test(window)) {
          return { violation: 'addoptimistic-fire-and-forget' };
        }
        return { violation: 'useoptimistic-without-transition' };
      }
    }
  }
  return { violation: null };
}

const IMPURE_REDUCER_RE =
  /\bfetch\s*\(|\bawait\b|\bset[A-Z]\w*\s*\(|\bposthog\.\w+\s*\(|\bsentry\.\w+\s*\(|\blogger\.\w+\s*\(|\bconsole\.\w+\s*\(|\bnew\s+Date\s*\(/;

function hasImpureReducer(bodies: string[]): boolean {
  for (const body of bodies) {
    if (IMPURE_REDUCER_RE.test(body)) return true;
  }
  return false;
}

const DIRECT_MUTATION_RE =
  /\bstate\.(?:push|unshift|splice|pop|shift|sort|reverse)\s*\(|\bstate\[[^\]]+\]\s*=(?!=)|\bstate\.\w+\s*=(?!=)/;

function hasDirectMutation(bodies: string[]): boolean {
  for (const body of bodies) {
    if (DIRECT_MUTATION_RE.test(body)) return true;
  }
  return false;
}

function classify(body: string): Classification {
  const source = stripComments(body);
  if (!hasUseClient(source)) return 'safe';
  if (!importsUseOptimistic(source)) return 'safe';
  const setters = optimisticSetterNames(source);
  if (setters.length === 0) return 'safe';

  const { violation: transitionViolation } = checkUseOptimisticWithoutTransition(source, setters);
  if (transitionViolation) return transitionViolation;

  const reducerBodies = extractReducerBodies(source);
  if (hasImpureReducer(reducerBodies)) return 'impure-reducer';
  if (hasDirectMutation(reducerBodies)) return 'direct-mutation';
  return 'safe';
}

// ---------- tests ----------

describe('optimistic-ui-wiring', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
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
    expect(violations.length).toBeGreaterThanOrEqual(4);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"optimistic-remediation-implementability" scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'optimistic-remediation-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

// Eval for the rsc-data-fetching skill.
//
// Deterministic classifier over Next.js 15 App Router data-fetching code.
// Matches against four violation classes from SKILL.md § Hard Thresholds:
//
//   - missing-cache-strategy    — fetch without cache/next options
//   - conflicting-revalidate    — segment revalidate ≠ per-fetch revalidate
//   - unstable_cache-incomplete — unstable_cache / cache with < 3 args or no tags
//   - dynamic-in-static         — force-static + dynamic API usage

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'missing-cache-strategy',
  'conflicting-revalidate',
  'unstable_cache-incomplete',
  'dynamic-in-static',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function stripComments(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// --- dynamic-in-static ---
function hasForceStatic(body: string): boolean {
  return /export\s+const\s+dynamic\s*=\s*['"]force-static['"]/.test(body);
}

function hasDynamicApiUsage(body: string): boolean {
  // Dynamic APIs: headers() / cookies() / draftMode() calls, searchParams: / searchParams.
  return (
    /\bheaders\s*\(\s*\)/.test(body) ||
    /\bcookies\s*\(\s*\)/.test(body) ||
    /\bdraftMode\s*\(\s*\)/.test(body) ||
    /\bsearchParams\s*:/.test(body) ||
    /\bsearchParams\.\w+/.test(body) ||
    /\{\s*searchParams\s*\}/.test(body)
  );
}

// --- unstable_cache-incomplete ---
// Count top-level arguments to a `unstable_cache(...)` or `cache(...)` call.
// Depth-aware so nested parens/braces don't confuse the count.
interface CacheCall {
  argsText: string;
  argCount: number;
  hasTagsInLastArg: boolean;
}

function findCacheCalls(body: string): CacheCall[] {
  const re = /\b(?:unstable_cache|cache)\s*\(/g;
  const calls: CacheCall[] = [];
  for (const m of body.matchAll(re)) {
    if (m.index === undefined) continue;
    const openIdx = body.indexOf('(', m.index);
    if (openIdx === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = openIdx; i < body.length; i++) {
      const ch = body[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0 && ch === ')') {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const argsText = body.slice(openIdx + 1, end);
    // Split args by top-level commas.
    const args: string[] = [];
    depth = 0;
    let start = 0;
    for (let i = 0; i < argsText.length; i++) {
      const ch = argsText[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      else if (ch === ',' && depth === 0) {
        args.push(argsText.slice(start, i).trim());
        start = i + 1;
      }
    }
    const lastArgTail = argsText.slice(start).trim();
    if (lastArgTail.length > 0) args.push(lastArgTail);
    const lastArg = args[args.length - 1] ?? '';
    const hasTagsInLastArg = /\btags\s*:/.test(lastArg);
    calls.push({ argsText, argCount: args.length, hasTagsInLastArg });
  }
  return calls;
}

// --- conflicting-revalidate ---
function segmentRevalidate(body: string): number | null {
  const m = /export\s+const\s+revalidate\s*=\s*(\d+)/.exec(body);
  return m ? Number(m[1]) : null;
}

function fetchRevalidateValues(body: string): number[] {
  const values: number[] = [];
  const re = /\bnext\s*:\s*\{[^}]*?\brevalidate\s*:\s*(\d+)/g;
  for (const m of body.matchAll(re)) {
    if (m[1]) values.push(Number(m[1]));
  }
  return values;
}

// --- missing-cache-strategy ---
// Inspect each fetch(...) call, check whether its options include cache/next,
// and whether the method is GET (default) or a mutation (exempt).
interface FetchCall {
  optsText: string;
  method: string;
  hasCacheOption: boolean;
  hasNextOption: boolean;
}

function findFetchCalls(body: string): FetchCall[] {
  const re = /\bfetch\s*\(/g;
  const calls: FetchCall[] = [];
  for (const m of body.matchAll(re)) {
    if (m.index === undefined) continue;
    const openIdx = body.indexOf('(', m.index);
    if (openIdx === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = openIdx; i < body.length; i++) {
      const ch = body[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0 && ch === ')') {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const argsText = body.slice(openIdx + 1, end);
    // Second argument = options. Split by top-level comma.
    let topCommaIdx = -1;
    depth = 0;
    for (let i = 0; i < argsText.length; i++) {
      const ch = argsText[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      else if (ch === ',' && depth === 0) {
        topCommaIdx = i;
        break;
      }
    }
    const optsText = topCommaIdx === -1 ? '' : argsText.slice(topCommaIdx + 1).trim();
    const methodMatch = /\bmethod\s*:\s*['"`]([A-Z]+)['"`]/.exec(optsText);
    const method = methodMatch?.[1] ?? 'GET';
    const hasCacheOption = /\bcache\s*:/.test(optsText);
    const hasNextOption = /\bnext\s*:/.test(optsText);
    calls.push({ optsText, method, hasCacheOption, hasNextOption });
  }
  return calls;
}

function classify(content: string): Classification {
  const body = stripComments(content);

  // 1. dynamic-in-static
  if (hasForceStatic(body) && hasDynamicApiUsage(body)) {
    return 'dynamic-in-static';
  }

  // 2. unstable_cache-incomplete
  const cacheCalls = findCacheCalls(body);
  for (const call of cacheCalls) {
    if (call.argCount < 3) return 'unstable_cache-incomplete';
    if (!call.hasTagsInLastArg) return 'unstable_cache-incomplete';
  }

  // 3. conflicting-revalidate
  const segVal = segmentRevalidate(body);
  const fetchVals = fetchRevalidateValues(body);
  if (segVal !== null) {
    for (const v of fetchVals) {
      if (v !== segVal) return 'conflicting-revalidate';
    }
  }

  // 4. missing-cache-strategy
  const fetchCalls = findFetchCalls(body);
  for (const call of fetchCalls) {
    if (call.method !== 'GET') continue; // mutations exempt
    if (!call.hasCacheOption && !call.hasNextOption) return 'missing-cache-strategy';
  }

  return 'safe';
}

describe('rsc-data-fetching', () => {
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
        `misclassified: ${wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') || '(none)'}`,
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
        `held-out misclassified: ${wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') || '(none)'}`,
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

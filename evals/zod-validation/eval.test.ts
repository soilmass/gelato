// Eval for the zod-validation skill.
//
// Deterministic classifier over Next.js route handlers, Server Actions, and
// env-reader patterns. Detects the four violation classes in SKILL.md § Hard
// Thresholds using position-based heuristics over the fixture text:
//
//   - unsafe-cast-bypasses-schema — `as <Type>` / `as unknown as <Type>` on
//     an input expression
//   - parse-should-be-safe-parse  — `.parse(` inside a `try` block whose
//     `catch` returns a 4xx Response
//   - validation-after-consumption — parse position > first side-effect
//     position (db/fetch/send/notify consuming the same input)
//   - missing-at-boundary         — input consumption present, no
//     `.parse()` / `.safeParse()` anywhere in file
//
// No LLM-as-judge half for v0.1 — the four classes are syntactically
// detectable. A v0.2 `ts-morph` upgrade would add AST-level precision for
// cross-function flow analysis.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'missing-at-boundary',
  'validation-after-consumption',
  'parse-should-be-safe-parse',
  'unsafe-cast-bypasses-schema',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// Strip // and /* */ comments before position-based matching. Unlike the
// security-headers classifier (where `//` in `https://` inside a string was
// the hazard), here the fixtures are TypeScript source — strings don't
// commonly contain `//` except inside URL literals which we handle by
// preserving strings as-is via a simple heuristic that only strips `//`
// when it's not preceded by `:`.
function stripComments(body: string): string {
  // Strip /* ... */ blocks first.
  const noBlock = body.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Strip line comments — only when the `//` is at column 0 or preceded by
  // whitespace. This avoids chewing `https://...` inside strings.
  return noBlock.replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// --- Input-consumption markers (in the order they're common) ---
const INPUT_CONSUMPTION_RE =
  /(?:await\s+req\.(?:json|text|formData|blob|arrayBuffer)\s*\(|Object\.fromEntries\s*\(\s*\w+(?:\.\w+)?\s*\)|\bformData\.get\s*\(|\bparams\.\w+|\bprocess\.env\.\w+|await\s+response\.json\s*\(|new\s+URL\s*\(\s*req\.url\s*\))/g;

// --- Side-effect markers (things that consume the input) ---
const SIDE_EFFECT_RE =
  /(?:\bdb\.(?:insert|update|delete|select|transaction)\b|\bfetch\s*\(|\bsend\w*\s*\(|\bnotify\w*\s*\(|\bpublish\w*\s*\(|\bstripe\.\w+\.create\s*\()/g;

// --- Parse call markers ---
const PARSE_RE = /\.parse\s*\(/g;
const SAFE_PARSE_RE = /\.safeParse\s*\(/g;

// --- Unsafe cast on an input expression ---
const UNSAFE_CAST_INPUT_RE =
  /\b(?:await\s+req\.(?:json|text|formData)\s*\(\s*\)|Object\.fromEntries\s*\([^)]*\)|params\.\w+)\s*\)?\s*as\s+(?:unknown\s+as\s+)?[A-Z]\w+/g;

// --- Handler / action detection (to tell "pure helper" from "boundary") ---
const HANDLER_METHOD_RE =
  /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/;
const USE_SERVER_DIRECTIVE_RE = /^\s*['"]use server['"]\s*;?\s*$/m;

interface TryBlock {
  start: number;
  bodyEnd: number;
  catchEnd: number;
  catchHasResponse: boolean;
}

function findTryBlocks(source: string): TryBlock[] {
  const blocks: TryBlock[] = [];
  const tryRe = /\btry\s*\{/g;
  for (const m of source.matchAll(tryRe)) {
    if (m.index === undefined) continue;
    const bodyOpen = source.indexOf('{', m.index);
    const bodyEnd = matchBrace(source, bodyOpen);
    if (bodyEnd === -1) continue;
    // Look for catch after the try body.
    const afterBody = source.slice(bodyEnd + 1);
    const catchMatch = /^\s*catch\s*(?:\([^)]*\))?\s*\{/.exec(afterBody);
    if (!catchMatch) continue;
    const catchOpen = bodyEnd + 1 + catchMatch.index + catchMatch[0].lastIndexOf('{');
    const catchEnd = matchBrace(source, catchOpen);
    if (catchEnd === -1) continue;
    const catchBody = source.slice(catchOpen + 1, catchEnd);
    const catchHasResponse =
      /\bnew\s+Response\s*\(|NextResponse\.json\s*\(|Response\.json\s*\(|return\s*\{\s*ok\s*:\s*false/.test(
        catchBody,
      );
    blocks.push({ start: m.index, bodyEnd, catchEnd, catchHasResponse });
  }
  return blocks;
}

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

function firstMatchIndex(source: string, re: RegExp): number {
  re.lastIndex = 0;
  const m = re.exec(source);
  return m?.index ?? -1;
}

function hasBoundary(body: string): boolean {
  if (HANDLER_METHOD_RE.test(body)) return true;
  if (USE_SERVER_DIRECTIVE_RE.test(body)) return true;
  // Pure env-reader is also a boundary.
  return /\bprocess\.env\.\w+/.test(body);
}

function classify(content: string): Classification {
  const body = stripComments(content);

  // 1. Unsafe cast on an input expression (highest priority).
  UNSAFE_CAST_INPUT_RE.lastIndex = 0;
  if (UNSAFE_CAST_INPUT_RE.test(body)) {
    return 'unsafe-cast-bypasses-schema';
  }

  // 2. `.parse(` inside a `try` with a 4xx-returning catch.
  const tryBlocks = findTryBlocks(body);
  for (const block of tryBlocks) {
    const tryBody = body.slice(block.start, block.bodyEnd + 1);
    const hasParseNotSafe = /\.parse\s*\(/.test(tryBody) && !/\.safeParse\s*\(/.test(tryBody);
    if (hasParseNotSafe && block.catchHasResponse) {
      return 'parse-should-be-safe-parse';
    }
  }

  if (!hasBoundary(body)) return 'safe';

  const firstInput = firstMatchIndex(body, INPUT_CONSUMPTION_RE);
  if (firstInput === -1) return 'safe'; // boundary declared but no input consumed

  const firstParse = Math.min(
    firstMatchIndex(body, PARSE_RE) === -1
      ? Number.POSITIVE_INFINITY
      : firstMatchIndex(body, PARSE_RE),
    firstMatchIndex(body, SAFE_PARSE_RE) === -1
      ? Number.POSITIVE_INFINITY
      : firstMatchIndex(body, SAFE_PARSE_RE),
  );

  if (firstParse === Number.POSITIVE_INFINITY) return 'missing-at-boundary';

  const firstSideEffect = firstMatchIndex(body, SIDE_EFFECT_RE);
  if (firstSideEffect !== -1 && firstSideEffect < firstParse) {
    return 'validation-after-consumption';
  }

  return 'safe';
}

describe('zod-validation', () => {
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

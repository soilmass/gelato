// Eval for the sentry-setup skill.
//
// Deterministic classifier over @sentry/nextjs config fixtures and
// handler fixtures. Detects the four Sentry-misconfig violations in
// SKILL.md § Procedure:
//
//   - hardcoded-dsn           — a literal Sentry DSN string in the
//     file (https://...@...ingest.sentry.io/<id>). DSN mentioned in
//     a comment is exempt (comments stripped before match).
//   - sample-rate-unbounded   — tracesSampleRate / replays*SampleRate
//     set to a bare literal 1 or 1.0 inside Sentry.init, not env-
//     guarded (ternary) and not replaced with a tracesSampler fn.
//   - missing-beforesend      — Sentry.init options object lacks both
//     `beforeSend` and `ignoreErrors` — unfiltered events ship to
//     Sentry.
//   - no-capture-in-catch     — handler file imports from @sentry/*
//     AND has a catch block that neither calls Sentry.captureException
//     nor re-throws.
//
// No LLM-as-judge half for v0.1 — alert routing / coverage judgment
// is a v0.2 candidate rubric.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'hardcoded-dsn',
  'sample-rate-unbounded',
  'missing-beforesend',
  'no-capture-in-catch',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function stripComments(body: string): string {
  const noBlock = body.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return noBlock.replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

function matchCloseParen(body: string, openParenIdx: number): number {
  if (body[openParenIdx] !== '(') return -1;
  let depth = 0;
  for (let i = openParenIdx; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchCloseBrace(body: string, openBraceIdx: number): number {
  if (body[openBraceIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openBraceIdx; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// --- Sentry.init options iteration --------------------------------------

function forEachSentryInitOptions(
  body: string,
  visit: (optionsText: string) => boolean | undefined,
): boolean {
  const initRe = /\bSentry\s*\.\s*init\s*\(/g;
  for (const match of body.matchAll(initRe)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(body, openParen);
    if (closeParen === -1) continue;
    const argsText = body.slice(openParen + 1, closeParen);
    const objStart = argsText.indexOf('{');
    if (objStart === -1) continue;
    const objEnd = matchCloseBrace(argsText, objStart);
    if (objEnd === -1) continue;
    const optionsText = argsText.slice(objStart + 1, objEnd);
    if (visit(optionsText) === true) return true;
  }
  return false;
}

function extractOptionValue(optionsText: string, key: string): string | null {
  const keyRe = new RegExp(`\\b${key}\\s*:`);
  const m = keyRe.exec(optionsText);
  if (!m) return null;
  const startPos = m.index + m[0].length;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let i = startPos; i < optionsText.length; i++) {
    const ch = optionsText[i];
    const prev = optionsText[i - 1] ?? '';
    if (inSingle) {
      if (ch === "'" && prev !== '\\') inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '"' && prev !== '\\') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '`' && prev !== '\\') inTemplate = false;
      continue;
    }
    if (ch === "'") inSingle = true;
    else if (ch === '"') inDouble = true;
    else if (ch === '`') inTemplate = true;
    else if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) return optionsText.slice(startPos, i).trim();
  }
  return optionsText.slice(startPos).trim();
}

// --- hardcoded-dsn -----------------------------------------------------

const DSN_LITERAL_RE = /https?:\/\/[^\s'"`]+\.ingest\.(?:[\w-]+\.)?sentry\.io\/\d+/;

function hasHardcodedDsn(body: string): boolean {
  const stripped = stripComments(body);
  return DSN_LITERAL_RE.test(stripped);
}

// --- sample-rate-unbounded ---------------------------------------------

const SAMPLE_RATE_KEYS = [
  'tracesSampleRate',
  'replaysSessionSampleRate',
  'replaysOnErrorSampleRate',
];

function isUnboundedLiteralRate(value: string): boolean {
  // Bare literal `1` or `1.0` (optionally followed by trailing comment).
  return /^1\.0*$|^1$/.test(value.trim());
}

function hasUnboundedSampleRate(body: string): boolean {
  return forEachSentryInitOptions(body, (optionsText) => {
    for (const key of SAMPLE_RATE_KEYS) {
      const val = extractOptionValue(optionsText, key);
      if (val && isUnboundedLiteralRate(val)) return true;
    }
  });
}

// --- missing-beforesend ------------------------------------------------

function hasMissingBeforeSend(body: string): boolean {
  return forEachSentryInitOptions(body, (optionsText) => {
    if (/\bbeforeSend\s*[:(\s]/.test(optionsText)) return;
    if (/\bignoreErrors\s*:/.test(optionsText)) return;
    return true;
  });
}

// --- no-capture-in-catch -----------------------------------------------

const USE_SERVER_RE = /^\s*['"]use server['"]\s*;?\s*$/m;
const HANDLER_EXPORT_RE =
  /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|middleware)\s*\(/;

function isHandlerFile(body: string): boolean {
  return USE_SERVER_RE.test(body) || HANDLER_EXPORT_RE.test(body);
}

function hasSentryImport(body: string): boolean {
  return /\bfrom\s+['"]@sentry\/[\w-]+['"]/.test(body);
}

const CATCH_BLOCK_RE = /\bcatch\s*\([^)]*\)\s*\{/g;

function hasNoCaptureInCatch(body: string): boolean {
  if (!isHandlerFile(body)) return false;
  if (!hasSentryImport(body)) return false;
  for (const match of body.matchAll(CATCH_BLOCK_RE)) {
    if (match.index === undefined) continue;
    const openBrace = body.indexOf('{', match.index);
    const closeBrace = matchCloseBrace(body, openBrace);
    if (closeBrace === -1) continue;
    const blockBody = body.slice(openBrace + 1, closeBrace);
    const hasCapture =
      /Sentry\s*\.\s*captureException\s*\(/.test(blockBody) ||
      /\bcaptureException\s*\(/.test(blockBody);
    const hasRethrow = /\bthrow\b/.test(blockBody);
    if (!hasCapture && !hasRethrow) return true;
  }
  return false;
}

// --- Top-level classifier ----------------------------------------------

function classify(body: string): Classification {
  if (hasHardcodedDsn(body)) return 'hardcoded-dsn';
  if (hasUnboundedSampleRate(body)) return 'sample-rate-unbounded';
  if (hasMissingBeforeSend(body)) return 'missing-beforesend';
  if (hasNoCaptureInCatch(body)) return 'no-capture-in-catch';
  return 'safe';
}

describe('sentry-setup', () => {
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

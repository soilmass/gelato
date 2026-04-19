// Eval for the structured-logging skill.
//
// Deterministic classifier over Next.js 15 handler fixtures. Detects the
// four Pino + OpenTelemetry-aligned violations in SKILL.md § Procedure:
//
//   - console-in-handler      — `console.*()` invoked inside a function
//     body of a handler file ('use server', export function POST/GET/...,
//     middleware). Top-level console (e.g., boot-time guards) is exempt.
//   - sensitive-data-logged   — logger payload (first arg to
//     logger.<level>/log.<level>) contains a banned key (password,
//     token, secret, apiKey, api_key, authorization, cookie,
//     credit_card, creditCard, ssn). Presence flags like `hasPassword`
//     and field names like `tokenCount` are NOT flagged.
//   - string-template-log     — first arg to logger.<level>/log.<level>
//     is a template literal with `${}` interpolation or a quoted-string
//     concat with `+`.
//   - error-without-object    — logger.error / logger.fatal called with
//     a string/template first arg OR an object first arg that lacks
//     `err` / `error` / `cause` key.
//
// No LLM-as-judge half for v0.1 — log-design quality is a v0.2
// candidate rubric.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'console-in-handler',
  'sensitive-data-logged',
  'string-template-log',
  'error-without-object',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

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

// Extract the first argument from `argsText` (raw body of a call's parens),
// honoring balanced braces / brackets / parens / strings / templates.
function extractFirstArg(argsText: string): string | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let i = 0; i < argsText.length; i++) {
    const ch = argsText[i];
    const prev = argsText[i - 1] ?? '';
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
    else if (ch === '(' || ch === '{' || ch === '[' || ch === '<') depth++;
    else if (ch === ')' || ch === '}' || ch === ']' || ch === '>') depth--;
    else if (ch === ',' && depth === 0) return argsText.slice(0, i);
  }
  return argsText.length > 0 ? argsText : null;
}

// --- Is this file a handler? --------------------------------------------

const USE_SERVER_RE = /^\s*['"]use server['"]\s*;?\s*$/m;
const HANDLER_EXPORT_RE =
  /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|middleware)\s*\(/;

function isHandlerFile(body: string): boolean {
  return USE_SERVER_RE.test(body) || HANDLER_EXPORT_RE.test(body);
}

// --- Is the position inside a function body (not top-level)? ------------

const CONTROL_KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'do', 'else']);

function isInsideFunctionBody(body: string, pos: number): boolean {
  let cursor = pos;
  // Walk up enclosing blocks. Stop at module top-level or a function block.
  for (let hops = 0; hops < 32; hops++) {
    let depth = 0;
    let openBrace = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      const ch = body[i];
      if (ch === '}') depth++;
      else if (ch === '{') {
        if (depth === 0) {
          openBrace = i;
          break;
        }
        depth--;
      }
    }
    if (openBrace === -1) return false;

    // What precedes the `{`?
    let j = openBrace - 1;
    while (j >= 0 && /\s/.test(body[j] ?? '')) j--;
    if (j < 0) return false;

    // Arrow function: ends in `=>`.
    if (j >= 1 && body[j] === '>' && body[j - 1] === '=') return true;

    // Function parameter list: ends in `)`.
    if (body[j] === ')') {
      // Brace-match back to `(`.
      let pd = 1;
      let openParen = -1;
      for (let k = j - 1; k >= 0; k--) {
        if (body[k] === ')') pd++;
        else if (body[k] === '(') {
          pd--;
          if (pd === 0) {
            openParen = k;
            break;
          }
        }
      }
      if (openParen === -1) return false;
      // Token immediately before `(`.
      let m = openParen - 1;
      while (m >= 0 && /\s/.test(body[m] ?? '')) m--;
      const tokEnd = m + 1;
      while (m >= 0 && /[a-zA-Z0-9_$]/.test(body[m] ?? '')) m--;
      const tok = body.slice(m + 1, tokEnd);
      if (CONTROL_KW.has(tok)) {
        // Control block — keep walking upward.
        cursor = openBrace;
        continue;
      }
      // Function-like (named function, method, or anonymous arrow whose
      // parameter list precedes `) =>`). Treat as function body.
      return true;
    }

    // Object / class / other block — not a function body.
    return false;
  }
  return false;
}

// --- console-in-handler -------------------------------------------------

const CONSOLE_CALL_RE = /\bconsole\s*\.\s*(?:log|warn|error|info|debug|trace)\s*\(/g;

function hasConsoleInHandlerBody(body: string): boolean {
  if (!isHandlerFile(body)) return false;
  for (const match of body.matchAll(CONSOLE_CALL_RE)) {
    if (match.index === undefined) continue;
    if (isInsideFunctionBody(body, match.index)) return true;
  }
  return false;
}

// --- logger-call iteration -----------------------------------------------

const LOGGER_CALL_RE = /\b(?:logger|log)\s*\.\s*(?:info|warn|error|debug|trace|fatal)\s*\(/g;
const ERROR_LEVEL_CALL_RE = /\b(?:logger|log)\s*\.\s*(?:error|fatal)\s*\(/g;

function forEachLoggerCall(
  body: string,
  re: RegExp,
  visit: (argsText: string) => boolean | undefined,
): boolean {
  for (const match of body.matchAll(re)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(body, openParen);
    if (closeParen === -1) continue;
    const argsText = body.slice(openParen + 1, closeParen);
    const out = visit(argsText);
    if (out === true) return true;
  }
  return false;
}

// --- sensitive-data-logged ----------------------------------------------

const BANNED_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'credit_card',
  'creditCard',
  'ssn',
];

function hasSensitiveDataLogged(body: string): boolean {
  return forEachLoggerCall(body, LOGGER_CALL_RE, (argsText) => {
    const firstArg = extractFirstArg(argsText);
    if (!firstArg) return;
    if (!firstArg.trimStart().startsWith('{')) return;
    for (const key of BANNED_KEYS) {
      const keyRe = new RegExp(`\\b${key}\\s*[,:}]`);
      if (keyRe.test(firstArg)) return true;
    }
  });
}

// --- string-template-log ------------------------------------------------

function hasStringTemplateLog(body: string): boolean {
  return forEachLoggerCall(body, LOGGER_CALL_RE, (argsText) => {
    const firstArg = extractFirstArg(argsText);
    if (!firstArg) return;
    const trimmed = firstArg.trimStart();
    if (trimmed.startsWith('`') && /\$\{/.test(trimmed)) return true;
    if (
      (trimmed.startsWith("'") || trimmed.startsWith('"')) &&
      /['"]\s*\+|\+\s*['"]/.test(trimmed)
    ) {
      return true;
    }
  });
}

// --- error-without-object ----------------------------------------------

const ERROR_OBJ_KEY_RE = /\b(?:err|error|cause)\s*[,:}]/;

function hasErrorWithoutObject(body: string): boolean {
  return forEachLoggerCall(body, ERROR_LEVEL_CALL_RE, (argsText) => {
    const firstArg = extractFirstArg(argsText);
    if (firstArg === null || firstArg.trim().length === 0) return true;
    const trimmed = firstArg.trimStart();
    if (trimmed.startsWith("'") || trimmed.startsWith('"') || trimmed.startsWith('`')) {
      return true;
    }
    if (trimmed.startsWith('{')) {
      if (!ERROR_OBJ_KEY_RE.test(firstArg)) return true;
    }
  });
}

// --- Top-level classifier ----------------------------------------------

function classify(body: string): Classification {
  if (hasConsoleInHandlerBody(body)) return 'console-in-handler';
  if (hasSensitiveDataLogged(body)) return 'sensitive-data-logged';
  // error-without-object checked before string-template-log so that a
  // stringified error-level log (`logger.error(\`... ${err}\`)`) classifies
  // under the more-specific class.
  if (hasErrorWithoutObject(body)) return 'error-without-object';
  if (hasStringTemplateLog(body)) return 'string-template-log';
  return 'safe';
}

describe('structured-logging', () => {
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

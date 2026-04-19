// Eval for the event-taxonomy-and-instrumentation skill.
//
// Deterministic classifier over PostHog capture / identify call sites.
// Detects the four taxonomy violations in SKILL.md § Procedure:
//
//   - pii-in-event-properties  — capture properties object contains
//     any of {email, password, token, secret, authorization, cookie,
//     apiKey/api_key, creditCard/credit_card, ssn, firstName/
//     first_name, lastName/last_name}.
//   - email-as-distinct-id     — posthog.identify(<expr>, ...) or
//     posthog.identify({distinctId: <expr>, ...}) where <expr>
//     references an `email` identifier directly.
//   - non-snake-case-event     — event name has uppercase / hyphens /
//     spaces OR is on the banned-generic list (click, event, action,
//     submit, page_view bare, user_event, button_clicked).
//   - missing-event-properties — positional capture with no second
//     arg or `undefined`; object-form capture with no `properties`
//     key or `properties: undefined`.

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
  'pii-in-event-properties',
  'email-as-distinct-id',
  'non-snake-case-event',
  'missing-event-properties',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// --- Parser helpers -----------------------------------------------------

function matchCloseParen(body: string, openIdx: number): number {
  if (body[openIdx] !== '(') return -1;
  let depth = 0;
  for (let i = openIdx; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchCloseBrace(body: string, openIdx: number): number {
  if (body[openIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openIdx; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const prev = body[i - 1] ?? '';
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
    else if (ch === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.filter((p) => p.trim().length > 0);
}

function extractObjectKeys(objText: string): string[] {
  const trimmed = objText.trim();
  if (!trimmed.startsWith('{')) return [];
  const closeIdx = matchCloseBrace(trimmed, 0);
  if (closeIdx === -1) return [];
  const body = trimmed.slice(1, closeIdx);
  const keys: string[] = [];
  for (const part of splitTopLevel(body)) {
    const trimmedPart = part.trim();
    const quotedKey = /^['"`]([^'"`]+)['"`]\s*:/.exec(trimmedPart);
    if (quotedKey) {
      keys.push(quotedKey[1] ?? '');
      continue;
    }
    const identKey = /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:[:,]|$)/.exec(trimmedPart);
    if (identKey) keys.push(identKey[1] ?? '');
  }
  return keys.filter((k) => k.length > 0);
}

function extractObjectValue(objText: string, key: string): string | null {
  const trimmed = objText.trim();
  if (!trimmed.startsWith('{')) return null;
  const closeIdx = matchCloseBrace(trimmed, 0);
  if (closeIdx === -1) return null;
  const body = trimmed.slice(1, closeIdx);
  for (const part of splitTopLevel(body)) {
    const trimmedPart = part.trim();
    const keyRe = new RegExp(`^(?:['"\`]${key}['"\`]|${key})\\s*:(.*)$`, 's');
    const m = keyRe.exec(trimmedPart);
    if (m) return (m[1] ?? '').trim();
  }
  return null;
}

function extractFirstArg(argsText: string): string | null {
  const parts = splitTopLevel(argsText);
  return parts[0]?.trimStart() ?? null;
}

function extractSecondArg(argsText: string): string | null {
  const parts = splitTopLevel(argsText);
  return parts[1]?.trim() ?? null;
}

// --- capture-call iteration ---------------------------------------------

interface CaptureInvocation {
  eventName: string | null;
  propertiesObj: string | null; // raw `{...}` text or null
  hasPropertiesSlot: boolean;
  propertiesIsUndefined: boolean;
}

function forEachCaptureCall(
  body: string,
  visit: (inv: CaptureInvocation) => boolean | undefined,
): boolean {
  const re = /\bposthog\s*\.\s*capture\s*\(/g;
  for (const match of body.matchAll(re)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(body, openParen);
    if (closeParen === -1) continue;
    const argsText = body.slice(openParen + 1, closeParen);
    const first = extractFirstArg(argsText) ?? '';
    const firstTrim = first.trim();

    let eventName: string | null = null;
    let propertiesObj: string | null = null;
    let hasPropertiesSlot = false;
    let propertiesIsUndefined = false;

    if (firstTrim.startsWith('{')) {
      // Object form: { distinctId, event, properties }
      const eventVal = extractObjectValue(firstTrim, 'event');
      if (eventVal) {
        const strMatch = /^['"`]([^'"`]+)['"`]$/.exec(eventVal);
        if (strMatch) eventName = strMatch[1] ?? null;
      }
      const keys = extractObjectKeys(firstTrim);
      hasPropertiesSlot = keys.includes('properties');
      const propVal = extractObjectValue(firstTrim, 'properties');
      if (propVal) {
        if (propVal === 'undefined') propertiesIsUndefined = true;
        else if (propVal.startsWith('{')) propertiesObj = propVal;
      }
    } else if (
      firstTrim.startsWith("'") ||
      firstTrim.startsWith('"') ||
      firstTrim.startsWith('`')
    ) {
      // Positional form.
      const strMatch = /^['"`]([^'"`]+)['"`]$/.exec(firstTrim);
      if (strMatch) eventName = strMatch[1] ?? null;
      const second = extractSecondArg(argsText);
      if (second !== null) {
        hasPropertiesSlot = true;
        if (second === 'undefined') propertiesIsUndefined = true;
        else if (second.startsWith('{')) propertiesObj = second;
      }
    }

    const out = visit({ eventName, propertiesObj, hasPropertiesSlot, propertiesIsUndefined });
    if (out === true) return true;
  }
  return false;
}

// --- identify-call iteration --------------------------------------------

interface IdentifyInvocation {
  distinctIdExpr: string | null;
}

function forEachIdentifyCall(
  body: string,
  visit: (inv: IdentifyInvocation) => boolean | undefined,
): boolean {
  const re = /\bposthog\s*\.\s*identify\s*\(/g;
  for (const match of body.matchAll(re)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(body, openParen);
    if (closeParen === -1) continue;
    const argsText = body.slice(openParen + 1, closeParen);
    const first = extractFirstArg(argsText) ?? '';
    const firstTrim = first.trim();

    let distinctIdExpr: string | null = null;
    if (firstTrim.startsWith('{')) {
      distinctIdExpr = extractObjectValue(firstTrim, 'distinctId');
    } else {
      distinctIdExpr = firstTrim || null;
    }

    const out = visit({ distinctIdExpr });
    if (out === true) return true;
  }
  return false;
}

// --- class detectors ----------------------------------------------------

const PII_KEYS = new Set([
  'email',
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apiKey',
  'api_key',
  'creditCard',
  'credit_card',
  'ssn',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
]);

function hasPiiInEventProperties(body: string): boolean {
  return forEachCaptureCall(body, (inv) => {
    if (!inv.propertiesObj) return;
    const keys = extractObjectKeys(inv.propertiesObj);
    for (const key of keys) {
      if (PII_KEYS.has(key)) return true;
    }
  });
}

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;
const BANNED_GENERIC_EVENTS = new Set([
  'click',
  'event',
  'action',
  'submit',
  'page_view',
  'user_event',
  'button_clicked',
]);

function hasNonSnakeCaseEvent(body: string): boolean {
  return forEachCaptureCall(body, (inv) => {
    if (!inv.eventName) return;
    if (!SNAKE_CASE_RE.test(inv.eventName)) return true;
    if (BANNED_GENERIC_EVENTS.has(inv.eventName)) return true;
  });
}

function hasMissingEventProperties(body: string): boolean {
  return forEachCaptureCall(body, (inv) => {
    if (!inv.hasPropertiesSlot) return true;
    if (inv.propertiesIsUndefined) return true;
  });
}

function hasEmailAsDistinctId(body: string): boolean {
  return forEachIdentifyCall(body, (inv) => {
    if (!inv.distinctIdExpr) return;
    // Detect `email` as identifier or as `.email` property access.
    if (/\bemail\b/.test(inv.distinctIdExpr)) return true;
  });
}

// --- Top-level classifier ----------------------------------------------

function classify(body: string): Classification {
  if (hasPiiInEventProperties(body)) return 'pii-in-event-properties';
  if (hasEmailAsDistinctId(body)) return 'email-as-distinct-id';
  if (hasNonSnakeCaseEvent(body)) return 'non-snake-case-event';
  if (hasMissingEventProperties(body)) return 'missing-event-properties';
  return 'safe';
}

describe('event-taxonomy-and-instrumentation', () => {
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
    it('"taxonomy-coherence" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'taxonomy-coherence',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

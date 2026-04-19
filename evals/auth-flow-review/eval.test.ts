// Eval for the auth-flow-review skill.
//
// Deterministic classifier over auth-handler fixtures (Server Actions and
// route.ts files). Detects the four mechanical OWASP-ASVS-aligned
// violations in SKILL.md § Procedure:
//
//   - plaintext-password        — db.insert / db.update writes a plain
//     `password` column (not `passwordHash`) with no hash() call in the
//     same handler file
//   - insecure-password-compare — a line contains both the `password` /
//     `passwordHash` identifier AND `===` / `==` (not `!==` / `!=`)
//   - insecure-session-cookie   — cookies().set / NextResponse.cookies
//     .set for a cookie named like session/auth/token/jwt that's missing
//     one of httpOnly / secure / sameSite
//   - unvalidated-redirect      — file calls redirect(…) AND reads user
//     input (searchParams.get / formData.get / body / searchParams.X)
//     AND has no allowlist / same-origin / verify / validate guard
//
// Session-design trade-offs, MFA enforcement, and rate-limiting are
// intentionally out of scope and land in v0.2 candidate skills.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'plaintext-password',
  'insecure-password-compare',
  'insecure-session-cookie',
  'unvalidated-redirect',
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

// --- plaintext-password -------------------------------------------------

function hasPlaintextPassword(body: string): boolean {
  // Only fires when the file is actually persisting to the DB.
  if (!/\bdb\s*\.\s*(?:insert|update)\b/.test(body)) return false;
  // hash() / bcrypt.hash() / argon2.hash() present anywhere → safe.
  if (/\b(?:hash|bcrypt\.hash|argon2\.hash)\s*\(/.test(body)) return false;
  // Look for a `password` property (object literal key or shorthand).
  // Exclude `passwordHash` / `password_hash` / `password?:` type-annot.
  return /\bpassword(?!Hash|_[hH]ash)\s*[,:}]/.test(body);
}

// --- insecure-password-compare ------------------------------------------

function hasInsecurePasswordCompare(body: string): boolean {
  for (const line of body.split('\n')) {
    // Strict equals `===` / `==` (not `!==` / `!=`) on this line.
    const hasStrictEq = /(?<![!=])={2,3}(?!=)/.test(line);
    if (!hasStrictEq) continue;
    if (/\bpassword\w*\b/i.test(line)) return true;
  }
  return false;
}

// --- insecure-session-cookie --------------------------------------------

const AUTH_COOKIE_NAME_RE = /session|auth|token|jwt/i;

function hasInsecureAuthCookie(body: string): boolean {
  const cookieSetRe = /(?:\bcookies\s*\(\s*\)\s*\.\s*set|\.cookies\s*\.\s*set)\s*\(/g;
  for (const match of body.matchAll(cookieSetRe)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(body, openParen);
    if (closeParen === -1) continue;
    const argsText = body.slice(openParen + 1, closeParen);
    const nameMatch = /^\s*(['"`])([^'"`]+)\1/.exec(argsText);
    if (!nameMatch) continue;
    const name = nameMatch[2] ?? '';
    if (!AUTH_COOKIE_NAME_RE.test(name)) continue;
    const hasHttpOnly = /\bhttpOnly\s*:/.test(argsText);
    const hasSecure = /\bsecure\s*:/.test(argsText);
    const hasSameSite = /\bsameSite\s*:/.test(argsText);
    if (!hasHttpOnly || !hasSecure || !hasSameSite) return true;
  }
  return false;
}

// --- unvalidated-redirect -----------------------------------------------

const REDIRECT_CALL_RE = /\b(?:redirect|NextResponse\s*\.\s*redirect)\s*\(/g;
const USER_INPUT_RE =
  /\bsearchParams\s*\.\s*(?:get\s*\(|\w+)|\bformData\s*\.\s*get\s*\(|\bbody\s*\.\s*\w+/;
// Guard markers: identifier-level matches like `verifySignedPayload` (camelCase
// after the prefix) so TypeScript generic syntax `verify<T>(x)` doesn't defeat
// detection, plus allowlist shapes (startsWith('/'), ALLOWED_, `.has(`).
const REDIRECT_GUARD_RE =
  /\.startsWith\s*\(\s*['"`]\/|\bALLOWED_|allowlist|allowList|\.has\s*\(|\bverify[A-Z]\w*|\bvalidate[A-Z]\w*/;

function hasUnvalidatedRedirect(body: string): boolean {
  // Scan every redirect() call; skip ones whose argument is a string literal
  // (hardcoded targets are safe even if the file reads user input elsewhere).
  let anyUserDerivedRedirect = false;
  for (const match of body.matchAll(REDIRECT_CALL_RE)) {
    if (match.index === undefined) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchCloseParen(body, openParen);
    if (closeParen === -1) continue;
    const arg = body.slice(openParen + 1, closeParen).trim();
    if (/^['"`]/.test(arg)) continue; // hardcoded string literal
    anyUserDerivedRedirect = true;
    break;
  }
  if (!anyUserDerivedRedirect) return false;
  if (!USER_INPUT_RE.test(body)) return false;
  if (REDIRECT_GUARD_RE.test(body)) return false;
  return true;
}

// --- Top-level classifier -----------------------------------------------

function classify(body: string): Classification {
  if (hasPlaintextPassword(body)) return 'plaintext-password';
  if (hasInsecurePasswordCompare(body)) return 'insecure-password-compare';
  if (hasInsecureAuthCookie(body)) return 'insecure-session-cookie';
  if (hasUnvalidatedRedirect(body)) return 'unvalidated-redirect';
  return 'safe';
}

describe('auth-flow-review', () => {
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

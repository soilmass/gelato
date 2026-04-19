// Eval for the security-headers skill.
//
// Deterministic header-string classifier. Parses each fixture (which is
// either a next.config.ts `headers()` array, a middleware.ts NextResponse
// header-set sequence, or both), strips comments, collects the set of
// headers that would actually ship, and matches against the four violation
// classes from SKILL.md § Step 2:
//
//   - missing-header       — one of the six OWASP-baseline headers is absent
//   - over-permissive      — header is set but value weakens below baseline
//   - deprecated-value     — a known-deprecated header or directive is set
//   - conflicting-source   — same header set in config AND middleware with
//                             different values (middleware wins silently)
//
// v0.1 of this skill ships no LLM-as-judge half — header configuration is
// a mechanical check and the deterministic classifier carries the signal.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'missing-header',
  'over-permissive',
  'deprecated-value',
  'conflicting-source',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// The six OWASP-baseline headers.
const BASELINE_HEADERS = [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Content-Security-Policy',
  'Permissions-Policy',
] as const;

// Deprecated headers — setting any is a violation.
const DEPRECATED_HEADERS = ['X-XSS-Protection', 'Expect-CT', 'Public-Key-Pins'];

// Report-Only CSP is legitimate during rollout; treat as a CSP signal equal
// to the enforcing one for the missing-header check when the enforcing one
// is also present.
const CSP_REPORT_ONLY = 'Content-Security-Policy-Report-Only';

type HeaderSource = 'config' | 'middleware';
interface HeaderEntry {
  header: string;
  value: string;
  source: HeaderSource;
}

function extractHeaders(rawBody: string): HeaderEntry[] {
  // Source is inferred from syntax shape, not a file marker: `{ key, value }`
  // is what `next.config.ts` headers() returns, and `response.headers.set(...)`
  // is what middleware.ts writes. Either shape unambiguously identifies its
  // source.
  //
  // We deliberately do NOT strip comments before matching — the naïve
  // `//[^\n]*` comment-strip chews on `https://...` inside string literals
  // and butchers CSP values that reference external origins. The extraction
  // regexes are shape-specific enough that they never match prose inside a
  // line comment accidentally.
  const entries: HeaderEntry[] = [];

  // The trailing `,?\s*` before `\}` / `\)` accommodates multi-line call
  // sites that end with a trailing comma — common inside arrays and more
  // common with Prettier/Biome-formatted multi-line function calls.
  const CONFIG_RE = /\{\s*key:\s*['"]([^'"]+)['"]\s*,\s*value:\s*(['"`])([\s\S]*?)\2\s*,?\s*\}/g;
  for (const m of rawBody.matchAll(CONFIG_RE)) {
    entries.push({ header: m[1] ?? '', value: m[3] ?? '', source: 'config' });
  }

  const SET_RE =
    /response\.headers\.set\s*\(\s*['"]([^'"]+)['"]\s*,\s*(['"`])([\s\S]*?)\2\s*,?\s*\)/g;
  for (const m of rawBody.matchAll(SET_RE)) {
    entries.push({ header: m[1] ?? '', value: m[3] ?? '', source: 'middleware' });
  }

  return entries;
}

function hasBaselineCoverage(entries: HeaderEntry[], header: string): boolean {
  const normalized = header.toLowerCase();
  const match = entries.some((e) => e.header.toLowerCase() === normalized);
  // CSP is satisfied by either Content-Security-Policy or Content-Security-
  // Policy-Report-Only (during rollout).
  if (!match && normalized === 'content-security-policy') {
    return entries.some((e) => e.header.toLowerCase() === CSP_REPORT_ONLY.toLowerCase());
  }
  return match;
}

function isOverPermissive(header: string, value: string): boolean {
  const lower = value.toLowerCase();
  switch (header) {
    case 'Content-Security-Policy':
      return (
        lower.includes("'unsafe-inline'") ||
        lower.includes("'unsafe-eval'") ||
        /default-src\s+\*/.test(lower) ||
        /script-src\s+[^;]*\*/.test(lower)
      );
    case 'Strict-Transport-Security':
      return /max-age\s*=\s*0\b/.test(lower);
    case 'X-Frame-Options':
      return lower === 'allowall' || lower === 'none';
    case 'Referrer-Policy':
      return lower === 'unsafe-url';
    case 'Permissions-Policy':
      // A literal '*' inside any feature grant (camera=*, microphone=*).
      return /=\s*\*/.test(lower);
    default:
      return false;
  }
}

function isDeprecated(header: string, value: string): boolean {
  if (DEPRECATED_HEADERS.includes(header)) return true;
  if (header === 'X-Frame-Options' && /^allow-from\b/i.test(value)) return true;
  return false;
}

function findConflictingSources(entries: HeaderEntry[]): string | null {
  const bySource = new Map<string, Map<HeaderSource, Set<string>>>();
  for (const e of entries) {
    const entry = bySource.get(e.header) ?? new Map<HeaderSource, Set<string>>();
    const values = entry.get(e.source) ?? new Set<string>();
    values.add(e.value);
    entry.set(e.source, values);
    bySource.set(e.header, entry);
  }
  for (const [header, sources] of bySource) {
    if (sources.size < 2) continue;
    const configValues = [...(sources.get('config') ?? [])];
    const middlewareValues = [...(sources.get('middleware') ?? [])];
    if (configValues.length === 0 || middlewareValues.length === 0) continue;
    // Conflict only when values differ.
    const allSame = configValues.every((v) => middlewareValues.includes(v));
    if (!allSame) return header;
  }
  return null;
}

function classify(content: string): Classification {
  const entries = extractHeaders(content);

  // 1. Deprecated (any deprecated header or deprecated directive).
  for (const e of entries) {
    if (isDeprecated(e.header, e.value)) return 'deprecated-value';
  }

  // 2. Conflicting-source (same header, two sources, different values).
  if (findConflictingSources(entries) !== null) return 'conflicting-source';

  // 3. Missing-header (any of the six not covered).
  for (const h of BASELINE_HEADERS) {
    if (!hasBaselineCoverage(entries, h)) return 'missing-header';
  }

  // 4. Over-permissive (any value weakens below baseline).
  for (const e of entries) {
    if (isOverPermissive(e.header, e.value)) return 'over-permissive';
  }

  return 'safe';
}

describe('security-headers', () => {
  describe('quantitative — deterministic header-string classifier', () => {
    it('classifies 12 violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length, 'expected 12 violation fixtures').toBe(12);

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
      expect(fixtures.length, 'expected 5 safe fixtures').toBe(5);
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
      expect(fixtures.length, 'expected at least 6 held-out fixtures').toBeGreaterThanOrEqual(6);

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
    for (const f of violations) {
      byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    }
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has at least one fixture`).toBeGreaterThan(0);
    }
  });
});

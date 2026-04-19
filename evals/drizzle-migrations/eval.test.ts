// Eval for the drizzle-migrations skill.
//
// Procedural skill with three Hard Thresholds. Eval parses each fixture SQL
// file, strips comments and string literals, and matches against the four
// single-statement danger patterns defined in SKILL.md § Hard Thresholds
// and references/violation-classes.md:
//
//   - single-step-drop          — DROP COLUMN / DROP TABLE
//   - single-step-rename        — ALTER TABLE … RENAME COLUMN …
//   - single-step-type-change   — ALTER COLUMN … TYPE …
//   - not-null-without-default  — ADD COLUMN … NOT NULL with no DEFAULT
//
// Quantitative half (always on): 12 labeled violation fixtures across the
// four classes + 10 additive/safe fixtures + 6 adversarial held-out cases.
// No Claude API calls.
//
// Qualitative half: no LLM-as-judge rubric for v0.1 of this skill — the
// three Hard Thresholds are Postgres-mechanical and the deterministic
// classifier carries the signal. A v0.2 `implementability` rubric against
// generated remediation advice is a candidate follow-up.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'single-step-drop',
  'single-step-rename',
  'single-step-type-change',
  'not-null-without-default',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// Strip SQL comments (both `--` line and `/* */` block) and string literals
// before matching. Fixtures 01 and 02 of the held-out set specifically stress
// these — a classifier that does not strip would false-positive when the
// danger keyword appears inside prose or a text value.
function stripSqlNoise(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''");
}

// DROP COLUMN or DROP TABLE as a real SQL keyword (not DROP DEFAULT, not
// DROP CONSTRAINT, not DROP INDEX — those are safe in this skill's scope).
const DROP_COLUMN_RE = /\bDROP\s+COLUMN\b/i;
const DROP_TABLE_RE = /\bDROP\s+TABLE\b/i;
// RENAME COLUMN is always dangerous; RENAME TO (for tables) has the same
// failure mode but Drizzle does not emit it from a schema.ts edit, so we
// restrict to the column form which is what the skill's SQL classifier sees.
const RENAME_COLUMN_RE = /\bRENAME\s+COLUMN\b/i;
// ALTER COLUMN ... TYPE — rewrites the column under a table lock.
// Parameterized without greedy matching across statement boundaries.
const ALTER_TYPE_RE = /\bALTER\s+COLUMN\s+\w+\s+(?:SET\s+DATA\s+)?TYPE\b/i;

// ADD COLUMN clauses — captured per column so multi-add statements
// (`ADD COLUMN a ..., ADD COLUMN b ...`) evaluate each independently.
const ADD_COLUMN_RE =
  /\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+([^,;]+?)(?=(?:,\s*ADD\s+COLUMN\b|;|$))/gi;

function addColumnHasNotNullWithoutDefault(sql: string): boolean {
  const matches = [...sql.matchAll(ADD_COLUMN_RE)];
  for (const m of matches) {
    const definition = (m[2] ?? '').trim();
    const hasNotNull = /\bNOT\s+NULL\b/i.test(definition);
    // `DEFAULT NULL` doesn't count — that's equivalent to no default for a
    // NOT NULL column. Match any other DEFAULT literal or expression.
    const hasRealDefault = /\bDEFAULT\s+(?!NULL\b)\S/i.test(definition);
    if (hasNotNull && !hasRealDefault) return true;
  }
  return false;
}

function classifySql(body: string): Classification {
  const stripped = stripSqlNoise(body);
  if (RENAME_COLUMN_RE.test(stripped)) return 'single-step-rename';
  if (ALTER_TYPE_RE.test(stripped)) return 'single-step-type-change';
  if (DROP_COLUMN_RE.test(stripped) || DROP_TABLE_RE.test(stripped)) return 'single-step-drop';
  if (addColumnHasNotNullWithoutDefault(stripped)) return 'not-null-without-default';
  return 'safe';
}

describe('drizzle-migrations', () => {
  describe('quantitative — deterministic SQL classifier', () => {
    it('classifies 12 violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length, 'expected 12 violation fixtures').toBe(12);

      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classifySql(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const accuracy = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        accuracy,
        `misclassified: ${wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') || '(none)'}`,
      ).toBeGreaterThanOrEqual(0.95);
    });

    it('zero false positives on 10 safe fixtures', async () => {
      const fixtures = await loadFixtures(SAFE_DIR);
      expect(fixtures.length, 'expected 10 safe fixtures').toBe(10);
      const falsePositives = fixtures
        .map((f) => ({ name: f.name, predicted: classifySql(f.content) }))
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
        const predicted = classifySql(f.content);
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

    expect(safe.length, 'SKILL.md targets 10 safe fixtures').toBe(10);
    expect(violations.length, 'SKILL.md targets 12 violation fixtures (3 per class × 4)').toBe(12);

    const byClass = new Map<string, number>();
    for (const f of violations) {
      byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    }
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has at least one fixture`).toBeGreaterThan(0);
    }
  });
});

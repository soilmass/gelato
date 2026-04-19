// Eval for the new-skill-review skill.
//
// Procedural eval over Gelato's own SKILL.md contract. Each fixture is a
// full candidate SKILL.md (frontmatter + body). Classifier checks:
//   1. Zod frontmatter validity (via @gelato/schema)
//   2. `name` kebab-case
//   3. mandated body sections present
//   4. methodology_source non-empty
//   5. body length ≤ 500

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isJudgeAvailable, judgeWithPromptfoo, loadFixtures } from '@gelato/eval-harness';
import { SkillFrontmatter } from '@gelato/schema';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'frontmatter-schema-invalid',
  'missing-mandated-section',
  'missing-methodology-citation',
  'skill-name-kebab-case-violation',
  'skill-body-over-limit',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

const MANDATED_SECTIONS = [
  '## Methodology Attribution',
  '## Stack Assumptions',
  '## When to Use',
  '## When NOT to Use',
  '## Procedure',
  '## Tool Integration',
  '## Examples',
  '## Evaluation',
  '## Handoffs',
  '## References',
] as const;

// Our fixtures use a meta-frontmatter block (--- class: X ---) to carry the
// fixture-level metadata, and then repeat --- to open the candidate
// SKILL.md's own frontmatter. gray-matter reads the first block. To expose
// the candidate SKILL.md to the classifier, we pull the second --- block
// from the content.
function extractCandidate(rawContent: string): {
  frontmatter: string;
  body: string;
} {
  // After gray-matter strips the outer frontmatter, the candidate SKILL.md
  // begins with `---\n...` again. Find that second frontmatter.
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(rawContent.trimStart());
  if (!match) return { frontmatter: '', body: rawContent };
  return { frontmatter: match[1] ?? '', body: (match[2] ?? '').trimStart() };
}

// ---------- rules ----------

function hasFrontmatterSchemaInvalid(fmYaml: string): boolean {
  if (!fmYaml) return true;
  try {
    const parsed = matter(`---\n${fmYaml}\n---\n`);
    const result = SkillFrontmatter.safeParse(parsed.data);
    return !result.success;
  } catch {
    return true;
  }
}

function hasSkillNameKebabViolation(fmYaml: string): boolean {
  const m = /^\s*name\s*:\s*(.+?)\s*$/m.exec(fmYaml);
  if (!m) return false; // covered by schema-invalid
  const name = (m[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
  return !/^[a-z][a-z0-9-]*$/.test(name);
}

function hasMissingMandatedSection(body: string): boolean {
  for (const section of MANDATED_SECTIONS) {
    if (!body.includes(section)) return true;
  }
  return false;
}

function hasMissingMethodologyCitation(fmYaml: string): boolean {
  // Zod schema enforces this, but we also check at string level so the
  // rule surfaces independently from schema-invalid cases.
  const ms = /methodology_source\s*:\s*(\[\s*\]|\n\s*(?:#|[a-z]))/.exec(fmYaml);
  if (ms && ms[1] === '[]') return true;
  const hasField = /methodology_source\s*:/.test(fmYaml);
  if (!hasField) return true;
  // If present, check that at least one list item follows.
  const hasItem = /methodology_source\s*:[\s\S]*?-\s+name\s*:/.test(fmYaml);
  return !hasItem;
}

function hasBodyOverLimit(body: string): boolean {
  return body.split('\n').length > 500;
}

function classify(fixtureContent: string): Classification {
  const { frontmatter, body } = extractCandidate(fixtureContent);
  // Evaluate in order: most-specific → most-general.
  if (hasSkillNameKebabViolation(frontmatter)) return 'skill-name-kebab-case-violation';
  if (hasMissingMethodologyCitation(frontmatter)) return 'missing-methodology-citation';
  if (hasFrontmatterSchemaInvalid(frontmatter)) return 'frontmatter-schema-invalid';
  if (hasMissingMandatedSection(body)) return 'missing-mandated-section';
  if (hasBodyOverLimit(body)) return 'skill-body-over-limit';
  return 'safe';
}

describe('new-skill-review', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 5 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
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
    expect(violations.length).toBeGreaterThanOrEqual(5);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"review-thoroughness" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'review-thoroughness',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

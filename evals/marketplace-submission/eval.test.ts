// Eval for the marketplace-submission skill.
//
// Meta eval — every fixture is a candidate `.claude-plugin/marketplace.json`
// source. Classifier checks five rules from Anthropic's Plugin Marketplaces
// reference.

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
  'marketplace-missing-required-field',
  'marketplace-name-reserved',
  'marketplace-plugin-duplicate-name',
  'marketplace-plugin-missing-source',
  'marketplace-plugin-source-path-traversal',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

const RESERVED_NAMES = new Set<string>([
  'claude-code-marketplace',
  'claude-code-plugins',
  'claude-plugins-official',
  'anthropic-marketplace',
  'anthropic-plugins',
  'agent-skills',
  'knowledge-work-plugins',
  'life-sciences',
]);

function hasStringField(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === 'string' && (obj[key] as string).length > 0;
}

function sourceIsStringWithTraversal(src: unknown): boolean {
  return typeof src === 'string' && src.includes('..');
}

function classify(source: string): Classification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    // Out of scope for this skill — plugin-manifest-validity
    // already owns JSON-parse failures for plugin.json, and the
    // catalog's plugin-validate runs parse-level errors first. Treat
    // as safe here so the skill doesn't double-flag JSON bugs.
    return 'safe';
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'safe';
  }
  const manifest = parsed as Record<string, unknown>;

  // Step 1 — required top-level fields.
  const hasName = hasStringField(manifest, 'name');
  const hasOwner =
    typeof manifest.owner === 'object' &&
    manifest.owner !== null &&
    !Array.isArray(manifest.owner) &&
    hasStringField(manifest.owner as Record<string, unknown>, 'name');
  const hasPlugins = Array.isArray(manifest.plugins);
  if (!hasName || !hasOwner || !hasPlugins) {
    return 'marketplace-missing-required-field';
  }

  // Step 2 — reserved marketplace names.
  if (RESERVED_NAMES.has(manifest.name as string)) {
    return 'marketplace-name-reserved';
  }

  const plugins = manifest.plugins as unknown[];

  // Step 3 — plugin-name uniqueness.
  const seen = new Set<string>();
  for (const entry of plugins) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name === 'string') {
      if (seen.has(e.name)) return 'marketplace-plugin-duplicate-name';
      seen.add(e.name);
    }
  }

  // Step 4 — every plugin entry needs `name` + `source`.
  for (const entry of plugins) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return 'marketplace-plugin-missing-source';
    }
    const e = entry as Record<string, unknown>;
    if (!hasStringField(e, 'name')) return 'marketplace-plugin-missing-source';
    if (!('source' in e) || e.source === undefined || e.source === null) {
      return 'marketplace-plugin-missing-source';
    }
    // object-form source — require a source discriminator
    if (typeof e.source === 'object' && !Array.isArray(e.source)) {
      const s = e.source as Record<string, unknown>;
      if (!hasStringField(s, 'source')) return 'marketplace-plugin-missing-source';
    } else if (typeof e.source !== 'string') {
      return 'marketplace-plugin-missing-source';
    }
  }

  // Step 5 — relative-path sources must not contain ..
  for (const entry of plugins) {
    const e = entry as Record<string, unknown>;
    if (sourceIsStringWithTraversal(e.source)) {
      return 'marketplace-plugin-source-path-traversal';
    }
  }

  return 'safe';
}

describe('marketplace-submission', () => {
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
    it('"marketplace-submission-thoroughness" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'marketplace-submission-thoroughness',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

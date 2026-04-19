// Eval for the plugin-manifest-validity skill.
//
// Meta eval — every fixture is a candidate `.claude-plugin/plugin.json`
// source. Classifier checks five rules from Anthropic's Plugin Reference.

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
  'plugin-manifest-invalid-json',
  'plugin-manifest-missing-name',
  'plugin-name-not-kebab-case',
  'plugin-version-not-semver',
  'plugin-component-path-not-relative',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

const KEBAB_CASE_RE = /^[a-z][a-z0-9-]*$/;

// Semver core: MAJOR.MINOR.PATCH, each a non-negative integer with no
// leading zeros (except the literal 0). Optional pre-release and
// build-metadata suffixes per the semver spec.
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const PATH_FIELDS = [
  'skills',
  'commands',
  'agents',
  'hooks',
  'mcpServers',
  'outputStyles',
  'monitors',
  'lspServers',
] as const;

function pathIsRelative(value: string): boolean {
  return value.startsWith('./');
}

// Each PATH_FIELDS entry may be a string, string[], or an inline
// object (hooks/mcpServers/lspServers only). Inline objects are
// exempt from the ./ rule — they're config, not paths.
function collectPathStrings(manifest: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const field of PATH_FIELDS) {
    const v = manifest[field];
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) {
      for (const entry of v) if (typeof entry === 'string') out.push(entry);
    }
    // object form (hooks/mcpServers/lspServers inline) — skip
  }
  return out;
}

function classify(source: string): Classification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return 'plugin-manifest-invalid-json';
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'plugin-manifest-invalid-json';
  }
  const manifest = parsed as Record<string, unknown>;

  if (!('name' in manifest) || typeof manifest.name !== 'string' || manifest.name.length === 0) {
    return 'plugin-manifest-missing-name';
  }
  if (!KEBAB_CASE_RE.test(manifest.name)) {
    return 'plugin-name-not-kebab-case';
  }
  if ('version' in manifest) {
    const v = manifest.version;
    if (typeof v !== 'string' || !SEMVER_RE.test(v)) {
      return 'plugin-version-not-semver';
    }
  }
  const paths = collectPathStrings(manifest);
  for (const p of paths) {
    if (!pathIsRelative(p)) return 'plugin-component-path-not-relative';
  }
  return 'safe';
}

describe('plugin-manifest-validity', () => {
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
    it('"plugin-manifest-thoroughness" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'plugin-manifest-thoroughness',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

// Eval for the git-hygiene skill.
//
// Quantitative half (always on): replays each fixture through Commitlint
// loaded from the repo's commitlint.config.ts so we measure the rules that
// ship, not a snapshot.
//
// Qualitative half (API-key gated): Promptfoo LLM-as-judge rubrics for
// "explains the why", "<type>/<kebab-slug> branch naming", and PR-description
// completeness. Defers to the eval-harness judge shim, which currently
// throws JudgeNotImplemented — that half turns on in Step 4 of BRIEF.md
// when rsc-boundary-audit forces full Promptfoo integration. Until then
// the rubrics are declared as `.skip` assertions so the report shape is
// already stable.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import lint from '@commitlint/lint';
import load from '@commitlint/load';
import {
  type Fixture,
  isJudgeAvailable,
  judgeWithPromptfoo,
  loadFixtures,
} from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');

interface LintOutcome {
  valid: boolean;
  errorNames: string[];
}

async function getLinter(): Promise<(msg: string) => Promise<LintOutcome>> {
  const loaded = await load({ cwd: process.cwd() });
  const parserOpts = loaded.parserPreset?.parserOpts;
  return async (msg: string): Promise<LintOutcome> => {
    const result = await lint(msg, loaded.rules, parserOpts ? { parserOpts } : {});
    return {
      valid: result.valid,
      errorNames: result.errors.map((e) => e.name),
    };
  };
}

const linterP = getLinter();

function labeled(fixtures: Fixture[]): string {
  return fixtures.map((f) => f.name).join(', ');
}

describe('git-hygiene', () => {
  describe('quantitative — Commitlint format checks', () => {
    it('every good fixture parses cleanly under the repo commitlint config', async () => {
      const linter = await linterP;
      const fixtures = await loadFixtures('evals/git-hygiene/fixtures/good');
      expect(fixtures.length, 'at least 10 good fixtures per SKILL.md').toBeGreaterThanOrEqual(10);
      const failures: { name: string; errors: string[] }[] = [];
      for (const f of fixtures) {
        const outcome = await linter(f.content);
        if (!outcome.valid) failures.push({ name: f.name, errors: outcome.errorNames });
      }
      expect(failures, `good-fixture failures: ${JSON.stringify(failures)}`).toEqual([]);
    });

    it('zero false positives on legitimate-but-unusual fixtures', async () => {
      const linter = await linterP;
      const fixtures = await loadFixtures('evals/git-hygiene/fixtures/legitimate');
      expect(fixtures.length, 'at least 5 legitimate-unusual fixtures').toBeGreaterThanOrEqual(5);
      const falsePositives: string[] = [];
      for (const f of fixtures) {
        const outcome = await linter(f.content);
        if (!outcome.valid) falsePositives.push(f.name);
      }
      expect(
        falsePositives,
        `false positives on legitimate fixtures: ${falsePositives.join(', ')}`,
      ).toEqual([]);
    });

    it('catches at least 95% of violation fixtures', async () => {
      const linter = await linterP;
      const fixtures = await loadFixtures('evals/git-hygiene/fixtures/violations');
      expect(fixtures.length, 'at least 10 violation fixtures').toBeGreaterThanOrEqual(10);
      const missed: string[] = [];
      const caught: string[] = [];
      for (const f of fixtures) {
        const outcome = await linter(f.content);
        if (outcome.valid) missed.push(f.name);
        else caught.push(f.name);
      }
      const rate = caught.length / fixtures.length;
      expect(
        rate,
        `caught ${caught.length}/${fixtures.length}; missed: ${missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"explains the why" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'explains-the-why',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });

    it('"<type>/<kebab-slug>" branch naming rubric scores ≥ 0.9', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'branch-naming',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.9);
    });

    it('PR descriptions include all five mandatory fields (≥ 0.9)', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'pr-completeness',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.9);
    });
  });

  it('fixture inventory is documented', async () => {
    // Sanity check that the three fixture buckets all exist and have the
    // minimum size the SKILL § Evaluation section prescribes — with
    // tolerances for v0.1's reduced fixture count (scaled toward SKILL
    // targets in follow-up expansions).
    const good = await loadFixtures('evals/git-hygiene/fixtures/good');
    const legitimate = await loadFixtures('evals/git-hygiene/fixtures/legitimate');
    const violations = await loadFixtures('evals/git-hygiene/fixtures/violations');
    expect(good.length, `good: ${labeled(good)}`).toBeGreaterThanOrEqual(10);
    expect(legitimate.length, `legitimate: ${labeled(legitimate)}`).toBeGreaterThanOrEqual(5);
    expect(violations.length, `violations: ${labeled(violations)}`).toBeGreaterThanOrEqual(10);
  });
});

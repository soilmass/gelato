# Gelato Eval Spec

Every skill has a runnable eval. A skill without a passing eval is not shipped.

---

## Architecture

- **Runner:** Vitest (dogfoods the stack, one mental model)
- **Helper library:** Promptfoo (for prompt-driven judgment assertions)
- **Real-tool integration:** Lighthouse CI, Playwright, tsc, etc. — invoked directly from Vitest for metric skills
- **LLM-as-judge:** used only for qualitative assertions where structured output isn't enough (via Promptfoo's API)
- **Pass rate publication:** after every eval run, `scripts/update-pass-rate.ts` writes the rate back into the skill's SKILL.md frontmatter

---

## Directory structure

```
evals/
├── core-web-vitals-audit/
│   ├── eval.test.ts          # Vitest entry
│   ├── fixtures/
│   │   └── regressed-app/    # Next.js app with known performance regressions
│   ├── promptfoo.yaml        # OPTIONAL — for judgment assertions
│   └── README.md             # One paragraph: what this eval proves
├── rsc-boundary-audit/
│   ├── eval.test.ts
│   ├── fixtures/
│   │   ├── violations/       # 23 known boundary violations
│   │   └── legitimate/       # 10 legitimate 'use client' cases
│   ├── promptfoo.yaml        # LLM-as-judge for remediation-plan quality
│   └── README.md
```

Each skill has its own eval directory at `evals/<skill-name>/`. No cross-skill shared fixtures in v0.1.

---

## Two eval types

### Type A — Metric eval (for skills with Hard Thresholds)

**Pattern:** spin up a real fixture, invoke a real tool, assert on numeric output.

**Example (`core-web-vitals-audit`):**

```ts
// evals/core-web-vitals-audit/eval.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'bun';
import { runLighthouseCI } from './helpers/lighthouse';
import { applySkillGuidance } from '@gelato/eval-harness';

describe('core-web-vitals-audit', () => {
  let baselineMetrics: Metrics;
  let postFixMetrics: Metrics;

  beforeAll(async () => {
    // Build fixture app
    await spawn(['bun', 'run', 'build'], {
      cwd: 'evals/core-web-vitals-audit/fixtures/regressed-app',
    });
    // Baseline run
    baselineMetrics = await runLighthouseCI('fixtures/regressed-app');
    // Apply skill's recommended fixes (via Claude API + skill content)
    await applySkillGuidance({
      skill: 'core-web-vitals-audit',
      fixturePath: 'fixtures/regressed-app',
    });
    // Rebuild and re-measure
    await spawn(['bun', 'run', 'build'], {
      cwd: 'evals/core-web-vitals-audit/fixtures/regressed-app',
    });
    postFixMetrics = await runLighthouseCI('fixtures/regressed-app');
  });

  it('baseline violates at least one threshold', () => {
    const fails = [
      baselineMetrics.lcp > 2500,
      baselineMetrics.inp > 200,
      baselineMetrics.cls > 0.1,
    ].some(Boolean);
    expect(fails).toBe(true);
  });

  it('post-fix LCP ≤ 2.5s', () => {
    expect(postFixMetrics.lcp).toBeLessThanOrEqual(2500);
  });

  it('post-fix INP ≤ 200ms', () => {
    expect(postFixMetrics.inp).toBeLessThanOrEqual(200);
  });

  it('post-fix CLS ≤ 0.1', () => {
    expect(postFixMetrics.cls).toBeLessThanOrEqual(0.1);
  });
});
```

Pass rate = `passing_assertions / total_assertions`. Expected range: 0.85–1.00 for well-specified metric skills.

### Type B — Judgment eval (for skills without Hard Thresholds)

**Pattern:** two-part — quantitative classification against labeled fixtures, qualitative LLM-as-judge for subjective properties.

**Example (`rsc-boundary-audit`):**

```ts
// evals/rsc-boundary-audit/eval.test.ts
import { describe, it, expect } from 'vitest';
import { loadFixtures, runSkillOnFixtures } from '@gelato/eval-harness';
import { judgeWithPromptfoo } from '@gelato/eval-harness/judge';

describe('rsc-boundary-audit', () => {
  describe('quantitative — classification', () => {
    it('classifies all 23 violation fixtures correctly (≥95%)', async () => {
      const fixtures = await loadFixtures('fixtures/violations');
      const results = await runSkillOnFixtures('rsc-boundary-audit', fixtures);
      const correct = results.filter((r) => r.predicted === r.expected).length;
      expect(correct / results.length).toBeGreaterThanOrEqual(0.95);
    });

    it('zero false positives on 10 legitimate-client fixtures', async () => {
      const fixtures = await loadFixtures('fixtures/legitimate');
      const results = await runSkillOnFixtures('rsc-boundary-audit', fixtures);
      const falsePositives = results.filter(
        (r) => r.predicted === 'violation'
      ).length;
      expect(falsePositives).toBe(0);
    });

    it('remediation plan ordered by bundle-size impact', async () => {
      const plan = await runSkillOnFixtures(
        'rsc-boundary-audit',
        await loadFixtures('fixtures/violations')
      );
      const ordered = [...plan].sort((a, b) => b.bundleImpact - a.bundleImpact);
      expect(plan).toEqual(ordered);
    });
  });

  describe('qualitative — LLM-as-judge', () => {
    it('fix recommendations are implementable as-written', async () => {
      const score = await judgeWithPromptfoo({
        config: 'promptfoo.yaml',
        rubric: 'implementability',
      });
      expect(score).toBeGreaterThanOrEqual(0.8);
    });

    it('examples reference actual codebase, not invented scenarios', async () => {
      const score = await judgeWithPromptfoo({
        config: 'promptfoo.yaml',
        rubric: 'groundedness',
      });
      expect(score).toBeGreaterThanOrEqual(0.85);
    });
  });
});
```

**Promptfoo config (`evals/rsc-boundary-audit/promptfoo.yaml`):**

```yaml
description: rsc-boundary-audit LLM-as-judge rubrics

providers:
  - anthropic:claude-sonnet-4-5-20250929

prompts:
  - file://prompts/judge-implementability.txt
  - file://prompts/judge-groundedness.txt

tests:
  - vars:
      skill_output: file://outputs/sample-remediation.md
    assert:
      - type: llm-rubric
        value: |
          Score 0-1. 1 means every recommendation is implementable as written
          without additional context. 0 means recommendations are vague,
          missing file paths, or require clarifying questions.
```

Pass rate = average of quantitative pass ratio and qualitative rubric scores. Weighting TBD after first runs — default 50/50.

---

## Pass rate publication

After every eval run, `scripts/update-pass-rate.ts` runs. It:

1. Reads Vitest JSON output (`--reporter=json`)
2. Computes per-skill pass rate
3. Opens each skill's `SKILL.md`, uses `gray-matter` to parse frontmatter
4. Writes `metadata.eval.pass_rate`, `metadata.eval.last_run`, `metadata.eval.n_cases`
5. Commits the update under a dedicated CI commit (`chore(eval): update pass rates`)

**Do not hand-edit those fields.** The runner owns them. PRs that modify them manually are rejected by CI.

---

## CI behavior

GitHub Actions workflow `.github/workflows/eval.yml`:

- Runs on every PR that touches `skills/**` or `evals/**`
- Runs nightly on `main`
- If any skill's pass rate drops by more than 0.05 from its last committed value, CI fails
- If a new skill has no eval, CI fails
- On green, opens a commit to update frontmatter pass rates

Failure mode: if an eval is flaky, it is not a passing eval. Quarantine the skill (mark `eval.pass_rate: null` manually and open an issue) rather than lowering the bar.

---

## Anthropic API usage in evals

Judgment evals call the Anthropic API (via Promptfoo). This costs money.

- Local dev: evals require `ANTHROPIC_API_KEY` in env
- CI: key stored in GitHub Actions secrets
- Budget: estimate ~$0.50 per full eval run across all skills in v0.1 (low because there are only 2 skills). Will grow; add budget monitoring before scaling past 15 skills.
- Caching: Promptfoo caches responses by default; set `cache: true` in config to avoid re-billing during development

---

## What the harness provides

`packages/eval-harness/` (build this in step 2 of the build order) exposes:

- `applySkillGuidance({ skill, fixturePath })` — runs the skill end-to-end against a fixture via the Anthropic API, returns the applied changes
- `runSkillOnFixtures(skill, fixtures)` — lighter variant that returns classifications/predictions without applying changes
- `judgeWithPromptfoo({ config, rubric })` — invokes Promptfoo and returns a 0–1 score
- `loadFixtures(path)` — hydrates fixture metadata from conventional folder layout

Skills should not reimplement these. They live in one place.

---

## Stop criteria for an eval

A skill's eval is "done" when:

- All quantitative assertions pass on a clean run
- Qualitative rubrics score ≥ 0.8 (subject to revision per skill)
- Running the eval twice in a row produces identical pass rates (deterministic or well-cached)
- `scripts/update-pass-rate.ts` successfully writes the rate back to frontmatter
- CI passes

If any of these fail, the skill is not shipped.

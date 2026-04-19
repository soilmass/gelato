# EVAL_SPEC.md contract — condensed

Gelato ships two eval types per EVAL_SPEC.md:

## Type A — quantitative classifier

Skills with mechanical violation classes (most of Core 1, most of Core 2, all of Core 6). The eval:

1. Loads labeled fixtures from `VIOLATIONS_DIR`, `SAFE_DIR`, `HELD_OUT_DIR` via `loadFixtures()`.
2. Runs a deterministic classifier over each fixture's content.
3. Asserts accuracy thresholds:
   - Violations set: ≥ 0.95
   - Safe set: zero false positives (`toEqual([])`)
   - Held-out set: ≥ 0.90

## Type B — LLM-as-judge rubric

Skills with subjective criteria (remediation quality, implementability). The eval:

1. Imports `judgeWithPromptfoo` + `isJudgeAvailable`.
2. Wraps in `describe.skipIf(!isJudgeAvailable())` so CI without `ANTHROPIC_API_KEY` skips the test block rather than failing.
3. Calls `judgeWithPromptfoo({ config, rubric })` which spawns the promptfoo CLI subprocess.
4. Asserts `result.score >= 0.85` (standard threshold).

Most skills ship both halves. A skill shipping only Type B is flagged by `eval-harness-pattern` Step 1 as missing the quantitative classifier.

## Canonical constant names

- `VIOLATIONS_DIR` — per-class violation fixtures
- `SAFE_DIR` — canonical-correct fixtures
- `HELD_OUT_DIR` — adversarial generalization fixtures

These names are documented in EVAL_SPEC.md. Alternate names (`GOOD_DIR`, `VIOLATION_FIXTURES`) fail the classifier's pattern match.

## Why gating the LLM-judge matters

- CI without an Anthropic API key should still run the quantitative half successfully.
- Branches, forks, and contributor PRs frequently lack the secret.
- Without gating, a missing key causes `judgeWithPromptfoo` to throw → Vitest marks the whole file failed → unrelated classifier failures get missed.

`isJudgeAvailable()` checks the env var and returns a boolean. `describe.skipIf(!isJudgeAvailable())` is the canonical form — Vitest runs the describe block only when the predicate is false.

## Why the 0.95 / 0.90 thresholds

- **0.95 on the violations set**: each violation fixture carries a known class label. The classifier must hit every class almost perfectly; ≤ 5% miss is tolerable on small sets (≥ 20 total fixtures = ≤ 1 miss).
- **0.90 on held-out**: adversarial variants are harder by design. Some drift is expected; the gap between 0.95 and 0.90 is the "generalization allowance."
- **Zero FPs on safe**: false positives destroy trust. A skill that flags canonical-correct code loses credibility faster than one that under-detects.

## Exemptions documented in EVAL_SPEC.md

- Metric-type skills (LCP/INP/CLS, bundle-size budgets) use real tools (Lighthouse CI, `@next/bundle-analyzer`) instead of fixture classifiers. They carry numeric thresholds directly from the upstream methodology rather than Type-A accuracy assertions.
- The `eval-harness-pattern` classifier detects these via the presence of `runLighthouse` / `runSkillWithClaude` imports from `@gelato/eval-harness` and exempts Steps 1-3.

## What this skill's classifier does NOT check

- Whether the classifier is correct (that's the eval's own job — run against fixtures).
- Whether the fixtures cover the right violation classes (human review).
- Whether the promptfoo rubric prose scores reasonably (separate concern; rubric quality is a review call).
- Whether the skill has > 1 violation class per directory (EVAL_SPEC.md recommends one; not enforced mechanically).
- Whether `fixture inventory matches SKILL.md § Evaluation` — the existing `it()` block per-eval already checks this; this skill checks eval shape, not inventory.

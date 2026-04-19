# git-hygiene eval

Proves the skill's commit-message discipline is real, not aspirational, by
running every fixture through the exact Commitlint rules shipped in
`commitlint.config.ts`.

## What the eval measures

### Quantitative (always on)

- **Good fixtures parse cleanly.** Canonical Conventional Commits shapes for
  all 11 locked types, plus a Co-Authored-By trailer example. Failure here
  means the commitlint config is rejecting something it shouldn't.
- **Zero false positives on legitimate-unusual fixtures.** Renovate-style
  batched dep bumps, Changesets release commits, `revert:` commits, BREAKING
  CHANGE footers, long multi-paragraph bodies. Failure here means the config
  is too strict and is going to bounce real commits.
- **≥95% of violation fixtures caught.** wip / update / bare `fix` / `misc` /
  past-tense / trailing period / over-length / uppercase type / file-path
  scope / empty subject. Failure here means the config has lost a rule it
  used to enforce.

### Qualitative (Step 4 of BRIEF.md)

Three Promptfoo rubrics declared in `promptfoo.yaml` for LLM-as-judge:

- `"explains the why"` — commit bodies do more than restate the diff.
- `"<type>/<kebab-slug>"` — branch naming suggestions.
- PR description completeness — all five mandatory fields.

These currently `.skip` because `judgeWithPromptfoo` throws
`JudgeNotImplemented` until rsc-boundary-audit forces the real Promptfoo
integration (Step 4 of BRIEF.md).

## Fixture inventory

v0.1 ships a reduced fixture count versus the SKILL's targets (30 / 10 / 20+),
to prove the pipeline end-to-end with tractable author overhead:

| Bucket | v0.1 count | SKILL target | Gap closed in |
|---|---|---|---|
| good | 11 | 30 | follow-up `test(git-hygiene): expand fixture coverage` |
| legitimate | 5 | 10 | follow-up |
| violations | 11 | ≥20 | follow-up |

Expansion is deferred — not skipped — because the assertion structure is
already final. Each new fixture is a drop-in file without a test edit.

## Running

```bash
bun run eval git-hygiene
```

The orchestrator runs Vitest with a JSON reporter and hands the report to
`scripts/update-pass-rate.ts`, which writes `metadata.eval.pass_rate`,
`metadata.eval.last_run`, and `metadata.eval.n_cases` back into
`skills/git-hygiene/SKILL.md`. Those fields are runner-owned — hand-edits
are rejected by `scripts/validate-skills.ts`.

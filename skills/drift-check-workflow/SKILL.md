---
name: drift-check-workflow
description: >
  Enforce Gelato's drift-check pattern on a candidate
  `.github/workflows/drift-*.yml`. Five violation classes:
  missing `schedule:` cron, missing `workflow_dispatch:`,
  missing a fetch step (curl/wget), missing `actions/checkout`,
  missing a `concurrency:` block.
  Use when: adding a new skill whose `methodology_source[]`
  cites an external authority, reviewing a drift workflow PR,
  auditing an existing drift workflow.
  Do NOT use for: snapshot diff semantics, workflow secrets,
  SKILL.md (→ new-skill-review), plugin.json
  (→ plugin-manifest-validity), marketplace.json
  (→ marketplace-submission), eval.test.ts
  (→ eval-harness-pattern).
license: MIT
metadata:
  version: "1.0"
  core: meta
  subsystem: maintenance
  phase: build
  type: procedural
  methodology_source:
    - name: "Gelato drift pattern (self-hosted)"
      authority: "Gelato project / Neopolitan"
      url: "https://github.com/soilmass/gelato/blob/main/.github/workflows/drift-conventional-commits.yml"
      version: "drift-conventional-commits.yml (2026)"
      verified: "2026-04-19"
  stack_assumptions:
    - "GitHub Actions"
    - "Ubuntu runner (`ubuntu-latest`)"
    - "`curl` available in the runner (bundled with ubuntu-latest)"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T17:08:32.807Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill over Gelato's own drift
    pattern. Five mechanical violation classes detectable from a
    single `.github/workflows/drift-*.yml` file.
---

# drift-check-workflow

Encodes the shape every Gelato drift-check workflow must carry. BRIEF.md § build-tree and TEMPLATE.md § drift-check require each external methodology to be shadowed by a weekly fetch-and-diff job. This skill's classifier catches the five ways those jobs routinely break: no cron, no manual trigger, no actual fetch, no checkout to diff against, and no concurrency group (so two weekly runs can race).

---

## Methodology Attribution

- **Primary:** Gelato drift pattern (self-hosted)
  - Source: [https://github.com/soilmass/gelato/blob/main/.github/workflows/drift-conventional-commits.yml](https://github.com/soilmass/gelato/blob/main/.github/workflows/drift-conventional-commits.yml)
  - Authority: Gelato project / Neopolitan
  - Version: drift-conventional-commits.yml (2026)
  - Verified: 2026-04-19
- **Drift-check:** _self-referential — this skill's own eval enforces the pattern; no external drift needed._

Encoded: the five mechanical rules every Gelato drift workflow must satisfy. NOT encoded: snapshot content format (prose-markdown vs raw HTML — human choice per methodology), which action opens the PR (`peter-evans/create-pull-request` is standard but unpinned), the exact fetch command (curl / wget / `actions/fetch`), snapshot-diff success semantics (some skills want a hard failure, others open an "FYI" PR — same shape, different next step).

---

## Stack Assumptions

- GitHub Actions — the workflow lives under `.github/workflows/`
- `ubuntu-latest` runner (so `curl` / `wget` are pre-installed)
- Repo uses `actions/checkout@v4` or later (pinned by commit SHA acceptable)

If you run drift workflows on self-hosted runners, verify `curl` is available and adapt.

---

## When to Use

Activate when any of the following is true:
- Adding a new skill with an external `methodology_source[]`
- Adding a new source to an existing skill's `methodology_source[]`
- Reviewing a PR that touches any `.github/workflows/drift-*.yml`
- Auditing an existing drift workflow

## When NOT to Use

Do NOT activate for:
- **SKILL.md frontmatter / body** → `new-skill-review`
- **eval.test.ts shape** → `eval-harness-pattern`
- **Plugin manifest** → `plugin-manifest-validity`
- **Marketplace entry** → `marketplace-submission`
- **Upstream-source quality** (whether the source is worth citing) — human call
- **Secrets / credentials setup** — out of scope; see GitHub's repo-secrets guidance

---

## Procedure

### Step 1 — `schedule:` (cron) trigger is required

Without a cron trigger, drift is never detected automatically. Pick a weekly cadence (e.g. Mondays 04:00 UTC); keep cadences staggered across drift workflows so the runner doesn't thundering-herd.

```yaml
# RIGHT
on:
  schedule:
    - cron: '0 4 * * 1'
  workflow_dispatch:

# WRONG — only manual; nothing auto-runs
on:
  workflow_dispatch:
```

### Step 2 — `workflow_dispatch:` is required

Humans need a one-click trigger for "is my source still up?" checks and for re-running after a failure. Without this, the weekly cron is the only path — and a bad cron means a week of silence.

```yaml
# RIGHT
on:
  schedule:
    - cron: '0 4 * * 1'
  workflow_dispatch: {}

# WRONG — no manual trigger
on:
  schedule:
    - cron: '0 4 * * 1'
```

### Step 3 — The workflow must actually fetch the upstream source

`curl`, `wget`, or a dedicated fetch action. A drift workflow without a fetch is a placeholder that pretends to run. Flag any workflow where no step's `run:` or `uses:` contains `curl`, `wget`, or a fetch-action pattern.

```yaml
# RIGHT
- name: Fetch Conventional Commits
  run: curl -fsSL https://www.conventionalcommits.org/en/v1.0.0/ -o /tmp/cc.html

# WRONG — no fetch step
- name: TODO
  run: echo "Will fetch the spec here eventually."
```

### Step 4 — `actions/checkout` is required so there's a snapshot to diff against

The repo must be checked out — otherwise the workflow has no local snapshot file to compare the fetched HTML/Markdown against, and the "drift detection" is just a fetch. Use `actions/checkout@v4` (or later; pinned SHA acceptable).

### Step 5 — `concurrency:` group is required

Weekly crons can overlap with manual `workflow_dispatch` runs (e.g. a human triggers a retry while the scheduled run is still mid-flight). Without a concurrency group, two runs compete on the same PR-open step and either duplicate the PR or race each other's snapshot commit. Standard shape:

```yaml
concurrency:
  group: drift-<skill-slug>
  cancel-in-progress: true
```

---

## Tool Integration

No CLI. The classifier lives in this skill's eval; Vitest runs it alongside every other skill's eval on `bun run eval`. For ad-hoc checks, GitHub's `act` project runs workflows locally — but the classifier catches the common shape-level bugs without needing a live runner.

## Examples

### Example 1 — `drift-workflow-missing-concurrency`

**Input:** `.github/workflows/drift-eslint-rules.yml` has `schedule:`, `workflow_dispatch:`, a curl fetch, `actions/checkout@v4`, but no `concurrency:` block.
**Output:** Two overlapping runs both open `chore(drift): eslint-rules snapshot update` PRs, duplicating noise. Fix: add the two-line concurrency group.

### Example 2 — `drift-workflow-missing-fetch`

**Input:** workflow includes checkout + a cron + workflow_dispatch but no `curl` / `wget` anywhere.
**Output:** the workflow passes every week but never checks the upstream source — a silent false-negative. Fix: add a fetch step pointed at the authoritative URL from the skill's `methodology_source[].url`.

---

## Edge Cases

- **Workflows using `actions/fetch-artifact` or a custom composite action:** the classifier also accepts `uses:` lines referencing `anthropics/` or other first-party fetch actions as a fetch. Bespoke composite actions named something other than `*fetch*` won't match — prefer `curl` / `wget` for portability.
- **Cron expressions using `*/N` or `@weekly`:** accepted (regex permits both).
- **Workflows that fetch multiple sources:** one fetch step is sufficient to pass Rule 3; the skill doesn't require one-per-source.
- **Concurrency group with `group: ${{ github.workflow }}`:** accepted — a valid templated group expression counts as a concurrency block.
- **Reusable workflows called via `workflow_call:`:** out of scope; `workflow_call` is the only trigger permitted in some orgs. The skill flags the absence of `schedule` / `workflow_dispatch` — teams using `workflow_call` patterns need a different skill.

---

## Evaluation

See `/evals/drift-check-workflow/`.

**Quantitative:** ≥ 5 violation fixtures at ≥ 95%, 0 false positives on ≥ 4 safe, held-out ≥ 90%.
**Qualitative:** Promptfoo rubric `drift-workflow-thoroughness` ≥ 0.85.

---

## Handoffs

Scoped to `.github/workflows/drift-*.yml` shape. NOT absorbed:

- SKILL.md → `new-skill-review`
- Eval contract → `eval-harness-pattern`
- Plugin manifest → `plugin-manifest-validity`
- Marketplace entry → `marketplace-submission`

---

## Dependencies

- **External skills:** `new-skill-review`
- **MCP servers:** none
- **Tools required in environment:** `@gelato/eval-harness`, Vitest

---

## References

- `references/drift-pattern.md` — condensed Gelato drift-workflow pattern with per-rule rationale

## Scripts

- _(none — classifier lives in `evals/drift-check-workflow/eval.test.ts`)_

# Drift Workflow Pattern — condensed reference

Source: [Gelato `drift-conventional-commits.yml` + BRIEF.md § build-tree + TEMPLATE.md § drift-check](https://github.com/soilmass/gelato/blob/main/.github/workflows/drift-conventional-commits.yml), verified 2026-04-19.

Every skill that cites an external methodology ships a weekly drift-check workflow. This file is the canonical extract the `drift-check-workflow` classifier encodes.

## Location

`.github/workflows/drift-*.yml`. The `drift-` prefix is convention, not enforced; this skill matches on shape, not filename.

## Required shape (5 rules)

### 1. `schedule:` trigger

Workflow must run on a cron. Weekly is the floor — more often is fine. No cron = no automation.

```yaml
on:
  schedule:
    - cron: '0 4 * * 1'
```

Staggering: pick a unique UTC minute across drift workflows so the runner pool isn't hammered at the top of the hour.

### 2. `workflow_dispatch:` trigger

Manual trigger is mandatory. Humans use it for ad-hoc "is the source still up?" checks and for re-running after a failed cron run.

```yaml
on:
  workflow_dispatch: {}
```

### 3. Fetch step

At least one step must actually fetch the upstream source. Accepted forms:

- `run:` containing `curl` or `wget`
- `uses:` referencing a first-party fetch action (`anthropics/fetch-upstream`, `actions/cache` paired with a fetch, etc.)

A drift workflow without a fetch is a placeholder.

### 4. `actions/checkout`

The repo must be checked out for the workflow to have a snapshot to diff against. Pin to a major version (`@v4`) or to a full commit SHA; bare `@main` is discouraged (not enforced by this skill).

### 5. `concurrency:` group

Cancel in-flight runs when a new one starts. Without this, a manual `workflow_dispatch` racing the weekly cron can double-open PRs or corrupt snapshots.

```yaml
concurrency:
  group: drift-<skill-slug>
  cancel-in-progress: true
```

Templated groups like `${{ github.workflow }}` are acceptable.

## What the classifier checks (5 rules)

1. **`drift-workflow-missing-schedule`** — no `schedule:` trigger.
2. **`drift-workflow-missing-dispatch`** — no `workflow_dispatch:` trigger.
3. **`drift-workflow-missing-fetch`** — no `curl` or `wget` in any step.
4. **`drift-workflow-missing-checkout`** — no `actions/checkout` reference.
5. **`drift-workflow-missing-concurrency`** — no top-level `concurrency:` block.

## What the classifier does NOT check

- Snapshot format (raw HTML vs prose-markdown — human choice per methodology).
- Whether the fetched URL matches the skill's `methodology_source[].url`.
- Which PR-opening action the workflow uses.
- Whether the diff step actually runs after fetch + checkout.
- Whether the cron cadence is sensible (weekly vs hourly).
- Workflow secrets (`secrets.*`) — out of scope.
- Composite / reusable workflow patterns (`workflow_call:`).

## Typical end-to-end shape

```yaml
name: Drift — <Source Name>

on:
  schedule:
    - cron: '0 4 * * 1'
  workflow_dispatch: {}

concurrency:
  group: drift-<skill-slug>
  cancel-in-progress: true

jobs:
  drift:
    name: Fetch and compare canonical sources
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Fetch upstream
        run: curl -fsSL https://upstream.example/spec -o /tmp/snapshot.html
      - name: Diff against repo snapshot
        run: diff -u skills/<name>/references/snapshot.html /tmp/snapshot.html || true
      - name: Open PR on drift
        uses: peter-evans/create-pull-request@v6
        with:
          commit-message: "chore(drift): <name> snapshot update"
          branch: chore/drift-<name>-${{ github.run_id }}
```

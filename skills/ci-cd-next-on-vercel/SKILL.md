---
name: ci-cd-next-on-vercel
description: >
  Configure a GitHub Actions pipeline for Next.js 15 on Vercel following
  Vercel's deployment docs and DORA-metric hygiene. Four rules over
  workflow YAML: third-party actions are version-pinned (never `@main`
  / `@master` / `@HEAD`), secrets are never echoed to logs, every
  workflow has a `concurrency:` block with `cancel-in-progress: true`
  (stale runs don't pile up on merge), and every job has
  `timeout-minutes:` set (caps default 6-hour runaway). Flags the four
  corresponding violations.
  Use when: writing a `.github/workflows/*.yml`, reviewing a PR that
  touches CI, auditing the deploy pipeline, investigating "our runners
  are always saturated", setting up a new Next.js repo on Vercel.
  Do NOT use for: Vercel env-var config per se (→ security-headers for
  HTTP-side, environment-scoping is operational), branch-protection
  rules (configured in GitHub UI), release cadence policy.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: deployment
  phase: run
  type: procedural
  methodology_source:
    - name: "Vercel — Deployment Overview"
      authority: "Vercel"
      url: "https://vercel.com/docs/deployments/overview"
      version: "Vercel docs (2025)"
      verified: "2026-04-18"
    - name: "Accelerate / DORA — Four Key Metrics"
      authority: "DORA / Nicole Forsgren et al."
      url: "https://dora.dev/guides/dora-metrics-four-keys/"
      version: "dora.dev (2024 edition)"
      verified: "2026-04-18"
  stack_assumptions:
    - "next@15+ App Router"
    - "GitHub Actions (ubuntu-latest)"
    - "Vercel — git integration OR Vercel CLI"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T10:32:59.163Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four mechanical violations (unpinned-action,
    secret-echoed-in-run, missing-concurrency-cancel, no-timeout-minutes)
    detected by a deterministic classifier over workflow YAML fixtures.
---

# ci-cd-next-on-vercel

Encodes four mechanical workflow-hygiene rules for a Next.js 15 / Vercel GitHub Actions pipeline. Four properties of a workflow file — version-pinned actions, no secret echoing, concurrency with cancel, job timeouts — keep CI green, cheap, and auditable. Procedural skill.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Vercel — Deployment Overview
  - Source: [https://vercel.com/docs/deployments/overview](https://vercel.com/docs/deployments/overview)
  - Authority: Vercel
  - Verified: 2026-04-18
- **Secondary:** DORA / Accelerate — Four Key Metrics
  - Source: [https://dora.dev/guides/dora-metrics-four-keys/](https://dora.dev/guides/dora-metrics-four-keys/)
  - Authority: DORA / Nicole Forsgren et al.
  - Verified: 2026-04-18
- **Drift-check:** `.github/workflows/drift-vercel-dora.yml`

Encoded: the four workflow-hygiene rules detectable from a single `.yml` file. NOT encoded: branch-protection rules (GitHub UI), release cadence, PR-size norms, rollback strategies, blue-green / canary deploys, feature-flag rollout.

---

## Stack Assumptions

- `next@15+` App Router
- GitHub Actions runners (`ubuntu-latest`)
- Vercel — git integration (automatic PR preview deploys) OR Vercel CLI for custom flows
- `bun@1.1+`

If your CI is CircleCI / Jenkins / custom, the principles apply but the YAML shape differs — fork the suite.

---

## When to Use

Activate when any of the following is true:
- Writing a new `.github/workflows/*.yml`
- Reviewing a PR that edits CI
- Auditing the deploy pipeline
- "Our runners are always saturated" / "stale runs are piling up"
- Setting up a new Next.js repo to deploy on Vercel
- "Someone accidentally committed a secret, then echoed it in CI"

## When NOT to Use

Do NOT activate for:
- **Branch protection rules** — configured in GitHub UI, not YAML.
- **Vercel env-var management** — UI / Vercel CLI, not workflow.
- **Release cadence policy** — team choice.
- **Blue-green / canary deploys** — v0.2 candidate `progressive-deploys` skill.

---

## Procedure

### Step 1 — Version-pin third-party actions

```yaml
# RIGHT — pinned
- uses: actions/checkout@v4
- uses: oven-sh/setup-bun@v1
- uses: vercel/action@v25.1.0

# BEST — pinned to a commit SHA (reproducible, tamper-resistant)
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

# WRONG — floating reference, supply-chain risk
- uses: actions/checkout@main
- uses: oven-sh/setup-bun@master
- uses: some-vendor/some-action@HEAD
```

`@main` / `@master` / `@HEAD` is a supply-chain vulnerability: a compromise of the action's repo silently propagates to your builds. Pin to a release tag at minimum; SHAs are preferred for security-sensitive steps.

### Step 2 — Never echo secrets to logs

```yaml
# WRONG — writes secret to the workflow log
- name: Debug
  run: |
    echo "Token: ${{ secrets.VERCEL_TOKEN }}"
    echo "Deploying with $DEPLOY_KEY"
    env | grep SECRET

# RIGHT — use the secret; don't print it
- name: Deploy
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  run: vercel --token "$VERCEL_TOKEN" --prod
```

GitHub masks secret values in workflow logs best-effort (string-match), but:
- Multi-line secrets / base64-encoded secrets can slip through
- Logs are retained for 90 days by default, visible to anyone with repo read access
- Secrets in `env:` are preferred over inlining `${{ secrets.X }}` in command strings

Banned run-step patterns: `echo ${{ secrets.` / `echo $<SECRET_NAME>` / `env | grep` / `env > ...` / printing `$GITHUB_TOKEN`.

### Step 3 — Every workflow has a `concurrency:` block with `cancel-in-progress: true`

```yaml
# RIGHT
name: CI
on: pull_request

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ...
```

Without `concurrency`, each push to a PR branch spawns a fresh workflow run — old ones keep running, wasting runners and blocking queued jobs. With `cancel-in-progress: true`, the latest push supersedes prior in-flight runs on the same ref.

Production workflows (on `push: main`) may want `cancel-in-progress: false` to queue rather than cancel — that's a deliberate choice, not a violation.

### Step 4 — Every job has `timeout-minutes:` set

```yaml
jobs:
  typecheck:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      # ...

  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      # ...
```

Default job timeout is **360 minutes** (6 hours). A stuck test, a dead SSH port, a hung install — anything will burn 6 hours of runner time before GitHub reaps it. Set a realistic cap on every job: typecheck ~10 min, tests ~15 min, e2e ~20-30 min. If a job legitimately needs > 60 min, document why in a comment above the `timeout-minutes:` line.

---

## Tool Integration

**Canonical `.github/workflows/ci.yml`:**

```yaml
name: CI
on: pull_request

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.x
      - run: bun install --frozen-lockfile
      - run: bun run validate
      - run: bun run typecheck
      - run: bun run eval

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.x
      - run: bun install --frozen-lockfile
      - run: bun run build
```

**Canonical `.github/workflows/deploy-prod.yml` (only if using the CLI flow):**

```yaml
name: Deploy (production)
on:
  push:
    branches: [main]

concurrency:
  group: deploy-prod
  cancel-in-progress: false   # queue, don't cancel prod deploys

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.x
      - run: bun install --frozen-lockfile
      - name: Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          bunx vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
          bunx vercel build --prod --token="$VERCEL_TOKEN"
          bunx vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
```

(If you're using Vercel's native git integration, the deploy workflow is handled outside GitHub Actions entirely — this skill still applies to whatever CI YAML you do write.)

---

## Examples

### Example 1 — Unpinned action (`unpinned-action`)

**Input:** `uses: actions/checkout@main`.

**Output:** replace with `uses: actions/checkout@v4` (or the latest SHA). `@main` pulls whatever is at the tip of `actions/checkout`'s main branch — could be compromised, could introduce breaking changes silently.

### Example 2 — Secret echoed in run step (`secret-echoed-in-run`)

**Input:** `run: echo "Deploying with token ${{ secrets.VERCEL_TOKEN }}"`.

**Output:** pass the token via `env:` and use the env var in the command — never echo it. `run: vercel --token "$VERCEL_TOKEN"` with `env: VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}`.

### Example 3 — Missing concurrency-cancel (`missing-concurrency-cancel`)

**Input:** workflow with no top-level `concurrency:` block, triggered on `pull_request`.

**Output:** add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`. Pushes to the same PR will now cancel stale runs.

### Example 4 — Missing job timeout (`no-timeout-minutes`)

**Input:** `jobs: test:` with `runs-on: ubuntu-latest` and no `timeout-minutes:`.

**Output:** add `timeout-minutes: 15`. Default 360-minute timeout is a footgun for any stuck process.

---

## Edge Cases

- **First-party actions** (`actions/checkout`, `actions/cache`) — still must be pinned, same supply-chain rationale.
- **Production `cancel-in-progress: false`** — legitimate for deploy workflows; the classifier accepts any `concurrency:` block (cancel true or false).
- **Reusable workflows** — `uses: ./.github/workflows/shared.yml` or `uses: org/repo/.github/workflows/shared.yml@v1` — still apply the `@version` pinning rule to cross-repo uses.
- **Matrix builds** — each strategy entry is still one job; `timeout-minutes:` at the job level applies per matrix cell.
- **Echoing a masked secret accidentally** — sometimes a non-secret output happens to contain a secret substring (e.g., a URL that includes a token). GitHub's masking is best-effort; the only reliable protection is not echoing at all.

---

## Evaluation

See `/evals/ci-cd-next-on-vercel/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

No LLM-as-judge half for v0.1. A v0.2 `pipeline-design` rubric would judge whether test / deploy / rollback stages are wired correctly (currently fuzzier than the four shape-level checks here).

---

## Handoffs

- **Security headers** → `security-headers`
- **Error capture** → `sentry-setup`
- **Bundle budgets in CI** → `bundle-budget`
- **Env-var strategy** — Vercel UI / `vercel env pull`, out of scope for this skill

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** GitHub Actions, Vercel (integration or CLI), Bun

---

## References

- `references/violation-classes.md` — four-class taxonomy with canonical examples
- `references/canonical-workflows.md` — drop-in CI and deploy workflow templates

## Scripts

- _(none in v0.1 — eval ships the classifier; a Dependabot / Renovate config that auto-pins action versions is a v0.2 candidate)_

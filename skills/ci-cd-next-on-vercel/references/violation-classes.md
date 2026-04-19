# Four violation classes

A fixture that triggers none is `safe`.

## 1. `unpinned-action`

**Signal:** a `uses:` line references a third-party action at `@main`, `@master`, `@HEAD`, or has no `@` version tag at all.

**Canonical example:**

```yaml
- uses: actions/checkout@main
- uses: oven-sh/setup-bun@master
```

**Remediation:** pin to a release tag (`@v4`) or a commit SHA (`@11bd71901bbe5b1630ceea73d27597364c9af683`). Renovate / Dependabot can keep pins fresh.

## 2. `secret-echoed-in-run`

**Signal:** a `run:` step contains one of:

- `echo ${{ secrets.X }}` — direct interpolation into echo
- `echo "$SECRET_VAR_NAME"` — where SECRET_VAR_NAME is referenced by a secret binding
- `env | grep` / `env > ` / `printenv` — dumping the env to logs
- `cat` / `printf` / `curl -d` printing a value that references `${{ secrets.`

**Remediation:** bind the secret via `env:` and use the env var in the command without echoing it.

## 3. `missing-concurrency-cancel`

**Signal:** top-level workflow YAML has no `concurrency:` block. (A concurrency block with `cancel-in-progress: false` is accepted — it's a conscious choice for queued-deploy workflows.)

**Remediation:**

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## 4. `no-timeout-minutes`

**Signal:** a `jobs.<name>:` block lacks `timeout-minutes:`. Any job without it inherits the 360-minute default.

**Remediation:** add `timeout-minutes: <N>` to every job. Starting points: typecheck ~10, tests ~15, e2e ~20–30, build ~15.

## Why exactly four

These are the four CI-YAML misconfigurations that produce concrete operational pain: supply-chain risk (1), secret leakage (2), runner hoarding (3), stuck-job runaway (4). Every item is a single-YAML-file detection with no build / runtime context needed.

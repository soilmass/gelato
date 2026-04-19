# ci-cd-next-on-vercel eval

Proves the four GitHub Actions workflow-hygiene rules for Next.js on Vercel are mechanically enforceable from single-file YAML fixture text.

## What the eval measures

Deterministic classifier — signal-based heuristics. Four detection steps (priority order):

1. **unpinned-action** — `uses:` references `@main` / `@master` / `@HEAD` / `@latest` OR has no `@version`. Local reusable workflows (`./.github/workflows/x.yml`) are exempt.
2. **secret-echoed-in-run** — `run:` line with `echo`/`printf`/`cat` + `${{ secrets.X }}` OR `env | grep`/`>` dump OR `echo $VAR` where VAR is bound to a secret in an `env:` block.
3. **missing-concurrency-cancel** — top-level `concurrency:` key absent (cancel-true / cancel-false both accepted).
4. **no-timeout-minutes** — any job with `runs-on:` lacks `timeout-minutes:`. Reusable-workflow-call jobs (no `runs-on:`) are exempt.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 Third-party action pinned to `@v3.0.0` — rule applies to any vendor, pinning format accepted
- 02 Secret bound via `env:` and echoed via `$DEPLOY_KEY` — still a leak; classifier tracks the binding
- 03 Production deploy with `cancel-in-progress: false` — legitimate queue behavior, safe
- 04 Large `timeout-minutes: 60` with a comment justifying it — still satisfies the rule
- 05 Echo of `github.workflow`/`sha`/`actor` (context vars, not secrets) — safe
- 06 Reusable workflow job (`uses: org/repo/.github/workflows/x.yml@v1`) with no `timeout-minutes:` — exempt (no `runs-on:`)

## Running

```bash
bun run eval ci-cd-next-on-vercel
```

~70 ms. No env, no network.

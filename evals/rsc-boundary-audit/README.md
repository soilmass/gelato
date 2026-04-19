# rsc-boundary-audit eval

Proves the skill's five-class taxonomy and four-criterion decision tree are mechanically enforceable against a labeled fixture set. Judgment eval per EVAL_SPEC.md § Type B.

## Two halves

### Quantitative (always on)

A deterministic classifier at `eval.test.ts` encodes the skill's four-criterion decision tree and the five-class taxonomy as regex-driven code. Runs instantly; no API calls. Three assertions:

| Assertion | Requirement |
|---|---|
| Violations classified correctly | ≥ 95% across all 23 labeled violations |
| Zero false positives on legitimate fixtures | 10/10 correctly classified as `legitimate` |
| Remediation plan ordered by class priority | Monotonic per SKILL.md § Step 4 |

Plus a sanity check that the fixture inventory matches the counts declared in SKILL.md § Evaluation (23 violations across 5 classes, 10 legitimate).

### Qualitative (gated on `ANTHROPIC_API_KEY`)

Two Promptfoo LLM-as-judge rubrics from SKILL.md § Evaluation:

| Rubric | Threshold |
|---|---|
| implementability — fix recommendations usable as-written | ≥ 0.80 |
| groundedness — examples reference real-looking files, not placeholders | ≥ 0.85 |

Gated with `describe.skipIf(!isJudgeAvailable())`. Without an API key, the test suite skips the qualitative half and runs the quantitative half end-to-end.

## Fixture layout

```
fixtures/
├── violations/                          # 23 files across 5 classes
│   ├── unnecessary-directive/           # 6 fixtures
│   ├── server-only-import-in-client/    # 4 fixtures
│   ├── non-serializable-prop/           # 5 fixtures
│   ├── barrel-import-leakage/           # 4 fixtures
│   └── hydration-mismatch-source/       # 4 fixtures
└── legitimate/                          # 10 fixtures
```

Each fixture is a `.txt` file with YAML frontmatter carrying the expected class (or `expected: legitimate`) and a one-line reason, followed by a self-contained `.tsx`-shaped component. The classifier strips the frontmatter before matching so reason-field prose doesn't influence the signal.

## Running

```bash
bun run eval rsc-boundary-audit
```

With a key set:

```bash
ANTHROPIC_API_KEY=sk-ant-... bun run eval rsc-boundary-audit
```

The quantitative half completes in under 100 ms. The qualitative half makes two Anthropic API calls (one per rubric) and costs < $0.01 per run with Promptfoo caching enabled (`defaultTest.options.cache: true` in `promptfoo.yaml`).

## Deterministic classifier scope

The classifier intentionally uses regex heuristics, not a full TypeScript AST. Trade-off:

- **Fast:** classifies all 33 fixtures in ~30 ms total.
- **Fragile on code it wasn't designed for.** A production auditor would parse TypeScript properly, track `'use server'` boundaries at module level, and resolve imports transitively. The classifier here covers the five canonical violation shapes; real-world code with aggressive barrel re-exports or dynamic imports would need AST-level work.

This is acceptable because the eval tests a labeled set the skill's procedure should handle. A future `feat(rsc-boundary-audit): ts-morph based classifier` upgrades to AST walking without changing the assertion structure.

# drizzle-migrations eval

Proves the skill's three Hard Thresholds are mechanically enforceable against labeled fixture SQL. Procedural eval — no LLM calls, no fixture Postgres instance required, runs in < 100 ms.

## What the eval measures

A deterministic SQL classifier at `eval.test.ts` parses each fixture `.sql` body, strips comments and string literals, then matches against the four single-statement danger patterns defined in `references/violation-classes.md`:

| Class | Regex-level signal |
|---|---|
| `single-step-drop` | `DROP COLUMN` / `DROP TABLE` (but not `DROP DEFAULT`, `DROP CONSTRAINT`, `DROP INDEX`) |
| `single-step-rename` | `RENAME COLUMN` |
| `single-step-type-change` | `ALTER COLUMN … TYPE …` |
| `not-null-without-default` | `ADD COLUMN … NOT NULL` with no non-NULL `DEFAULT` clause |

Four assertions:

| Assertion | Requirement |
|---|---|
| Violations classified correctly | ≥ 95% across 12 labeled violations (3 per class × 4) |
| Zero false positives on safe fixtures | 10/10 classify as `safe` |
| Held-out generalization | ≥ 90% across 6 adversarial cases |
| Fixture inventory matches SKILL.md counts | 10 safe + 12 violations, each class ≥ 1 fixture |

## Fixture layout

```
fixtures/
├── safe/                                 # 10 additive / expand-phase shapes
├── violations/
│   ├── single-step-drop/                 # 3 fixtures
│   ├── single-step-rename/               # 3 fixtures
│   ├── single-step-type-change/          # 3 fixtures
│   └── not-null-without-default/         # 3 fixtures
└── held-out/                             # 6 adversarial cases
    # 01 DROP COLUMN inside a string literal (INSERT text)
    # 02 RENAME COLUMN inside a SQL comment
    # 03 ADD COLUMN DEFAULT before NOT NULL (order swapped)
    # 04 ALTER COLUMN DROP DEFAULT (not a column drop)
    # 05 Pure CREATE TABLE + CREATE INDEX — no-match path
    # 06 NOT NULL DEFAULT now() — function-expression default
```

Each fixture is a `.txt` with YAML frontmatter declaring the expected class (or `expected: safe`) and a one-line reason, followed by the SQL body. The classifier strips the frontmatter before matching.

## Qualitative half

None in v0.1. The three Hard Thresholds are Postgres-mechanical and the deterministic classifier carries the signal end-to-end. A v0.2 `implementability` rubric against generated remediation advice (checking that the advice produces a complete three-migration sequence with correct app-state transitions between deploys, not prose like "split this into three migrations") is a candidate follow-up. `promptfoo.yaml` declares the config shell so the rubric references resolve when it lands.

## Scope of the classifier

Regex-driven, not AST-driven. This is a deliberate v0.1 trade-off — same trade-off as the `rsc-boundary-audit` classifier. The four violation classes are SQL keyword-level concerns, which regex handles cleanly once comments and string literals are stripped. A v0.2 upgrade to `pg-query-parser` would add:

- Cross-file analysis (is a DROP preceded by an expand in an earlier migration?)
- Composite statement detection (DO blocks, CTEs with DDL)
- MySQL/SQLite dialect branches

Until then: the classifier covers the four single-file patterns faithfully, the held-out set catches the two most obvious regex fragility modes (comments + string literals), and the SKILL README explicitly scopes out cross-file analysis as v0.2 work.

## Running

```bash
bun run eval drizzle-migrations
```

Completes in well under 1 s. No environment variables, no API keys, no Chromium.

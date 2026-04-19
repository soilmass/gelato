---
name: drizzle-migrations
description: >
  Apply the PlanetScale expand/contract playbook to Drizzle-managed Postgres
  schemas so destructive and renaming migrations ship as multi-step sequences
  — never as single-statement column drops or renames that can take down a
  running app mid-deploy. Checks that every migration is additive, that drops
  are paired with prior expand migrations, and that renames are split into
  add + backfill + drop across at least three migrations.
  Use when: adding or changing a Drizzle schema, generating a migration with
  drizzle-kit, renaming a column, dropping a column, splitting a table,
  adding a NOT NULL column to an existing table, "is this migration safe to
  run in production", "can I do this rename in one step", reviewing a
  migration PR.
  Do NOT use for: initial schema design (→ rsc-data-fetching once built),
  long-running data backfills that run in application code (→ sentry-setup
  for worker observability), non-Drizzle ORMs (fork the suite), non-Postgres
  databases.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: data
  phase: build
  type: procedural
  methodology_source:
    - name: "Schema migrations: expand/contract"
      authority: "PlanetScale"
      url: "https://planetscale.com/docs/learn/handling-table-and-column-renames"
      version: "2024 playbook"
      verified: "2026-04-18"
    - name: "Drizzle ORM — Migrations"
      authority: "Drizzle team"
      url: "https://orm.drizzle.team/docs/migrations"
      version: "Drizzle 1.x docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "drizzle-orm@1.x"
    - "drizzle-kit@1.x"
    - "postgres (Supabase or Neon)"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T17:15:27.771Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill. Three Hard Thresholds enforce the
    expand/contract split; SQL classifier detects single-step destructive
    migrations in the fixture set. v0.2 extends to MySQL dialects and
    Supabase Realtime publication-aware drops.
---

# drizzle-migrations

Encodes PlanetScale's expand/contract migration playbook and applies it to Drizzle-managed Postgres schemas. Every destructive or renaming change ships as a multi-step sequence so production rolls forward cleanly and rolls back without data loss. Not a general schema-design skill — scoped to migration safety.

---

## Methodology Attribution

This skill encodes guidance from two primary sources:

- **Primary:** PlanetScale — *Handling table and column renames*
  - Source: [https://planetscale.com/docs/learn/handling-table-and-column-renames](https://planetscale.com/docs/learn/handling-table-and-column-renames)
  - Version: 2024 playbook
  - Verified: 2026-04-18
- **Secondary:** Drizzle ORM — *Migrations*
  - Source: [https://orm.drizzle.team/docs/migrations](https://orm.drizzle.team/docs/migrations)
  - Version: Drizzle 1.x docs (2025)
  - Verified: 2026-04-18
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the expand/contract sequence structure (add → dual-write → backfill → switch reads → drop), the migration-file naming and per-file safety constraints, the Drizzle-specific mechanics (`drizzle-kit generate` vs. `drizzle-kit migrate`, the snapshot/journal pair, schema.ts → SQL flow).

NOT encoded: initial schema design / normalization (out of scope), cross-region replication lag strategy (Supabase/Neon specifics), application-code dual-write patterns (belongs in a paired skill), MySQL-dialect differences (Postgres only in v0.1 of this skill).

---

## Stack Assumptions

- `drizzle-orm@1.x`
- `drizzle-kit@1.x` — the migration generator + runner
- Postgres hosted on Supabase or Neon
- `bun@1.1+` for the CLI scripts

If your stack differs, fork the suite. This skill does not accept configuration flags.

---

## When to Use

Activate when any of the following is true:
- Author edits `schema.ts` and runs `drizzle-kit generate`
- A PR adds a migration that drops, renames, or changes a column type
- Adding a `NOT NULL` column to an existing non-empty table
- Splitting a table, or merging two into one
- Reviewing a migration PR
- A stakeholder asks "is this migration safe to run in production"
- A migration has run in staging but not production, and the behavior is uncertain

## When NOT to Use

Do NOT activate for:
- Initial schema design on a greenfield table — this skill is about *evolution*, not design
- Application-level dual-writes (the code that uses the schema) — that belongs in a v0.2+ `data-dual-write` skill
- Long-running backfills executed from worker code — instrument via `sentry-setup` / `structured-logging`
- Non-Drizzle ORMs (Prisma, Kysely, raw SQL) — fork the suite
- MySQL, SQLite, or MSSQL — v0.1 of this skill is Postgres-only

---

## Procedure

### Step 1 — Classify the intended change

Every schema change falls into exactly one of three safety classes:

| Class | Example | Safe as single migration? |
|---|---|---|
| **Additive** | `ADD COLUMN email_verified boolean DEFAULT false NOT NULL` — default supplied | **Yes** |
| **Destructive** | `DROP COLUMN legacy_id`, `DROP TABLE old_payments` | **No** — requires a prior expand migration |
| **Renaming / type-changing** | `RENAME COLUMN name TO full_name`, `ALTER COLUMN id TYPE bigint` | **No** — requires a three-migration sequence |

Additive changes without defaults on non-empty tables are also destructive (an `ADD COLUMN NOT NULL` without a default blocks inserts from already-deployed app versions). Treat them as renames.

### Step 2 — For additive changes: ship the single migration

Generate with `drizzle-kit generate`. Review the emitted SQL. Commit. Ship. No multi-step required.

The only trap: `ALTER TABLE ... ADD COLUMN ... NOT NULL` without `DEFAULT` **is destructive** when the table has rows. Always pair `NOT NULL` adds with a safe default, or split into add-nullable → backfill → set-not-null (three-step).

### Step 3 — For destructive / renaming changes: split into expand + contract

For a column rename `name → full_name`:

**Migration 1 — expand:**

```sql
ALTER TABLE users ADD COLUMN full_name text;
UPDATE users SET full_name = name;
```

App reads from **both** columns; writes go to **both** columns.

**Deploy migration 1. Deploy app change.**

**Migration 2 — backfill + verify:**

```sql
UPDATE users SET full_name = name WHERE full_name IS NULL;
-- Optional: ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
```

App reads from `full_name` only; writes still go to both.

**Deploy migration 2. Deploy app change.**

**Migration 3 — contract:**

```sql
ALTER TABLE users DROP COLUMN name;
```

App references `full_name` only. `name` is dead.

**Deploy migration 3.**

A single-migration `ALTER TABLE users RENAME COLUMN name TO full_name` breaks every running app instance that still references `name` between the migration and the app rollout. The three-step sequence keeps every state of (old-migration, old-app) / (old-migration, new-app) / (new-migration, new-app) valid.

### Step 4 — Never edit a committed migration

Once a migration runs in any environment (staging counts), its SQL is fixed. Further changes go into new migrations. Drizzle's journal tracks applied-ness by filename hash; editing a committed file desynchronizes environments irreversibly.

If a committed migration is wrong: ship a *compensating* migration. Never rewrite history.

### Step 5 — Pair every destructive migration with an explicit rollback

Destructive migrations are irreversible by the database, but the *plan* should name the rollback. In the PR description or a sibling `.rollback.sql` file, document:

- Which subset of data is recoverable from backups
- Whether a preceding expand migration can be re-deployed to restore reads
- The decision point where rollback is no longer possible (usually: after contract deploys)

Without this, a mid-deploy failure turns into an incident.

---

## Hard Thresholds

The eval fails this skill if any threshold is missed:

- **No single migration file contains `DROP COLUMN` or `DROP TABLE` without a matching prior expand migration** in the same migrations directory.
- **No migration contains `ALTER TABLE ... RENAME COLUMN`** — renames must be the add + backfill + drop sequence above.
- **No `ADD COLUMN ... NOT NULL` without `DEFAULT`** on an existing table (sequence requires nullable add → backfill → constraint).

The skill's classifier inspects each fixture SQL file for these patterns and labels each as `safe` or flags a violation class.

---

## Tool Integration

**Generate a migration from a `schema.ts` edit:**

```bash
bunx drizzle-kit generate
```

Drizzle emits a file under `drizzle/NNNN_*.sql` plus a snapshot update under `drizzle/meta/`. Commit both; the snapshot is what tells the next generation where you are.

**Apply pending migrations:**

```bash
bunx drizzle-kit migrate
```

Run in CI/CD against staging before merge; run against production after deploy. Never run `migrate` from a developer laptop against a production database.

**`drizzle.config.ts` (canonical):**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,     // refuses ambiguous changes — keep strict on
  verbose: true,
});
```

**Forbidden:** hand-editing files under `drizzle/meta/` or rewriting committed `.sql` files under `drizzle/`.

---

## Examples

### Example 1 — Add a boolean flag (additive, one migration)

**Input:** need an `email_verified` boolean on `users`, defaulting to false.

**Output:** single migration, safe:

```sql
ALTER TABLE users ADD COLUMN email_verified boolean DEFAULT false NOT NULL;
```

Default supplied → existing rows get `false` → no deployment-order risk.

### Example 2 — Rename `name → full_name` (three migrations)

See Step 3 above for the canonical sequence. **Never** one step.

### Example 3 — Change a column type (three migrations)

**Input:** `users.id` is `integer`, need `bigint` for growth.

**Output:** add `id_bigint bigint`, backfill, switch reads, then drop original + rename. The final rename itself is a contract-migration that the SKILL allows because the old column is already dead when it runs.

---

## Edge Cases

- **Adding a unique index on a large table:** use `CREATE UNIQUE INDEX CONCURRENTLY` (Postgres-specific). Drizzle supports this via a custom migration (drop into raw SQL). A blocking `CREATE UNIQUE INDEX` locks writes for the duration.
- **Foreign-key adds:** validate in two steps — `ADD CONSTRAINT ... NOT VALID` first, then `VALIDATE CONSTRAINT` after backfill. Drizzle's default emits a single-step add; override.
- **Enum value additions:** Postgres allows `ALTER TYPE ... ADD VALUE` as an additive change since Postgres 12. Enum value *removal* requires the full expand/contract with a new enum type.
- **Downtime-tolerant migrations:** if the app can tolerate a brief write lock, one-step renames are *technically* possible. The SKILL still refuses them because "brief" in practice means "30 seconds on the one table that does 90% of writes". Expand/contract costs three deploys and zero surprises.
- **Rollback after contract:** once the contract migration runs, the old column is gone. Rollback is restore-from-backup. Plan accordingly.

---

## Evaluation

See `/evals/drizzle-migrations/` for the canonical eval suite.

### Pass criteria

**Quantitative:**
- Classifier flags ≥ 95% of violation fixtures (single-step drops, renames, type changes, NOT-NULL-no-default adds)
- Zero false positives on legitimate additive fixtures
- Every violation class documented in `references/violation-classes.md` is covered by at least one fixture

The classifier is deterministic — it inspects each fixture `.sql` file for the three Hard Threshold patterns.

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate` in the frontmatter above.

---

## Handoffs

This skill is scoped to migration-sequence safety on Drizzle + Postgres. Explicitly NOT absorbed:

- **Schema design** (normalization, index strategy, column types at creation time) — v0.2 `schema-design` if it proves out
- **Application-level dual-write during expand phases** — v0.2+ `data-dual-write`
- **Long-running backfill workers** — instrument via `structured-logging` + `sentry-setup` (both v0.2+)
- **MySQL / SQLite / MSSQL dialect differences** — fork the suite
- **Realtime publication surgery** (Supabase Realtime-aware drops) — v0.2 extension

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** `drizzle-kit@1.x`, `drizzle-orm@1.x`, Postgres 14+, Bun

---

## References

- `references/expand-contract-sequence.md` — the canonical three-migration rename sequence, copy-paste ready
- `references/violation-classes.md` — the classifier's taxonomy (single-step drop, single-step rename, type change, NOT-NULL-no-default add)

## Scripts

- _(none — the eval ships the SQL classifier; a `bun run drizzle-audit` CLI is a v0.2 candidate)_

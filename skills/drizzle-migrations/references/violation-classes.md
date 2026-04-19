# Migration violation classes

The classifier inspects each `.sql` migration file and flags exactly one of four violation classes. A file that raises none is `safe`.

## 1. `single-step-drop`

A migration that drops a column or table without a preceding expand migration.

**Signal:** contains `DROP COLUMN` or `DROP TABLE` (case-insensitive), and no migration earlier in the lexicographic sequence adds a replacement.

**Why it's wrong:** application instances still running the pre-drop code reference the dropped object and fail.

**Canonical example:**

```sql
-- 0023_remove_legacy.sql
ALTER TABLE users DROP COLUMN legacy_id;
```

Remediation: precede with an expand migration that adds the replacement and switches reads over several deploys.

## 2. `single-step-rename`

A migration that renames a column in a single SQL statement.

**Signal:** contains `RENAME COLUMN` (case-insensitive).

**Why it's wrong:** see `expand-contract-sequence.md` — a single rename invalidates the pre-rename app's reads immediately.

**Canonical example:**

```sql
-- 0045_rename_full_name.sql
ALTER TABLE users RENAME COLUMN name TO full_name;
```

Remediation: three-migration sequence (add new column → backfill + switch reads → drop old column).

## 3. `single-step-type-change`

A migration that changes a column's type in a single statement.

**Signal:** contains `ALTER COLUMN ... TYPE` (case-insensitive).

**Why it's wrong:** Postgres rewrites the whole column on most type changes, locking the table. Application code that typed the old shape fails when the new column appears.

**Canonical example:**

```sql
-- 0067_widen_id.sql
ALTER TABLE users ALTER COLUMN id TYPE bigint;
```

Remediation: add a new column with the new type, backfill, switch reads, drop the old column, rename the new.

## 4. `not-null-without-default`

A migration that adds a `NOT NULL` column without a `DEFAULT` clause.

**Signal:** contains `ADD COLUMN` with `NOT NULL` but not `DEFAULT` (or the default is explicitly `NULL`).

**Why it's wrong:** any insert from application code that doesn't know about the new column fails with a not-null violation. Even on an empty table, the constraint trips as soon as any row is inserted without the column.

**Canonical example:**

```sql
-- 0089_verify_email.sql
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL;
```

Remediation: supply a `DEFAULT` (`DEFAULT false NOT NULL`), or add as nullable first, backfill in a separate migration, then `SET NOT NULL`.

## Why exactly four

These are the four single-migration shapes where Postgres + a running application break. Every other schema change is either additive with a safe default (class `safe`) or a sequence (class `safe` per-file once split correctly). Adding a fifth class tends to duplicate one of these; collapsing to three always hides a distinguishable remediation path.

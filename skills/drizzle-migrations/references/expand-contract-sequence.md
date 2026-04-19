# The three-migration rename sequence

Canonical reference for Step 3 of the `drizzle-migrations` procedure. Every column rename and every type change ships as three migrations, deployed in lockstep with three application deploys. A single-step `RENAME COLUMN` is **always** wrong on a production database that receives writes.

## Scenario

Rename `users.name` → `users.full_name`.

## The sequence

### Migration 1 — expand

```sql
ALTER TABLE users ADD COLUMN full_name text;
UPDATE users SET full_name = name;
```

Application state after deploy 1:
- Reads: still from `name` (old column).
- Writes: dual — write to **both** `name` and `full_name`.
- New rows: correctly populated in both columns.

**Invariant after deploy 1:** every row has consistent `name` and `full_name`.

### Migration 2 — backfill + switch reads

```sql
UPDATE users SET full_name = name WHERE full_name IS NULL;
-- optional once backfill is verified clean:
-- ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
```

Application state after deploy 2:
- Reads: from `full_name` (new column).
- Writes: still dual — write to both.

**Invariant after deploy 2:** `full_name` is the source of truth for reads; `name` is a shadow.

### Migration 3 — contract

```sql
ALTER TABLE users DROP COLUMN name;
```

Application state after deploy 3:
- Reads: from `full_name`.
- Writes: to `full_name` only.
- `name` is gone.

**Invariant after deploy 3:** only `full_name` exists; no dual-write path remains.

## Why three, not two

A two-step approach (expand + drop) leaves the old-app / new-migration state undefined: during the brief window between migration 3 deploying and every app instance updating to read from `full_name`, an old-app-instance + new-migration combination reads from `name`, which the migration has dropped. Requests fail.

The three-step sequence guarantees **every combination of (app version, migration version) is valid**:

| App reads | `name` exists | `full_name` exists | state |
|---|---|---|---|
| `name` | ✓ | — | pre-migration |
| `name` | ✓ | ✓ | post-migration-1 (old app, new schema) |
| `full_name` | ✓ | ✓ | post-deploy-2 (new app, new schema, shadow still there) |
| `full_name` | — | ✓ | post-migration-3 (new app, contracted schema) |

No combination leaves the app trying to read a dropped column.

## Application code during the sequence

**After migration 1, before deploy 2:**

```ts
// writes dual
await db.insert(users).values({ name: x, full_name: x });
// reads old
const row = await db.select({ name: users.name }).from(users).where(...);
```

**After deploy 2, before migration 3:**

```ts
// writes still dual
await db.insert(users).values({ name: x, full_name: x });
// reads new
const row = await db.select({ full_name: users.full_name }).from(users).where(...);
```

**After migration 3:**

```ts
// writes and reads are both new
await db.insert(users).values({ full_name: x });
const row = await db.select({ full_name: users.full_name }).from(users).where(...);
```

The dual-write phase is the cost of zero-downtime. The SKILL does not optimize it away.

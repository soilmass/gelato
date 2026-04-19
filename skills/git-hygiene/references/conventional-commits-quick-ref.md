# Conventional Commits 1.0.0 — Quick Reference

Full spec: <https://www.conventionalcommits.org/en/v1.0.0/>

## Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

## Locked types (Gelato)

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no code meaning change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system, dependencies |
| `ci` | CI config and scripts |
| `chore` | Housekeeping (no production code) |
| `revert` | Reverts a prior commit |

Extending this list requires updating `commitlint.config.ts` (under `type-enum`) and this file in the same PR.

## Subject rules

1. Imperative mood — *"add"*, not *"added"* or *"adds"*.
2. Capitalize the first word after the colon.
3. No trailing period.
4. ≤ 72 characters total line length.
5. Describe the change, not the file touched.

## Footer keywords

- `BREAKING CHANGE:` — describe the breaking API change (must appear in the footer).
- `Refs: #<n>` — reference an issue or PR.
- `Closes: #<n>` — close an issue when the commit lands on `main`.
- `Reverts: <sha>` — revert a prior commit.
- `Co-Authored-By: Claude <noreply@anthropic.com>` — use only when Claude wrote >50% of the change.

## Scope conventions (Gelato)

Prefer one of:

- a subsystem name (`skills`, `evals`, `docs`, `scripts`, `deps`, `schema`, `eval-harness`)
- a concrete skill name (`core-web-vitals-audit`, `rsc-boundary-audit`, `git-hygiene`)
- `repo` for root-wide scaffolding changes that don't belong to one subsystem
- omit the scope when the change is global and no subsystem fits

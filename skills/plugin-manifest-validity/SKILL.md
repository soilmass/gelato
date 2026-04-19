---
name: plugin-manifest-validity
description: >
  Enforce Anthropic's Plugin Reference schema on a candidate
  `.claude-plugin/plugin.json`. Five violation classes: JSON that
  doesn't parse, absent `name` field, `name` that isn't kebab-case,
  `version` that isn't semver `MAJOR.MINOR.PATCH`, and a component
  path (`skills`, `commands`, `agents`, `hooks`, `mcpServers`,
  `outputStyles`, `monitors`, `lspServers`) that isn't a relative
  path beginning with `./`. A manifest that fails any of these will
  cause Claude Code to refuse the plugin at install time.
  Use when: creating or editing `.claude-plugin/plugin.json`,
  reviewing a PR that touches the plugin manifest, auditing before
  a marketplace submission.
  Do NOT use for: marketplace.json entry shape (→ marketplace-submission),
  SKILL.md frontmatter (→ new-skill-review), eval.test.ts shape
  (→ eval-harness-pattern), drift-monitoring workflow
  (→ drift-check-workflow), runtime hook-script correctness.
license: MIT
metadata:
  version: "1.0"
  core: meta
  subsystem: distribution
  phase: build
  type: procedural
  methodology_source:
    - name: "Anthropic Claude Code — Plugins Reference"
      authority: "Anthropic"
      url: "https://code.claude.com/docs/en/plugins-reference.md"
      version: "Plugins Reference (2026)"
      verified: "2026-04-19"
  stack_assumptions:
    - "Claude Code v2.1+"
    - "Plugin installed via marketplace OR --plugin-dir"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:53:13.636Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill over Anthropic's Plugin
    Reference. Five mechanical violation classes detectable from a
    single `plugin.json` file.
---

# plugin-manifest-validity

Encodes the mechanical half of Anthropic's Plugin Reference schema for `.claude-plugin/plugin.json`. A manifest that fails any rule below will cause Claude Code to error at `claude plugin install` or to silently drop components when the plugin loads.

---

## Methodology Attribution

- **Primary:** Anthropic Claude Code — Plugins Reference
  - Source: [https://code.claude.com/docs/en/plugins-reference.md](https://code.claude.com/docs/en/plugins-reference.md)
  - Authority: Anthropic
  - Version: Plugins Reference (2026)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7 → Core 6 `drift-check-workflow`)._

Encoded: JSON parse-ability, `name` presence + kebab-case, `version` semver, and component-path relativity (the `./`-prefix rule from Path behavior rules). NOT encoded: MCP command validity (tested at runtime), hook event-name case (delegated to a future hook-specific skill), hook-script executability (runtime), marketplace-entry shape (→ `marketplace-submission`), cross-field rules like `channels[].server` matching an `mcpServers` key.

---

## Stack Assumptions

- Claude Code v2.1 or newer (Plugin Reference schema current at 2026-04-19)
- Plugin installed either from a marketplace or via `claude --plugin-dir`
- `bun` available locally to run `claude plugin validate` during CI

If you target an older Claude Code, pin the verified-date and check the Plugin Reference changelog.

---

## When to Use

Activate when any of the following is true:
- Creating `.claude-plugin/plugin.json` for a new plugin
- Editing an existing manifest (version bump, keyword tweak, component-path addition)
- Reviewing a PR that touches the plugin manifest
- Auditing a plugin before submitting it to a marketplace

## When NOT to Use

Do NOT activate for:
- **Marketplace `.claude-plugin/marketplace.json` entry shape** → `marketplace-submission`
- **SKILL.md frontmatter / body** → `new-skill-review`
- **eval.test.ts shape** → `eval-harness-pattern`
- **Upstream-source drift monitoring** → `drift-check-workflow`
- **Runtime hook-script correctness** (permissions, shebangs, `${CLAUDE_PLUGIN_ROOT}` usage at exec time) — outside this skill's scope; a future hook-specific skill may cover it

---

## Procedure

### Step 1 — JSON must parse

`.claude-plugin/plugin.json` must be valid JSON — no trailing commas, no JavaScript comments, no unquoted identifiers. Claude Code fails plugin install with `Plugin has a corrupt manifest file at .claude-plugin/plugin.json. JSON parse error: ...`.

### Step 2 — `name` is required

The only universally required field. Claude Code fails with `Plugin has an invalid manifest file at .claude-plugin/plugin.json. Validation errors: name: Required`.

```json
// RIGHT
{ "name": "deployment-tools", "version": "1.0.0" }

// WRONG — no name
{ "version": "1.0.0", "description": "My plugin" }
```

### Step 3 — `name` must be kebab-case

Plugin Reference: "Unique identifier (kebab-case, no spaces)". Claude Code namespaces components by plugin `name` (e.g. `plugin-dev:agent-creator`), so the name must be safe for use as a URL-style identifier.

Allowed: lowercase ASCII letters, digits, hyphens; must start with a letter. Disallowed: spaces, uppercase, underscores, dots, camelCase.

```
✓ deployment-tools
✓ gelato
✓ my-plugin-v2
✗ Deployment-Tools       (uppercase)
✗ deployment_tools        (underscore)
✗ deployment tools        (space)
✗ deployment.tools        (dot)
✗ deploymentTools         (camelCase)
```

### Step 4 — `version` must be semver `MAJOR.MINOR.PATCH` (when present)

`version` is optional at the `plugin.json` level (a marketplace entry can supply it instead), but when present it must follow semver. Plugin Reference: "Version format: `MAJOR.MINOR.PATCH`". Pre-release suffixes are allowed (e.g. `2.0.0-beta.1`); build-metadata suffixes are allowed per the semver spec (`1.0.0+20260419`).

```
✓ 1.0.0
✓ 0.4.0
✓ 2.0.0-beta.1
✓ 1.0.0+gelato
✗ 1.0
✗ v1.0.0
✗ 1
✗ latest
```

If omitted entirely: fine — the marketplace entry can carry the version and `plugin.json` need not duplicate it.

### Step 5 — Component-path fields must be relative (`./…`)

The component-path fields — `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `outputStyles`, `monitors`, `lspServers` — may be strings, string arrays, or (for `hooks` / `mcpServers` / `lspServers`) inline objects. Plugin Reference: "All paths must be relative to the plugin root and start with `./`".

A string path that fails the `./` prefix is a violation. Absolute paths (`/…`), parent-traversal paths (`../…`), and bare relative paths (`custom/skills/`) all break. Inline object forms are exempt from this check — they're embedded config, not paths.

```json
// RIGHT
{ "skills": "./custom/skills/" }
{ "commands": ["./cmd1.md", "./cmd2.md"] }
{ "hooks": "./hooks/hooks.json" }
{ "hooks": { "PostToolUse": [...] } }  // inline object — fine

// WRONG
{ "skills": "custom/skills/" }          // missing ./
{ "skills": "/abs/path/skills/" }       // absolute
{ "skills": "../sibling/skills/" }      // parent traversal
{ "commands": ["./ok.md", "cmd2.md"] }  // one entry missing ./
```

---

## Tool Integration

No CLI. The classifier lives in this skill's eval; Vitest runs it alongside every other skill's eval on `bun run eval`. For runtime validation, Claude Code itself ships `claude plugin validate` — run it locally before committing a manifest change.

## Examples

### Example 1 — `plugin-name-not-kebab-case`

**Input:** `.claude-plugin/plugin.json` sets `"name": "MyCoolPlugin"`.
**Output:** Claude Code namespaces components as `MyCoolPlugin:…`, which leaks camelCase into every `/agents` and `/plugin` reference and is rejected by the Plugin Reference schema. Fix: `"name": "my-cool-plugin"`.

### Example 2 — `plugin-component-path-not-relative`

**Input:** `"skills": "custom/skills/"` (no leading `./`).
**Output:** Claude Code refuses the path during plugin load. Fix: `"skills": "./custom/skills/"`.

---

## Edge Cases

- **`version` absent:** permitted. The marketplace entry can supply the version; `plugin.json` need not duplicate it.
- **Inline `hooks` / `mcpServers` / `lspServers` objects:** not a path — the relativity rule applies only to string and string-array forms. Inline objects are embedded config.
- **Pre-release versions (`1.0.0-beta.1`, `1.0.0+build.42`):** allowed; semver permits both pre-release and build-metadata suffixes.
- **Empty path arrays (`"commands": []`):** permitted — the array is well-formed; the behavior is that no extra commands load from custom paths. Not flagged.
- **Trailing slash on directory paths (`./skills/`):** permitted — both `./skills` and `./skills/` are valid per Plugin Reference examples.

---

## Evaluation

See `/evals/plugin-manifest-validity/`.

**Quantitative:** ≥ 5 violation fixtures at ≥ 95%, 0 false positives on ≥ 4 safe, held-out ≥ 90%.
**Qualitative:** Promptfoo rubric `plugin-manifest-thoroughness` ≥ 0.85.

---

## Handoffs

Scoped to `.claude-plugin/plugin.json`. NOT absorbed:

- SKILL.md contract → `new-skill-review`
- Eval contract → `eval-harness-pattern`
- Marketplace entry shape → `marketplace-submission`
- Upstream-source drift → `drift-check-workflow`

---

## Dependencies

- **External skills:** `marketplace-submission`
- **MCP servers:** none
- **Tools required in environment:** `@gelato/eval-harness`, Vitest

---

## References

- `references/plugin-manifest-schema.md` — condensed Anthropic Plugin Reference schema table with per-rule rationale

## Scripts

- _(none — classifier lives in `evals/plugin-manifest-validity/eval.test.ts`)_

---
name: marketplace-submission
description: >
  Enforce Anthropic's Plugin Marketplace schema on a candidate
  `.claude-plugin/marketplace.json`. Five violation classes: any
  of the three required top-level fields (`name`, `owner`,
  `plugins`) missing, marketplace `name` matching one of
  Anthropic's reserved identifiers, two entries in `plugins`
  sharing the same `name`, a plugin entry missing either `name`
  or `source`, and a relative-path `source` that traverses above
  the marketplace root (`..`). Claude Code rejects a marketplace
  with any of these at `/plugin marketplace add` time.
  Use when: publishing a Claude Code marketplace, adding a plugin
  to an existing marketplace.json, reviewing a PR that edits the
  marketplace file, auditing before announcing a marketplace
  publicly.
  Do NOT use for: plugin.json schema (→ plugin-manifest-validity),
  SKILL.md shape (→ new-skill-review), eval.test.ts shape
  (→ eval-harness-pattern), upstream-source drift
  (→ drift-check-workflow), or hosting / auth / CI concerns like
  `GITHUB_TOKEN` setup.
license: MIT
metadata:
  version: "1.0"
  core: meta
  subsystem: distribution
  phase: build
  type: procedural
  methodology_source:
    - name: "Anthropic Claude Code — Plugin Marketplaces"
      authority: "Anthropic"
      url: "https://code.claude.com/docs/en/plugin-marketplaces.md"
      version: "Plugin Marketplaces reference (2026)"
      verified: "2026-04-19"
  stack_assumptions:
    - "Claude Code v2.1+"
    - "Marketplace hosted on GitHub, Git URL, or local path"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T17:01:21.037Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Procedural skill over Anthropic's Plugin
    Marketplace schema. Five mechanical violation classes
    detectable from a single `marketplace.json` file.
---

# marketplace-submission

Encodes the mechanical half of Anthropic's Plugin Marketplace schema for `.claude-plugin/marketplace.json`. A catalog that fails any rule below will be rejected at `/plugin marketplace add` — either by the validator directly or by Claude Code when the first user tries to install.

---

## Methodology Attribution

- **Primary:** Anthropic Claude Code — Plugin Marketplaces
  - Source: [https://code.claude.com/docs/en/plugin-marketplaces.md](https://code.claude.com/docs/en/plugin-marketplaces.md)
  - Authority: Anthropic
  - Version: Plugin Marketplaces reference (2026)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7 → Core 6 `drift-check-workflow`)._

Encoded: top-level required fields, reserved marketplace names, plugin-name uniqueness, per-entry required fields, and the `..` path-traversal ban from § Relative paths. NOT encoded: GitHub-source `sha` being 40 hex chars (low-signal, distinct rule), `version` semver on plugin entries (mostly owned by plugin.json per the docs' "manifest wins silently" rule), npm-source `package` validity (subjective — scoped packages, private registries), strict-mode conflict detection (cross-file — requires reading the referenced plugin's `plugin.json`).

---

## Stack Assumptions

- Claude Code v2.1 or newer
- Marketplace hosted on GitHub, another Git host, or a local path
- `bun` available locally so CI can run `claude plugin validate` against the marketplace

If you distribute via a direct URL to `marketplace.json`, note that relative-path plugin sources cannot resolve — prefer GitHub or Git URL sources instead. That's a distribution-layer concern, not flagged by this classifier.

---

## When to Use

Activate when any of the following is true:
- Publishing a new Claude Code plugin marketplace
- Adding a plugin entry to an existing `marketplace.json`
- Editing any field under the `plugins` array
- Reviewing a PR that changes `.claude-plugin/marketplace.json`
- Auditing before announcing a marketplace publicly

## When NOT to Use

Do NOT activate for:
- **Plugin manifest `.claude-plugin/plugin.json`** → `plugin-manifest-validity`
- **SKILL.md frontmatter / body** → `new-skill-review`
- **eval.test.ts shape** → `eval-harness-pattern`
- **Upstream-source drift monitoring** → `drift-check-workflow`
- **Hosting / auth / private-repo `GITHUB_TOKEN` setup** — out of scope; see the upstream doc's § Host and distribute

---

## Procedure

### Step 1 — Top-level required fields must all be present

`.claude-plugin/marketplace.json` must carry `name`, `owner`, and `plugins`. Claude Code errors with `Plugin validation failed: required field missing`.

```json
// RIGHT
{
  "name": "company-tools",
  "owner": { "name": "DevTools Team" },
  "plugins": []
}

// WRONG — no owner
{ "name": "company-tools", "plugins": [] }
```

### Step 2 — `name` must not be a reserved Anthropic identifier

Plugin Marketplaces reference explicitly reserves these names: `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `knowledge-work-plugins`, `life-sciences`. Names that impersonate official marketplaces (like `official-claude-plugins`) are also blocked by the Claude.ai marketplace sync.

This classifier flags the exact reserved list; "impersonation" variants are out of scope (subjective).

### Step 3 — Plugin entry names must be unique within the marketplace

`/plugin install <name>@<marketplace>` resolves by `name`. Two entries with the same `name` ship a catalog whose second entry shadows the first, and `claude plugin validate` errors with `Duplicate plugin name "x" found in marketplace`.

```json
// WRONG — two entries named "formatter"
{
  "plugins": [
    { "name": "formatter", "source": "./plugins/a" },
    { "name": "formatter", "source": "./plugins/b" }
  ]
}
```

### Step 4 — Every plugin entry needs `name` + `source`

Plugin Marketplaces reference § Required fields. Any entry missing either field fails validation with `plugins[N]: Required field missing`.

```json
// RIGHT
{ "name": "deploy", "source": "./plugins/deploy" }

// WRONG — no source
{ "name": "deploy", "description": "Deployment tools" }
```

`source` may be a string (relative path, must start with `./`) or an object with a `source` discriminator of `github`, `url`, `git-subdir`, or `npm`.

### Step 5 — Relative-path sources must not contain `..`

Plugin Marketplaces reference § Relative paths: "Do not use `../` to reference paths outside the marketplace root." Plugins outside the marketplace directory cannot be copied to the local plugin cache, so these entries break at install time with `plugins[N].source: Path contains ".."`.

```json
// WRONG
{ "name": "shared", "source": "../sibling-repo/plugin" }
```

Object-form sources (`github`, `url`, etc.) are exempt from this check — their fetchers don't care about local paths.

---

## Tool Integration

No CLI. The classifier lives in this skill's eval; Vitest runs it alongside every other skill's eval on `bun run eval`. For runtime validation, Claude Code ships `claude plugin validate .` — run it locally before committing a marketplace change.

## Examples

### Example 1 — `marketplace-plugin-duplicate-name`

**Input:** `marketplace.json` lists two plugin entries named `"deploy"`.
**Output:** `claude plugin validate` errors with `Duplicate plugin name "deploy" found in marketplace`. Fix: rename the second entry (e.g. `"deploy-enterprise"`) or remove it.

### Example 2 — `marketplace-plugin-source-path-traversal`

**Input:** `"source": "../other-repo/plugins/deploy"`.
**Output:** Claude Code rejects the entry because the marketplace cache only copies the marketplace root downward. Fix: move the plugin under the marketplace repo, use a `github`/`url` source, or use `git-subdir` for monorepos.

---

## Edge Cases

- **Empty `plugins` array (`"plugins": []`):** permitted — a zero-plugin marketplace is a valid placeholder. Validator emits a warning (non-blocking).
- **Object-form sources (`github`, `url`, `git-subdir`, `npm`):** exempt from Rule 5 (the `..` check applies only to string paths).
- **String paths that don't start with `./`:** out of this skill's scope — the Plugin Marketplaces reference wording on this is less explicit than plugin.json's. Flagged only when `..` appears.
- **`version` in both `plugin.json` and the marketplace entry:** upstream warns ("manifest wins silently") but doesn't block. Not classified by this skill — use human review for version hygiene.
- **Marketplace `name` containing uppercase or spaces (non-kebab-case):** Claude.ai sync rejects but `claude plugin validate` accepts as a warning. Not flagged here; the plugin-entry `name` kebab-case rule is stricter and covered by `plugin-manifest-validity` when the plugin is built in-tree.

---

## Evaluation

See `/evals/marketplace-submission/`.

**Quantitative:** ≥ 5 violation fixtures at ≥ 95%, 0 false positives on ≥ 4 safe, held-out ≥ 90%.
**Qualitative:** Promptfoo rubric `marketplace-submission-thoroughness` ≥ 0.85.

---

## Handoffs

Scoped to `.claude-plugin/marketplace.json`. NOT absorbed:

- Plugin manifest → `plugin-manifest-validity`
- SKILL.md → `new-skill-review`
- Eval contract → `eval-harness-pattern`
- Upstream-source drift → `drift-check-workflow`

---

## Dependencies

- **External skills:** `plugin-manifest-validity`
- **MCP servers:** none
- **Tools required in environment:** `@gelato/eval-harness`, Vitest

---

## References

- `references/marketplace-schema.md` — condensed Anthropic Plugin Marketplaces schema with per-rule rationale

## Scripts

- _(none — classifier lives in `evals/marketplace-submission/eval.test.ts`)_

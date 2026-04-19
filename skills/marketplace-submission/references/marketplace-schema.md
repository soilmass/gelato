# Plugin Marketplace Schema — condensed reference

Source: [Anthropic Claude Code — Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md), verified 2026-04-19.

This file is the canonical extract the `marketplace-submission` classifier encodes. Keep it in sync when the Plugin Marketplaces reference updates.

## Location

`.claude-plugin/marketplace.json`, at the marketplace repository root. Sibling `.claude-plugin/` directories at plugin roots are distinct — they hold per-plugin `plugin.json` files. A single repo can contain both (a marketplace root plus per-plugin subdirectories).

## Required top-level fields

| Field     | Type   | Rule                                                                                                        |
| :-------- | :----- | :---------------------------------------------------------------------------------------------------------- |
| `name`    | string | Marketplace identifier, kebab-case. Not any of the reserved names (see below). Public-facing.               |
| `owner`   | object | Maintainer info. `owner.name` required; `owner.email` optional.                                             |
| `plugins` | array  | List of plugin entries. May be empty (warning, not error).                                                  |

## Reserved marketplace names

Cannot be used by third-party marketplaces per the Plugin Marketplaces reference:

- `claude-code-marketplace`
- `claude-code-plugins`
- `claude-plugins-official`
- `anthropic-marketplace`
- `anthropic-plugins`
- `agent-skills`
- `knowledge-work-plugins`
- `life-sciences`

Impersonation variants (e.g. `official-claude-plugins`, `anthropic-tools-v2`) are also blocked but are subjective to enumerate.

## Optional top-level metadata

| Field                  | Type   | Note                                                         |
| :--------------------- | :----- | :----------------------------------------------------------- |
| `metadata.description` | string | Human-readable marketplace description                       |
| `metadata.version`     | string | Marketplace-level version                                    |
| `metadata.pluginRoot`  | string | Base directory prepended to relative plugin source paths     |

## Plugin entries (`plugins[]`)

### Required per-entry fields

| Field    | Type           | Rule                                                                                             |
| :------- | :------------- | :----------------------------------------------------------------------------------------------- |
| `name`   | string         | Unique within the marketplace. Kebab-case. Duplicate entries cause validator error.              |
| `source` | string \| object | Location of the plugin. See Plugin sources below.                                              |

### Optional per-entry fields

Any field from the plugin-manifest schema (`description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`, `commands`, `hooks`, `mcpServers`, etc.) plus marketplace-specific fields:

| Field      | Type    | Note                                                                                |
| :--------- | :------ | :---------------------------------------------------------------------------------- |
| `category` | string  | Plugin category for organization                                                    |
| `tags`     | array   | Tags for searchability                                                              |
| `strict`   | boolean | Default `true`. `false` = marketplace entry is the full definition, no plugin.json. |

## Plugin sources

### String form (relative path)

Must start with `./`. Resolves relative to the marketplace root (the directory containing `.claude-plugin/`). Must NOT contain `..`.

Only works when the marketplace is added via Git (GitHub, GitLab, git URL). Direct-URL marketplaces cannot resolve relative paths.

### Object form

Object sources carry a `source` discriminator:

| Discriminator | Required fields                       | Optional fields       |
| :------------ | :------------------------------------ | :-------------------- |
| `github`      | `repo` (`owner/repo`)                 | `ref`, `sha`          |
| `url`         | `url` (full git URL, `.git` optional) | `ref`, `sha`          |
| `git-subdir`  | `url`, `path`                         | `ref`, `sha`          |
| `npm`         | `package`                             | `version`, `registry` |

- `sha` values must be full 40-character git commit SHAs when present (not classified by this skill — distinct rule).
- `ref` is branch or tag; unpinned defaults to the repository default branch.

## What the classifier checks (5 rules)

1. **`marketplace-missing-required-field`** — top-level missing `name`, `owner`, or `plugins`.
2. **`marketplace-name-reserved`** — top-level `name` matches the reserved set above.
3. **`marketplace-plugin-duplicate-name`** — two entries in `plugins` share the same `name`.
4. **`marketplace-plugin-missing-source`** — any plugin entry missing `name` or `source`.
5. **`marketplace-plugin-source-path-traversal`** — any string-form `source` contains `..`.

## What the classifier does NOT check

- `sha` being 40-character hex (distinct rule; low yield).
- Per-entry `version` being valid semver (delegated to `plugin-manifest-validity` when the plugin is in-tree).
- npm `package` validity (subjective — scoped packages, private registries are legitimate).
- Strict-mode conflict detection (cross-file — requires reading the referenced plugin.json).
- Marketplace-source vs plugin-source distinction in `strictKnownMarketplaces` (this is a managed-settings concern, not marketplace.json).
- Impersonation names outside the exact reserved list.
- The `string-path-must-start-with-./` rule, which is documented less strictly than plugin.json's equivalent.

# Plugin Manifest Schema — condensed reference

Source: [Anthropic Claude Code — Plugins Reference](https://code.claude.com/docs/en/plugins-reference.md), verified 2026-04-19.

This file is the canonical extract the `plugin-manifest-validity` classifier encodes. Keep it in sync when the Plugin Reference updates.

## Location

`.claude-plugin/plugin.json`, relative to the plugin root. **All other component directories** (`skills/`, `commands/`, `agents/`, `hooks/`, `output-styles/`, `monitors/`) **must sit at the plugin root — NOT inside `.claude-plugin/`.**

## Required

| Field  | Type   | Rule                                                  |
| :----- | :----- | :---------------------------------------------------- |
| `name` | string | Unique identifier. Kebab-case. No spaces, no uppercase, no underscores. Used for namespacing as `<name>:<component>`. |

## Metadata (optional)

| Field         | Type   | Rule                                                                                                                                    |
| :------------ | :----- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `version`     | string | Semver `MAJOR.MINOR.PATCH`. Pre-release (`1.0.0-beta.1`) + build-metadata (`1.0.0+sha.abc`) suffixes allowed. Plugin.json takes priority over marketplace entry if both set. |
| `description` | string | Free-text.                                                                                                                              |
| `author`      | object | `{ name, email, url }`.                                                                                                                 |
| `homepage`    | string | URL.                                                                                                                                    |
| `repository`  | string | URL.                                                                                                                                    |
| `license`     | string | SPDX identifier.                                                                                                                        |
| `keywords`    | array  | Strings.                                                                                                                                |

## Component paths (optional)

Each of these may be a string, string array, or (for `hooks`, `mcpServers`, `lspServers`) inline object. **String and array entries must start with `./`.**

| Field          | Accepts                     |
| :------------- | :-------------------------- |
| `skills`       | string \| array             |
| `commands`     | string \| array             |
| `agents`       | string \| array             |
| `hooks`        | string \| array \| object   |
| `mcpServers`   | string \| array \| object   |
| `outputStyles` | string \| array             |
| `lspServers`   | string \| array \| object   |
| `monitors`     | string \| array             |
| `userConfig`   | object                      |
| `channels`     | array                       |
| `dependencies` | array                       |

## Path behavior rules

- Paths must be relative to the plugin root and start with `./`.
- For `skills`, `commands`, `agents`, `outputStyles`, `monitors`: a custom path **replaces** the default — include the default (`./skills/`) in the array if you want to keep it plus extras.
- `hooks`, `mcpServers`, `lspServers` have different merge semantics (they accumulate).

## Environment variables (not manifest-level, but cited for scope)

- `${CLAUDE_PLUGIN_ROOT}` — absolute path to the plugin installation directory. Use inside hook `command`, MCP `command`/`args`/`env`, LSP configs, monitor commands.
- `${CLAUDE_PLUGIN_DATA}` — persistent directory surviving plugin updates.

## What the classifier checks (5 rules)

1. **`plugin-manifest-invalid-json`** — JSON parse fails.
2. **`plugin-manifest-missing-name`** — `name` key absent.
3. **`plugin-name-not-kebab-case`** — `name` contains characters outside `[a-z0-9-]` or starts with a non-letter.
4. **`plugin-version-not-semver`** — `version` present but not matching semver `MAJOR.MINOR.PATCH` (with optional pre-release/build suffix).
5. **`plugin-component-path-not-relative`** — any string path in `skills`/`commands`/`agents`/`hooks`/`mcpServers`/`outputStyles`/`monitors`/`lspServers` does not start with `./`.

## What the classifier does NOT check

- Whether component files at the cited paths actually exist (runtime).
- Whether `mcpServers` commands use `${CLAUDE_PLUGIN_ROOT}` for bundled scripts (runtime + subjective — `npx`/global binaries are legitimate).
- Hook event-name case (e.g. `postToolUse` vs `PostToolUse`) — may be added in a future hook-specific skill.
- Marketplace entry shape in `.claude-plugin/marketplace.json` → `marketplace-submission`.
- Whether `channels[].server` matches an `mcpServers` key.

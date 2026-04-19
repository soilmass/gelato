# Gelato — Claude Code project context

**You are Claude Code. This repo is the v0.1 build of Gelato: a dogmatic, eval-verified Claude Code plugin for modern full-stack TypeScript. A Neopolitan product.**

## Read this first

Before writing any code in this repo, follow the instructions in `STARTUP.md`. It lists the six briefing documents to read in order and tells you what summary to produce before your first commit.

Do not skip the summary step. Do not begin scaffolding before the user approves.

## Quick constraints (full rules in BRIEF.md)

- **Dogmatic stack, no substitutions.** See `TOOL_MANIFEST.md`.
- **Git discipline from commit 1.** The pre-built skill at `skills/git-hygiene/SKILL.md` is auto-loaded and applies to every commit you make. Conventional Commits format, imperative subjects ≤72 chars, bodies wrap at 72, atomic commits. Never bypass hooks with `--no-verify`.
- **Stop after each build step.** See BRIEF.md build order. Commit, announce, wait for approval, then continue.
- **Do not modify** `TEMPLATE.md` or `skills/git-hygiene/SKILL.md` unless a reference skill reveals a template problem — in which case pause and report.
- **Evals are mandatory.** A skill without a passing eval is not shipped.
- **Co-author trailer** — when Claude writes >50% of a commit, add `Co-Authored-By: Claude <noreply@anthropic.com>` per `skills/git-hygiene/SKILL.md` Step 9.

## Project identity

| Aspect | Value |
|---|---|
| Product | Gelato |
| Parent brand | Neopolitan |
| Repo | `gelato` |
| npm package (future) | `@neopolitan/gelato` |
| Plugin identifier (future) | `gelato@neopolitan` |
| License | MIT |

## Where things live

- `/BRIEF.md`, `/TEMPLATE.md`, `/SKILLS.md`, `/EVAL_SPEC.md`, `/TOOL_MANIFEST.md`, `/STARTUP.md` — briefing docs
- `/skills/git-hygiene/` — pre-built skill, auto-loaded, ships with the plugin
- `/.claude-plugin/plugin.json` — plugin manifest
- `/.claude/CLAUDE.md` — this file
- `/.claude/settings.json` — project settings
- `/.git/` — initialized; commit 0 already exists on `main`

## Plugin skill path (resolved during Step 1)

The git-hygiene skill lives at top-level `skills/git-hygiene/` — moved from `.claude/skills/` during Step 1 scaffolding. Claude Code's plugin distribution convention puts shared skills at the plugin root under `skills/<name>/SKILL.md`; content under `.claude/` is project-local and is not distributed when users install the plugin. See the Claude Code plugin reference at <https://code.claude.com/docs/en/plugins-reference.md>.

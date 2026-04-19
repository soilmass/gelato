# Gelato — Claude Code project context

**You are Claude Code. This repo is the v0.1 build of Gelato: a dogmatic, eval-verified Claude Code plugin for modern full-stack TypeScript. A Neopolitan product.**

## Read this first

Before writing any code in this repo, follow the instructions in `STARTUP.md`. It lists the six briefing documents to read in order and tells you what summary to produce before your first commit.

Do not skip the summary step. Do not begin scaffolding before the user approves.

## Quick constraints (full rules in BRIEF.md)

- **Dogmatic stack, no substitutions.** See `TOOL_MANIFEST.md`.
- **Git discipline from commit 1.** The pre-built skill at `.claude/skills/git-hygiene/SKILL.md` is auto-loaded and applies to every commit you make. Conventional Commits format, imperative subjects ≤72 chars, bodies wrap at 72, atomic commits. Never bypass hooks with `--no-verify`.
- **Stop after each build step.** See BRIEF.md build order. Commit, announce, wait for approval, then continue.
- **Do not modify** `TEMPLATE.md` or `.claude/skills/git-hygiene/SKILL.md` unless a reference skill reveals a template problem — in which case pause and report.
- **Evals are mandatory.** A skill without a passing eval is not shipped.
- **Co-author trailer** — when Claude writes >50% of a commit, add `Co-Authored-By: Claude <noreply@anthropic.com>` per `.claude/skills/git-hygiene/SKILL.md` Step 9.

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
- `/.claude/skills/git-hygiene/` — pre-built skill, auto-loaded
- `/.claude/CLAUDE.md` — this file
- `/.claude/settings.json` — project settings
- `/.git/` — initialized; commit 0 already exists on `main`

## Step 1 of build order note

During Step 1 (scaffolding), when you create `.claude-plugin/plugin.json`, decide whether the git-hygiene skill should:
- **Stay** at `.claude/skills/git-hygiene/` (project-local auto-load only), or
- **Move** to a top-level `skills/git-hygiene/` matching Claude Code plugin distribution convention (so it ships with the plugin)

Pick per current Claude Code plugin convention. If you move it, update the path references in BRIEF.md, SKILLS.md, STARTUP.md, and this file as part of the scaffolding commit.

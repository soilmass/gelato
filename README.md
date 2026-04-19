# Gelato

> The dogmatic, eval-verified Claude Code kit for modern full-stack TypeScript.
> A Neopolitan product.

[![Skills: 3/15](https://img.shields.io/badge/skills-3%2F15-informational)](./SKILLS.md)
[![Evals: passing](https://img.shields.io/badge/evals-passing-brightgreen)](./EVAL_SPEC.md)
[![Stack: locked](https://img.shields.io/badge/stack-locked-blue)](./TOOL_MANIFEST.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)](./LICENSE)

Gelato is an opinionated Claude Code plugin for full-stack TypeScript developers. Every skill it ships is an encoded external methodology (web.dev, OWASP, Next.js docs, React docs, PlanetScale, Conventional Commits, …) — not invented guidance. Every skill has a runnable eval whose pass rate is written back into the skill's frontmatter by the runner on every run. One locked stack; no configuration flags.

**What makes it different:** every skill has a published, runnable, passing eval. See `EVAL_SPEC.md`.

## Shipped in v0.1

Three skills with passing evals:

| Skill | Phase | Type | Methodology |
|---|---|---|---|
| [`git-hygiene`](./skills/git-hygiene/SKILL.md) | build | procedural | Conventional Commits 1.0 + Chris Beams |
| [`core-web-vitals-audit`](./skills/core-web-vitals-audit/SKILL.md) | verify | metric | web.dev Core Web Vitals (2024-Q4) |
| [`rsc-boundary-audit`](./skills/rsc-boundary-audit/SKILL.md) | verify | judgment | Next.js App Router + React 19 docs |

Twelve more are scoped for v0.2+ — see `SKILLS.md`.

## The dogmatic stack

Do not suggest alternatives. If you are not on this stack, fork the repo.

Runtime **Bun** · Framework **Next.js 15+ App Router** · Monorepo **Turborepo** · Lint/format **Biome** · ORM **Drizzle** · DB **Supabase or Neon (Postgres)** · Cache **Upstash Redis** · Auth **Auth.js** · Validation **Zod** · UI **shadcn/ui + Radix** · Styling **Tailwind v4** · Unit tests **Vitest** · E2E tests **Playwright** · Perf audits **Lighthouse CI** · Errors **Sentry** · Logs **Axiom** · Analytics **PostHog** · Hosting **Vercel** · Deps **Renovate** · Secrets **Doppler** · SAST **Semgrep** · Supply chain **Socket.dev** · Bot protection **Arcjet**

Full list with versions: `TOOL_MANIFEST.md`.

## Install (v0.2 target)

```bash
# via Claude Code plugin marketplaces (v0.2+)
claude plugin install gelato@neopolitan
```

v0.1 is not yet published. Use as a git dependency while the suite matures:

```bash
git clone https://github.com/neopolitan/gelato.git
# Claude Code autoloads anything under gelato/skills/*/SKILL.md
# when you open the repo.
```

## Develop

```bash
bun install
bun run validate              # Zod-validate every SKILL.md frontmatter
bun run eval                  # Run all evals, write pass rates back to SKILL.md
bun run eval <skill-name>     # Run one skill's eval
bun run new-skill <name>      # Scaffold a new skill from TEMPLATE.md
```

Git discipline (lefthook hooks auto-install on `bun install`):

- `pre-commit` — Biome format + Gitleaks
- `commit-msg` — Commitlint (Conventional Commits, 11 locked types)
- `pre-push` — branch-name gate + `tsc --noEmit` + skill validator

Never bypass with `--no-verify`. Fix the underlying issue.

## Repository layout

```
gelato/
├── skills/<name>/              # each skill, paired with an eval
│   ├── SKILL.md                # Zod-validated frontmatter + body
│   ├── references/             # reference material the SKILL points at
│   └── scripts/                # skill-specific scripts (optional)
├── evals/<name>/               # matches skills/<name>
│   ├── eval.test.ts            # Vitest
│   ├── fixtures/               # labeled inputs
│   └── promptfoo.yaml          # optional LLM-as-judge config
├── packages/
│   ├── schema/                 # Zod schema for SKILL.md frontmatter
│   └── eval-harness/           # loadFixtures, runLighthouse, runSkillWithClaude, judgeWithPromptfoo
├── scripts/
│   ├── new-skill.ts            # scaffolds skills/<name>/ from TEMPLATE.md
│   ├── validate-skills.ts      # Zod-validates every SKILL.md frontmatter
│   ├── eval.ts                 # Vitest orchestrator
│   └── update-pass-rate.ts     # writes metadata.eval.* back to each SKILL.md
├── .claude-plugin/
│   ├── plugin.json             # Claude Code plugin manifest
│   └── marketplace.json        # single-plugin marketplace manifest
└── .claude/
    ├── CLAUDE.md               # auto-loaded project context
    └── settings.json           # minimal project settings
```

## Documentation

- **`BRIEF.md`** — identity, scope, principles, build order
- **`TEMPLATE.md`** — frozen SKILL.md template (v1.0)
- **`SKILLS.md`** — locked v0.1 skill list
- **`EVAL_SPEC.md`** — eval runner architecture and format
- **`TOOL_MANIFEST.md`** — exact tools to install; no substitutions
- **`STARTUP.md`** — the originating user message, for context

## License

MIT. See `LICENSE`.

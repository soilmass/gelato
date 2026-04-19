# Gelato

> The dogmatic, eval-verified Claude Code kit for modern full-stack TypeScript.
> A Neopolitan product.

[![Skills: 19/19](https://img.shields.io/badge/skills-19%2F19-brightgreen)](./SKILLS.md)
[![Evals: passing](https://img.shields.io/badge/evals-passing-brightgreen)](./EVAL_SPEC.md)
[![Stack: locked](https://img.shields.io/badge/stack-locked-blue)](./TOOL_MANIFEST.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)](./LICENSE)

Gelato is an opinionated Claude Code plugin for full-stack TypeScript developers. Every skill it ships is an encoded external methodology (web.dev, OWASP, Next.js docs, React docs, PlanetScale, Conventional Commits, …) — not invented guidance. Every skill has a runnable eval whose pass rate is written back into the skill's frontmatter by the runner on every run. One locked stack; no configuration flags.

**What makes it different:** every skill has a published, runnable, passing eval. 16 of 19 also carry a live LLM-as-judge rubric. See `EVAL_SPEC.md` and `CHANGELOG.md`.

## Shipped in v0.2.0

19 skills, each with a deterministic classifier eval at `pass_rate = 1.0`. The `methodology_source` in every SKILL.md cites upstream authority (OWASP, web.dev, Next.js, React, Google Search Central, …) — no invented guidance.

### Foundations · build

| Skill | Type | Methodology |
|---|---|---|
| [`git-hygiene`](./skills/git-hygiene/SKILL.md) | procedural | Conventional Commits 1.0 + Chris Beams |

### Data · build

| Skill | Type | Methodology |
|---|---|---|
| [`drizzle-migrations`](./skills/drizzle-migrations/SKILL.md) | procedural | PlanetScale expand/contract + Drizzle docs |
| [`rsc-data-fetching`](./skills/rsc-data-fetching/SKILL.md) | procedural | Next.js App Router caching docs |
| [`zod-validation`](./skills/zod-validation/SKILL.md) | procedural | Zod docs + Next.js Server Actions |

### Server · build

| Skill | Type | Methodology |
|---|---|---|
| [`server-actions-vs-api`](./skills/server-actions-vs-api/SKILL.md) | judgment | Vercel Server Actions guidance |

### UI · build / verify

| Skill | Phase | Type | Methodology |
|---|---|---|---|
| [`form-with-server-action`](./skills/form-with-server-action/SKILL.md) | build | procedural | Next.js Forms + React Hook Form |
| [`shadcn-tailwind-v4`](./skills/shadcn-tailwind-v4/SKILL.md) | build | procedural | shadcn/ui + Tailwind v4 docs |
| [`rsc-boundary-audit`](./skills/rsc-boundary-audit/SKILL.md) | verify | judgment | Next.js Server Components + React docs |

### Testing · verify

| Skill | Type | Methodology |
|---|---|---|
| [`tdd-cycle`](./skills/tdd-cycle/SKILL.md) | procedural | Kent C. Dodds Testing Trophy |
| [`playwright-e2e`](./skills/playwright-e2e/SKILL.md) | procedural | Playwright official best practices |

### Performance · verify

| Skill | Type | Methodology |
|---|---|---|
| [`core-web-vitals-audit`](./skills/core-web-vitals-audit/SKILL.md) | metric | web.dev Core Web Vitals (2024-Q4) |
| [`bundle-budget`](./skills/bundle-budget/SKILL.md) | judgment | web.dev bundle budgets + Next.js analyzer |

### SEO · verify

| Skill | Type | Methodology |
|---|---|---|
| [`metadata-and-og`](./skills/metadata-and-og/SKILL.md) | procedural | Google Search Central + Next.js Metadata API |

### Security · build / verify

| Skill | Phase | Type | Methodology |
|---|---|---|---|
| [`security-headers`](./skills/security-headers/SKILL.md) | build | procedural | OWASP Secure Headers + Next.js docs |
| [`auth-flow-review`](./skills/auth-flow-review/SKILL.md) | verify | judgment | OWASP ASVS v4 + Auth.js v5 |

### Observability · run

| Skill | Type | Methodology |
|---|---|---|
| [`structured-logging`](./skills/structured-logging/SKILL.md) | procedural | OpenTelemetry semantic conventions + Pino |
| [`sentry-setup`](./skills/sentry-setup/SKILL.md) | procedural | Sentry Next.js official guide |

### Analytics · run

| Skill | Type | Methodology |
|---|---|---|
| [`event-taxonomy-and-instrumentation`](./skills/event-taxonomy-and-instrumentation/SKILL.md) | judgment | Amplitude North Star + PostHog |

### Deployment · run

| Skill | Type | Methodology |
|---|---|---|
| [`ci-cd-next-on-vercel`](./skills/ci-cd-next-on-vercel/SKILL.md) | procedural | Vercel deployment + DORA metrics |

Deferred sub-skills (v0.2+) and full release notes: see `CHANGELOG.md`.

## The dogmatic stack

Do not suggest alternatives. If you are not on this stack, fork the repo.

Runtime **Bun** · Framework **Next.js 15+ App Router** · Monorepo **Turborepo** · Lint/format **Biome** · ORM **Drizzle** · DB **Supabase or Neon (Postgres)** · Cache **Upstash Redis** · Auth **Auth.js** · Validation **Zod** · UI **shadcn/ui + Radix** · Styling **Tailwind v4** · Unit tests **Vitest** · E2E tests **Playwright** · Perf audits **Lighthouse CI** · Errors **Sentry** · Logs **Axiom** · Analytics **PostHog** · Hosting **Vercel** · Deps **Renovate** · Secrets **Doppler** · SAST **Semgrep** · Supply chain **Socket.dev** · Bot protection **Arcjet**

Full list with versions: `TOOL_MANIFEST.md`.

## Install

Claude Code auto-loads any skill under a repo's `skills/*/SKILL.md`. Clone and open:

```bash
git clone https://github.com/soilmass/gelato.git
# Open the repo with Claude Code — all 19 skills load automatically.
```

Claude Code plugin marketplace submission and `@neopolitan/gelato` npm publish are in-flight for a follow-up point release.

## Develop

```bash
bun install
bun run validate              # Zod-validate every SKILL.md frontmatter
bun run eval                  # Run all evals, write pass rates back to SKILL.md
bun run eval <skill-name>     # Run one skill's eval
bun run new-skill <name>      # Scaffold a new skill from TEMPLATE.md
bun run docs:generate         # Regenerate docs/app/skills/*/page.mdx from SKILL.md
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
│   ├── update-pass-rate.ts     # writes metadata.eval.* back to each SKILL.md
│   ├── generate-docs.ts        # materializes docs/app/skills/<name>/page.mdx
│   └── check-pass-rate-regression.ts  # CI gate: fail on >0.05 pass-rate drop
├── docs/                       # Nextra 4 App Router docs site (gelato.dev)
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
- **`SKILLS.md`** — Core 1 skill list (Gelato core)
- **`EVAL_SPEC.md`** — eval runner architecture and format
- **`TOOL_MANIFEST.md`** — exact tools to install; no substitutions
- **`CHANGELOG.md`** — release notes, including v0.2.0 deferred sub-skills
- **`STARTUP.md`** — the originating user message, for context

## License

MIT. See `LICENSE`.

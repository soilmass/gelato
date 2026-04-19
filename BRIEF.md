# Gelato — Build Brief

> The dogmatic, eval-verified Claude Code kit for modern full-stack TypeScript.
> A Neopolitan product.

**You are Claude Code. Read these files in order before writing any code:**
1. BRIEF.md (this file) — identity, scope, principles
2. TEMPLATE.md — the frozen SKILL.md template
3. SKILLS.md — the locked v0.1 skill list
4. EVAL_SPEC.md — eval runner and format
5. TOOL_MANIFEST.md — exact tools, versions, configs
6. STARTUP.md — the originating user message

---

## Identity

Gelato is an opinionated Claude Code plugin for full-stack TypeScript developers. It is **not** a catalog of every possible skill — it is a **curated, quality-controlled distribution** where every skill:

1. Encodes a canonical external methodology (web.dev, OWASP, PlanetScale, etc.) rather than inventing new guidance
2. Assumes one locked stack (below) and does not accept configuration flags
3. Ships with a runnable eval that publishes its pass rate in the skill's frontmatter
4. Is scoped to one subsystem with zero overlap against adjacent skills

The positioning claim that differentiates Gelato from every competitor (ECC, antigravity-awesome-skills, VoltAgent): **every skill has a published, runnable, passing eval.** Do not ship a skill without one.

---

## The six functions

Every skill implements one or more of these:

1. **Knowledge injection** — inject current stack context so Claude stops writing year-old code
2. **Workflow discipline** — enforce plan → test → implement → verify → review loops
3. **Memory across sessions** — preserve decisions, open items, partial state
4. **Quality gating on every change** — typecheck, lint, test, flag security patterns automatically
5. **Token economy** — load only what's relevant, compact at the right moments
6. **Verification that the suite itself works** — every skill has a runnable eval

---

## The dogmatic stack (locked)

Do not suggest alternatives. Do not offer configuration flags. If a user is not on this stack, they fork the repo.

| Layer | Locked choice |
|---|---|
| Runtime | Bun |
| Framework | Next.js 15+ App Router |
| Package manager | Bun (workspaces) |
| Monorepo | Turborepo |
| Lint/format | Biome |
| ORM | Drizzle |
| DB | Supabase or Neon (both Postgres) |
| Cache | Upstash Redis |
| Auth | Auth.js |
| Validation | Zod |
| UI primitives | shadcn/ui + Radix |
| Styling | Tailwind v4 |
| Unit testing | Vitest |
| E2E testing | Playwright |
| Perf auditing | Lighthouse CI |
| Error tracking | Sentry |
| Logs | Axiom |
| Analytics | PostHog |
| Hosting | Vercel |
| Dependency updates | Renovate |
| Secrets | Doppler |
| SAST | Semgrep |
| Supply chain | Socket.dev |
| Bot/rate-limit | Arcjet |

---

## The suite has six cores. Core 1 (Web Dev) ships first and alone.

Cores 2–6 exist in planning only. **Do not scaffold them in v0.1.**

For context only:
1. Web Dev (this repo, v0.1)
2. Brand & Content
3. Growth & Distribution
4. Founder Ops
5. Research & Synthesis
6. Meta

---

## Core 1 has 11 subsystems across 3 phases

**Build:** Foundations, Data, Server, UI
**Verify:** Testing, Performance, SEO, Security
**Run:** Observability, Analytics, Deployment & Maintenance

See SKILLS.md for the subsystem-to-skill mapping.

---

## v0.1 scope — what you are building now

**Before anything else:** `.claude/skills/git-hygiene/SKILL.md` ships pre-built in this handoff and is auto-loaded by Claude Code the moment this repo opens. Read it before your first commit. Every commit you make in this repo — including the very first scaffolding commit — follows its procedure. Do not rewrite it. Do not modify it in this handoff unless the reference skills reveal a template problem.

Then, in this order:

1. **Repo scaffolding** — monorepo with Bun workspaces, all tooling from TOOL_MANIFEST.md wired. Create `.claude-plugin/plugin.json`. Decide whether to keep git-hygiene at `.claude/skills/` (project-only) or move to top-level `skills/` (plugin distribution); update path references in BRIEF.md, SKILLS.md, STARTUP.md, and `.claude/CLAUDE.md` if you move it.
2. **Eval runner** — Vitest harness, Promptfoo helper lib, frontmatter pass_rate writer. Also run `git-hygiene`'s eval (deferred from Step 0) as the first thing the runner processes.
3. **Skill scaffolder** — hand-rolled Bun script (`scripts/new-skill.ts`), reads TEMPLATE.md
4. **Validation CLI** — walks the skills directory, validates every SKILL.md frontmatter via Zod
5. **Reference skill #1:** `core-web-vitals-audit` (metric-heavy, full eval)
6. **Reference skill #2:** `rsc-boundary-audit` (judgment-heavy, full eval)
7. **Docs site skeleton** — Nextra 3, auto-generates skill pages from SKILL.md (git-hygiene page is auto-generated too)
8. **README** with badges, install command, positioning line

**STOP after step 8. Hand back to the user for review.**

Do not build the remaining 12 skills. Do not scaffold Cores 2–6. Do not write launch material.

---

## Project identity and naming

| Aspect | Value |
|---|---|
| Brand (parent) | Neopolitan |
| Product name | Gelato |
| Repo name | `gelato` |
| npm package | `@neopolitan/gelato` |
| Plugin identifier | `gelato@neopolitan` |
| CLI command | `gelato` |
| Docs domain | `gelato.dev` (user will register) |
| License | MIT |
| Tagline | The dogmatic Claude Code kit for modern full-stack TypeScript. A Neopolitan product. |

---

## Non-Negotiable Principles

1. **Buy, don't build.** Use the tools in TOOL_MANIFEST.md. If something is not listed, stop and ask before writing custom code.
2. **Dogmatic over configurable.** No `--orm` flags. No "works with Drizzle or Prisma" — Drizzle is the answer.
3. **Methodology-first.** Every skill attributes its source. Do not invent new methodologies.
4. **Evals are mandatory.** A skill without a passing eval is not shipped.
5. **Reference skills validate the template.** If the template needs to change to fit a reference skill cleanly, pause and report — do not silently modify the template.
6. **Small surface, high quality.** 15 skills total in v0.1 (you build 2 of them). Do not add more.

---

## Repo directory structure (target)

```
gelato/
├── .changeset/
├── .claude/
│   ├── CLAUDE.md                 # auto-loaded project context (ships in handoff)
│   ├── settings.json             # minimal project settings (ships in handoff)
│   └── skills/
│       └── git-hygiene/          # PRE-BUILT — ships in v0.1 handoff, auto-loaded
│           ├── SKILL.md
│           ├── scripts/
│           │   └── check-branch-name.sh
│           ├── references/
│           │   ├── conventional-commits-quick-ref.md
│           │   └── beams-seven-rules.md
│           └── assets/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── release.yml
│   │   ├── drift-check.yml
│   │   └── eval.yml
│   └── renovate.json
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/                        # plugin distribution path (populated in Step 1+)
│   ├── core-web-vitals-audit/    # Built in Step 3
│   │   ├── SKILL.md
│   │   ├── scripts/
│   │   ├── references/
│   │   └── assets/
│   └── rsc-boundary-audit/       # Built in Step 4
│       └── (same structure)
├── evals/
│   ├── core-web-vitals-audit/
│   │   ├── eval.test.ts
│   │   ├── fixtures/
│   │   └── promptfoo.yaml
│   └── rsc-boundary-audit/
│       └── (same structure)
├── scripts/
│   ├── new-skill.ts
│   ├── validate-skills.ts
│   ├── eval.ts
│   └── update-pass-rate.ts
├── docs/                          # Nextra 3 site
├── packages/
│   └── schema/                    # Zod schema for SKILL.md frontmatter
├── TEMPLATE.md
├── BRIEF.md
├── SKILLS.md
├── EVAL_SPEC.md
├── TOOL_MANIFEST.md
├── STARTUP.md
├── README.md
├── LICENSE
├── package.json
├── bun.lockb
├── turbo.json
├── biome.json
├── lefthook.yml
├── commitlint.config.ts
└── tsconfig.json
```

---

## Build order and stop points

| Step | Work | Stop for review? |
|---|---|---|
| 0 | Read `.claude/skills/git-hygiene/SKILL.md` (auto-loaded). Ships pre-built. Use from commit 1. | No — implicit precondition |
| 1 | Scaffolding + all tooling from TOOL_MANIFEST.md. Create `.claude-plugin/plugin.json`. Decide final skill path. | **Yes** |
| 2 | Eval runner + scaffolder + validator scripts. Run git-hygiene's eval. | **Yes** |
| 3 | Reference skill #1: `core-web-vitals-audit` with passing eval | **Yes** |
| 4 | Reference skill #2: `rsc-boundary-audit` with passing eval | **Yes — hand back** |
| 5 | Docs site skeleton (Nextra 3, skill pages auto-generated) | No, included in step 4 commit |
| 6 | README + LICENSE + plugin manifests | No, included in step 4 commit |

"Stop for review" means: commit the work, open a draft PR (or just announce the commit in chat), wait for user feedback before continuing.

---

## Things to explicitly NOT do

- Do not write any skills beyond the two reference skills
- Do not scaffold Cores 2–6
- Do not add scaffolding "for future expansion" that isn't needed for v0.1
- Do not publish to npm
- Do not set up a marketing site, landing page, or social posts
- Do not suggest alternatives to tools in TOOL_MANIFEST.md
- Do not add features (telemetry, auto-update, etc.) not called for in this brief
- Do not modify TEMPLATE.md without pausing and reporting why
- Do not invent methodology — every skill cites a canonical external source

---

## When to pause and ask

- TEMPLATE.md doesn't fit a reference skill cleanly
- TOOL_MANIFEST.md is missing a tool you genuinely need
- A methodology source has no clear canonical authority
- An eval threshold seems unreasonable after implementation
- Anything in this brief contradicts itself

Default to pausing. The user prefers a slightly slower build with correct decisions over a fast build with drift.

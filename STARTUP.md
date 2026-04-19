# STARTUP.md

This is the message to paste into Claude Code as your very first prompt. Copy everything between the `---` lines below.

---

You are building **Gelato**, a Claude Code plugin. This repo contains briefing documents plus one pre-built, auto-loaded skill. Read them in this exact order before writing any code:

1. `BRIEF.md` — identity, scope, principles, build order
2. `TEMPLATE.md` — frozen SKILL.md template (v1.0)
3. `SKILLS.md` — locked v0.1 skill list; build the two marked "✅ REF", use the one marked "📦 PRE"
4. `EVAL_SPEC.md` — eval runner architecture and format
5. `TOOL_MANIFEST.md` — exact tools to install; do not substitute alternatives
6. **`skills/git-hygiene/SKILL.md`** — the pre-built, auto-loaded skill you follow from commit 1 onward (moved from `.claude/skills/` to top-level `skills/` during Step 1; the handoff tarball still places it under `.claude/skills/`, so read it from whichever path exists when the repo opens)

Note: `.claude/CLAUDE.md` is auto-loaded by Claude Code; you may have already read it. Treat it as a quick-reference supplement to BRIEF.md.

After reading all six, summarize back to me in 6 bullets:
- What Gelato is
- The v0.1 scope (what you are building now and what you are NOT)
- The dogmatic stack (just list, no commentary)
- The two reference skills and what makes them different
- How you will apply `git-hygiene` from the first commit
- Your planned first commit (subject + body + reasoning)

Wait for my approval of the summary before you start committing code.

When you start, follow the build order in BRIEF.md step by step. **Stop after each step for review** — commit, announce the commit in chat, wait for my go-ahead before the next step.

Specifically:

- Step 1: Repo scaffolding + all tooling from TOOL_MANIFEST.md. Create `.claude-plugin/plugin.json`. (Resolved: moved git-hygiene to top-level `skills/` per Claude Code plugin convention and updated all path references in the same commit.) Stop.
- Step 2: Eval runner + scaffolder + validator scripts. Run `git-hygiene`'s eval first once the runner works. Stop.
- Step 3: Reference skill #1, `core-web-vitals-audit`, with passing eval. Stop.
- Step 4: Reference skill #2, `rsc-boundary-audit`, with passing eval. Stop and hand back to me.

Non-negotiables:

- Use every tool in TOOL_MANIFEST.md. Do not substitute. If something is missing, pause and ask.
- Follow `skills/git-hygiene/SKILL.md` for every commit including the first one (`chore: initial scaffolding` is the only exception, allowed for commit 0 — but commit 0 already exists, so your first commit is commit 1 and follows the full discipline).
- Every skill must have a passing eval before merge. No placeholders.
- Never hand-edit `metadata.eval.pass_rate`, `last_run`, or `n_cases` — the runner owns those fields.
- Do not build skills 1–15 from SKILLS.md in this handoff. Only the two marked "✅ REF".
- Do not modify the git-hygiene skill during v0.1 unless the reference skills reveal a template problem — if so, pause and report.
- Do not scaffold Cores 2–6.
- If TEMPLATE.md does not fit a reference skill cleanly, pause and report. Do not silently modify the template.

Ready? Read the six files and give me your 6-bullet summary.

---

## How to use this file (for you, the human)

The repo is **already initialized** with commit 0 on `main` and `.claude/` set up. You do not need to `git init` — just extract and push.

1. Create an empty GitHub repo named `gelato` (private is fine for now)
2. Extract the zip — you get a `gelato/` directory with `.git/` and `.claude/` already in place
3. (optional) Rewrite the commit author to you: `git commit --amend --author="Your Name <you@email.com>" --no-edit`
4. Add your remote and push: `git remote add origin git@github.com:YOUR_USER/gelato.git && git push -u origin main`
5. Open the repo in your editor with Claude Code running — `.claude/CLAUDE.md` auto-loads, and Claude Code will have the git-hygiene skill available immediately
6. Paste the message between the `---` lines above as your first prompt
7. Review each commit Claude Code makes before approving the next step

Total expected time from paste to two passing reference skills: 3–6 hours of Claude Code work, interspersed with your review. Plan to be available for those reviews — the whole point of the stop-and-review cadence is that you catch drift early.

## If something goes wrong

- **Claude Code wants to add a tool not in TOOL_MANIFEST.md:** say no. Open an issue, update the manifest, then resume.
- **An eval is failing on `main`:** that's the design. Fix the skill until the eval passes, or revert the skill.
- **Claude Code wants to modify TEMPLATE.md:** require a commit message explaining why. If the reason is "this skill needed it," push back — the template held in Stage 5 testing. Adjust the skill, not the template.
- **Pass rate drops on an existing skill after a change:** CI will catch it. Don't merge.
- **You want to skip a review:** don't. The review cadence is what keeps quality high. A rushed v0.1 is worse than a slower one.

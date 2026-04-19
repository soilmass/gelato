# Gelato SKILL.md Template (v1.0, frozen)

Every skill in Gelato clones this template. Do not deviate without pausing and reporting why.

This template extends the `building-skills` skill's Stage 4 structure with Gelato-specific sections (Methodology Attribution, Stack Assumptions, Hard Thresholds, Tool Integration, published eval metadata).

---

## Frontmatter schema (Zod-enforced)

The canonical Zod schema lives in `packages/schema/src/skill-frontmatter.ts`. The schema is the source of truth; this section is a human-readable summary.

```yaml
---
name: <kebab-case, under 64 chars, gerund or noun-phrase form>
description: >
  <Third-person, under 1024 chars. Verb+object first. Then triggers.>
  Use when: <natural-language phrases users actually type>, <...>.
  Do NOT use for: <near-miss adjacent skills>, <...>.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: <foundations|data|server|ui|testing|performance|seo|security|observability|analytics|deployment>
  phase: <build|verify|run>
  type: <procedural|judgment|metric>
  methodology_source:
    # Accepts a string OR an array. Multi-source skills use array form.
    - name: <e.g., "Core Web Vitals">
      authority: <e.g., "web.dev / Google Chrome team">
      url: <canonical URL>
      version: <source version or date>
      verified: <ISO date>
  stack_assumptions:
    - "next@15+ App Router"
    - "drizzle@1.x"
    - "bun@1.x"
    # ...only items this skill actually touches
  eval:
    pass_rate: <0.0-1.0, auto-updated by eval runner — do not hand-edit>
    last_run: <ISO date, auto-updated>
    n_cases: <integer, auto-updated>
  changelog: >
    v1.0 — <one line>
---
```

---

## Body structure

Copy this structure verbatim. Omit sections marked OPTIONAL when they do not apply.

```markdown
# <skill-name>

<One paragraph. What this skill encodes, whose methodology, for what stack.
No marketing. No "this skill helps you...". Plain statement of what it is.>

---

## Methodology Attribution

This skill encodes <NAME> methodology from <AUTHORITY>.

- **Source:** <canonical URL>
- **Version:** <source version or publication date>
- **Verified:** <ISO date>
- **Drift-check:** <path to GitHub Actions workflow>

<One paragraph: what about this methodology is encoded, and what is deliberately NOT encoded.>

<!-- Multi-source skills list each source separately with Primary/Secondary labels. -->

---

## Stack Assumptions

This skill assumes the locked Gelato stack:

- <explicit list — only items this skill actually touches>

If your stack differs, fork the suite. This skill does not accept configuration flags.

---

## When to Use

Activate when any of the following is true:
- <user-facing trigger phrase>
- <...>

## When NOT to Use

Do NOT activate for:
- <near-miss that routes elsewhere> — use <adjacent skill> instead
- <...>

---

## Procedure

<!--
Match Procedure depth to threshold presence:
- If this skill has Hard Thresholds, Procedure can be lean — thresholds do the enforcement.
- If this skill has NO Hard Thresholds (judgment skills), Procedure is where enforcement lives.
  Write real depth: decision trees, classification criteria, ordered rules.
-->

<Imperative. Staged if multi-step.>

### Step 1 — <name>
<...>

### Step 2 — <name>
<...>

---

## Hard Thresholds

<!-- OPTIONAL — omit entirely for judgment-based skills. Do not invent thresholds to fill the section. -->

The eval fails this skill if any threshold is missed:

- <metric> <operator> <number> (source: <methodology authority>)
- <...>

---

## Tool Integration

Exact commands, configs, and paths this skill uses. Version-pinned where applicable.

```bash
<command>
```

```ts
// config snippet
```

---

## Examples

### Example 1 — <scenario>
**Input:** <realistic user request>
**Output:** <realistic skill-guided response>

### Example 2 — <edge scenario>
**Input:** <...>
**Output:** <...>

---

## Edge Cases

- **<edge case>:** <handling>
- <...>

---

## Evaluation

See `/evals/<skill-name>/` for the canonical eval suite.

### Pass criteria

**Quantitative:**
- <assertions run by the eval runner>

**Qualitative:** <OPTIONAL — only when the skill has subjective properties>
- <human-review criteria>

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate` in frontmatter above.

---

## Handoffs

This skill is scoped to <narrow responsibility>. Explicitly NOT absorbed:

- <adjacent concern> — use <other skill> instead
- <...>

---

## Dependencies

- **External skills:** <list or "none">
- **MCP servers:** <list or "none">
- **Tools required in environment:** <list>

---

## References

- `references/<file>.md` — <one line per file>

## Scripts

- `scripts/<file>` — <one line per script>
```

---

## Non-negotiables

Every skill built from this template MUST:

1. **Cite a canonical external methodology** in Methodology Attribution. Never invent one.
2. **List only locked-stack tools** in Stack Assumptions.
3. **Pass its own eval** before being merged. No exceptions.
4. **Fit under 500 body lines.** At 400, restructure into `references/`.
5. **Keep references one level deep** from SKILL.md.
6. **Use third-person, trigger-framed description under 1024 chars.**
7. **Have the Evaluation section with a real `evals/<skill>/` suite** — not a placeholder.

Every skill built from this template MUST NOT:

1. Offer configuration flags for stack choices
2. Hand-edit the `eval.pass_rate`, `eval.last_run`, or `eval.n_cases` fields (the runner writes them)
3. Include a Non-Negotiable Rules section unless Stage 5 testing reveals specific rationalization (per `building-skills` discipline)
4. Cover multiple subsystems — one skill, one subsystem
5. Reference files more than one level deep (no chains of imports)

---

## Three refinements from Stage 5 testing (v1.0 vs. the initial draft)

Captured here for posterity and to prevent drift:

1. **`methodology_source` accepts array.** Multi-source skills (e.g., `rsc-boundary-audit`, which cites both Next.js docs and React docs) use array form. Schema accepts either a single object or an array.

2. **Hard Thresholds omission is explicit.** The HTML comment `<!-- OPTIONAL — omit entirely for judgment-based skills -->` prevents contributors from inventing thresholds to fill the section.

3. **Procedure depth matches threshold presence.** The comment at the top of Procedure makes this explicit: metric skills can have lean procedures because numbers enforce; judgment skills need deep, decision-tree-style procedures because no numbers enforce.

---

## Reference implementation

The two v0.1 reference skills live at `/skills/core-web-vitals-audit/` and `/skills/rsc-boundary-audit/`. Read those for concrete examples of the template in use — one metric-type, one judgment-type.

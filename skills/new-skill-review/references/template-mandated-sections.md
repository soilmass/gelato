# Mandated body sections — TEMPLATE.md v1.0

Every Gelato SKILL.md body (post-frontmatter) must contain these H2 sections. Order matters for readability but not for validity; the classifier checks presence only.

| Section | Rationale |
|---|---|
| `## Methodology Attribution` | Gelato's core claim: every skill encodes a canonical external source. This section is the citation layer — names the source, links the URL, dates the last verification. Without it, Gelato can't distinguish "encoded methodology" from "invented guidance." |
| `## Stack Assumptions` | Gelato is dogmatic; skills declare the exact toolchain they target. If a skill is written against Next.js 15 App Router, it says so. Saves reviewers from matching a skill against the wrong stack. |
| `## When to Use` | User-facing trigger phrases. Drives Claude's skill-matching; missing means the skill is effectively unreachable. |
| `## When NOT to Use` | Explicit near-miss handoffs. The Gelato "one subsystem, zero overlap" rule is enforced here — every skill names the adjacent skills that cover concerns *this* skill deliberately doesn't. |
| `## Procedure` | The actual discipline the skill encodes. Judgment skills carry procedural weight here (since they omit Hard Thresholds); metric skills can be leaner. |
| `## Tool Integration` | Exact commands + configs. Makes the skill reproducible outside a Claude session. |
| `## Examples` | At least one Input / Output pair per violation class. Without examples the procedure is abstract. |
| `## Evaluation` | Every skill points at its `evals/<name>/` directory. Without a passing eval, the skill doesn't ship (BRIEF.md § Non-Negotiable #4). |
| `## Handoffs` | Explicit non-overlap. Mirrors `When NOT to Use` but from the scope-definition side. |
| `## References` | Files under `skills/<name>/references/`. At least one reference is required when the skill's discipline benefits from a depth the SKILL.md body can't hold (long rule catalogs, rationale docs). |

## Optional sections

- `## Hard Thresholds` — metric-type skills only. Judgment skills omit cleanly; do not fill with invented thresholds (TEMPLATE.md Stage 5 refinement #2).
- `## Edge Cases` — enumerate the exemptions the classifier respects. Present when a skill has meaningful exemption rules (e.g. `opengraph-image.tsx` is exempt from `next-image-font-script`'s `<img>` rule).
- `## Dependencies` — cross-skill + tool-environment declarations. Present when the skill depends on siblings or external tools the skill consumer must install.

## What the classifier enforces

The `new-skill-review` skill's classifier checks presence of the 10 mandated H2 sections by scanning for the literal `## <section>` line in the body. Three observations:

- The classifier is presence-only. It does NOT check order, content depth, or internal consistency.
- Optional sections are not enforced. A missing `## Hard Thresholds` passes.
- The classifier's body scope is "everything after the closing `---` of the frontmatter." A section present only inside the frontmatter block doesn't count.

## When a mandated section's absence is justified

Short answer: never. Every section has content that belongs somewhere. If a section feels redundant for a particular skill, the SKILL.md author should still include the H2 + a one-sentence note explaining why the section is brief:

```markdown
## Edge Cases

_(none — every violation class has a single, mechanically-detectable shape)_
```

Versus omitting the section, which would fail the classifier. TEMPLATE.md's Non-negotiable #3 explicitly refers to this pattern ("Include a Non-Negotiable Rules section unless Stage 5 testing reveals specific rationalization").

## Order recommendation (not enforced)

The canonical order in TEMPLATE.md is:

1. `# <skill-name>` — H1 title
2. `## Methodology Attribution`
3. `## Stack Assumptions`
4. `## When to Use` + `## When NOT to Use` (H2 pair)
5. `## Procedure`
6. `## Hard Thresholds` (if applicable)
7. `## Tool Integration`
8. `## Examples`
9. `## Edge Cases`
10. `## Evaluation`
11. `## Handoffs`
12. `## Dependencies`
13. `## References`
14. `## Scripts`

Following this order makes cross-skill comparison trivial. Deviating is legal per the classifier but creates review friction.

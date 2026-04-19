# Why the skill enforces 44×44, not 24×24

## WCAG 2.5.8 — Target Size (Minimum), AA

> The size of the target for pointer inputs is at least 24 by 24 CSS pixels, except where:
> — Spacing: the target offset is at least 24 CSS pixels to every adjacent target;
> — Equivalent: the target is available through a different control on the same page that is at least 24 by 24 CSS pixels;
> — Inline: the target is in a sentence or its size is otherwise constrained by the line-height of non-target text;
> — User Agent Control: the size of the target is determined by the user agent and is not modified by the author;
> — Essential: a particular presentation of the target is essential or is legally required for the information being conveyed.

**Conformance bar:** 24×24. That's the letter of WCAG 2.2 AA.

## Why we enforce 44×44 instead

The skill classifies anything below 44×44 as a violation, not 24×24. Rationale:

1. **Apple Human Interface Guidelines** — "Provide ample touch targets for interactive elements. Try to maintain a minimum tappable area of 44pt × 44pt for all controls." (`developer.apple.com/design/human-interface-guidelines/` — Input)
2. **Material Design** — "Touch targets should be at least 48dp × 48dp." (48dp ≈ 48 CSS pixels.) (`m3.material.io` — Foundations → Accessibility)
3. **WCAG 2.5.5 (AAA)** — the stricter target-size requirement ≥ 44×44. The skill applies it because the cost of bigger targets on desktop is effectively zero, and mobile users (the largest segment for most Next.js deployments) benefit directly.
4. **Failure-mode asymmetry** — a too-small tappable control hurts users; a slightly-too-big one does not. Optimizing for "passes AA literally" leaves the user experience on the table.

## Why Tailwind classes specifically

The classifier is static; it doesn't render the page. Size has to be inferred from the `className` string. Tailwind's size tokens are a canonical mapping (`h-11` = `height: 2.75rem` = 44px at default root font-size) so class-string scanning is reliable.

Tokens accepted as "meets the bar" (both axes required):

**Height:** `h-11`, `h-12`, `h-14`, `h-16`, `h-20`, `h-24`, `h-28`, `h-32`, `h-36`, `h-40`, `h-44`, `h-48`, `h-52`, `h-56`, `h-60`, `h-64`, `h-72`, `h-80`, `h-96`, `min-h-11` … `min-h-96`, `size-11` … `size-96`.

**Width:** `w-11` … `w-96`, `min-w-11` … `min-w-96`, `size-11` … `size-96` (the `size-*` utility sets both axes in one token).

**Padding heuristic:** `py-3` + an implicit default line-height ≈ 44px. To reduce false positives, the classifier accepts `py-3` or larger (`py-4`, `py-5`, …) AS satisfying the height axis when the element's content is text (auto-height). This heuristic is disabled for `<button>` wrapping only an icon (no text content), where explicit `h-*` is required.

## What the skill doesn't catch

- Dynamic classes: `className={cn("h-11", cond && "h-6")}` — the classifier sees both `h-11` and `h-6`; it flags if ANY branch is below the bar. False positives are possible for "only-on-desktop-shrink" patterns; the remediation is to use `md:h-11` + `h-11` rather than `h-6` + `md:h-11`.
- Arbitrary values: `className="h-[44px]"` — classifier accepts `h-[N]` where N is ≥ 44 in px/rem-equivalent units.
- CSS-defined sizes: `.my-button { height: 44px }` in a CSS module — out of scope; fix the classifier by bringing the class into Tailwind or add a reference from SKILL.md to this limitation.

## Exceptions in the spec that the classifier respects

- `type="hidden"` inputs — no rendered target, no rule applies.
- Inline links (`<a>` without `href` or inside running text) — the "Inline" exception of 2.5.8 kicks in. Classifier heuristic: an `<a>` without `className` carrying any size token AND without `role="button"` is treated as inline and skipped.

## When the 44×44 bar is genuinely wrong

Two legitimate reasons to deviate that should trigger a SKILL.md update, not a per-file suppression:

1. **Ultra-dense data tables** with hundreds of row-level actions on desktop-only views. The spec's "Equivalent" exception applies if the same action is available on a larger control elsewhere.
2. **Legacy markup migration** where fixing all violations in one PR is impractical. The right answer is still to fix them; the skill exists to catch regressions as PRs land.

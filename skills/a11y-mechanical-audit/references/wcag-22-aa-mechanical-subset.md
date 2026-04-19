# WCAG 2.2 AA — mechanical subset

Five rules from the full WCAG 2.2 AA conformance target that are detectable from a single `.tsx` file without running the page. Mapping below ties each rule to a WCAG Success Criterion, a WAI-ARIA APG pattern (where applicable), and the corresponding axe-core rule ID.

| Rule | Violation class | WCAG SC | APG pattern | axe-core rule |
|---|---|---|---|---|
| `<img>` must carry `alt` | `img-no-alt` | 1.1.1 Non-text Content | — | `image-alt` |
| Form controls need an accessible name | `input-no-label` | 1.3.1 Info and Relationships; 3.3.2 Labels or Instructions | Form Instructions | `label` |
| `onClick` on non-interactive element needs `role` + `tabIndex` + keyboard | `interactive-without-role` | 4.1.2 Name, Role, Value; 2.1.1 Keyboard | Button | `interactive-supports-focus`, `role-support` |
| No positive `tabIndex` | `tabindex-positive` | 2.4.3 Focus Order | — | `tabindex` |
| Interactive elements ≥ 44×44 CSS px | `target-size-too-small` | 2.5.8 Target Size (Minimum) | — | `target-size` |

## What's NOT in the mechanical subset

These also matter for conformance but need rendered-DOM or document-level analysis:

| WCAG SC | Why it's out of scope here |
|---|---|
| 1.4.3 Contrast (Minimum) | Needs design-token lookup + computed styles |
| 2.4.1 Bypass Blocks (skip-links) | Document-level, layout-spanning |
| 1.3.6 Identify Purpose | Semantic judgment, not syntactic |
| 2.4.6 Headings and Labels | Requires heading-order walk across the whole tree |
| 4.1.3 Status Messages | Runtime (aria-live firing) |
| 2.3.3 Animation from Interactions | Media-query driven (`prefers-reduced-motion`) |
| 1.4.13 Content on Hover or Focus | Runtime behaviour |

The runtime rules are covered by the `axe-playwright` skill (v0.3) which scans a live DOM through `@axe-core/playwright`.

## Why these five in particular

They share three properties that make them suitable for a regex/AST classifier:

1. **Single-file detectability.** Every violation can be spotted by looking at one `.tsx` file in isolation — no cross-file resolution, no computed styles, no hydration state.
2. **Unambiguous fix.** Each rule has a canonical remediation the author can write without additional design input (add `alt`, add `label`, add `role+tabIndex+onKeyDown`, remove positive tabIndex, bump Tailwind size class).
3. **High signal.** Deque's internal data across millions of scans consistently puts these five in the top-10 most-encountered violations on React codebases. Fixing them eliminates the majority of mechanically-findable a11y bugs.

## Relationship to the full axe-core catalog

axe-core 4.10 ships ~95 rules. The mechanical subset here is ~5 of them (5%). The remaining ~90 rules split across:

- **~40 rules** that require rendered DOM (contrast, scrollable regions, frame titles, color alone). → `axe-playwright`
- **~25 rules** that require document-level or cross-file view (landmark uniqueness, heading order, skip-links, duplicate ids). → out of scope, candidate for a future `a11y-document-audit` skill
- **~20 rules** that overlap with the five here but at different granularity (aria-* attribute validity, role-value pairing). → folded into the `interactive-without-role` class as appropriate
- **~5 rules** in "best-practice" or "experimental" that aren't WCAG-conformance-required.

The skill encodes the mechanical subset at 100%; it deliberately does not overclaim.

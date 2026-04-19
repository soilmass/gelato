---
name: a11y-mechanical-audit
description: >
  Audit a Next.js 15 App Router codebase against the mechanically
  detectable subset of WCAG 2.2 AA + WAI-ARIA APG + axe-core 4.10
  rules. Five violation classes: `<img>` without `alt`, form controls
  without an associated label / aria-label, elements with `onClick`
  that are neither native interactive (`button` / `a`) nor
  `role="button"` + `tabIndex={0}`, positive `tabIndex` values, and
  interactive elements that Tailwind classes place under the WCAG
  2.5.8 target-size minimum (44×44 CSS px).
  Use when: reviewing a PR that adds markup, landing-page a11y pass,
  component-library audit, "my form isn't keyboard-accessible",
  "screen reader skips this button", target-size QA.
  Do NOT use for: runtime a11y scans (→ axe-playwright), Radix
  primitive composition (→ radix-primitive-a11y), color-contrast
  audits beyond class-level patterns (needs rendered DOM), full
  WCAG AAA conformance, i18n + direction (→ i18n-routing when built).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: verify
  type: judgment
  methodology_source:
    - name: "WCAG 2.2 — Success Criteria (AA)"
      authority: "W3C / WAI"
      url: "https://www.w3.org/TR/WCAG22/"
      version: "W3C Recommendation 2023-10-05"
      verified: "2026-04-19"
    - name: "WAI-ARIA Authoring Practices 1.2"
      authority: "W3C / WAI"
      url: "https://www.w3.org/WAI/ARIA/apg/"
      version: "APG 1.2 (2023)"
      verified: "2026-04-19"
    - name: "axe-core rule catalog"
      authority: "Deque Systems"
      url: "https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md"
      version: "axe-core 4.10+"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "tailwindcss@4+"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T16:00:08.237Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Judgment skill. Five mechanical violation classes
    (img-no-alt, input-no-label, interactive-without-role,
    tabindex-positive, target-size-too-small) detected by a
    deterministic classifier over .tsx fixtures. Color-contrast,
    landmark roles, and heading order are explicitly out of scope;
    they need rendered-DOM introspection (axe-playwright handles
    that).
---

# a11y-mechanical-audit

Encodes the mechanically detectable subset of WCAG 2.2 AA + WAI-ARIA APG + axe-core's rule catalog for Next.js 15 + React 19 markup. Five rules a reviewer can verify from a single `.tsx` file without a running browser. Judgment skill — the procedure is the enforcement.

---

## Methodology Attribution

Three primary sources:

- **Primary:** WCAG 2.2 — Success Criteria (AA)
  - Source: [https://www.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/)
  - Authority: W3C / WAI
  - Version: W3C Recommendation 2023-10-05
  - Verified: 2026-04-19
- **Secondary:** WAI-ARIA Authoring Practices 1.2
  - Source: [https://www.w3.org/WAI/ARIA/apg/](https://www.w3.org/WAI/ARIA/apg/)
  - Version: APG 1.2 (2023)
  - Verified: 2026-04-19
- **Tertiary:** axe-core rule catalog
  - Source: [https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
  - Authority: Deque Systems
  - Version: axe-core 4.10+
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the five mechanical rules that map 1:1 to axe-core rule IDs and WCAG success criteria. NOT encoded: color-contrast (needs rendered DOM + design tokens), heading order (needs tree walk), landmark-region coverage (needs document-level view), reduced-motion (`prefers-reduced-motion` is a media query, not markup), keyboard-trap detection (runtime only), screen-reader announcement order (semantic, not syntactic). Those surfaces are the domain of `axe-playwright` (runtime) and `radix-primitive-a11y` (composition).

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `tailwindcss@4+` (class-string scans use Tailwind v4 names)
- `bun@1.1+`

If your stack is Pages Router or a non-Tailwind CSS framework, fork the suite — the target-size rule's regex depends on Tailwind class conventions.

---

## When to Use

Activate when any of the following is true:
- Adding or reviewing markup in `app/**/*.tsx` or `components/**/*.tsx`
- Pre-launch a11y pass on a new page or route
- A screen-reader test surfaces a missing label
- "Why is my button not reaching on keyboard Tab?"
- Landing-page audit for WCAG 2.2 AA target-size compliance

## When NOT to Use

Do NOT activate for:
- **Runtime a11y scans** — `axe-playwright` runs the full rule set against a live DOM
- **Radix primitive composition** — `radix-primitive-a11y` owns Dialog / Popover / Menu / Combobox wiring
- **Color-contrast audits** — class-level contrast requires design-token lookup; browser-rendered contrast is the truth. Out of scope
- **Heading-order / landmark-region audits** — document-level concerns, not single-file detectable
- **WCAG AAA conformance** — the skill targets AA; AAA is a separate, stricter pass
- **Non-Next.js or non-Tailwind stacks** — fork the suite

---

## Procedure

Judgment skills have no Hard Thresholds — the procedure is the enforcement.

### Step 1 — `<img>` must carry an `alt` attribute (WCAG 1.1.1; axe `image-alt`)

```tsx
// RIGHT — meaningful alt
<img src="/chart.png" alt="Pass-rate trend for Q1 2026" />

// RIGHT — decorative image, explicitly empty
<img src="/divider.svg" alt="" />

// WRONG — missing alt entirely
<img src="/chart.png" />
```

Rule: every `<img>` tag must have an `alt` attribute, literal or dynamic. `alt=""` is valid for purely decorative images (APG). Prefer `next/image` — `<img>` without `alt` flags regardless of source (the `next-image-font-script` skill owns the `<img>`-vs-`next/image` decision; this skill owns the `alt` presence).

### Step 2 — Form controls must have an accessible label (WCAG 1.3.1 + 3.3.2; axe `label`)

```tsx
// RIGHT — htmlFor association
<label htmlFor="email">Email</label>
<input id="email" name="email" type="email" />

// RIGHT — aria-label / aria-labelledby
<input name="search" aria-label="Search posts" />

// WRONG — no label at all
<input name="email" type="email" />

// WRONG — placeholder is not a label
<input name="email" type="email" placeholder="Email" />
```

Rule: every `<input>`, `<select>`, `<textarea>` (except `type="hidden"` and the auto-labelled `type="submit"` / `type="reset"` / `type="button"`) must have one of: an `id` referenced by a sibling `<label htmlFor>` in the same fixture, an `aria-label`, or an `aria-labelledby`.

### Step 3 — `onClick` on a non-interactive element requires `role` + `tabIndex={0}` + keyboard handler (WCAG 4.1.2; APG "Button" pattern)

```tsx
// RIGHT — native interactive element
<button onClick={handleClick}>Save</button>

// RIGHT — full keyboard pattern on a div
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
>
  Save
</div>

// WRONG — click without role, tabIndex, or keyboard handler
<div onClick={handleClick}>Save</div>
```

Rule: any native element tag other than `button`, `a`, `input`, `select`, `textarea`, `summary`, `details`, `label` carrying an `onClick` prop must have all three: `role="button"` (or a more specific interactive role), `tabIndex={0}`, and an `onKeyDown` / `onKeyUp` handler. Missing any of the three is a violation. Custom-tag components (`<Button>`) are not flagged — they're owned by the component library.

### Step 4 — No positive `tabIndex` (WCAG 2.4.3; axe `tabindex`)

```tsx
// RIGHT — default tab order
<button>A</button>

// RIGHT — programmatically focusable only
<div tabIndex={-1} ref={focusRef}>…</div>

// WRONG — positive tabIndex jumps out of document order
<button tabIndex={1}>A</button>
```

Rule: `tabIndex={n}` where `n > 0` is a violation. Positive tabIndex overrides document order and breaks assistive-tech expectations; `0` keeps an element in natural order; `-1` removes it from tab order while keeping it programmatically focusable. Those two are the only supported values.

### Step 5 — Interactive elements must meet WCAG 2.5.8 target size (44×44 CSS px)

```tsx
// RIGHT — Tailwind classes meeting the bar
<button className="min-h-11 min-w-11 px-4">Save</button>

// WRONG — tiny icon button
<button className="h-6 w-6"><XIcon /></button>
```

Rule: any native interactive tag (`button`, `a` with `href`, `input[type=submit|button|checkbox|radio]`, `select`, `summary`) or any element with `onClick` must carry Tailwind size tokens that resolve to ≥ 44px in both axes. Mechanical check: `className` must contain at least one of `h-11`/`h-12`/…/`h-96`, `min-h-11`/…/`min-h-96`, `size-11`/…/`size-96`, or `py-*` that adds up (heuristic), AND the same for width. WCAG 2.5.8 AA's hard minimum is 24×24 (≥`h-6`); the skill enforces the 44×44 mobile-first bar from Apple HIG + Material Design because the cost of larger targets on desktop is effectively zero.

---

## Tool Integration

The classifier-only invocation used today:

```bash
# v0.2 candidate — packaged CLI is scoped for a future release. Today
# the eval's classifier is the only consumer.
bun run a11y-audit app/ components/
```

**Minimum viable `app/layout.tsx` viewport meta** (required for responsive rendering; not enforced by the classifier):

```tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Do NOT set userScalable: false — violates WCAG 1.4.4.
};
```

---

## Examples

### Example 1 — `input-no-label`

**Input:**
```tsx
<form>
  <input name="email" type="email" placeholder="Email" />
  <button type="submit">Subscribe</button>
</form>
```

**Output:** The `<input>` has no accessible name — placeholder is not a label (WCAG 3.3.2). Fix: add `<label htmlFor="email">Email</label>` with a matching `id="email"` on the input, or wrap the input in `<label>` directly.

### Example 2 — `target-size-too-small`

**Input:**
```tsx
<button className="h-6 w-6" onClick={close}>
  <XIcon />
</button>
```

**Output:** Button is 24×24 CSS px (`h-6`/`w-6`). Fix: `className="h-11 w-11"` or `"min-h-11 min-w-11 p-3"`.

---

## Edge Cases

- **`alt` with dynamic expression:** `<img src={url} alt={caption} />` passes the presence check; the runtime value of `caption` is a concern for `axe-playwright`.
- **Visually hidden labels:** `<label className="sr-only">Search</label>` is valid — `sr-only` keeps the label in the accessibility tree.
- **Custom components rendering native elements:** `<Button onClick>` wraps a native `<button>` internally. The classifier does NOT flag custom-tagged `onClick` — under-detection is safer than false-positives for a judgment skill.
- **Form submit buttons:** `<button type="submit">Save</button>` and `<input type="submit" value="Save" />` are auto-labelled by their content / value. No separate label needed.
- **`next/link`:** treated like `<a>` by the classifier — no role prop required.

---

## Evaluation

See `/evals/a11y-mechanical-audit/` for the canonical eval suite.

### Pass criteria

**Quantitative:**
- Classifies ≥ 5 violation fixtures across 5 classes at ≥ 95% accuracy
- Zero false positives on ≥ 5 safe fixtures
- Held-out adversarial set (≥ 6 fixtures) at ≥ 90% accuracy

**Qualitative:**
- LLM-as-judge rubric `remediation-implementability` scores ≥ 0.85 (promptfoo)

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate` in the frontmatter above.

---

## Handoffs

This skill is scoped to **static mechanical a11y checks**. Explicitly NOT absorbed:

- Runtime violations (focus traps, aria-live misfires) → `axe-playwright`
- Radix primitive composition (Dialog missing Title) → `radix-primitive-a11y`
- Color-contrast + design-token-level checks → out of scope (v0.4 candidate `design-token-contrast`)
- Landmark regions + heading order + skip-links → out of scope (multi-file analysis)
- `<img>` → `next/image` migration → `next-image-font-script`

---

## Dependencies

- **External skills:** `radix-primitive-a11y` (composed widgets), `axe-playwright` (runtime half)
- **MCP servers:** none
- **Tools required in environment:** none (regex classifier is self-contained)

---

## References

- `references/wcag-22-aa-mechanical-subset.md` — mapping of the 5 rules to exact WCAG success criteria + axe-core rule IDs
- `references/target-size-rationale.md` — why 44×44, not 24×24

## Scripts

- _(none — classifier lives in `evals/a11y-mechanical-audit/eval.test.ts`)_

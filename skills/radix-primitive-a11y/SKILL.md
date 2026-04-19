---
name: radix-primitive-a11y
description: >
  Audit Radix UI primitive composition on Next.js 15 + React 19
  against the WAI-ARIA Authoring Practices patterns Radix encodes.
  Five violation classes: `Dialog.Content` without `Dialog.Title`
  descendant or `aria-labelledby`, `Dialog.Content` without
  `Dialog.Description` or `aria-describedby`, overlay triggers
  (Popover / DropdownMenu / Tooltip) wrapping a non-button element
  without `asChild`, `Combobox` / `Select` without a `<Label>`
  sibling or `aria-label`, and overlay content not wrapped in the
  primitive's `Portal` component.
  Use when: reviewing a PR that uses Radix primitives, adding a
  Dialog / Popover / DropdownMenu, a11y audit of a component
  library, "my modal is not announced", "my dropdown closes on
  scroll", "my combobox has no label".
  Do NOT use for: native HTML a11y (→ a11y-mechanical-audit),
  runtime a11y scans (→ axe-playwright), Radix styling / theming
  (→ shadcn-tailwind-v4), custom (non-Radix) headless components.
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: verify
  type: judgment
  methodology_source:
    - name: "Radix UI Primitives — Components"
      authority: "WorkOS (Radix UI)"
      url: "https://www.radix-ui.com/primitives/docs/components/"
      version: "Radix UI v1.x (2025)"
      verified: "2026-04-19"
    - name: "WAI-ARIA Authoring Practices 1.2"
      authority: "W3C / WAI"
      url: "https://www.w3.org/WAI/ARIA/apg/"
      version: "APG 1.2 (2023)"
      verified: "2026-04-19"
  stack_assumptions:
    - "next@15+ App Router"
    - "react@19+"
    - "@radix-ui/react-*@1.x"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T14:22:28.749Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Judgment skill. Five mechanical violation
    classes detected by a regex classifier over .tsx fixtures using
    the shared tsx-classifier helper. Scoped to Dialog, AlertDialog,
    Popover, DropdownMenu, Tooltip, HoverCard, Combobox, Select.
---

# radix-primitive-a11y

Encodes Radix UI's composition contract against the WAI-ARIA Authoring Practices patterns Radix itself cites. Radix exposes unstyled primitives; developers own the composition. The five most common a11y regressions in that composition are mechanically detectable from a single `.tsx` file.

---

## Methodology Attribution

Two primary sources:

- **Primary:** Radix UI Primitives — Components
  - Source: [https://www.radix-ui.com/primitives/docs/components/](https://www.radix-ui.com/primitives/docs/components/)
  - Authority: WorkOS (Radix UI)
  - Version: Radix UI v1.x (2025)
  - Verified: 2026-04-19
- **Secondary:** WAI-ARIA Authoring Practices 1.2
  - Source: [https://www.w3.org/WAI/ARIA/apg/](https://www.w3.org/WAI/ARIA/apg/)
  - Version: APG 1.2 (2023)
  - Verified: 2026-04-19
- **Drift-check:** _planned (v0.2 H7). Until the generic drift workflow lands, refresh the `verified` dates above when the upstream docs are re-read._

Encoded: the five mechanical composition rules that map directly to Radix component-level docs (Dialog Title/Description requirement; Trigger's `asChild` contract; Portal requirement on overlays; Combobox Label pairing). NOT encoded: focus-management behaviour (handled by Radix internally), keyboard interaction (handled by Radix internally), runtime announcement order (axe-playwright territory), styling / motion (shadcn-tailwind-v4 territory), custom (non-Radix) headless primitives.

---

## Stack Assumptions

- `next@15+` App Router
- `react@19+`
- `@radix-ui/react-*@1.x` (every `@radix-ui/react-<primitive>` package in use)
- `bun@1.1+`

If your stack uses Headless UI, Ark UI, or custom primitives, fork the suite — the scoped-name patterns differ.

---

## When to Use

Activate when any of the following is true:
- A PR introduces or modifies `<Dialog.*>`, `<AlertDialog.*>`, `<Popover.*>`, `<DropdownMenu.*>`, `<Tooltip.*>`, `<HoverCard.*>`, `<Combobox.*>`, or `<Select.*>` usage
- Adding a new modal / flyout / menu / autocomplete
- A screen-reader test reports "missing accessible name" on an overlay
- "My modal works but doesn't announce properly"
- Component-library a11y audit

## When NOT to Use

Do NOT activate for:
- **Native HTML a11y (img alt, input label, tabIndex)** — `a11y-mechanical-audit`
- **Runtime a11y scans (aria-live, focus traps, dynamic contrast)** — `axe-playwright`
- **Styling, theming, motion** — `shadcn-tailwind-v4`
- **Custom (non-Radix) headless primitives** — methodology doesn't apply; out of scope
- **Radix primitives that are not covered by the five classes** — `Toggle`, `Checkbox`, `Switch`, etc. handle their own a11y internally and don't have mechanical composition gotchas at the same level

---

## Procedure

Judgment skills have no Hard Thresholds — the procedure is the enforcement.

### Step 1 — `Dialog.Content` / `AlertDialog.Content` needs a `Dialog.Title` or `aria-labelledby`

Per Radix docs and APG "Dialog (Modal)" pattern, a dialog must have an accessible name.

```tsx
// RIGHT — Title descendant
<Dialog.Content>
  <Dialog.Title>Delete account</Dialog.Title>
  <Dialog.Description>This cannot be undone.</Dialog.Description>
  <form>...</form>
</Dialog.Content>

// RIGHT — aria-labelledby points at external heading
<Dialog.Content aria-labelledby="delete-heading">
  <h2 id="delete-heading">Delete account</h2>
  ...
</Dialog.Content>

// WRONG — no Title, no aria-labelledby
<Dialog.Content>
  <form>...</form>
</Dialog.Content>
```

Rule: any `Dialog.Content` or `AlertDialog.Content` open tag must be followed (before its balanced close) by a `Dialog.Title` / `AlertDialog.Title` descendant, OR carry an `aria-labelledby` attribute.

### Step 2 — `Dialog.Content` / `AlertDialog.Content` needs a `Dialog.Description` or `aria-describedby`

Radix docs require a description for assistive-tech users to understand the dialog's purpose beyond its title. If the dialog intentionally has none, explicitly pass `aria-describedby={undefined}` to acknowledge the choice.

```tsx
// RIGHT
<Dialog.Content>
  <Dialog.Title>Unsaved changes</Dialog.Title>
  <Dialog.Description>You have unsaved changes. Discard?</Dialog.Description>
  ...
</Dialog.Content>

// WRONG — no Description or aria-describedby
<Dialog.Content>
  <Dialog.Title>Unsaved changes</Dialog.Title>
  <button>Discard</button>
</Dialog.Content>
```

Rule: `Dialog.Content` / `AlertDialog.Content` open tags must contain a `Dialog.Description` / `AlertDialog.Description` descendant, OR carry `aria-describedby`.

### Step 3 — Overlay triggers wrapping a non-button need `asChild`

`Popover.Trigger`, `DropdownMenu.Trigger`, `Tooltip.Trigger`, `HoverCard.Trigger`, `AlertDialog.Trigger` render a native `<button>` by default. If you're wrapping a custom component (e.g. a shadcn `<Button>`), you must pass `asChild` so Radix merges the trigger behaviour into the child rather than nesting two buttons.

```tsx
// RIGHT — asChild merges trigger behaviour into <Button>
<Popover.Trigger asChild>
  <Button variant="ghost">Filter</Button>
</Popover.Trigger>

// RIGHT — no asChild needed because child is implicit native button
<Popover.Trigger>Filter</Popover.Trigger>

// WRONG — nested <button> (Radix renders one, Button renders another)
<Popover.Trigger>
  <Button>Filter</Button>
</Popover.Trigger>
```

Rule: `*.Trigger` open tag whose only JSX child is a PascalCase-tagged element (custom component) must carry an `asChild` attribute.

### Step 4 — `Combobox` / `Select` needs a `<Label>` sibling or `aria-label`

APG Combobox + Listbox patterns require an accessible name bound to the widget.

```tsx
// RIGHT — Label sibling
<Label htmlFor="country">Country</Label>
<Select.Root>
  <Select.Trigger id="country">...</Select.Trigger>
  <Select.Content>...</Select.Content>
</Select.Root>

// RIGHT — aria-label on Trigger
<Select.Root>
  <Select.Trigger aria-label="Country">...</Select.Trigger>
  ...
</Select.Root>

// WRONG — no label, no aria-label
<Select.Root>
  <Select.Trigger>...</Select.Trigger>
</Select.Root>
```

Rule: a fixture that imports `@radix-ui/react-select` or `@radix-ui/react-combobox` and contains `Select.Trigger` / `Combobox.Input` must have one of: an `aria-label` on that trigger, or a `<Label>` (with `htmlFor` pointing at the trigger's `id`) elsewhere in the same source.

### Step 5 — Overlay primitives need a `Portal`

`Dialog`, `AlertDialog`, `Popover`, `DropdownMenu`, `Tooltip`, `HoverCard` render content positioned outside the normal flow. Wrap content in the primitive's `Portal` subcomponent so it's not clipped by `overflow: hidden` ancestors.

```tsx
// RIGHT — Portal wraps Content
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>...</Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

// WRONG — Content outside Portal
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content>...</Dialog.Content>
</Dialog.Root>
```

Rule: any `Dialog.Content` / `AlertDialog.Content` / `Popover.Content` / `DropdownMenu.Content` / `Tooltip.Content` / `HoverCard.Content` must appear inside the matching `*.Portal` in the same source. The classifier checks for the `*.Portal` open tag between `*.Root` and the `*.Content`.

---

## Tool Integration

The classifier-only invocation used today:

```bash
# v0.2 candidate — packaged CLI is scoped for a future release.
bun run radix-a11y-audit app/ components/
```

## Examples

### Example 1 — `dialog-without-title`

**Input:**
```tsx
<Dialog.Root>
  <Dialog.Trigger>Settings</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Content>
      <form>...</form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**Output:** Dialog has no accessible name. Screen readers announce "dialog" with no further context. Fix: add `<Dialog.Title>Settings</Dialog.Title>` as the first child of `Dialog.Content`, or pass `aria-labelledby` pointing at an existing heading.

### Example 2 — `trigger-without-aschild-role`

**Input:**
```tsx
<Tooltip.Trigger>
  <Button variant="ghost"><InfoIcon /></Button>
</Tooltip.Trigger>
```

**Output:** Radix renders a native `<button>` around `<Button>`, producing nested interactive elements — invalid HTML, unpredictable focus. Fix: `<Tooltip.Trigger asChild><Button variant="ghost"><InfoIcon /></Button></Tooltip.Trigger>`.

---

## Edge Cases

- **`<VisuallyHidden>` Title:** Radix ships `@radix-ui/react-visually-hidden` so Dialogs with no visible title can still satisfy the Title requirement. `<VisuallyHidden><Dialog.Title>Filters</Dialog.Title></VisuallyHidden>` is detected the same as a visible Title (both are `Dialog.Title` descendants).
- **Slot-based triggers:** `Tooltip.Trigger asChild><div role="button">…</div></Tooltip.Trigger>` — the child is a native element with `role="button"`, which satisfies the rule; the classifier flags only PascalCase-tagged custom children without `asChild`.
- **Dialog in Server Component:** Radix primitives require `'use client'`; the classifier doesn't enforce that here (it's a React rule, not Radix-specific). `rsc-boundary-audit` catches it.
- **Nested dialogs:** each `Dialog.Content` is evaluated independently. A nested dialog without its own Title is flagged even if the parent has one.
- **`aria-describedby={undefined}`:** the intentional opt-out — classifier accepts it as satisfying Step 2.
- **Non-Radix components with similar tag names:** a component named `Dialog.Root` that isn't from `@radix-ui/react-dialog` will be incorrectly flagged. The classifier under-detects: it only activates when a Radix import is present (`from '@radix-ui/react-<primitive>'`).

---

## Evaluation

See `/evals/radix-primitive-a11y/` for the canonical eval suite.

### Pass criteria

**Quantitative:**
- Classifies ≥ 5 violation fixtures across 5 classes at ≥ 95% accuracy
- Zero false positives on ≥ 5 safe fixtures
- Held-out adversarial set (≥ 6 fixtures) at ≥ 90% accuracy

**Qualitative:**
- LLM-as-judge rubric `composition-remediation` scores ≥ 0.85

### Current pass rate

Auto-updated by `bun run eval`. See `metadata.eval.pass_rate` in the frontmatter above.

---

## Handoffs

Scoped to **Radix primitive composition**. Explicitly NOT absorbed:

- Native HTML a11y → `a11y-mechanical-audit`
- Runtime a11y scans → `axe-playwright`
- Styling / motion on Radix primitives → `shadcn-tailwind-v4`
- Custom (non-Radix) headless primitives → out of scope

---

## Dependencies

- **External skills:** `a11y-mechanical-audit`, `axe-playwright`
- **MCP servers:** none
- **Tools required in environment:** `@radix-ui/react-*@1.x` in the audited project

---

## References

- `references/radix-patterns.md` — Radix primitive → APG pattern mapping + required sub-components

## Scripts

- _(none — classifier lives in `evals/radix-primitive-a11y/eval.test.ts`)_

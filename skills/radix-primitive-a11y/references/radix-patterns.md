# Radix primitives → APG pattern mapping

For each Radix primitive the skill audits, this is the WAI-ARIA Authoring Practices pattern it implements, the required sub-components, and which of the skill's five rules apply.

## Dialog / AlertDialog

- **APG pattern:** Dialog (Modal) — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **Radix docs:** https://www.radix-ui.com/primitives/docs/components/dialog
- **Required sub-components:** `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Title`, `Description`, `Close`
- **Rules applied:** `dialog-without-title`, `dialog-content-without-description`, `portal-missing-for-overlay`

AlertDialog is the same shape with different keyboard semantics (Escape closes; Esc-key only; requires an explicit Action or Cancel). Both primitives use `Title` + `Description` identically.

## Popover

- **APG pattern:** Disclosure (non-modal popover) — https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- **Radix docs:** https://www.radix-ui.com/primitives/docs/components/popover
- **Required sub-components:** `Root`, `Trigger`, `Portal`, `Content`, `Close`, `Anchor`, `Arrow`
- **Rules applied:** `trigger-without-aschild-role`, `portal-missing-for-overlay`

No Title/Description rule — Popover content is arbitrary and doesn't have an enforced naming contract per APG.

## DropdownMenu

- **APG pattern:** Menu Button — https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
- **Radix docs:** https://www.radix-ui.com/primitives/docs/components/dropdown-menu
- **Required sub-components:** `Root`, `Trigger`, `Portal`, `Content`, `Item`, `Sub`, `Separator`, `Label`, `Group`, `RadioGroup`, `RadioItem`, `CheckboxItem`
- **Rules applied:** `trigger-without-aschild-role`, `portal-missing-for-overlay`

## Tooltip

- **APG pattern:** Tooltip — https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- **Radix docs:** https://www.radix-ui.com/primitives/docs/components/tooltip
- **Required sub-components:** `Provider`, `Root`, `Trigger`, `Portal`, `Content`
- **Rules applied:** `trigger-without-aschild-role`, `portal-missing-for-overlay`

Notable APG constraint: tooltips must not contain interactive content. The skill does NOT enforce this (it needs descendant-interactivity analysis); it's a human-review concern at code review.

## HoverCard

- **APG pattern:** no direct APG match; Radix documents as a "rich-content preview on hover". Nearest pattern: Disclosure.
- **Radix docs:** https://www.radix-ui.com/primitives/docs/components/hover-card
- **Required sub-components:** `Root`, `Trigger`, `Portal`, `Content`
- **Rules applied:** `trigger-without-aschild-role`, `portal-missing-for-overlay`

## Select

- **APG pattern:** Listbox — https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
- **Radix docs:** https://www.radix-ui.com/primitives/docs/components/select
- **Required sub-components:** `Root`, `Trigger`, `Value`, `Icon`, `Portal`, `Content`, `Viewport`, `Item`, `ItemText`, `ItemIndicator`, `Group`, `Label`, `Separator`
- **Rules applied:** `combobox-without-label`, `portal-missing-for-overlay`

## Combobox (third-party — e.g. `cmdk`)

`cmdk` and other combobox libraries are not Radix primitives proper, but `@radix-ui/react-dropdown-menu` is often used as the combobox's popover surface. The `combobox-without-label` rule applies to any `Combobox.Input` import regardless of vendor — the APG Combobox pattern requires a label binding independent of the underlying primitive.

## Primitives NOT in scope

Radix ships many primitives the skill does not enforce composition rules for:

- `Accordion`, `Collapsible`, `Tabs` — no composition-level a11y violations that aren't caught by Radix's own prop types
- `Checkbox`, `Switch`, `RadioGroup`, `Toggle` — single-widget primitives; a11y is self-contained
- `ScrollArea`, `Slider`, `Progress`, `Avatar` — no overlay or composition surface to audit
- `Form`, `NavigationMenu`, `Toolbar`, `Menubar` — broader composition patterns, candidate for a v0.4 `radix-navigation-a11y` skill

## Required imports the classifier looks for

The classifier activates a rule only when the corresponding `@radix-ui/react-*` package import is present in the source:

| Rule | Required import prefix |
|---|---|
| `dialog-without-title`, `dialog-content-without-description` | `@radix-ui/react-dialog` or `@radix-ui/react-alert-dialog` |
| `trigger-without-aschild-role` | `@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-hover-card`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-dialog` |
| `combobox-without-label` | `@radix-ui/react-select` or `@radix-ui/react-combobox` |
| `portal-missing-for-overlay` | any of the overlay primitives above |

This import-gated approach keeps false-positive rate low in fixtures that use similarly-named custom components (e.g., a project-local `Dialog` wrapper).

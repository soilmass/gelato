# form-with-server-action eval

Proves the four React-19 form-with-Server-Action tenets are mechanically enforceable against client form components.

## What the eval measures

Deterministic classifier — signal-based heuristics over the fixture text. Four detection steps (each short-circuits):

1. **action-not-bound-to-form** — `'use client'` + imports a Server Action module + no `action={}` attribute anywhere + has `onSubmit=` or `onClick=` handler. The action isn't bound via the form binding.
2. **controlled-inputs-with-action** — form has `action={…}` AND at least one input with `value={…}` (or `checked={…}`) paired with `onChange={…}`. Breaks progressive enhancement.
3. **missing-pending-state** — client form with `action={…}` + a `<button>`, but no `disabled={…}` and no `useFormStatus()`. Button never disables on submit.
4. **errors-not-rendered** — `useActionState(…)` present AND state shape declares `errors:` / `errors?:`, but no JSX reads `state.errors` or destructured `errors.<field>`.

Four assertions:

| Assertion | Threshold |
|---|---|
| 12 violations × 4 classes | ≥ 95% |
| 5 safe fixtures | 0 false positives |
| 6 held-out adversarial | ≥ 90% |
| Inventory matches SKILL.md | ✓ |

## Held-out set

- 01 `isSaving` renamed pending alias (classifier must match `disabled={<any-expr>}`)
- 02 errors destructured from state at the top (`const { errors } = state; …{errors?.title?.length}`)
- 03 `startTransition(formAction)` as an imperative trigger, but the form still binds via `action={formAction}` — safe
- 04 controlled radio selector — violation (classifier doesn't read intent; a controlled input is a controlled input)
- 05 bare server-component form (no `'use client'`, no hooks — zero-JS form is safe)
- 06 `onSubmit=` fires analytics only; `action={formAction}` still binds — safe

## Running

```bash
bun run eval form-with-server-action
```

~70 ms. No env, no Chromium, no API keys.

## Why these four, not more

See `skills/form-with-server-action/references/violation-classes.md` § "Why exactly four". Each violates one of the four progressive-enhancement tenets. A fifth (e.g. "form resets state on success" UX concern) drifts into micro-interaction territory that belongs in a v0.2 UX rubric skill.

---
name: form-with-server-action
description: >
  Wire a React 19 form to a Next.js Server Action with four tenets:
  the action binds via the form's `action={}` attribute, inputs are
  uncontrolled (`defaultValue`, not `value`+`onChange`), pending state
  is surfaced via `useActionState` or `useFormStatus`, and returned
  error shapes are rendered inline. Flags four violations: controlled
  inputs on a Server-Action form, missing pending state, swallowed
  errors, and action called outside the form binding.
  Use when: writing a React form that submits to a Server Action,
  adding validation error display, showing a submit-pending spinner,
  migrating a route-handler form submission to a Server Action,
  reviewing a form component that imports a Server Action, "my form
  double-submits", "errors don't show up in my form".
  Do NOT use for: choosing between a Server Action and a route handler
  (→ server-actions-vs-api), input validation with Zod (→
  zod-validation), authentication (→ auth-flow-review), general
  component styling (→ shadcn-tailwind-v4 when built).
license: MIT
metadata:
  version: "1.0"
  core: web-dev
  subsystem: ui
  phase: build
  type: procedural
  methodology_source:
    - name: "React — Form Actions (React 19)"
      authority: "React core team"
      url: "https://react.dev/reference/react-dom/components/form"
      version: "React 19 (stable)"
      verified: "2026-04-18"
    - name: "Next.js — Forms and useActionState"
      authority: "Vercel / Next.js team"
      url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#forms"
      version: "Next.js 15 docs (2025)"
      verified: "2026-04-18"
  stack_assumptions:
    - "react@19+"
    - "next@15+ App Router"
    - "bun@1.1+"
  eval:
    pass_rate: 1
    last_run: "2026-04-19T11:54:25.215Z"
    n_cases: 4
  changelog: >
    v1.0 — initial. Four tenets (action-binding, uncontrolled inputs,
    pending state, error rendering) encoded as four violation classes
    detected by a deterministic classifier over React form fixtures.
---

# form-with-server-action

Encodes the React 19 + Next.js 15 form-with-Server-Action idiom. Uncontrolled inputs bound to the form via `action={dispatch}`, pending state surfaced by `useActionState` or `useFormStatus`, errors returned as structured state and rendered inline. The design center: a form that works without JavaScript and upgrades when JavaScript arrives.

---

## Methodology Attribution

Two primary sources:

- **Primary:** React — `<form>` with Actions
  - Source: [https://react.dev/reference/react-dom/components/form](https://react.dev/reference/react-dom/components/form)
  - Version: React 19 stable
  - Verified: 2026-04-18
- **Secondary:** Next.js — Forms + `useActionState` pattern
  - Source: [https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#forms](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#forms)
  - Version: Next.js 15 docs (2025)
  - Verified: 2026-04-18
- **Drift-check:** `.github/workflows/drift-react-forms.yml`

Encoded: the four-tenet pattern for a React form calling a Server Action (action attribute binding, uncontrolled inputs, pending state, error rendering). NOT encoded: input validation rules (`zod-validation`), server-side business logic (belongs in the action itself), authentication before the action runs (`auth-flow-review`), styling and layout (`shadcn-tailwind-v4` when built).

---

## Stack Assumptions

- `react@19+` (required for `useActionState`, `useFormStatus`, and the `action` prop on `<form>`)
- `next@15+` App Router
- `bun@1.1+`

If your stack is on React 18 or older Next, fork the suite — the hooks and prop don't exist.

---

## When to Use

Activate when any of the following is true:
- Writing a React form that submits to a Server Action
- Adding validation error display to a form
- Showing a submit-pending spinner / disabling the button during submit
- Migrating a route-handler form submission to a Server Action
- Reviewing a form component that imports a Server Action
- "My form double-submits when I click fast"
- "Errors from my action don't show in the form"

## When NOT to Use

Do NOT activate for:
- **Choosing between a Server Action and a route handler** — `server-actions-vs-api`.
- **Schema validation inside the action** — `zod-validation`.
- **Authentication / session checks** — `auth-flow-review`.
- **Component styling / shadcn UI composition** — `shadcn-tailwind-v4` (when built).
- **File-upload UX specifics** — v0.2+ candidate `file-upload-ux` skill.

---

## Procedure

Write the form in this order. Each tenet has a default — deviate only with a named reason.

### Step 1 — Bind the Server Action via the `action` attribute

```tsx
'use client';
import { useActionState } from 'react';
import { createPost } from './actions';

const initialState = { ok: false as const, errors: {} as Record<string, string[]> };

export function CreatePostForm() {
  const [state, formAction, pending] = useActionState(createPost, initialState);
  return (
    <form action={formAction}>
      {/* inputs */}
    </form>
  );
}
```

`action={formAction}` is the binding. It gives you: FormData assembly for free, progressive enhancement (the form POSTs natively without JS), and type-safe state threading. **Do not** call the action from `onClick` or `onSubmit` — that bypasses the binding.

### Step 2 — Keep inputs uncontrolled

```tsx
<input name="title" defaultValue={state.input?.title} required />
<textarea name="body" defaultValue={state.input?.body} required />
```

Use `defaultValue`, not `value` + `onChange`. React 19 forms are designed to read from `FormData` — controlling inputs with `useState` forces a client-only form, breaks progressive enhancement, and causes a re-render per keystroke.

The exceptions: inputs that genuinely need controlled behavior for UX reasons (autocomplete suggestions, input masking, real-time validation preview). For those inputs, document the reason in a comment and keep the rest of the form uncontrolled.

### Step 3 — Surface pending state

Two options:

**Option A — `useActionState` pending flag** (within the same component):

```tsx
<button type="submit" disabled={pending}>
  {pending ? 'Saving…' : 'Save'}
</button>
```

**Option B — `useFormStatus()` in a child component** (when the submit button is nested):

```tsx
'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving…' : children}
    </button>
  );
}
```

Either is correct. Missing the pending state is the violation — users double-click and submit twice.

### Step 4 — Render returned errors inline

The Server Action returns a discriminated union. On the failure branch, the form surfaces per-field messages:

```tsx
{state.errors?.title?.length ? (
  <p role="alert" className="text-red-600">
    {state.errors.title.join(', ')}
  </p>
) : null}
```

A form that swallows errors (action returns `{ ok: false, errors }` but the JSX never reads `state.errors`) is broken — validation failures become invisible.

### Step 5 — Do not call the action outside the binding

```tsx
// WRONG — defeats the binding
<button onClick={() => createPost(formData)}>Save</button>

// WRONG — manual fetch to an action URL
<form onSubmit={async (e) => {
  e.preventDefault();
  await fetch('/actions/createPost', { method: 'POST', body: new FormData(e.currentTarget) });
}}>

// RIGHT
<form action={formAction}>
  <button type="submit">Save</button>
</form>
```

If you need to call the action imperatively (rare — e.g., a menu item that triggers a mutation), use `startTransition(() => formAction(formData))` with the `formAction` returned from `useActionState`, not a raw `fetch`.

---

## Tool Integration

**Canonical form with all four tenets:**

```tsx
'use client';
import { useActionState } from 'react';
import { createPost, type CreatePostState } from './actions';

const initialState: CreatePostState = { ok: false, errors: {} };

export function CreatePostForm() {
  const [state, formAction, pending] = useActionState(createPost, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={state.input?.title} required />
        {state.errors?.title?.length ? (
          <p role="alert" className="text-red-600">{state.errors.title.join(', ')}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="body">Body</label>
        <textarea id="body" name="body" defaultValue={state.input?.body} required />
        {state.errors?.body?.length ? (
          <p role="alert" className="text-red-600">{state.errors.body.join(', ')}</p>
        ) : null}
      </div>

      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
```

**Canonical paired Server Action:**

```ts
'use server';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { db, posts } from '@/lib/db';

const CreatePostSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
});

export type CreatePostState =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]>; input?: { title?: string; body?: string } };

export async function createPost(_prev: CreatePostState, formData: FormData): Promise<CreatePostState> {
  const raw = Object.fromEntries(formData);
  const result = CreatePostSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.flatten().fieldErrors,
      input: { title: String(raw.title ?? ''), body: String(raw.body ?? '') },
    };
  }
  await db.insert(posts).values(result.data);
  revalidateTag('posts');
  return { ok: true };
}
```

---

## Examples

### Example 1 — Controlled inputs (`controlled-inputs-with-action`)

**Input:** form has `action={formAction}` but every `<input>` uses `value={title}` + `onChange={e => setTitle(e.target.value)}`.

**Output:** controlled inputs on a Server-Action form break progressive enhancement — if JS fails to load, the inputs are empty and the form POSTs nothing useful. Also wasteful: every keystroke re-renders the form. Switch to `defaultValue={state.input?.title}` and read from `FormData` in the action.

### Example 2 — Missing pending state (`missing-pending-state`)

**Input:** `<button type="submit">Save</button>` — no disabled state, no pending text.

**Output:** the user double-clicks and submits twice. Wire `useActionState` (or `useFormStatus` in a child `<SubmitButton>`) and set `disabled={pending}`. The form will show a live spinner and prevent duplicate submits.

### Example 3 — Swallowed errors (`errors-not-rendered`)

**Input:** action returns `{ ok: false, errors: { title: ['required'] } }` but the form's JSX has no references to `state.errors`.

**Output:** validation fails silently — the user sees nothing. Render per-field errors: `{state.errors?.title?.length ? <p role="alert">…</p> : null}`.

### Example 4 — Action called outside the binding (`action-not-bound-to-form`)

**Input:** form has `onSubmit={async (e) => { e.preventDefault(); await createPost(new FormData(e.currentTarget)); }}` and no `action={}` attribute.

**Output:** this bypasses the binding. Progressive enhancement is dead (form does nothing without JS), error/pending state threading doesn't work, and you're manually rebuilding what `useActionState` provides. Move the action to `action={formAction}` via `useActionState`.

---

## Edge Cases

- **Multi-step forms** — each step is its own form bound to its own action. Share state between steps via URL params or the server (not React state).
- **Optimistic updates** — React 19's `useOptimistic` pairs with `useActionState`. Not a violation of any of the four tenets on its own, but the canonical form still uses `action={formAction}` at the binding.
- **Forms with file uploads** — `action={formAction}` binds as a multipart submission. `FormData` carries the files — still uncontrolled.
- **Formatted inputs (dates, phone numbers)** — if a library requires controlled values (e.g., a masked-input component), control that one field but keep the rest uncontrolled. Document the exception inline.
- **Non-form actions (delete buttons, toggles)** — still wire via `<form action={formAction}>` with a single submit button; or use `startTransition(formAction)` from an imperative handler when there's genuinely no form semantic.

---

## Evaluation

See `/evals/form-with-server-action/`.

### Pass criteria

**Quantitative (deterministic classifier):**
- ≥ 95% of violation fixtures classified across 4 classes
- Zero false positives on 5 safe fixtures
- Held-out ≥ 90%

No LLM-as-judge half for v0.1. A v0.2 `a11y-rubric` would judge whether the rendered error JSX carries `role="alert"` / `aria-describedby` appropriately.

---

## Handoffs

- **Tool choice (action vs. route handler)** → `server-actions-vs-api`
- **Schema validation** → `zod-validation`
- **Authentication** → `auth-flow-review`
- **Styling / form UI components** → `shadcn-tailwind-v4` (when built)

---

## Dependencies

- **External skills:** none
- **MCP servers:** none
- **Tools required in environment:** Bun, Next.js 15+, React 19+

---

## References

- `references/four-tenets.md` — one-page cheat-sheet for the four-tenet pattern
- `references/violation-classes.md` — four-class taxonomy with canonical examples

## Scripts

- _(none in v0.1 — eval ships the classifier; a CLI codemod for the controlled-inputs → uncontrolled migration is a v0.2 candidate)_

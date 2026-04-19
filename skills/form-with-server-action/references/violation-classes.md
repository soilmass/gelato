# Four violation classes

A fixture that triggers none is `safe`.

## 1. `controlled-inputs-with-action`

Form has `action={formAction}` wiring but inputs are controlled via `useState` + `value` + `onChange`.

**Signal:** `<form action={` AND at least one `<input ... value={` paired with `onChange={` AND a matching `useState` call.

**Canonical example:**

```tsx
'use client';
import { useState } from 'react';
import { useActionState } from 'react';
import { createPost } from './actions';

export function Form() {
  const [title, setTitle] = useState('');
  const [state, formAction, pending] = useActionState(createPost, { ok: false });

  return (
    <form action={formAction}>
      <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit" disabled={pending}>Save</button>
    </form>
  );
}
```

**Remediation:** swap to `defaultValue={state.input?.title}`. Drop the `useState` and `onChange`.

## 2. `missing-pending-state`

Form binds to a Server Action but the submit button has no `disabled={pending}` and the component uses no `useActionState` pending flag or `useFormStatus()` elsewhere.

**Signal:** `<form action={` present AND submit button present AND no `disabled={pending}` / `disabled={isPending}` / `useFormStatus(` anywhere in the file.

**Canonical example:**

```tsx
'use client';
import { useActionState } from 'react';
import { createPost } from './actions';

export function Form() {
  const [state, formAction] = useActionState(createPost, { ok: false });
  return (
    <form action={formAction}>
      <input name="title" defaultValue="" />
      <button type="submit">Save</button>
    </form>
  );
}
```

**Remediation:** destructure the pending tuple, disable the button: `const [state, formAction, pending] = ...; <button disabled={pending}>`.

## 3. `errors-not-rendered`

The action's return shape includes an `errors` field, but the form's JSX never reads it.

**Signal:** `useActionState(` present, `state.errors` / `state?.errors` never referenced in the component body (no JSX render of errors).

**Canonical example:**

```tsx
'use client';
import { useActionState } from 'react';
import { createPost } from './actions';

export function Form() {
  const [state, formAction, pending] = useActionState(createPost, { ok: false, errors: {} });
  return (
    <form action={formAction}>
      <input name="title" defaultValue="" />
      <button type="submit" disabled={pending}>Save</button>
    </form>
  );
}
```

**Remediation:** render `{state.errors?.title?.length ? <p role="alert">…</p> : null}` adjacent to each input.

## 4. `action-not-bound-to-form`

The Server Action is invoked imperatively — via `onSubmit` + `fetch`, or `onClick={() => action(...)}` — instead of via the form's `action={}` attribute.

**Signal:** the file imports a Server Action AND the form has `onSubmit=` or a button with `onClick={` that calls the imported action, AND the form does NOT have `action={`.

**Canonical example:**

```tsx
'use client';
import { createPost } from './actions';

export function Form() {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        await createPost(formData);
      }}
    >
      <input name="title" defaultValue="" />
      <button type="submit">Save</button>
    </form>
  );
}
```

**Remediation:** replace the `onSubmit` handler with `action={createPost}` (or `action={formAction}` from `useActionState`).

## Why exactly four

These are the four departures from the idiomatic React 19 + Next 15 form pattern that break observable behavior: progressive enhancement (tenet 2 + 4), double-submission (tenet 3), silent-failure UX (tenet 4, via error rendering). Each is mechanically detectable from the JSX + hook usage in a single file.

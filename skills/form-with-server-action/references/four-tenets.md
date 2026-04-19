# Four-tenet cheat-sheet

A React 19 form calling a Next.js Server Action is correct iff all four are true:

## 1. Action bound via `action={formAction}`

```tsx
const [state, formAction, pending] = useActionState(action, initial);
return <form action={formAction}>...</form>;
```

Never `onSubmit={handler}` that calls `fetch()` or the action imperatively — that defeats the binding.

## 2. Inputs uncontrolled

```tsx
<input name="title" defaultValue={state.input?.title} />   {/* right */}
<input name="title" value={title} onChange={...} />         {/* wrong */}
```

FormData reads by `name`. `defaultValue` is a seed for the current render. Controlled inputs force client-only forms and re-render on every keystroke.

## 3. Pending state surfaced

```tsx
<button disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
```

Either `useActionState`'s third tuple element, or `useFormStatus().pending` inside a child component. A submit button with no pending state double-submits.

## 4. Errors rendered

```tsx
{state.errors?.title?.length ? (
  <p role="alert">{state.errors.title.join(', ')}</p>
) : null}
```

Action returns `{ ok: false, errors }` — the form reads `state.errors.<field>` and renders it. Otherwise validation fails silently.

## The tenets' unifying principle

Progressive enhancement. A form with uncontrolled inputs, action binding, and server-returned state can submit and display errors even before client JS loads. React upgrades the same markup into a reactive experience without changing the submission semantics.

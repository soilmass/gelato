# `useOptimistic` contract — React 19

Reference summary of what React 19's `useOptimistic` guarantees, the four invariants the skill enforces, and the wiring pattern the docs recommend.

## API signature

```ts
const [optimisticState, addOptimistic] = useOptimistic<State, Action>(
  baseState: State,
  reducer: (currentState: State, optimisticValue: Action) => State,
);
```

- `baseState` is the "real" state you want to layer optimistic updates on top of.
- `reducer` is called synchronously during render with the current state and any queued optimistic values. **Must be pure.**
- `addOptimistic(value)` queues an optimistic update. **Must be called inside a transition or a form action.**

## The four invariants

| Invariant | What the React docs say |
|---|---|
| Transition-or-action wiring | "`addOptimistic` must be called inside a transition or action." (useOptimistic reference) |
| Pure reducer | "The update function must be a pure function that takes the current state and the optimistic value..." |
| No mutation | "...and returns the resulting optimistic state." (New return value, not a mutation of state.) |
| Revert-on-resolution semantics | React discards the optimistic queue when the enclosing transition/action resolves; the reducer must not rely on side effects for correctness. |

The skill enforces the first three invariants statically; the fourth (revert-on-resolution) is an emergent property of the first three — if the first three hold, the fourth holds too.

## Canonical shape: Server-Action form

```tsx
'use client';
import { useOptimistic } from 'react';

export function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo],
  );

  return (
    <form
      action={async (formData) => {
        const newTodo = { id: crypto.randomUUID(), text: String(formData.get('text')) };
        addOptimistic(newTodo);
        await createTodoAction(formData);
      }}
    >
      <input name="text" />
      <button type="submit">Add</button>
      <ul>
        {optimisticTodos.map((t) => (
          <li key={t.id}>{t.text}</li>
        ))}
      </ul>
    </form>
  );
}
```

- The form's `action={...}` callback is a transition automatically. `addOptimistic` inside satisfies Step 1 of the skill.
- The inline reducer `(state, newTodo) => [...state, newTodo]` is pure and returns a new array — satisfies Steps 3 and 4.

## Canonical shape: `useTransition` wrapper

When the mutation isn't a form submission (e.g. a click handler on a button that mutates a list), the caller wraps the optimistic update in `startTransition`:

```tsx
'use client';
import { useOptimistic, useTransition } from 'react';

export function LikeButton({ post }: { post: Post }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticPost, addOptimistic] = useOptimistic(
    post,
    (state, liked: boolean) => ({ ...state, likes: state.likes + (liked ? 1 : -1) }),
  );

  function handleLike(liked: boolean) {
    startTransition(async () => {
      addOptimistic(liked);
      await toggleLike(post.id, liked);
    });
  }

  return (
    <button onClick={() => handleLike(!optimisticPost.likedByMe)} disabled={isPending}>
      ♥ {optimisticPost.likes}
    </button>
  );
}
```

- `startTransition` wraps the `addOptimistic` + `await toggleLike`. Satisfies Step 1.
- The reducer spreads `state` and returns a new object. Satisfies Step 4.

## Common anti-patterns

### Calling `addOptimistic` in a bare onClick

```tsx
// WRONG
<button onClick={() => { addOptimistic(item); doMutation(); }}>Add</button>
```

Runtime: React warns. The optimistic state may not render consistently before the real state resolves.

### Fetch inside the reducer

```tsx
// WRONG
useOptimistic(todos, async (state, value) => {
  const enriched = await enrich(value);
  return [...state, enriched];
});
```

Reducer runs during render. Fetching inside it breaks React's purity contract and causes infinite loops. Move the enrichment to the caller:

```tsx
// RIGHT
async function onSubmit(raw: Raw) {
  const enriched = await enrich(raw);
  startTransition(async () => {
    addOptimistic(enriched);
    await save(enriched);
  });
}
```

### Direct mutation

```tsx
// WRONG
useOptimistic(todos, (state, value) => {
  state.push(value);
  return state;
});
```

React compares by reference; returning the same array makes the optimistic update invisible. Use spread / concat / map / filter.

## What the skill doesn't enforce

- Whether the optimistic state LOOKS right (design concern)
- Whether the mutation is idempotent (correctness concern)
- Whether `isPending` from the transition is wired to a loading state (UX concern)
- Whether error states are surfaced after the server rejects the mutation (product concern)

Those concerns belong in human review or in follow-up UX audits. The skill ensures the wiring is correct; the rest is up to you.

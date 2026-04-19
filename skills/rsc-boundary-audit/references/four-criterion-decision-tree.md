# Four-criterion decision tree for `'use client'`

Copy-paste reference for Step 2 of the `rsc-boundary-audit` procedure. A component requires `'use client'` **if and only if** at least one criterion applies.

## The four criteria

1. **Interactivity.** Handles user events directly on DOM elements:
   - Pointer: `onClick`, `onMouseDown`, `onPointerMove`, drag handlers.
   - Keyboard: `onKeyDown`, `onKeyUp`, `onKeyPress`.
   - Form (with client state, not a Server Action): `onSubmit`, `onChange`, `onInput`, `onFocus`, `onBlur`.

2. **Browser APIs.** References any global that does not exist during server rendering:
   - `window`, `document`, `navigator`, `localStorage`, `sessionStorage`.
   - `IntersectionObserver`, `ResizeObserver`, `matchMedia`, `MutationObserver`.
   - `DOMParser`, `Blob`, `File`, `FileReader`.
   - Any library whose source references these unconditionally at import time.

3. **Client-only React hooks.**
   - Always client: `useState`, `useEffect`, `useLayoutEffect`, `useReducer`, `useRef`, `useSyncExternalStore`, `useTransition`, `useDeferredValue`, `useImperativeHandle`.
   - Conditionally client — flag when depending on client-side state: `useMemo`, `useCallback`.

4. **Client-only context consumption.** Calls `useContext(SomeContext)` where `SomeContext` is defined in, and its Provider lives in, a client component. Common providers that force this: theme stores (`next-themes`), auth session (`next-auth/react`), motion libraries (framer-motion's `MotionConfig`), form libraries (`react-hook-form`'s `FormProvider`).

## Negative cases

- **Child of a client component** — the subtree already runs in the client context. The child does not need its own `'use client'`; the directive marks the boundary, not the tree.
- **Server Action passed as a prop** — `<Form action={serverAction} />` is not interactivity; Server Actions are specially tagged and legal to cross the boundary.
- **Static use of a client-only library's types** — `import type { Something } from 'framer-motion'` imports only the type; not a boundary concern.

## Decision function (pseudocode)

```
needsUseClient(component):
  if any DOM event handler referenced: return true
  if any browser global referenced:     return true
  if any always-client hook called:     return true
  if any conditionally-client hook with client state: return true
  if any Context consumed whose Provider is in a client tree: return true
  return false
```

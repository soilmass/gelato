# Next.js error file conventions (App Router v15)

| File name | Scope | Client-side required | Expected default-export props |
|---|---|---|---|
| `error.tsx` | Segment-local errors (per route segment) | **Yes** — must declare `'use client'` | `{ error: Error & { digest?: string }, reset: () => void }` |
| `global-error.tsx` | Root-level errors that the layout can't catch | **Yes** — must declare `'use client'` and wrap JSX in `<html>` + `<body>` | `{ error: Error & { digest?: string }, reset: () => void }` |
| `not-found.tsx` | 404 rendering when `notFound()` is called | No — Server Component by default | `()` — no props |
| `forbidden.tsx` (Next 15.1+) | 403 rendering when `forbidden()` is called | No — Server Component by default | `()` — no props |
| `unauthorized.tsx` (Next 15.1+) | 401 rendering when `unauthorized()` is called | No — Server Component by default | `()` — no props |

## What error.tsx actually is

An `error.tsx` is bound at build time into a React error boundary placed around the segment's `page.tsx`. Next.js constructs the boundary roughly as:

```tsx
<ErrorBoundary fallback={<ErrorComponent error={err} reset={softReset} />}>
  <Page />
</ErrorBoundary>
```

Because the boundary must run client-side (React's error-boundary contract requires it), the file must opt into Client Component mode — hence the `'use client'` requirement.

The `reset` prop is bound to a soft re-render: Next re-renders the segment tree from the nearest boundary. Without accepting `reset`, a `<button onClick={reset}>Try again</button>` is simply not wireable; the user has no recovery path.

## Why global-error.tsx needs `<html>` and `<body>`

Most error files sit inside the existing layout tree — the error UI replaces the segment only. `global-error.tsx` is the special case: it replaces the **root layout** including the outermost `<html>` / `<body>`. If the file doesn't render those tags, the resulting document is malformed and the browser falls back to its own ugly error page.

The Next.js docs explicitly show the `<html>` / `<body>` wrap in the canonical example:

```tsx
'use client';
export default function GlobalError({ error, reset }: { … }) {
  return (
    <html lang="en">
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

## Class-based `ErrorBoundary` component (React-level contract)

Next.js's file conventions are React error boundaries under the hood. Any custom class-based boundary you write must follow React's contract:

- **`getDerivedStateFromError(error)`** — static; returns new state from the error. Intended for "set hasError: true" style state updates.
- **`componentDidCatch(error, info)`** — instance; for side effects like reporting to Sentry. Does NOT update state directly.

At least one must be declared; declaring only `render()` is not an error boundary. Declaring both is the canonical pattern (derive state → render fallback; separately, report the error).

```tsx
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, info);
  }

  render(): ReactNode {
    return this.state.hasError ? <Fallback /> : this.props.children;
  }
}
```

## Error-digest convention

Next.js 15 attaches a `digest` string to errors so server-only error details don't leak to the client. Good error-UI practice shows the digest so users can reference it in support:

```tsx
<p>Reference: {error.digest ?? 'unknown'}</p>
```

The skill does NOT enforce digest display — that's a UX decision. It's noted here because it's a common follow-up during a11y/error review.

## What `not-found.tsx` does NOT need

- No `'use client'` (opt-in only if you need interactivity)
- No `reset` prop (there's nothing to reset — the 404 is terminal)
- No `<html>`/`<body>` wrap (sits inside the normal layout)

The skill's rules do not activate for not-found files. A not-found.tsx missing a `'use client'` is correct, not broken.

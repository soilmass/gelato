# Five violation classes

The `rsc-boundary-audit` skill classifies each boundary violation into exactly one of these classes. The eval labels 23 fixtures across the five classes and asserts ≥ 95% classification accuracy.

## 1. `unnecessary-directive`

A component has `'use client'` but fails all four criteria of the decision tree (see `four-criterion-decision-tree.md`).

**Canonical example:**

```tsx
'use client';

export default function UserCard({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div>
      <img src={avatar} alt="" />
      <span>{name}</span>
    </div>
  );
}
```

**Remediation:** delete the `'use client'` directive. No other code changes.

## 2. `server-only-import-in-client`

A component has `'use client'` and imports a module that must never ship to the client — typically a database client, an ORM, a secrets source, or a Node-only filesystem dep.

**Canonical example:**

```tsx
'use client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export default function Form() {
  const go = async () => {
    const rows = await db.select().from(users);  // ships Drizzle client to the browser
    console.log(env.STRIPE_SECRET_KEY);           // secret now in the client bundle
  };
  return <button onClick={go}>Go</button>;
}
```

**Remediation:** move the server-only work into a Server Action (`'use server'`) and import the action from the client instead. Never move the import itself — it leaks the secret.

## 3. `non-serializable-prop`

A server component passes a non-serializable value to a client-component child. Crosses the boundary as a serialization error or hydration mismatch.

**Canonical example:**

```tsx
// app/page.tsx (server)
import { DatePicker } from './date-picker';

export default async function Page() {
  const handleSubmit = async (formData: FormData) => { /* arbitrary function */ };
  const initialDate = new Date();
  return <DatePicker initial={initialDate} onSubmit={handleSubmit} />;
}
```

**Remediation:** convert `Date` → ISO string at the boundary; if the handler was meant to be a Server Action, mark the file `'use server'`; otherwise move handler construction into the client.

## 4. `barrel-import-leakage`

A client component imports a barrel (`index.ts` re-export file) whose re-exports include large client-side libraries that the component doesn't actually use. The bundler pulls the whole barrel into the client tree.

**Canonical example:**

```tsx
'use client';
import { Button } from '@/components';                 // barrel re-exports 50 client components
import { cn } from '@/lib/utils';                      // pulls `@/lib` barrel re-exporting server utilities

export default function CTA() {
  return <Button className={cn('primary')}>Go</Button>;
}
```

**Remediation:** import leaf paths directly — `import { Button } from '@/components/button'`, `import { cn } from '@/lib/utils/cn'`. The fix is mechanical; the bundle-size win is often the largest line item in the remediation plan.

## 5. `hydration-mismatch-source`

A component's rendering output depends on client-only state or nondeterministic sources in a way that produces different output on server vs. client.

**Canonical example:**

```tsx
export default function Now() {
  // On the server this branch runs; on the client the other does.
  // Hydration sees divergent DOM and warns (or crashes).
  return (
    <span>
      {typeof window === 'undefined' ? 'server-rendered' : new Date().toLocaleTimeString()}
    </span>
  );
}
```

**Remediation options:** wrap the mismatch-prone branch in `<Suspense>` with a consistent fallback, move the component behind `dynamic(() => import('./now'), { ssr: false })`, or stabilize the output by computing the variable value once on the client after first paint (`useEffect` + `useState`).

## Why exactly five classes

These five cover the full set of boundary-crossing failures the Next.js + React docs name as boundary concerns. Empirically, every real-world `'use client'` problem reported in Vercel Support or the Next.js issue tracker maps onto one of these five. Adding a sixth class always duplicates one of these; collapsing to four always hides a distinguishable remediation path.

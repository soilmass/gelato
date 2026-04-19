# Sentry config templates

Drop-in starting points. All three passing the four classifier rules.

## `sentry.server.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event) {
    const value = event.exception?.values?.[0]?.value ?? '';
    if (value.includes('NEXT_NOT_FOUND') || value.includes('NEXT_REDIRECT')) return null;
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    return event;
  },
  ignoreErrors: ['NEXT_NOT_FOUND', 'NEXT_REDIRECT', 'AbortError'],
});
```

## `sentry.client.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
  beforeSend(event) {
    const value = event.exception?.values?.[0]?.value ?? '';
    if (value.includes('NEXT_NOT_FOUND') || value.includes('NEXT_REDIRECT')) return null;
    return event;
  },
});
```

## `sentry.edge.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event) {
    const value = event.exception?.values?.[0]?.value ?? '';
    if (value.includes('NEXT_NOT_FOUND')) return null;
    return event;
  },
});
```

## Env vars

```
# .env.local / Vercel env
NEXT_PUBLIC_SENTRY_DSN=https://abc@o12345.ingest.sentry.io/67890
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=sntrys_...   # build-time only; never ship
```

## CI integration (high-level)

`@sentry/nextjs` ships a webpack plugin that uploads source maps automatically when `SENTRY_AUTH_TOKEN` is set. Wire it into the Next.js config:

```js
// next.config.mjs
import { withSentryConfig } from '@sentry/nextjs';

export default withSentryConfig({
  // ...your config
}, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
});
```

Source-map upload is out of scope for this skill's classifier.

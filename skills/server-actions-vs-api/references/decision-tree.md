# Four-criterion decision tree

Copy-paste reference for Step 1 of `server-actions-vs-api`. Answer each question in order; the first "yes" decides.

## The four criteria

1. **Is the caller a non-React client?**
   - Mobile app, CLI, third-party webhook, cron job, curl script.
   - If yes → **Route handler.**
   - *Why:* Server Actions require the React runtime to invoke; their URL and serialization are not a stable HTTP interface.

2. **Does this endpoint need to stream a response?**
   - Server-Sent Events, chunked response, long-running response body.
   - If yes → **Route handler.**
   - *Why:* Server Actions return a single value; streaming is out of scope.

3. **Is this a mutation from within a React UI?**
   - Form submission, button click that changes server state, any user-triggered action in a React tree that mutates.
   - If yes → **Server Action.**
   - *Why:* Progressive enhancement, type-safe RPC, built-in revalidation hooks, no separate API surface to maintain.

4. **Is this a read that Server Components can do at render time?**
   - Loading posts to display on `/posts` when the page loads.
   - If yes → **Server Component direct call** (not a route handler, not a Server Action).
   - *Why:* The page renders on the server; it can call the database directly. Wrapping a DB call in an unneeded HTTP round-trip is a common over-engineering.

If none apply:
- Mutation → **Server Action.**
- Read exposed to non-React clients → **Route handler.**

## Decision function (pseudocode)

```
decideEndpointType(requirement):
  if requirement.caller is not_react_client: return ROUTE_HANDLER
  if requirement.needs_streaming:           return ROUTE_HANDLER
  if requirement.is_ui_mutation:            return SERVER_ACTION
  if requirement.is_server_render_read:     return SERVER_COMPONENT_DIRECT_CALL
  if requirement.is_mutation:               return SERVER_ACTION
  if requirement.exposed_to_non_react:      return ROUTE_HANDLER
  return INVARIANT_VIOLATION
```

## The falsely-contested cases

- **"What about my internal API that only the React app uses?"** — use a Server Action. No CORS, no stable HTTP interface needed, no versioning burden.
- **"What about a webhook that comes from a service I control?"** — still a webhook, still external HTTP, still a route handler.
- **"Server Actions feel too magical."** — the design is deliberate. The magic is: React serializes the function reference, Next dispatches it over HTTP, result comes back typed. If that model fits the requirement, use it.

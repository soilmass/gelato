# Event naming reference

Past-tense verbs, paired with the object that was acted on. All snake_case. The list is not exhaustive; use it as a pattern library.

## Account / auth

- `signup_started` / `signup_completed` / `signup_abandoned`
- `login_attempted` / `login_succeeded` / `login_failed`
- `password_reset_requested` / `password_reset_completed`
- `email_verified`
- `mfa_enrolled` / `mfa_prompt_shown` / `mfa_verified`
- `session_refreshed` / `logged_out`

## Content / product actions

- `post_created` / `post_updated` / `post_deleted` / `post_published`
- `comment_added` / `comment_deleted`
- `file_uploaded` / `file_downloaded`
- `search_performed` — include `{ query, resultsCount }`

## Commerce

- `checkout_started` / `checkout_completed` / `checkout_abandoned`
- `invoice_paid` / `invoice_failed`
- `subscription_started` / `subscription_upgraded` / `subscription_canceled` / `subscription_reactivated`
- `refund_issued`

## Engagement

- `onboarding_step_completed` — include `{ step, totalSteps }`
- `tutorial_skipped`
- `share_initiated` — include `{ channel }`
- `favorite_added` / `favorite_removed`

## Navigation (use sparingly)

- `page_viewed` — include `{ path, referrer }`. Bare `page_view` (no qualifier) is banned because it tells downstream consumers nothing.
- `link_clicked` — include `{ url, linkType }`. Avoid bare `click`.

## Errors (prefer Sentry, but helpful for funnel break-points)

- `error_shown` — include `{ errorCode, route }`. This is the surfaced UX error, NOT an exception trace.

## Naming patterns to avoid

| Pattern | Why it fails |
|---|---|
| `click` | Too generic. Useless alone. |
| `button_clicked` | Improvement over `click` but still no object (which button?). |
| `PostCreated` (PascalCase) | Inconsistent with the rest; dashboards can't group. |
| `post-created` (kebab-case) | Same reason as above. |
| `createPost` | Present tense, not past. Events describe what happened. |
| `user_event` | Abstraction over nothing — every event is a user event. |
| `submit` | Which form? Which object? |
| `page_view` | If you have many pages, `page_viewed` with `{ path }` tells you which. |

## The three-part check

Before shipping an event name, ask:

1. **Verb in past tense?** `created`, not `create` / `creating`.
2. **Object named?** `post_created`, not `created`.
3. **Snake_case?** `post_created`, not `PostCreated` / `post-created`.

# Canonical workflow templates

Drop-in GitHub Actions YAML for a Next.js 15 repo on Vercel. All four classifier rules satisfied.

## `.github/workflows/ci.yml`

```yaml
name: CI
on: pull_request

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.x
      - run: bun install --frozen-lockfile
      - run: bun run validate
      - run: bun run typecheck
      - run: bun run eval

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.x
      - run: bun install --frozen-lockfile
      - run: bun run build
```

## `.github/workflows/deploy-preview.yml` (optional — CLI flow)

Only needed if you're NOT using Vercel's git integration. With the git integration, preview deploys happen automatically.

```yaml
name: Deploy (preview)
on: pull_request

concurrency:
  group: deploy-preview-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.x
      - run: bun install --frozen-lockfile
      - name: Deploy
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          bunx vercel pull --yes --environment=preview --token="$VERCEL_TOKEN"
          bunx vercel build --token="$VERCEL_TOKEN"
          bunx vercel deploy --prebuilt --token="$VERCEL_TOKEN"
```

## `.github/workflows/deploy-prod.yml` (optional — CLI flow)

```yaml
name: Deploy (production)
on:
  push:
    branches: [main]

concurrency:
  group: deploy-prod
  cancel-in-progress: false   # queue production deploys, don't cancel

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.x
      - run: bun install --frozen-lockfile
      - name: Deploy
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          bunx vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
          bunx vercel build --prod --token="$VERCEL_TOKEN"
          bunx vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
```

## Pinning strategies

- **Release tag (`@v4`)**: balances security and ergonomics. Allows patch updates within v4 (per GitHub Actions' tag-floating behavior for major tags).
- **Full SHA (`@11bd71901bbe5b1630ceea73d27597364c9af683`)**: maximum security; Renovate can keep SHAs up to date automatically.
- **Never**: `@main` / `@master` / `@HEAD` / no version at all.

## DORA metrics this pipeline improves

- **Lead time for changes** — CI runs in parallel, concurrency-cancel prevents queue buildup.
- **Deployment frequency** — preview deploys per PR keep the feedback loop tight.
- **Change failure rate** — gates (typecheck / test / eval) before merge.
- **Time to restore service** — Vercel's instant rollback on prod; CI's cache reuse makes re-deploy fast.

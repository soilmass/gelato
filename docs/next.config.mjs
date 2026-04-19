import nextra from 'nextra';

// Nextra 3 App Router integration. Pages live under app/**/page.mdx; the
// theme and layout are applied in app/layout.tsx. No theme config here.
const withNextra = nextra({});

export default withNextra({
  reactStrictMode: true,
  // Scope file tracing to this workspace so Next doesn't walk the whole
  // monorepo on build.
  outputFileTracingRoot: import.meta.dirname,

  // v0.4.0 docs-routing migration: flat `/skills/<name>` → nested
  // `/<core>/skills/<name>`. Core 1 pages now live under `/web-dev/...`.
  // Keep the old URLs alive as permanent (301) redirects for one release
  // cycle so external bookmarks / blog links keep resolving.
  redirects: async () => [
    {
      source: '/skills/:name',
      destination: '/web-dev/skills/:name',
      permanent: true,
    },
  ],
});

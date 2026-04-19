import nextra from 'nextra';

// Nextra 3 App Router integration. Pages live under app/**/page.mdx; the
// theme and layout are applied in app/layout.tsx. No theme config here.
const withNextra = nextra({});

export default withNextra({
  reactStrictMode: true,
  // Scope file tracing to this workspace so Next doesn't walk the whole
  // monorepo on build.
  outputFileTracingRoot: import.meta.dirname,
});

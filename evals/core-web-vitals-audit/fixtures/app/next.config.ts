import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Silence the "detected multiple lockfiles" warning — the fixture app
  // has its own node_modules, separate from the monorepo.
  outputFileTracingRoot: import.meta.dirname,
};

export default config;

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Vitest runs on Vite, which does not honor tsconfig `paths`. Aliases here
// mirror tsconfig.json so eval tests can import `@gelato/...` without
// needing the vite-tsconfig-paths plugin.

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gelato/schema': resolve(here, 'packages/schema/src/index.ts'),
      '@gelato/eval-harness': resolve(here, 'packages/eval-harness/src/index.ts'),
    },
  },
  test: {
    // Picks up both skill evals (evals/*/eval.test.ts) and shared-harness
    // unit tests (packages/*/src/**/*.test.ts). Harness tests stay fast so
    // they run inline with `bun run eval` and don't need a separate script.
    include: ['evals/**/eval.test.ts', 'packages/*/src/**/*.test.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});

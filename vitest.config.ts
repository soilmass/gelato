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
    include: ['evals/**/eval.test.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});

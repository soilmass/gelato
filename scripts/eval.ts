#!/usr/bin/env bun
// Orchestrate skill evals. Runs Vitest over evals/<skill>/eval.test.ts with a
// JSON reporter, then hands the output file to scripts/update-pass-rate.ts so
// pass rates flow back into each SKILL.md's metadata.eval fields.
//
// Usage:
//   bun run eval                   # run every skill's eval
//   bun run eval <skill-name>      # run one skill
//   bun run eval --smoke           # run with --passWithNoTests (no eval dirs yet)
//
// Exit code mirrors Vitest's so CI correctly fails on regressions; the
// pass-rate writer always runs even when tests fail because a failing run
// still produces measurements worth recording.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Bun invokes package.json scripts through bash, which loses the path to the
// bun binary on minimal PATHs. Re-advertise the directory containing the
// running bun binary so `bunx vitest` resolves and subsequent spawns stay
// inside the same bun toolchain.
const BUN_BIN_DIR = dirname(process.execPath);
const AUGMENTED_PATH = [BUN_BIN_DIR, process.env.PATH ?? ''].filter(Boolean).join(':');

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const skillArgs = args.filter((a) => !a.startsWith('--'));
const [skill] = skillArgs;

const outputFile = resolve('/tmp', `gelato-eval-${Date.now()}.json`);

const vitestArgs = ['vitest', 'run', '--reporter=json', `--outputFile=${outputFile}`];

if (skill) {
  const evalPath = `evals/${skill}/eval.test.ts`;
  if (!existsSync(evalPath)) {
    console.error(`No eval at ${evalPath}.`);
    console.error(`Expected evals/${skill}/eval.test.ts.`);
    process.exit(1);
  }
  vitestArgs.push(evalPath);
} else {
  vitestArgs.push('evals/');
}

if (smoke) {
  vitestArgs.push('--passWithNoTests');
}

console.log(`\u25b6 ${vitestArgs.join(' ')}`);

const proc = Bun.spawn(['bunx', ...vitestArgs], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, PATH: AUGMENTED_PATH, FORCE_COLOR: '1' },
});

const vitestExit = await proc.exited;

if (!existsSync(outputFile)) {
  console.error(`\nVitest did not produce ${outputFile}; skipping pass-rate write-back.`);
  process.exit(vitestExit);
}

console.log('');
console.log(`\u25b6 bun run scripts/update-pass-rate.ts ${outputFile}`);
const writer = Bun.spawn([process.execPath, 'run', 'scripts/update-pass-rate.ts', outputFile], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, PATH: AUGMENTED_PATH },
});
const writerExit = await writer.exited;

if (writerExit !== 0) {
  console.error(`\nupdate-pass-rate.ts failed with exit ${writerExit}.`);
  process.exit(writerExit);
}

process.exit(vitestExit);

// Gelato eval harness — shared primitives for skill evals.
// v0.1 Step 1 scaffolding stubs. Implementations land in Step 2 of BRIEF.md
// alongside scripts/eval.ts and scripts/update-pass-rate.ts.

export interface ApplySkillGuidanceOptions {
  skill: string;
  fixturePath: string;
}

export interface Fixture {
  path: string;
  name: string;
  expected: unknown;
  metadata?: Record<string, unknown>;
}

export interface SkillRunResult {
  fixture: string;
  predicted: unknown;
  expected: unknown;
  bundleImpact?: number;
}

const UNIMPLEMENTED = 'not implemented until Step 2 of BRIEF.md';

export async function applySkillGuidance(_options: ApplySkillGuidanceOptions): Promise<void> {
  throw new Error(`applySkillGuidance: ${UNIMPLEMENTED}`);
}

export async function runSkillOnFixtures(
  _skill: string,
  _fixtures: Fixture[],
): Promise<SkillRunResult[]> {
  throw new Error(`runSkillOnFixtures: ${UNIMPLEMENTED}`);
}

export async function loadFixtures(_path: string): Promise<Fixture[]> {
  throw new Error(`loadFixtures: ${UNIMPLEMENTED}`);
}

export * from './judge.ts';

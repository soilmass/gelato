// Gelato eval harness — shared primitives for skill evals.
//
// Fixture loading and judge scaffolding ship in Step 2. The skill-running
// primitives (applySkillGuidance, runSkillOnFixtures) require direct
// Anthropic SDK calls and land alongside the first skill that needs them:
// core-web-vitals-audit uses Lighthouse CI without Claude, so Step 3 does
// not force the issue; rsc-boundary-audit does force it in Step 4.

export type {
  Fixture,
  LoadFixturesOptions,
} from './fixtures.ts';

export {
  fixtureDisplayName,
  groupByCategory,
  loadFixtures,
} from './fixtures.ts';

export type {
  JudgeOptions,
  JudgeResult,
} from './judge.ts';

export {
  JudgeApiKeyMissing,
  JudgeNotImplemented,
  isJudgeAvailable,
  judgeWithPromptfoo,
} from './judge.ts';

export type { CWVMetrics, RunLighthouseOptions } from './lighthouse.ts';

export { runLighthouse } from './lighthouse.ts';

import type { Fixture } from './fixtures.ts';

export interface ApplySkillGuidanceOptions {
  skill: string;
  fixturePath: string;
}

export interface SkillRunResult {
  fixture: string;
  predicted: unknown;
  expected: unknown;
  bundleImpact?: number;
}

const DEFERRED = 'lands alongside the first skill that exercises it (see BRIEF.md § build order).';

export async function applySkillGuidance(_options: ApplySkillGuidanceOptions): Promise<string> {
  throw new Error(`applySkillGuidance: ${DEFERRED}`);
}

export async function runSkillOnFixtures(
  _skill: string,
  _fixtures: Fixture[],
): Promise<SkillRunResult[]> {
  throw new Error(`runSkillOnFixtures: ${DEFERRED}`);
}

// Gelato eval harness — shared primitives for skill evals.
// See EVAL_SPEC.md § What the harness provides.

export type { Fixture, LoadFixturesOptions } from './fixtures.ts';

export { fixtureDisplayName, groupByCategory, loadFixtures } from './fixtures.ts';

export type { JudgeOptions, JudgeResult } from './judge.ts';

export {
  isJudgeAvailable,
  JudgeApiKeyMissing,
  JudgeConfigMissing,
  judgeWithPromptfoo,
} from './judge.ts';

export type { CWVMetrics, RunLighthouseOptions } from './lighthouse.ts';

export { runLighthouse } from './lighthouse.ts';

export type {
  ApplySkillGuidanceOptions,
  RunSkillOnFixturesOptions,
  RunSkillWithClaudeOptions,
  SkillRunResult,
} from './claude.ts';

export {
  applySkillGuidance,
  ClaudeApiKeyMissing,
  DEFAULT_MODEL,
  isClaudeAvailable,
  runSkillOnFixtures,
  runSkillWithClaude,
} from './claude.ts';

export type { JsxOpenTag } from './tsx-classifier.ts';

export {
  extractClassNames,
  hasUseClient,
  hasUseServer,
  isFencedCode,
  iterateJsxOpenTags,
  matchCloseBrace,
  matchCloseParen,
  parseJsxAttrs,
  stripComments,
} from './tsx-classifier.ts';

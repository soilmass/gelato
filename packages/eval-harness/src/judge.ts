// LLM-as-judge via Promptfoo. See EVAL_SPEC.md § Type B (Judgment eval).
//
// The qualitative half of a judgment eval routes through Promptfoo so skills
// reuse one prompting + caching + scoring path rather than each rolling its
// own Anthropic SDK integration. Full implementation ships alongside the
// first skill that actually exercises it (rsc-boundary-audit, Step 4 of
// BRIEF.md). Until then this module exposes the contract and clear error
// surfaces so skill authors can wire `describe.skipIf(...)` or
// `test.skipIf(...)` guards against it without depending on environment
// heuristics of their own.

import { readFile } from 'node:fs/promises';

export interface JudgeOptions {
  // Path to the promptfoo YAML config (resolved relative to process.cwd()
  // when the eval runs).
  config: string;
  // Rubric name — matches a `tests[].assert[].value` rubric label declared
  // inside the config.
  rubric: string;
}

export interface JudgeResult {
  score: number;
  nCases: number;
  reasons: string[];
}

export class JudgeApiKeyMissing extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set; judgeWithPromptfoo cannot call the API. Set the key or wrap the test in describe.skipIf(!process.env.ANTHROPIC_API_KEY).',
    );
    this.name = 'JudgeApiKeyMissing';
  }
}

export class JudgeNotImplemented extends Error {
  constructor(rubric: string) {
    super(
      `judgeWithPromptfoo('${rubric}'): Promptfoo invocation lands with the first judgment skill (rsc-boundary-audit, Step 4 of BRIEF.md). For now, quantitative eval assertions carry the signal.`,
    );
    this.name = 'JudgeNotImplemented';
  }
}

export async function judgeWithPromptfoo(options: JudgeOptions): Promise<JudgeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new JudgeApiKeyMissing();
  }
  // Surface the missing config early so a future implementer sees a real
  // filesystem error rather than a vague Promptfoo-internal failure.
  await readFile(options.config, 'utf8');
  throw new JudgeNotImplemented(options.rubric);
}

export function isJudgeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

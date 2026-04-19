// LLM-as-judge via Promptfoo. See EVAL_SPEC.md § Type B (Judgment eval).

export interface JudgeOptions {
  config: string;
  rubric: string;
}

export async function judgeWithPromptfoo(_options: JudgeOptions): Promise<number> {
  throw new Error('judgeWithPromptfoo: not implemented until Step 2 of BRIEF.md');
}

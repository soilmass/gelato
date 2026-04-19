// LLM-as-judge via Promptfoo. Invokes Promptfoo as a subprocess with a JSON
// output target, parses the report, and returns an averaged rubric score.
//
// Subprocess + JSON output target is more robust than Promptfoo's programmatic
// library API — the library signature shifts between versions; the CLI + JSON
// output is a stable contract. The trade-off is a ~2s startup per invocation.

import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

export interface JudgeOptions {
  /** Path to the promptfoo YAML config. Relative to process.cwd() when run. */
  config: string;
  /**
   * Rubric name to filter by — matches a `tests[].description` in the config
   * (Promptfoo's --filter-description). Averages scores across matching tests.
   */
  rubric: string;
}

export interface JudgeResult {
  /** 0..1, averaged across matching test cases. */
  score: number;
  nCases: number;
  reasons: string[];
}

export class JudgeApiKeyMissing extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set; judgeWithPromptfoo cannot call the API. Set the key or wrap the test in describe.skipIf(!isJudgeAvailable()).',
    );
    this.name = 'JudgeApiKeyMissing';
  }
}

export class JudgeConfigMissing extends Error {
  constructor(path: string) {
    super(`judgeWithPromptfoo: config not found at ${path}`);
    this.name = 'JudgeConfigMissing';
  }
}

export function isJudgeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

interface PromptfooTestResult {
  description?: string;
  success?: boolean;
  score?: number;
  gradingResult?: {
    pass?: boolean;
    score?: number;
    reason?: string;
    componentResults?: Array<{ pass?: boolean; score?: number; reason?: string }>;
  };
}

interface PromptfooReport {
  results?: { results?: PromptfooTestResult[] };
}

export async function judgeWithPromptfoo(options: JudgeOptions): Promise<JudgeResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new JudgeApiKeyMissing();
  // Read first to surface a filesystem error early; promptfoo's own error is
  // less specific.
  await readFile(options.config, 'utf8').catch(() => {
    throw new JudgeConfigMissing(options.config);
  });

  const outputPath = resolve(
    tmpdir(),
    `gelato-judge-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );

  // Augmented PATH so bunx/bun resolve under Claude-shell-minimal PATHs.
  const bunBin = dirname(process.execPath);
  const augmentedPath = [bunBin, process.env.PATH ?? ''].filter(Boolean).join(':');

  const proc = spawn(
    'bunx',
    [
      'promptfoo',
      'eval',
      '--config',
      options.config,
      '--output',
      outputPath,
      '--filter-description',
      options.rubric,
      '--no-progress-bar',
    ],
    {
      env: { ...process.env, PATH: augmentedPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const stderrChunks: Buffer[] = [];
  proc.stderr?.on('data', (c) => stderrChunks.push(c));

  const exitCode: number = await new Promise((res, rej) => {
    proc.on('error', rej);
    proc.on('close', (code) => res(code ?? 0));
  });

  // Non-zero exit can mean "tests failed thresholds" (still a valid measurement)
  // or "config error / API failure" (which we want to surface). Distinguish by
  // whether the output file exists.
  const raw = await readFile(outputPath, 'utf8').catch(() => null);
  if (!raw) {
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    throw new Error(
      `judgeWithPromptfoo: promptfoo did not produce ${outputPath} (exit ${exitCode}).\n${stderr}`,
    );
  }

  let report: PromptfooReport;
  try {
    report = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `judgeWithPromptfoo: could not parse Promptfoo report: ${(err as Error).message}`,
    );
  }

  // Clean up tempfile regardless of whether parse succeeds.
  await rm(outputPath, { force: true });

  const results = report.results?.results ?? [];
  if (results.length === 0) {
    throw new Error(
      `judgeWithPromptfoo: no test results in report (rubric "${options.rubric}" did not match any tests in ${options.config})`,
    );
  }

  let scoreSum = 0;
  const reasons: string[] = [];
  for (const r of results) {
    const score = r.gradingResult?.score ?? r.score ?? (r.gradingResult?.pass ? 1 : 0);
    scoreSum += Number(score);
    if (r.gradingResult?.reason) reasons.push(r.gradingResult.reason);
  }

  return {
    score: scoreSum / results.length,
    nCases: results.length,
    reasons,
  };
}

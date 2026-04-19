// Anthropic SDK integration for skill-running primitives.
//
// Used by rsc-boundary-audit and every future skill whose eval needs Claude
// to apply the skill's guidance to a fixture. Keeps two concerns separate:
//
//   - runSkillWithClaude: low-level message call that mounts the SKILL.md
//     as a system prompt. Other harness entry points compose on top.
//   - applySkillGuidance / runSkillOnFixtures: thin wrappers matching the
//     EVAL_SPEC.md contract — one returns the applied guidance as free
//     text, the other iterates fixtures and returns per-fixture results.
//
// All three require ANTHROPIC_API_KEY in the environment. Absent key throws
// a typed error so test files can wrap with `describe.skipIf(!isJudgeAvailable())`
// or similar guards.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { Fixture } from './fixtures.ts';

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export interface RunSkillWithClaudeOptions {
  skill: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  systemSuffix?: string;
}

export class ClaudeApiKeyMissing extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set; applySkillGuidance / runSkillOnFixtures cannot call the API. Set the key or wrap the test in describe.skipIf.',
    );
    this.name = 'ClaudeApiKeyMissing';
  }
}

export function isClaudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new ClaudeApiKeyMissing();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function loadSkill(skill: string): Promise<string> {
  return readFile(resolve('skills', skill, 'SKILL.md'), 'utf8');
}

export async function runSkillWithClaude(options: RunSkillWithClaudeOptions): Promise<string> {
  const client = getClient();
  const skillContent = await loadSkill(options.skill);
  const systemBody = `You are guided by the skill below. Apply its procedure faithfully.\n\n---\n\n${skillContent}`;
  const system = options.systemSuffix
    ? `${systemBody}\n\n---\n\n${options.systemSuffix}`
    : systemBody;

  const response = await client.messages.create({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? 4096,
    system,
    messages: [{ role: 'user', content: options.prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export interface ApplySkillGuidanceOptions {
  skill: string;
  fixturePath: string;
  model?: string;
  maxTokens?: number;
}

export async function applySkillGuidance(options: ApplySkillGuidanceOptions): Promise<string> {
  const fixtureContent = await readFile(options.fixturePath, 'utf8');
  return runSkillWithClaude({
    skill: options.skill,
    prompt: `Apply this skill's procedure to the following fixture. Return the remediated output (the full replacement file, if it is a file, or the structured report if the skill produces one).\n\n--- FIXTURE: ${options.fixturePath} ---\n\n${fixtureContent}`,
    model: options.model,
    maxTokens: options.maxTokens,
  });
}

export interface SkillRunResult {
  fixture: string;
  predicted: unknown;
  expected: unknown;
  bundleImpact?: number;
  raw?: string;
}

export interface RunSkillOnFixturesOptions {
  /** Parse the raw model output into a prediction; defaults to raw text. */
  parsePrediction?: (raw: string, fixture: Fixture) => unknown;
  /** Prompt builder; defaults to "classify this fixture" shape. */
  buildPrompt?: (fixture: Fixture) => string;
  model?: string;
  maxTokens?: number;
}

export async function runSkillOnFixtures(
  skill: string,
  fixtures: Fixture[],
  options: RunSkillOnFixturesOptions = {},
): Promise<SkillRunResult[]> {
  const results: SkillRunResult[] = [];
  const buildPrompt =
    options.buildPrompt ??
    ((f: Fixture) =>
      `Classify this fixture according to the skill's taxonomy. Reply with a single JSON object of the shape {"class": "<class>"}.\n\n--- FIXTURE: ${f.name} ---\n\n${f.content}`);
  const parse = options.parsePrediction ?? ((raw) => raw);

  for (const fixture of fixtures) {
    const raw = await runSkillWithClaude({
      skill,
      prompt: buildPrompt(fixture),
      ...(options.model ? { model: options.model } : {}),
      ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
    });
    results.push({
      fixture: fixture.name,
      predicted: parse(raw, fixture),
      expected: fixture.expected,
      raw,
    });
  }
  return results;
}

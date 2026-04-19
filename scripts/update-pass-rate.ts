#!/usr/bin/env bun
// Parse a Vitest JSON report and write the resulting pass rates back into
// each affected SKILL.md frontmatter.
//
// Per EVAL_SPEC.md, the three eval fields are runner-owned:
//   - metadata.eval.pass_rate (0..1)
//   - metadata.eval.last_run  (ISO timestamp)
//   - metadata.eval.n_cases   (int)
//
// Writes are surgical — only the three lines change, so docs comments and
// key order in the rest of the frontmatter are preserved. gray-matter's
// re-serialization would clobber folded scalars and re-quote values, so we
// skip it for writes. Reads still use gray-matter.
//
// Usage: bun run scripts/update-pass-rate.ts <vitest-report.json>

import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

interface VitestAssertion {
  status: 'passed' | 'failed' | 'pending' | 'todo' | 'skipped';
}

interface VitestFileResult {
  name: string;
  status: string;
  assertionResults: VitestAssertion[];
}

interface VitestReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  testResults: VitestFileResult[];
}

interface SkillScore {
  skill: string;
  passed: number;
  total: number;
  rate: number;
}

function extractSkillName(testFilePath: string): string | null {
  // evals/<skill>/eval.test.ts or absolute variants
  const match = testFilePath.match(/evals\/([^/]+)\/eval\.test\.ts$/);
  return match ? (match[1] ?? null) : null;
}

function aggregate(report: VitestReport): SkillScore[] {
  const bySkill = new Map<string, { passed: number; total: number }>();
  for (const file of report.testResults) {
    const skill = extractSkillName(file.name);
    if (!skill) continue;
    const bucket = bySkill.get(skill) ?? { passed: 0, total: 0 };
    for (const a of file.assertionResults) {
      if (a.status === 'skipped' || a.status === 'pending' || a.status === 'todo') continue;
      bucket.total++;
      if (a.status === 'passed') bucket.passed++;
    }
    bySkill.set(skill, bucket);
  }
  return [...bySkill.entries()].map(([skill, b]) => ({
    skill,
    passed: b.passed,
    total: b.total,
    rate: b.total === 0 ? 0 : b.passed / b.total,
  }));
}

// Surgical rewrite of a single frontmatter field inside the `eval:` block.
// Matches `^( +)<field>: .*$` within the first --- ... --- fence. Nesting
// is shallow (eval fields appear at depth 2) so a whitespace-prefixed match
// is enough — no need for a full YAML parse.
function updateEvalField(
  source: string,
  field: 'pass_rate' | 'last_run' | 'n_cases',
  value: number | string | null,
): string {
  const fenceEnd = source.indexOf('\n---', 4);
  if (!source.startsWith('---\n') || fenceEnd === -1) {
    throw new Error('SKILL.md does not start with a YAML frontmatter block');
  }
  const frontmatter = source.slice(0, fenceEnd + 4);
  const rest = source.slice(fenceEnd + 4);

  const pattern = new RegExp(`^( +)${field}: .*$`, 'm');
  if (!pattern.test(frontmatter)) {
    throw new Error(`frontmatter has no '${field}:' line to update`);
  }

  let serialized: string;
  if (value === null) serialized = 'null';
  else if (typeof value === 'number') serialized = String(value);
  else serialized = `"${value}"`;

  const updated = frontmatter.replace(pattern, `$1${field}: ${serialized}`);
  return updated + rest;
}

async function writeBack(score: SkillScore): Promise<void> {
  const path = `skills/${score.skill}/SKILL.md`;
  const raw = await readFile(path, 'utf8');
  const rounded = Number(score.rate.toFixed(3));
  const now = new Date().toISOString();

  let updated = raw;
  updated = updateEvalField(updated, 'pass_rate', rounded);
  updated = updateEvalField(updated, 'last_run', now);
  updated = updateEvalField(updated, 'n_cases', score.total);

  if (updated === raw) {
    console.log(`= ${score.skill}: no change (${score.passed}/${score.total} = ${rounded})`);
    return;
  }

  await writeFile(path, updated, 'utf8');
  console.log(`\u270e ${score.skill}: pass_rate=${rounded} n_cases=${score.total} last_run=${now}`);
}

async function main(): Promise<number> {
  const [reportPath] = process.argv.slice(2);
  if (!reportPath) {
    console.error('Usage: bun run scripts/update-pass-rate.ts <vitest-report.json>');
    return 1;
  }

  const raw = await readFile(reportPath, 'utf8');
  let report: VitestReport;
  try {
    report = JSON.parse(raw);
  } catch (err) {
    console.error(`Could not parse ${basename(reportPath)}: ${(err as Error).message}`);
    return 1;
  }

  const scores = aggregate(report);
  if (scores.length === 0) {
    console.log('No skill-scoped results in report — nothing to update.');
    return 0;
  }

  for (const score of scores) {
    try {
      await writeBack(score);
    } catch (err) {
      console.error(`\u2717 ${score.skill}: ${(err as Error).message}`);
      return 1;
    }
  }

  return 0;
}

process.exit(await main());

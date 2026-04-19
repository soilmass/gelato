#!/usr/bin/env bun
// Pass-rate regression gate for PRs.
//
// Compares each current skill's `metadata.eval.pass_rate` against the value
// on the base branch (default: origin/main). Fails if any skill's pass_rate
// dropped by more than 0.05, or if any skill that had a numeric pass_rate
// on base now has `null` (lost signal entirely). New skills introduced by
// the PR are exempt.
//
// Invoked by .github/workflows/eval.yml AFTER the eval run has finished
// updating SKILL.md frontmatter. Runs under `bun scripts/...` so Bun-native
// APIs (Bun.spawn, Bun.Glob) are available.
//
// Environment overrides:
//   BASE_REF          — git ref to compare against (default: origin/main)
//   REGRESSION_LIMIT  — maximum allowed drop (default: 0.05)
//
// Exit code: 0 on clean pass, 1 on any regression or lost-signal.

import { readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import matter from 'gray-matter';

const BASE_REF = process.env.BASE_REF ?? 'origin/main';
const REGRESSION_LIMIT = Number(process.env.REGRESSION_LIMIT ?? 0.05);

interface SkillFrontmatter {
  name?: string;
  metadata?: { eval?: { pass_rate?: number | null } };
}

async function readBaseSkill(skillName: string): Promise<SkillFrontmatter | null> {
  const proc = Bun.spawn(['git', 'show', `${BASE_REF}:skills/${skillName}/SKILL.md`], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exit = await proc.exited;
  if (exit !== 0) return null;
  const raw = await new Response(proc.stdout).text();
  const { data } = matter(raw) as { data: SkillFrontmatter };
  return data;
}

async function readCurrentSkill(path: string): Promise<SkillFrontmatter> {
  const raw = await readFile(path, 'utf8');
  const { data } = matter(raw) as { data: SkillFrontmatter };
  return data;
}

interface Verdict {
  skill: string;
  kind: 'regression' | 'lost-signal';
  base: number | null;
  current: number | null | undefined;
  delta?: number;
}

async function main(): Promise<number> {
  const glob = new Bun.Glob('skills/*/SKILL.md');
  const verdicts: Verdict[] = [];
  const checked: string[] = [];

  for await (const path of glob.scan('.')) {
    const skill = basename(dirname(path));
    const current = await readCurrentSkill(path);
    const base = await readBaseSkill(skill);

    if (base === null) {
      // New skill on this PR — no regression possible.
      continue;
    }
    checked.push(skill);

    const baseRate = base.metadata?.eval?.pass_rate ?? null;
    const currentRate = current.metadata?.eval?.pass_rate;

    if (baseRate === null) {
      // Base had null — nothing to regress from.
      continue;
    }

    if (currentRate === null || currentRate === undefined) {
      verdicts.push({ skill, kind: 'lost-signal', base: baseRate, current: currentRate });
      continue;
    }

    const delta = currentRate - baseRate;
    if (delta < -REGRESSION_LIMIT) {
      verdicts.push({ skill, kind: 'regression', base: baseRate, current: currentRate, delta });
    }
  }

  if (checked.length === 0) {
    console.log(
      `Pass-rate regression gate: no skills common with ${BASE_REF}. Nothing to compare.`,
    );
    return 0;
  }

  const regressions = verdicts.filter((v) => v.kind === 'regression');
  const lostSignal = verdicts.filter((v) => v.kind === 'lost-signal');

  if (regressions.length === 0 && lostSignal.length === 0) {
    console.log(
      `\u2713 No pass-rate regressions across ${checked.length} skill(s) vs ${BASE_REF}.`,
    );
    return 0;
  }

  console.log(`\u2717 Pass-rate regression gate failed against ${BASE_REF}:`);
  for (const v of regressions) {
    const deltaStr = v.delta != null ? v.delta.toFixed(3) : '?';
    console.log(`  ${v.skill}: ${v.base} \u2192 ${v.current} (\u0394 ${deltaStr})`);
  }
  for (const v of lostSignal) {
    console.log(`  ${v.skill}: ${v.base} \u2192 ${v.current} (lost signal; was numeric on base)`);
  }
  console.log(
    `\nLimit: ${REGRESSION_LIMIT}. Either fix the regression or update the base branch intentionally.`,
  );
  return 1;
}

process.exit(await main());

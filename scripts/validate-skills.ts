#!/usr/bin/env bun
// Walk skills/*/SKILL.md, validate frontmatter against the Gelato Zod schema,
// and enforce template-level invariants (body length, name-directory match,
// branch-name script byte-equality).
//
// Exit 0 on clean pass, 1 on any error. Warnings do not fail the run.

import { readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import matter from 'gray-matter';
import { SkillFrontmatter } from '../packages/schema/src/skill-frontmatter.ts';

const SKILL_GLOB = 'skills/*/SKILL.md';
const BODY_MAX_LINES = 500;
const BODY_WARN_LINES = 400;

interface ValidationResult {
  path: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

async function validateFrontmatter(
  path: string,
  raw: string,
): Promise<Pick<ValidationResult, 'errors' | 'warnings'>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = matter(raw);
  const frontmatter = parsed.data;

  const result = SkillFrontmatter.safeParse(frontmatter);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      errors.push(`frontmatter.${key}: ${issue.message}`);
    }
  }

  const dirName = basename(dirname(path));
  const fmName = (frontmatter as { name?: unknown }).name;
  if (typeof fmName === 'string' && fmName !== dirName) {
    errors.push(`frontmatter.name='${fmName}' does not match directory name='${dirName}'`);
  }

  const bodyLines = parsed.content.split('\n').length;
  if (bodyLines > BODY_MAX_LINES) {
    errors.push(`body is ${bodyLines} lines (>${BODY_MAX_LINES}). Move content into references/.`);
  } else if (bodyLines > BODY_WARN_LINES) {
    warnings.push(
      `body is ${bodyLines} lines (>${BODY_WARN_LINES}). Consider moving content into references/.`,
    );
  }

  return { errors, warnings };
}

async function checkBranchNameScriptSync(): Promise<string[]> {
  // The git-hygiene skill ships the canonical branch-name gate script at
  // skills/git-hygiene/scripts/check-branch-name.sh. The repo-root copy at
  // scripts/check-branch-name.sh is what lefthook invokes. They must stay
  // byte-identical — drift means the pre-push gate has deviated from the
  // skill's documented behavior.
  const rootPath = 'scripts/check-branch-name.sh';
  const skillPath = 'skills/git-hygiene/scripts/check-branch-name.sh';
  const [root, skill] = await Promise.all([
    readFile(rootPath, 'utf8').catch(() => null),
    readFile(skillPath, 'utf8').catch(() => null),
  ]);
  const errors: string[] = [];
  if (root === null) errors.push(`missing ${rootPath}`);
  if (skill === null) errors.push(`missing ${skillPath}`);
  if (root !== null && skill !== null && root !== skill) {
    errors.push(
      `${rootPath} and ${skillPath} have drifted. Sync them — they must be byte-identical.`,
    );
  }
  return errors;
}

async function validate(path: string): Promise<ValidationResult> {
  const raw = await readFile(path, 'utf8');
  const { errors, warnings } = await validateFrontmatter(path, raw);
  return { path, ok: errors.length === 0, errors, warnings };
}

async function main(): Promise<number> {
  const glob = new Bun.Glob(SKILL_GLOB);
  const paths: string[] = [];
  for await (const path of glob.scan('.')) paths.push(path);
  paths.sort();

  const results = await Promise.all(paths.map(validate));

  // Cross-skill invariants (run once, attach errors to the repo as a whole).
  const branchSyncErrors = await checkBranchNameScriptSync();

  let failed = 0;
  for (const r of results) {
    if (r.ok && r.warnings.length === 0) {
      console.log(`\u2713 ${r.path}`);
    } else if (r.ok) {
      console.log(`\u2713 ${r.path} (${r.warnings.length} warning(s))`);
      for (const w of r.warnings) console.log(`  \u26a0 ${w}`);
    } else {
      failed++;
      console.log(`\u2717 ${r.path}`);
      for (const e of r.errors) console.log(`  \u2717 ${e}`);
      for (const w of r.warnings) console.log(`  \u26a0 ${w}`);
    }
  }

  if (branchSyncErrors.length > 0) {
    failed++;
    console.log('\u2717 cross-skill: branch-name script parity');
    for (const e of branchSyncErrors) console.log(`  \u2717 ${e}`);
  }

  const total = results.length + 1;
  const passed = total - failed;
  console.log(`\n${total} check(s) run, ${passed} passed, ${failed} failed.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());

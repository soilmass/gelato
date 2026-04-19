#!/usr/bin/env bun
// Materialize docs/pages/skills/<name>.mdx from skills/<name>/SKILL.md.
//
// Nextra renders MDX files under docs/pages/ as routes; the SKILL.md files
// under skills/<name>/ already hold the prose + examples we want to publish,
// so "docs" is mostly this copy step. Frontmatter is stripped and replaced
// with a Nextra-compatible title; body comes through verbatim. Pass rate +
// metadata surface in a short preamble block above the body so readers see
// the skill's eval status without scrolling.

import { readFile, writeFile } from 'node:fs/promises';
import matter from 'gray-matter';

const SKILLS = ['git-hygiene', 'core-web-vitals-audit', 'rsc-boundary-audit'];

interface SkillMetadata {
  subsystem?: string;
  phase?: string;
  type?: string;
  eval?: { pass_rate?: number | null; last_run?: string | null; n_cases?: number | null };
}

interface SkillFrontmatter {
  name: string;
  description?: string;
  metadata?: SkillMetadata;
}

function formatEvalStatus(meta: SkillMetadata | undefined): string {
  const passRate = meta?.eval?.pass_rate;
  const nCases = meta?.eval?.n_cases;
  const lastRun = meta?.eval?.last_run;
  if (passRate == null || nCases == null || lastRun == null) {
    return '_Eval has not run yet._';
  }
  const pct = (passRate * 100).toFixed(1);
  const when = lastRun.slice(0, 10);
  return `**Pass rate:** ${pct}% across ${nCases} cases · **Last run:** ${when}`;
}

function preamble(name: string, fm: SkillFrontmatter): string {
  const phase = fm.metadata?.phase ?? '—';
  const type = fm.metadata?.type ?? '—';
  const subsystem = fm.metadata?.subsystem ?? '—';
  const status = formatEvalStatus(fm.metadata);
  const description = (fm.description ?? '').replace(/\n+/g, ' ').trim();
  return [
    `> ${description}`,
    '',
    `**Subsystem:** ${subsystem} · **Phase:** ${phase} · **Type:** ${type}`,
    '',
    status,
    '',
    `[View on GitHub](https://github.com/neopolitan/gelato/blob/main/skills/${name}/SKILL.md) · [Eval suite](https://github.com/neopolitan/gelato/tree/main/evals/${name})`,
    '',
    '---',
    '',
  ].join('\n');
}

async function generate(name: string): Promise<void> {
  const source = await readFile(`skills/${name}/SKILL.md`, 'utf8');
  const parsed = matter(source);
  const fm = parsed.data as SkillFrontmatter;
  const body = parsed.content.trimStart();

  // Strip the leading H1 — Nextra injects the page title from the filename /
  // meta config, so a second H1 creates a duplicate heading.
  const withoutH1 = body.replace(/^#\s[^\n]+\n+/, '');

  // MDX parses <https://...> as JSX (invalid). Rewrite autolinks to the
  // explicit markdown form that MDX passes through unchanged.
  const autolinkFix = withoutH1.replace(
    /<(https?:\/\/[^\s<>]+)>/g,
    (_match, url: string) => `[${url}](${url})`,
  );
  const mdx = [preamble(name, fm), autolinkFix].join('');
  const dir = `docs/app/skills/${name}`;
  await Bun.$`mkdir -p ${dir}`.quiet();
  await writeFile(`${dir}/page.mdx`, mdx, 'utf8');
  console.log(`\u270e ${dir}/page.mdx`);
}

for (const name of SKILLS) await generate(name);
console.log(`\nGenerated ${SKILLS.length} skill page(s).`);

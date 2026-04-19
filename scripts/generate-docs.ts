#!/usr/bin/env bun
// Materialize docs/pages/skills/<name>.mdx from skills/<name>/SKILL.md.
//
// Nextra renders MDX files under docs/pages/ as routes; the SKILL.md files
// under skills/<name>/ already hold the prose + examples we want to publish,
// so "docs" is mostly this copy step. Frontmatter is stripped and replaced
// with a Nextra-compatible title; body comes through verbatim. Pass rate +
// metadata surface in a short preamble block above the body so readers see
// the skill's eval status without scrolling.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import matter from 'gray-matter';

// Auto-discover every skill: a directory under skills/ that contains a
// SKILL.md file. Keeps the docs site in sync with the repo as new skills
// land, without requiring a hand-edit of this list with each PR.
async function discoverSkills(): Promise<string[]> {
  const entries = await readdir('skills', { withFileTypes: true });
  const skills: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = `skills/${entry.name}/SKILL.md`;
    try {
      await readFile(skillMd, 'utf8');
      skills.push(entry.name);
    } catch {
      // Directory without a SKILL.md — skip silently.
    }
  }
  return skills.sort();
}

interface SkillMetadata {
  core?: string;
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
    `[View on GitHub](https://github.com/soilmass/gelato/blob/main/skills/${name}/SKILL.md) · [Eval suite](https://github.com/soilmass/gelato/tree/main/evals/${name})`,
    '',
    '---',
    '',
  ].join('\n');
}

// Walk the source line-by-line; inside fenced code blocks (``` ... ```),
// pass through unchanged. Outside fenced blocks, escape `{`/`}` inside
// inline backtick spans to MDX's `\{`/`\}`.
function escapeBracesInInlineCode(source: string): string {
  const lines = source.split('\n');
  let inFenced = false;
  const out: string[] = [];
  for (const line of lines) {
    // Toggle fenced-code state on a line that starts with ``` (possibly
    // indented by a list-item marker).
    if (/^\s*```/.test(line)) {
      inFenced = !inFenced;
      out.push(line);
      continue;
    }
    if (inFenced) {
      out.push(line);
      continue;
    }
    out.push(escapeBracesInLine(line));
  }
  return out.join('\n');
}

// Within a single non-fenced line, walk characters and track whether the
// cursor is inside a single-backtick inline code span. Inside the span,
// rewrite `{`/`}` to `\{`/`\}`.
function escapeBracesInLine(line: string): string {
  const chars: string[] = [];
  let inInline = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    const prev = i > 0 ? line[i - 1] : '';
    // A backslash-escaped backtick `\`` is a literal inside the inline
    // code span; don't toggle state on it. Otherwise, toggle.
    if (ch === '`' && prev !== '\\') {
      inInline = !inInline;
      chars.push(ch);
      continue;
    }
    if (inInline && (ch === '{' || ch === '}')) {
      chars.push('\\');
      chars.push(ch);
      continue;
    }
    chars.push(ch);
  }
  return chars.join('');
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

  // MDX parses `{name}` inside inline code spans as expressions, which blows
  // up when the source snippet references identifiers like `isSelected` /
  // `postId` that aren't in scope. Escape `{` / `}` inside inline-backtick
  // spans to literal `\{` / `\}` so MDX passes them through.
  // Fenced code blocks (``` ... ```) are left alone — MDX already treats
  // them as code.
  const braceEscaped = escapeBracesInInlineCode(autolinkFix);

  const mdx = [preamble(name, fm), braceEscaped].join('');
  // Per-core subdirectory per v0.4.0 plan — docs/app/<core-slug>/skills/<name>/.
  // Core 1 keeps its historical "web-dev" slug. Nextra discovers pages
  // recursively via getPageMap(); redirects for legacy /skills/<name> paths
  // live in docs/next.config.ts.
  const core = fm.metadata?.core ?? 'web-dev';
  const dir = `docs/app/${core}/skills/${name}`;
  await Bun.$`mkdir -p ${dir}`.quiet();
  await writeFile(`${dir}/page.mdx`, mdx, 'utf8');
  console.log(`\u270e ${dir}/page.mdx`);
}

const skills = await discoverSkills();
for (const name of skills) await generate(name);
console.log(`\nGenerated ${skills.length} skill page(s).`);

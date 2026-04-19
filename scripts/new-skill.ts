#!/usr/bin/env bun
// Scaffold a new skill from TEMPLATE.md.
//
// Usage: bun run new-skill <kebab-case-name>
//
// Extracts the frontmatter block and body-structure block from TEMPLATE.md,
// substitutes `<skill-name>` with the provided name, and writes everything to
// skills/<name>/ alongside the three conventional subdirectories
// (scripts, references, assets). Refuses to overwrite an existing skill dir.
//
// Does NOT fill in authorship placeholders (methodology, thresholds, etc.) —
// the author writes those. Does NOT create evals/<name>/; that lands in
// scripts/new-eval.ts (v0.2) or by hand for now.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const NAME_MAX = 64;

function usage(): never {
  console.error('Usage: bun run new-skill <kebab-case-name>');
  process.exit(1);
}

function extractFenced(source: string, fence: string, occurrence = 1): string {
  const needle = `\`\`\`${fence}`;
  let cursor = 0;
  for (let i = 0; i < occurrence; i++) {
    const next = source.indexOf(needle, cursor);
    if (next === -1) {
      throw new Error(
        `TEMPLATE.md: could not find occurrence ${occurrence} of fenced \`\`\`${fence} block`,
      );
    }
    cursor = next + needle.length;
  }
  const contentStart = source.indexOf('\n', cursor) + 1;
  const end = source.indexOf('\n```', contentStart);
  if (end === -1) {
    throw new Error(`TEMPLATE.md: unclosed fenced \`\`\`${fence} block`);
  }
  return source.slice(contentStart, end);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const [name] = process.argv.slice(2);
  if (!name) usage();
  if (!NAME_PATTERN.test(name) || name.length > NAME_MAX) {
    console.error(
      `Invalid skill name '${name}'. Must be kebab-case (^[a-z][a-z0-9-]*$), ≤${NAME_MAX} chars.`,
    );
    process.exit(1);
  }

  const skillDir = resolve('skills', name);
  if (await exists(skillDir)) {
    console.error(`skills/${name}/ already exists. Refusing to overwrite.`);
    process.exit(1);
  }

  const template = await readFile('TEMPLATE.md', 'utf8');
  const frontmatter = extractFenced(template, 'yaml').replace(/^---\n|\n---\n?$/g, '');
  const body = extractFenced(template, 'markdown');

  // Substitute the skill name in three places:
  //   - frontmatter `name:` field (carries a prose description placeholder,
  //     not a literal <skill-name> token — replace the whole line)
  //   - body `# <skill-name>` heading (literal token)
  //   - any remaining <skill-name> occurrences in the body
  const filledFrontmatter = frontmatter
    .replace(/^name:[^\n]*$/m, `name: ${name}`)
    .replace(/<skill-name>/g, name)
    .trimEnd();
  const filledBody = body.replace(/<skill-name>/g, name).trimEnd();

  const filled = ['---', filledFrontmatter, '---', '', filledBody, ''].join('\n');

  await mkdir(skillDir, { recursive: true });
  await mkdir(resolve(skillDir, 'scripts'), { recursive: true });
  await mkdir(resolve(skillDir, 'references'), { recursive: true });
  await mkdir(resolve(skillDir, 'assets'), { recursive: true });
  await writeFile(resolve(skillDir, 'SKILL.md'), filled, 'utf8');

  console.log(`Created skills/${name}/SKILL.md`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Fill the frontmatter: methodology_source, stack_assumptions, changelog');
  console.log('  2. Write the body sections; omit Hard Thresholds for judgment skills');
  console.log(`  3. Create evals/${name}/ with eval.test.ts, fixtures/, promptfoo.yaml, README.md`);
  console.log('  4. Run: bun run validate');
  console.log(`  5. Run: bun run eval ${name}`);
}

await main();

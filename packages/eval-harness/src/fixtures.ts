import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import matter from 'gray-matter';

// Canonical fixture shape. Each fixture is a file with optional YAML
// frontmatter for metadata and freeform content (commit message, diff,
// source code — whatever the skill needs).
export interface Fixture {
  // Filesystem path (absolute or relative, as passed in).
  path: string;
  // Name without extension, with directory prefix preserved so grouped
  // fixtures keep their class (e.g. `good/feat-skills-add-audit`).
  name: string;
  // Direct category (the first path segment inside the fixtures root).
  category: string;
  // Whatever `expected:` was set to in the fixture's frontmatter — `null`
  // when the fixture does not declare an expectation.
  expected: unknown;
  // The file's body after the frontmatter, with leading whitespace trimmed
  // so commit-message fixtures are ready to hand to Commitlint.
  content: string;
  // Full frontmatter as a plain object.
  metadata: Record<string, unknown>;
}

export interface LoadFixturesOptions {
  // Glob extension filter. Defaults to `txt`. Pass `md` for diffs-with-prose
  // or a plain string (no leading dot) for any other extension.
  extension?: string;
}

// Load fixtures from a folder. Expects a conventional layout where the
// immediate subdirectory of `root` is the fixture's category:
//   <root>/good/*.txt
//   <root>/legitimate/*.txt
//   <root>/violations/*.txt
//
// Fixtures at the root (no category folder) get category `''` and are
// usable by skills that do not classify.
export async function loadFixtures(
  root: string,
  options: LoadFixturesOptions = {},
): Promise<Fixture[]> {
  const ext = options.extension ?? 'txt';
  const suffix = `.${ext}`;
  // readdir recursive lands a Dirent[] with .parentPath (Node 20.12+/22+) —
  // used here instead of a glob lib so the harness has zero extra runtime
  // deps and runs identically under Bun and Node (Vitest workers run on Node).
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  const fixtures: Fixture[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(suffix)) continue;
    const parentPath = entry.parentPath ?? root;
    const absPath = join(parentPath, entry.name);
    const relPath = relative(root, absPath);
    const raw = await readFile(absPath, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;

    const nameNoExt = relPath.slice(0, relPath.length - extname(relPath).length);
    const parts = nameNoExt.split(/[/\\]/).filter(Boolean);
    const category = parts.length > 1 ? (parts[0] ?? '') : '';

    fixtures.push({
      path: absPath,
      name: nameNoExt,
      category,
      expected: data.expected ?? null,
      content: parsed.content.replace(/^\s+/, ''),
      metadata: data,
    });
  }

  fixtures.sort((a, b) => a.name.localeCompare(b.name));
  return fixtures;
}

// Convenience: group loaded fixtures by their category folder.
export function groupByCategory(fixtures: Fixture[]): Map<string, Fixture[]> {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const existing = groups.get(fixture.category);
    if (existing) {
      existing.push(fixture);
    } else {
      groups.set(fixture.category, [fixture]);
    }
  }
  return groups;
}

// Convenience: a terse display name derived from the last path segment.
export function fixtureDisplayName(fixture: Fixture): string {
  return basename(fixture.name);
}

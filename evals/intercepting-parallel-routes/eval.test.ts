// Eval for the intercepting-parallel-routes skill.
//
// Procedural eval over virtual file-tree fixtures. Each fixture
// encodes one or more virtual files via `// FILE: <path>\n` markers.
// The classifier parses that into path -> body and runs the four
// rules from SKILL.md § Procedure.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isJudgeAvailable, judgeWithPromptfoo, loadFixtures } from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'slot-without-layout-prop',
  'parallel-missing-default',
  'intercepting-prefix-depth-mismatch',
  'intercepting-without-base-route',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// ---------- virtual file-tree parser ----------

function parseFileTree(body: string): Map<string, string> {
  const tree = new Map<string, string>();
  const lines = body.split('\n');
  let currentPath: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    const m = /^\/\/\s*FILE:\s*(.+?)\s*$/.exec(line);
    if (m) {
      if (currentPath) tree.set(currentPath, buf.join('\n'));
      currentPath = m[1] ?? null;
      buf = [];
    } else if (currentPath) {
      buf.push(line);
    }
  }
  if (currentPath) tree.set(currentPath, buf.join('\n'));
  return tree;
}

// ---------- helpers ----------

function allFolders(tree: Map<string, string>): Set<string> {
  const folders = new Set<string>();
  for (const path of tree.keys()) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }
  return folders;
}

function slotFoldersUnder(parent: string, tree: Map<string, string>): string[] {
  const out: string[] = [];
  for (const folder of allFolders(tree)) {
    const prefix = `${parent}/@`;
    if (folder.startsWith(prefix) && !folder.slice(prefix.length).includes('/')) {
      out.push(folder);
    }
  }
  return out;
}

function parentFolder(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

function layoutFileIn(folder: string, tree: Map<string, string>): string | null {
  const candidate = `${folder}/layout.tsx`;
  return tree.has(candidate) ? candidate : null;
}

// Parse the default-export function's props signature and collect
// destructured names.
const EXPORT_DEFAULT_FN_RE = /export\s+default\s+function\s+\w+\s*\(([^)]*)\)/;

function destructuredSlots(layoutBody: string): Set<string> {
  const m = EXPORT_DEFAULT_FN_RE.exec(layoutBody);
  if (!m) return new Set();
  const sig = m[1] ?? '';
  const braceMatch = /\{([^}]*)\}/.exec(sig);
  if (!braceMatch) return new Set();
  const names = (braceMatch[1] ?? '')
    .split(',')
    .map((s) => s.trim().split(':')[0]?.trim() ?? '')
    .filter(Boolean);
  return new Set(names);
}

// ---------- rules ----------

function findSlotWithoutLayoutProp(tree: Map<string, string>): boolean {
  for (const folder of allFolders(tree)) {
    const name = folder.split('/').pop() ?? '';
    if (!name.startsWith('@')) continue;
    const slotName = name.slice(1);
    if (slotName === 'children') continue;
    const parent = parentFolder(folder);
    const layoutPath = layoutFileIn(parent, tree);
    if (!layoutPath) return true; // slot with no parent layout is a bug
    const body = tree.get(layoutPath) ?? '';
    const slots = destructuredSlots(body);
    if (!slots.has(slotName)) return true;
  }
  return false;
}

function findParallelMissingDefault(tree: Map<string, string>): boolean {
  for (const folder of allFolders(tree)) {
    const name = folder.split('/').pop() ?? '';
    if (!name.startsWith('@')) continue;
    if (name === '@children') continue;
    // Does the slot have a page.tsx anywhere? If so it must also have default.tsx.
    let hasPage = false;
    for (const path of tree.keys()) {
      if (path.startsWith(`${folder}/`) && /\/page\.tsx$/.test(path)) hasPage = true;
    }
    if (!hasPage) continue;
    const hasDefault = tree.has(`${folder}/default.tsx`);
    if (!hasDefault) return true;
  }
  return false;
}

const INTERCEPT_PREFIX_RE = /^\((\.+(?:\)\()?\.*)\)([\w-]+)$/;

function parseInterceptingFolder(folderName: string): {
  depthSteps: number;
  baseName: string;
} | null {
  // Forms: (.)name, (..)name, (..)(..)name, (...)name
  // Normalize by counting how many dots in the paren group, AND whether
  // there's a second `(..)` chunk appended.
  if (folderName.startsWith('(...)')) {
    return { depthSteps: -1, baseName: folderName.slice(5) };
  }
  const m = /^\(((?:\.\.)+|\.)\)(?:\(((?:\.\.)+|\.)\))?([\w-]+)$/.exec(folderName);
  if (!m) return null;
  const first = m[1] ?? '';
  const second = m[2] ?? '';
  const baseName = m[3] ?? '';
  const depthSteps =
    (first === '.' ? 0 : first.length / 2) +
    (second === '' ? 0 : second === '.' ? 0 : second.length / 2);
  return { depthSteps, baseName };
}

// Compute the absolute base path the intercepting folder attempts to intercept.
function interceptingBasePath(
  interceptingPath: string,
): { basePath: string; rootRelative: boolean } | null {
  const name = interceptingPath.split('/').pop() ?? '';
  const parsed = parseInterceptingFolder(name);
  if (!parsed) return null;
  if (parsed.depthSteps === -1) {
    return { basePath: `app/${parsed.baseName}`, rootRelative: true };
  }
  // Route segments only — exclude route groups (foo) and intercepting prefixes.
  const segments = interceptingPath.split('/').slice(0, -1); // parent segments
  // Filter: drop route groups (x) and other intercept prefixes.
  const routeSegments = segments.filter(
    (s, i) => i === 0 || (!/^\(.*\)/.test(s) && !s.startsWith('(')),
  );
  // The first element is "app"; keep it. Walk up depthSteps from routeSegments.
  const upIndex = routeSegments.length - parsed.depthSteps;
  if (upIndex < 1) return null;
  const basePath = `${routeSegments.slice(0, upIndex).join('/')}/${parsed.baseName}`;
  return { basePath, rootRelative: false };
}

function findInterceptingIssues(tree: Map<string, string>): {
  depthMismatch: boolean;
  missingBase: boolean;
} {
  let depthMismatch = false;
  let missingBase = false;
  const folders = allFolders(tree);
  for (const folder of folders) {
    const name = folder.split('/').pop() ?? '';
    if (!/^\(/.test(name)) continue;
    const parsed = parseInterceptingFolder(name);
    if (!parsed) continue;
    const base = interceptingBasePath(folder);
    if (!base) {
      depthMismatch = true;
      continue;
    }
    const baseExists = [...folders].some((f) => f === base.basePath);
    if (!baseExists) {
      // Could be either: depth mismatch (base path refers to a folder
      // that could never exist given the tree) OR missing-base-route.
      // Heuristic: if ANY folder anywhere in the tree is named exactly
      // the base segment, assume depth-mismatch; otherwise missing base.
      const anyMatch = [...folders].some(
        (f) => (f.split('/').pop() ?? '') === (parsed.baseName ?? ''),
      );
      if (anyMatch) depthMismatch = true;
      else missingBase = true;
    }
  }
  return { depthMismatch, missingBase };
}

// ---------- top-level classifier ----------

function classify(body: string): Classification {
  const tree = parseFileTree(body);
  if (findSlotWithoutLayoutProp(tree)) return 'slot-without-layout-prop';
  if (findParallelMissingDefault(tree)) return 'parallel-missing-default';
  const { depthMismatch, missingBase } = findInterceptingIssues(tree);
  if (depthMismatch) return 'intercepting-prefix-depth-mismatch';
  if (missingBase) return 'intercepting-without-base-route';
  return 'safe';
}

// ---------- tests ----------

describe('intercepting-parallel-routes', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const acc = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        acc,
        `misclassified: ${
          wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') ||
          '(none)'
        }`,
      ).toBeGreaterThanOrEqual(0.95);
    });

    it('zero false positives on safe fixtures', async () => {
      const fixtures = await loadFixtures(SAFE_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
      const fp = fixtures
        .map((f) => ({ name: f.name, predicted: classify(f.content) }))
        .filter((r) => r.predicted !== 'safe');
      expect(fp.map((r) => `${r.name} (got ${r.predicted})`)).toEqual([]);
    });

    it('classifier generalizes to held-out adversarial fixtures at ≥ 90%', async () => {
      const fixtures = await loadFixtures(HELD_OUT_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = (f.metadata.class ?? f.metadata.expected) as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const acc = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        acc,
        `held-out misclassified: ${
          wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') ||
          '(none)'
        }`,
      ).toBeGreaterThanOrEqual(0.9);
    });
  });

  it('fixture inventory matches SKILL.md § Evaluation', async () => {
    const safe = await loadFixtures(SAFE_DIR);
    const violations = await loadFixtures(VIOLATIONS_DIR);
    expect(safe.length).toBeGreaterThanOrEqual(4);
    expect(violations.length).toBeGreaterThanOrEqual(4);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"route-structure-remediation" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'route-structure-remediation',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

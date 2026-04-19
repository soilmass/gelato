// Eval for the seo-sitemap-robots skill.
//
// Procedural classifier over sitemap.ts / robots.ts fixtures.
// Reads return-expression object literals and validates per-entry
// fields against sitemaps.org 0.9 + Next MetadataRoute types +
// BCP 47 locale grammar.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isJudgeAvailable,
  judgeWithPromptfoo,
  loadFixtures,
  stripComments,
} from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'sitemap-missing-url',
  'sitemap-bad-lastmodified',
  'sitemap-bad-locale',
  'robots-missing-sitemap-ref',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

function filename(metadata: Record<string, unknown>): string {
  return typeof metadata.filename === 'string' ? metadata.filename : '';
}

const BCP47_RE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/;

// Detect every "entry object" literal `{ ... }` inside the default-export
// return statement's array. We regex-scan for `{` ... `}` balanced pairs
// following a `return [` or `return (`.
function extractSitemapEntries(source: string): string[] {
  const entries: string[] = [];
  // Find the `return` in the default-export body. Walk forward for
  // balanced-depth `{ ... }` groups.
  const retIdx = source.search(/\breturn\b/);
  if (retIdx === -1) return entries;
  const after = source.slice(retIdx);
  const chars = after.split('');
  let depth = 0;
  let start = -1;
  let bracketDepth = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
    else if (ch === '{') {
      if (depth === 0 && bracketDepth > 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        entries.push(after.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return entries;
}

function extractRobotsReturnObject(source: string): string | null {
  const retIdx = source.search(/\breturn\b/);
  if (retIdx === -1) return null;
  const after = source.slice(retIdx);
  const openIdx = after.indexOf('{');
  if (openIdx === -1) return null;
  let depth = 0;
  for (let i = openIdx; i < after.length; i++) {
    const ch = after[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return after.slice(openIdx, i + 1);
    }
  }
  return null;
}

function hasLiteralKey(objSrc: string, key: string): boolean {
  const re = new RegExp(`(?:^|[,{\\s])\\s*(?:"${key}"|'${key}'|${key})\\s*:`);
  return re.test(objSrc);
}

function getLiteralValue(objSrc: string, key: string): string | null {
  const re = new RegExp(`(?:^|[,{\\s])\\s*(?:"${key}"|'${key}'|${key})\\s*:\\s*([^,}\\n]+)`);
  const m = re.exec(objSrc);
  return m?.[1]?.trim() ?? null;
}

// ---------- rule implementations ----------

function hasSitemapMissingUrl(source: string): boolean {
  for (const entry of extractSitemapEntries(source)) {
    if (!hasLiteralKey(entry, 'url')) return true;
  }
  return false;
}

// getLiteralValue above breaks on commas inside string literals (e.g.
// `lastModified: 'April 19, 2026'`). Use a string-aware extractor.
function lastModifiedLiteral(entry: string): string | null {
  const re = /(?:^|[,{\s])\s*(?:"lastModified"|'lastModified'|lastModified)\s*:\s*/;
  const m = re.exec(entry);
  if (!m) return null;
  const start = m.index + m[0].length;
  let i = start;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  while (i < entry.length) {
    const ch = entry[i];
    const prev = i > 0 ? entry[i - 1] : '';
    if (inSingle) {
      if (ch === "'" && prev !== '\\') inSingle = false;
    } else if (inDouble) {
      if (ch === '"' && prev !== '\\') inDouble = false;
    } else {
      if (ch === "'") inSingle = true;
      else if (ch === '"') inDouble = true;
      else if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0) break;
    }
    i++;
  }
  return entry.slice(start, i).trim();
}

function hasSitemapBadLastModified(source: string): boolean {
  for (const entry of extractSitemapEntries(source)) {
    if (!hasLiteralKey(entry, 'lastModified')) continue;
    const raw = lastModifiedLiteral(entry);
    if (!raw) continue;
    // Acceptable:
    //   new Date(...)
    //   new Date()
    //   variable / expression returning Date (we trust identifier refs)
    //   'YYYY-MM-DD...' ISO 8601
    if (/\bnew\s+Date\b/.test(raw)) continue;
    if (/^[a-zA-Z_]\w*(?:\(\))?$/.test(raw)) continue; // identifier or call
    // Plain string literal — must be ISO 8601.
    const strMatch = /^['"]([\s\S]+)['"]$/.exec(raw);
    if (strMatch?.[1]) {
      const s = strMatch[1];
      if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(s)) {
        continue;
      }
      return true;
    }
    // Number literal → bad.
    if (/^\d+$/.test(raw)) return true;
  }
  return false;
}

function hasSitemapBadLocale(source: string): boolean {
  for (const entry of extractSitemapEntries(source)) {
    const langRe = /languages\s*:\s*\{([^}]+)\}/;
    const m = langRe.exec(entry);
    if (!m) continue;
    const body = m[1] ?? '';
    // Keys in JS object literals live at `{<key>:` or `,<key>:`. URL
    // values contain `:` too, so anchor the match to avoid treating
    // `https:` inside a value as a key.
    const keyRe = /(?:^|[,{])\s*(?:"([^"]+)"|'([^']+)'|(\w[\w-]*))\s*:/g;
    for (;;) {
      const km = keyRe.exec(body);
      if (!km) break;
      const key = km[1] ?? km[2] ?? km[3] ?? '';
      if (!BCP47_RE.test(key)) return true;
    }
  }
  return false;
}

function hasRobotsMissingSitemapRef(source: string): boolean {
  const obj = extractRobotsReturnObject(source);
  if (!obj) return false;
  if (!/\brules\s*:/.test(obj)) return false; // not a robots return at all
  return !/\bsitemap\s*:/.test(obj);
}

function classify(body: string, metadata: Record<string, unknown>): Classification {
  const source = stripComments(body);
  const fn = filename(metadata);
  const isSitemap = /sitemap\.ts$/.test(fn);
  const isRobots = /robots\.ts$/.test(fn);
  if (isSitemap) {
    if (hasSitemapMissingUrl(source)) return 'sitemap-missing-url';
    if (hasSitemapBadLastModified(source)) return 'sitemap-bad-lastmodified';
    if (hasSitemapBadLocale(source)) return 'sitemap-bad-locale';
  }
  if (isRobots) {
    if (hasRobotsMissingSitemapRef(source)) return 'robots-missing-sitemap-ref';
  }
  return 'safe';
}

describe('seo-sitemap-robots', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content, f.metadata);
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
        .map((f) => ({ name: f.name, predicted: classify(f.content, f.metadata) }))
        .filter((r) => r.predicted !== 'safe');
      expect(fp.map((r) => `${r.name} (got ${r.predicted})`)).toEqual([]);
    });

    it('classifier generalizes to held-out adversarial fixtures at ≥ 90%', async () => {
      const fixtures = await loadFixtures(HELD_OUT_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(5);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = (f.metadata.class ?? f.metadata.expected) as Classification;
        const predicted = classify(f.content, f.metadata);
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
    it('"sitemap-remediation-implementability" scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'sitemap-remediation-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

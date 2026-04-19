// Eval for the metadata-and-og skill.
//
// Deterministic shape classifier over Next.js Metadata API exports. Each
// fixture is one or more `export const metadata = { ... }` or
// `generateMetadata() { return { ... } }` blocks. The classifier splits
// blocks by their export boundary, extracts the fields it cares about
// via regex, and matches against the four violation classes in SKILL.md
// § Step 2:
//
//   - missing-required   — title / description / canonical absent on an
//                          indexable route
//   - wrong-length       — title > 60, desc < 70 or > 160, og.title > 70
//   - duplicate-canonical — two blocks share a canonical URL
//   - malformed-og       — image entry missing url or dimensions; unknown
//                          openGraph.type
//
// Length boundaries come from references/length-boundaries.md.

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
  'missing-required',
  'wrong-length',
  'duplicate-canonical',
  'malformed-og',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;
const OG_TITLE_MAX = 70;

// Known-good openGraph.type values per OG spec + Next.js docs.
const OG_TYPES = new Set([
  'website',
  'article',
  'profile',
  'book',
  'music.song',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other',
]);

interface MetadataBlock {
  raw: string;
  // Static string literal values; null when the field is absent OR when its
  // value is a non-string expression (identifier, template literal with
  // interpolation, property access, etc.). See `titlePresent` / etc. for
  // presence vs. value distinction.
  title: string | null;
  titlePresent: boolean;
  description: string | null;
  descriptionPresent: boolean;
  canonical: string | null;
  canonicalPresent: boolean;
  noindex: boolean;
  ogTitle: string | null;
  ogTitlePresent: boolean;
  ogType: string | null;
  ogImages: OgImage[];
  hasMetadataBase: boolean;
}

// Split the body into metadata-export blocks. Each block is the text between
// one `export const metadata` / `export async function generateMetadata` /
// `return {` marker and the next.
function splitBlocks(body: string): string[] {
  const markers = [
    /export\s+const\s+metadata\s*=\s*\{/g,
    /export\s+(?:async\s+)?function\s+generateMetadata\s*\([^)]*\)\s*(?::\s*Promise<[^>]+>\s*)?\{[\s\S]*?return\s*\{/g,
  ];
  const boundaries: number[] = [];
  for (const re of markers) {
    for (const m of body.matchAll(re)) {
      if (m.index !== undefined) boundaries.push(m.index);
    }
  }
  boundaries.sort((a, b) => a - b);
  if (boundaries.length === 0) return [body];
  const slices: string[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i] ?? 0;
    const end = boundaries[i + 1] ?? body.length;
    slices.push(body.slice(start, end));
  }
  return slices;
}

function extractString(block: string, field: string): string | null {
  // Returns a string literal's value, OR null if the field is absent or its
  // value is a non-string expression (identifier, template with interpolation,
  // function call). Use `fieldPresent` to distinguish "absent" from "dynamic".
  const re = new RegExp(`\\b${field}\\s*:\\s*(['"\`])([^\\1]*?)\\1(?=[,}\\s\\n])`);
  const m = re.exec(block);
  if (!m) return null;
  // Reject template literals that contain `${...}` interpolation — those are
  // dynamic, not static string values. The eval's length check doesn't apply.
  if (m[1] === '`' && /\$\{/.test(m[2] ?? '')) return null;
  return m[2] ?? null;
}

function fieldPresent(block: string, field: string): boolean {
  // True when `<field>:` appears in the block with any non-empty value,
  // static string or not. Distinguishes dynamic `title: post.title` from
  // a truly-absent title.
  return new RegExp(`\\b${field}\\s*:\\s*\\S`).test(block);
}

function extractBoolean(block: string, path: string): boolean | null {
  // path like `robots.index` — look for `robots: { index: true/false }`.
  const [parent, child] = path.split('.');
  const re = new RegExp(`${parent}\\s*:\\s*\\{[^}]*${child}\\s*:\\s*(true|false)`);
  const m = re.exec(block);
  if (!m) return null;
  return m[1] === 'true';
}

function extractNested(block: string, field: string): string | null {
  // Returns the slice inside `field: { ... }`, or null if absent.
  const idx = block.search(new RegExp(`\\b${field}\\s*:\\s*\\{`));
  if (idx === -1) return null;
  const openIdx = block.indexOf('{', idx);
  let depth = 0;
  for (let i = openIdx; i < block.length; i++) {
    const ch = block[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return block.slice(openIdx + 1, i);
    }
  }
  return null;
}

interface OgImage {
  // Static string URL value, or null when absent or dynamic.
  url: string | null;
  // True when a `url:` key is present (static or dynamic expression).
  urlPresent: boolean;
  hasDimensions: boolean;
}

function parseOgImages(ogBlock: string): OgImage[] {
  const imagesIdx = ogBlock.search(/\bimages\s*:\s*\[/);
  if (imagesIdx === -1) return [];
  const arrayStart = ogBlock.indexOf('[', imagesIdx);
  let depth = 0;
  let end = -1;
  for (let i = arrayStart; i < ogBlock.length; i++) {
    const ch = ogBlock[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  const arrayText = ogBlock.slice(arrayStart + 1, end);
  const images: OgImage[] = [];

  // String-form image: `images: ['https://...', ...]`
  const stringItemRe = /(['"`])([^'"`]+)\1/g;
  // Object-form image: `{ url: '...', width: N, height: N, ... }`
  const objectItemRe = /\{([^{}]*)\}/g;

  for (const m of arrayText.matchAll(objectItemRe)) {
    const inner = m[1] ?? '';
    const url = extractString(inner, 'url');
    const urlPresent = fieldPresent(inner, 'url');
    const hasWidth = /\bwidth\s*:/.test(inner);
    const hasHeight = /\bheight\s*:/.test(inner);
    images.push({ url, urlPresent, hasDimensions: hasWidth && hasHeight });
  }
  // Only treat top-level string literals as string-form images if no objects
  // matched (to avoid double-counting URL strings inside objects).
  if (images.length === 0) {
    for (const m of arrayText.matchAll(stringItemRe)) {
      images.push({ url: m[2] ?? '', urlPresent: true, hasDimensions: false });
    }
  }
  return images;
}

function parseBlock(raw: string): MetadataBlock {
  const title = extractString(raw, 'title');
  const titlePresent = fieldPresent(raw, 'title');
  const description = extractString(raw, 'description');
  const descriptionPresent = fieldPresent(raw, 'description');
  const alternatesBlock = extractNested(raw, 'alternates');
  const canonical = alternatesBlock ? extractString(alternatesBlock, 'canonical') : null;
  const canonicalPresent = alternatesBlock ? fieldPresent(alternatesBlock, 'canonical') : false;
  const robotsIndex = extractBoolean(raw, 'robots.index');
  const noindex = robotsIndex === false;

  const ogBlock = extractNested(raw, 'openGraph');
  const ogTitle = ogBlock ? extractString(ogBlock, 'title') : null;
  const ogTitlePresent = ogBlock ? fieldPresent(ogBlock, 'title') : false;
  const ogType = ogBlock ? extractString(ogBlock, 'type') : null;
  const ogImages = ogBlock ? parseOgImages(ogBlock) : [];
  const hasMetadataBase = /\bmetadataBase\s*:/.test(raw);

  return {
    raw,
    title,
    titlePresent,
    description,
    descriptionPresent,
    canonical,
    canonicalPresent,
    noindex,
    ogTitle,
    ogTitlePresent,
    ogType,
    ogImages,
    hasMetadataBase,
  };
}

function isRemoteUrl(url: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

function classify(content: string): Classification {
  const blocks = splitBlocks(content).map(parseBlock);

  // 1. duplicate-canonical: two blocks share the same canonical value.
  const canonicals = blocks
    .map((b) => b.canonical)
    .filter((c): c is string => typeof c === 'string' && c.length > 0);
  const seenCanonicals = new Set<string>();
  for (const c of canonicals) {
    if (seenCanonicals.has(c)) return 'duplicate-canonical';
    seenCanonicals.add(c);
  }

  // For the remaining three classes, any one block tripping the check makes
  // the fixture belong to that class. Iterate and return on first match.
  for (const b of blocks) {
    if (b.noindex) continue; // exempt from required + length checks

    // 2. missing-required — field must be *present* in the block; dynamic
    // (non-string) values count as present.
    if (!b.titlePresent || !b.descriptionPresent || !b.canonicalPresent) {
      return 'missing-required';
    }

    // 3. wrong-length — only applies to static string values. Dynamic
    // values (identifiers, template literals with interpolation) are
    // exempt because the classifier cannot know the runtime length.
    if (b.title !== null && b.title.length > TITLE_MAX) return 'wrong-length';
    if (
      b.description !== null &&
      (b.description.length < DESC_MIN || b.description.length > DESC_MAX)
    ) {
      return 'wrong-length';
    }
    if (b.ogTitle !== null && b.ogTitle.length > OG_TITLE_MAX) return 'wrong-length';

    // 4. malformed-og
    if (b.ogImages.length > 0) {
      for (const img of b.ogImages) {
        // `urlPresent` without a resolved string value means the fixture
        // supplies a dynamic URL (e.g. `url: post.ogImage`) — accept it;
        // the classifier cannot know if the runtime value is remote.
        if (!img.urlPresent) return 'malformed-og';
        if (img.url !== null && isRemoteUrl(img.url) && !img.hasDimensions) {
          return 'malformed-og';
        }
      }
    }
    if (b.ogType !== null && !OG_TYPES.has(b.ogType)) return 'malformed-og';
  }

  return 'safe';
}

describe('metadata-and-og', () => {
  describe('quantitative — deterministic shape classifier', () => {
    it('classifies 12 violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length, 'expected 12 violation fixtures').toBe(12);

      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const accuracy = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        accuracy,
        `misclassified: ${wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') || '(none)'}`,
      ).toBeGreaterThanOrEqual(0.95);
    });

    it('zero false positives on 5 safe fixtures', async () => {
      const fixtures = await loadFixtures(SAFE_DIR);
      expect(fixtures.length).toBe(5);
      const falsePositives = fixtures
        .map((f) => ({ name: f.name, predicted: classify(f.content) }))
        .filter((r) => r.predicted !== 'safe');
      expect(
        falsePositives.map((r) => `${r.name} (got ${r.predicted})`),
        'every safe fixture must classify as safe',
      ).toEqual([]);
    });

    it('classifier generalizes to held-out adversarial fixtures at ≥ 90%', async () => {
      const fixtures = await loadFixtures(HELD_OUT_DIR);
      expect(fixtures.length).toBeGreaterThanOrEqual(6);
      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = (f.metadata.class ?? f.metadata.expected) as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const accuracy = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        accuracy,
        `held-out misclassified: ${wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') || '(none)'}`,
      ).toBeGreaterThanOrEqual(0.9);
    });
  });

  it('fixture inventory matches SKILL.md § Evaluation', async () => {
    const safe = await loadFixtures(SAFE_DIR);
    const violations = await loadFixtures(VIOLATIONS_DIR);
    expect(safe.length).toBe(5);
    expect(violations.length).toBe(12);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"length-rewrite" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'length-rewrite',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

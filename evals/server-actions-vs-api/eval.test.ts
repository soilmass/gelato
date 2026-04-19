// Eval for the server-actions-vs-api skill.
//
// Deterministic classifier over Next.js route handler files and Server
// Action files. Detects the four violation classes in SKILL.md § Examples
// using signal-based heuristics over the fixture text:
//
//   - mixed-concerns           — route handler with webhook-signature
//     markers AND formData consumption split by a positive `if (<var>)`
//     branch that early-returns before the formData fall-through
//   - action-for-public-api    — `'use server'` file with non-React
//     caller markers (Bearer token, mobile/CLI/third-party JSDoc,
//     verify* helpers)
//   - action-no-revalidation   — `'use server'` file with db.insert /
//     db.update / db.delete and no revalidatePath / revalidateTag call
//   - route-handler-for-form   — route handler consuming formData with
//     no webhook or Bearer markers (should be a Server Action)
//
// No LLM-as-judge half for v0.1 — the four classes are syntactically
// detectable from declarations + header checks. A v0.2 upgrade would use
// ts-morph for AST-level branch analysis of the mixed-concerns case.

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
  'route-handler-for-form',
  'action-for-public-api',
  'action-no-revalidation',
  'mixed-concerns',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// --- Syntactic markers ---------------------------------------------------

const USE_SERVER_DIRECTIVE_RE = /^\s*['"]use server['"]\s*;?\s*$/m;

const ROUTE_HANDLER_RE =
  /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/;

const FORMDATA_CONSUMPTION_RE =
  /await\s+req\.formData\s*\(|(?:^|[\s(,=.])(?:form|formData)\.get\s*\(/;

const WEBHOOK_SIG_RE =
  /stripe-signature|x-hub-signature|x-webhook-|x-github-|x-vendor-signature|x-shopify-hmac|stripe\.webhooks\.construct/i;

const WEBHOOK_UA_BRANCH_RE = /user-agent[\s\S]{0,200}(?:Webhook|Bot)/i;

const BEARER_MARKERS_RE =
  /\bBearer\b|\bauthToken\b|\bapiKey\b|verifyMobileToken|verifyApiKey|verifyApiToken|verifyBearerToken/;

const PUBLIC_API_JSDOC_RE =
  /Mobile-?\s*app-?\s*callable|iOS\s+client|Android\s+client|\bCLI\b|CLI-?callable|Third-?party|v\d+\s+API|npm\s+i\s+-g/i;

const DB_MUTATION_RE = /\bdb\.(?:insert|update|delete)\s*\(/;

const REVALIDATE_RE = /\brevalidatePath\s*\(|\brevalidateTag\s*\(/;

// --- Comment stripping ---------------------------------------------------
// JSDoc `@mobile` and free-text caller hints SHOULD be considered a
// public-API signal — they're the human authoring intent — so we do NOT
// strip block comments here. We DO strip `//` line comments that aren't
// inside URL literals.

function stripLineComments(body: string): string {
  return body.replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

function matchBrace(source: string, openIdx: number): number {
  if (source[openIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// --- Mixed-concerns detection -------------------------------------------
//
// A route handler is mixed-concerns when it contains:
//   1. webhook signature/UA markers, AND
//   2. formData consumption, AND
//   3. a positive `if (<var>) { ...return... }` branch (NOT `if (!<var>)`
//      guard) whose closing brace is followed by formData consumption.
//
// The shape distinguishes a webhook-only handler (guard clauses that
// return on failure) from a mixed endpoint (branch that handles the
// webhook path, then falls through to a React-form path).

function hasMixedConcernsPattern(body: string): boolean {
  const hasWebhookMarker = WEBHOOK_SIG_RE.test(body) || WEBHOOK_UA_BRANCH_RE.test(body);
  if (!hasWebhookMarker) return false;
  if (!FORMDATA_CONSUMPTION_RE.test(body)) return false;

  // Find positive `if (<expr>) {` blocks — skip negated `if (!...)` guards.
  const branchRe = /if\s*\(\s*(?!!)[^)]+\)\s*\{/g;
  for (const m of body.matchAll(branchRe)) {
    if (m.index === undefined) continue;
    const openBrace = body.indexOf('{', m.index);
    if (openBrace === -1) continue;
    const closeBrace = matchBrace(body, openBrace);
    if (closeBrace === -1) continue;
    const blockBody = body.slice(openBrace, closeBrace);
    if (!/\breturn\b/.test(blockBody)) continue;
    const afterBlock = body.slice(closeBrace);
    if (FORMDATA_CONSUMPTION_RE.test(afterBlock)) return true;
  }
  return false;
}

// --- Top-level classifier -----------------------------------------------

function classify(content: string): Classification {
  const body = stripLineComments(content);

  // 1. Mixed-concerns wins — a single endpoint serving two audiences is
  //    the most specific violation.
  if (hasMixedConcernsPattern(body)) return 'mixed-concerns';

  // 2. Server Action classes.
  if (USE_SERVER_DIRECTIVE_RE.test(body)) {
    if (BEARER_MARKERS_RE.test(body) || PUBLIC_API_JSDOC_RE.test(content)) {
      return 'action-for-public-api';
    }
    if (DB_MUTATION_RE.test(body) && !REVALIDATE_RE.test(body)) {
      return 'action-no-revalidation';
    }
    return 'safe';
  }

  // 3. Route handler classes.
  if (ROUTE_HANDLER_RE.test(body)) {
    if (
      FORMDATA_CONSUMPTION_RE.test(body) &&
      !WEBHOOK_SIG_RE.test(body) &&
      !WEBHOOK_UA_BRANCH_RE.test(body) &&
      !BEARER_MARKERS_RE.test(body)
    ) {
      return 'route-handler-for-form';
    }
    return 'safe';
  }

  return 'safe';
}

describe('server-actions-vs-api', () => {
  describe('quantitative — deterministic classifier', () => {
    it('classifies 12 violation fixtures at ≥ 95% accuracy across 4 classes', async () => {
      const fixtures = await loadFixtures(VIOLATIONS_DIR);
      expect(fixtures.length).toBe(12);

      const wrong: { name: string; expected: string; predicted: string }[] = [];
      for (const f of fixtures) {
        const expected = f.category as Classification;
        const predicted = classify(f.content);
        if (predicted !== expected) wrong.push({ name: f.name, expected, predicted });
      }
      const accuracy = (fixtures.length - wrong.length) / fixtures.length;
      expect(
        accuracy,
        `misclassified: ${
          wrong.map((w) => `${w.name} (exp=${w.expected} got=${w.predicted})`).join('; ') ||
          '(none)'
        }`,
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
    expect(safe.length).toBe(5);
    expect(violations.length).toBe(12);
    const byClass = new Map<string, number>();
    for (const f of violations) byClass.set(f.category, (byClass.get(f.category) ?? 0) + 1);
    for (const c of CLASSES) {
      expect(byClass.get(c) ?? 0, `class ${c} has ≥ 1 fixture`).toBeGreaterThan(0);
    }
  });

  describe.skipIf(!isJudgeAvailable())('qualitative — LLM-as-judge', () => {
    it('"decision-tree-grounded" rubric scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'decision-tree-grounded',
      });
      expect(
        result.score,
        `n=${result.nCases} reasons=${result.reasons.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0.85);
    });
  });
});

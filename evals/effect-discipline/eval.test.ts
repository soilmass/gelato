// Eval for the effect-discipline skill.
//
// Procedural eval per EVAL_SPEC.md § Type B. Activates only on
// client components ('use client'); server-only files fall through
// as safe. Four mechanical classes per SKILL.md § Procedure.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasUseClient,
  isJudgeAvailable,
  judgeWithPromptfoo,
  loadFixtures,
  matchCloseBrace,
  stripComments,
} from '@gelato/eval-harness';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTFOO_CONFIG = resolve(here, 'promptfoo.yaml');
const SAFE_DIR = resolve(here, 'fixtures/safe');
const VIOLATIONS_DIR = resolve(here, 'fixtures/violations');
const HELD_OUT_DIR = resolve(here, 'fixtures/held-out');

const CLASSES = [
  'state-from-prop-no-reset',
  'effect-for-derived-value',
  'setstate-in-effect-no-guard',
  'effect-as-event-handler',
] as const;

type ViolationClass = (typeof CLASSES)[number];
type Classification = ViolationClass | 'safe';

// ---------- helpers ----------

// Collect destructured prop names from each function component signature.
const FN_COMPONENT_RE = /function\s+([A-Z]\w*)\s*\(\s*\{([^}]*)\}(?::\s*[^)]+)?\s*\)/g;

function destructuredProps(source: string): Set<string> {
  const out = new Set<string>();
  FN_COMPONENT_RE.lastIndex = 0;
  for (;;) {
    const m = FN_COMPONENT_RE.exec(source);
    if (!m) break;
    const body = m[2] ?? '';
    for (const raw of body.split(',')) {
      const name = raw.trim().split(/[:=]/)[0]?.trim() ?? '';
      if (/^[a-z]/.test(name)) out.add(name);
    }
  }
  return out;
}

// Walk useEffect(() => { ... }, [deps]) invocations. Return each effect's
// body text and dep array.
interface EffectCall {
  bodyStart: number;
  bodyEnd: number;
  body: string;
  deps: string[] | null;
}

function* iterateEffects(source: string): Iterable<EffectCall> {
  const re = /\buseEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g;
  for (;;) {
    const m = re.exec(source);
    if (!m) return;
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = matchCloseBrace(source, openBrace);
    if (closeBrace === -1) return;
    const body = source.slice(openBrace + 1, closeBrace);
    // Find the deps array that follows the body (after the `},`)
    const afterBody = source.slice(closeBrace + 1);
    const depsMatch = /^\s*,\s*\[([^\]]*)\]\s*\)/.exec(afterBody);
    const deps =
      depsMatch && depsMatch[1] !== undefined
        ? depsMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
    yield { bodyStart: openBrace, bodyEnd: closeBrace, body, deps };
    re.lastIndex = closeBrace + 1;
  }
}

// Detect the subscription/teardown exemption.
function hasSubscriptionShape(body: string): boolean {
  if (/\baddEventListener\s*\(/.test(body)) return true;
  if (/\bsubscribe\s*\(/.test(body)) return true;
  if (/\bnew\s+WebSocket\s*\(/.test(body)) return true;
  if (/\bnew\s+EventSource\s*\(/.test(body)) return true;
  if (/\bnew\s+AbortController\s*\(/.test(body) && /\.abort\s*\(/.test(body)) return true;
  if (/\.current\b/.test(body) && /\b(focus|scroll|select|click)\s*\(/.test(body)) return true;
  return false;
}

// ---------- rule implementations ----------

function hasStateFromPropNoReset(source: string, props: Set<string>): boolean {
  const useStateRe = /\buseState\s*\(\s*(\w+)\s*\)/g;
  for (;;) {
    const m = useStateRe.exec(source);
    if (!m) break;
    const ident = m[1] ?? '';
    if (!props.has(ident)) continue;
    // Exempt if some useEffect with the prop in deps also calls setState
    // for the matching state variable (sync-to-prop pattern).
    let synced = false;
    for (const eff of iterateEffects(source)) {
      if (!eff.deps) continue;
      if (!eff.deps.includes(ident)) continue;
      if (/\bset[A-Z]\w*\s*\(/.test(eff.body)) synced = true;
    }
    if (!synced) return true;
  }
  return false;
}

function hasEffectForDerivedValue(source: string, props: Set<string>): boolean {
  for (const eff of iterateEffects(source)) {
    if (!eff.deps) continue;
    if (hasSubscriptionShape(eff.body)) continue;
    const trimmed = eff.body.trim().replace(/;?\s*$/, '');
    const m = /^set[A-Z]\w*\s*\(([\s\S]+)\)$/.exec(trimmed);
    if (!m) continue;
    const arg = (m[1] ?? '').trim();
    if (/\bawait\b|\bfetch\s*\(|\bnew\s+\w/.test(arg)) continue;
    // Prop-sync exemption: setState(prop) where prop is destructured AND
    // the dep array includes it — this is the documented "reset" pattern.
    if (/^[a-zA-Z_]\w*$/.test(arg) && props.has(arg) && eff.deps.includes(arg)) {
      continue;
    }
    return true;
  }
  return false;
}

function hasSetStateInEffectNoGuard(source: string): boolean {
  for (const eff of iterateEffects(source)) {
    if (hasSubscriptionShape(eff.body)) continue;
    // Effect directly calls setState without guard.
    if (!/\bset[A-Z]\w*\s*\(/.test(eff.body)) continue;
    // Guard tokens to accept: if / switch / return (early exit).
    const hasGuard = /\bif\s*\(|\bswitch\s*\(/.test(eff.body);
    if (hasGuard) continue;
    // Self-referencing — e.g. setCount(count + 1). Check if the setter
    // name matches the state name (setFoo -> foo) referenced in the
    // argument.
    const m = /\bset([A-Z]\w*)\s*\(([^)]*)\)/.exec(eff.body);
    if (!m) continue;
    const setter = m[1] ?? '';
    const stateName = setter.charAt(0).toLowerCase() + setter.slice(1);
    const arg = m[2] ?? '';
    if (new RegExp(`\\b${stateName}\\b`).test(arg)) return true;
    // Or: no dep array at all AND ANY setState → infinite loop risk.
    if (eff.deps === null) return true;
  }
  return false;
}

const BOOL_DEP_RE =
  /^(?:is|has|should|was|did)[A-Z]\w*$|^(?:submitted|confirmed|open|visible|ready|loading|active|expanded|selected|pending)$/;
const SIDE_EFFECT_RE =
  /\bfetch\s*\(|\bsendBeacon\s*\(|\bposthog\.\w+\s*\(|\bsentry\.\w+\s*\(|\blogger\.\w+\s*\(|\bconsole\.\w+\s*\(/i;

function hasEffectAsEventHandler(source: string): boolean {
  for (const eff of iterateEffects(source)) {
    if (!eff.deps) continue;
    if (hasSubscriptionShape(eff.body)) continue;
    if (!SIDE_EFFECT_RE.test(eff.body)) continue;
    if (!eff.deps.some((d) => BOOL_DEP_RE.test(d))) continue;
    return true;
  }
  return false;
}

// ---------- top-level classifier ----------

function classify(body: string): Classification {
  const source = stripComments(body);
  if (!hasUseClient(source)) return 'safe';
  const props = destructuredProps(source);
  if (hasStateFromPropNoReset(source, props)) return 'state-from-prop-no-reset';
  if (hasEffectForDerivedValue(source, props)) return 'effect-for-derived-value';
  if (hasSetStateInEffectNoGuard(source)) return 'setstate-in-effect-no-guard';
  if (hasEffectAsEventHandler(source)) return 'effect-as-event-handler';
  return 'safe';
}

// ---------- tests ----------

describe('effect-discipline', () => {
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
    it('"refactor-to-derived-value-implementability" scores ≥ 0.85', async () => {
      const result = await judgeWithPromptfoo({
        config: PROMPTFOO_CONFIG,
        rubric: 'refactor-to-derived-value-implementability',
      });
      expect(result.score, `reasons=${result.reasons.join(' | ')}`).toBeGreaterThanOrEqual(0.85);
    });
  });
});

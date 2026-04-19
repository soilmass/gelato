// Shared TSX/JSX regex primitives for Gelato skill classifiers.
//
// Every eval in evals/<skill>/eval.test.ts uses a deterministic regex
// walk over .tsx source. The patterns below are the ones that turned up
// in ≥3 existing evals (rsc-boundary-audit, sentry-setup, security-headers,
// zod-validation, form-with-server-action). Promoting them here prevents
// drift across the growing classifier set.
//
// The contract is intentionally narrow: regex-only, string in / string
// out, no AST parser imports. A skill that needs AST-level introspection
// (Radix composition tree, effect-discipline dependency graphs) promotes
// @babel/parser / ts-morph inside its own eval.test.ts — not here.

const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_RE = /(^|\s)\/\/[^\n]*/g;

export function stripComments(source: string): string {
  return source.replace(BLOCK_COMMENT_RE, ' ').replace(LINE_COMMENT_RE, '$1');
}

const USE_CLIENT_RE = /^\s*['"]use client['"]\s*;?\s*$/;
const USE_SERVER_RE = /^\s*['"]use server['"]\s*;?\s*$/;

export function hasUseClient(source: string): boolean {
  const firstNonBlank = source.split('\n').find((l) => l.trim() !== '');
  return !!firstNonBlank && USE_CLIENT_RE.test(firstNonBlank);
}

export function hasUseServer(source: string): boolean {
  return source
    .split('\n')
    .slice(0, 5)
    .some((line) => USE_SERVER_RE.test(line));
}

export function matchCloseBrace(body: string, openBraceIdx: number): number {
  if (body[openBraceIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openBraceIdx; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function matchCloseParen(body: string, openParenIdx: number): number {
  if (body[openParenIdx] !== '(') return -1;
  let depth = 0;
  for (let i = openParenIdx; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export interface JsxOpenTag {
  tag: string;
  attrsText: string;
  start: number;
  end: number;
  selfClosing: boolean;
}

// Walk every JSX open tag in the source. Matches both `<Foo ...>` and
// `<Foo ... />`. Tag names include scoped names (`Dialog.Root`) and
// lowercase HTML (`div`). Does not descend into nested strings — if an
// attribute value contains `>` (e.g. `className={`a>b`}`) this walker
// falls back to the last `>` before a newline, which is good enough for
// fixture code that doesn't abuse template literals in JSX attrs.
export function* iterateJsxOpenTags(source: string): Iterable<JsxOpenTag> {
  const stripped = stripComments(source);
  const re = /<([A-Za-z][\w.]*)\s*/g;
  let m: RegExpExecArray | null = re.exec(stripped);
  while (m !== null) {
    const tag = m[1] as string;
    const start = m.index;
    const attrsStart = start + m[0].length;
    const close = findTagClose(stripped, attrsStart);
    if (close === -1) {
      m = re.exec(stripped);
      continue;
    }
    const rawAttrs = stripped.slice(attrsStart, close.end);
    yield {
      tag,
      attrsText: rawAttrs,
      start,
      end: close.end + 1,
      selfClosing: close.selfClosing,
    };
    re.lastIndex = close.end + 1;
    m = re.exec(stripped);
  }
}

// Find the closing `>` of a JSX open tag starting at `from`, tracking
// balanced braces for attribute expressions.
function findTagClose(body: string, from: number): { end: number; selfClosing: boolean } | -1 {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = from; i < body.length; i++) {
    const ch = body[i];
    const prev = i > 0 ? body[i - 1] : '';
    if (inSingle) {
      if (ch === "'" && prev !== '\\') inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '"' && prev !== '\\') inDouble = false;
      continue;
    }
    if (ch === "'") inSingle = true;
    else if (ch === '"') inDouble = true;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0 && ch === '>') {
      const selfClosing = body[i - 1] === '/';
      return { end: i, selfClosing };
    }
  }
  return -1;
}

// Parse attribute name → literal string value from a JSX attrs blob.
// Values:
//   foo="bar"         → "bar"
//   foo='bar'         → "bar"
//   foo={<expr>}      → null (expression — regex can't resolve)
//   foo               → true (bare — e.g. `disabled`, `priority`)
// Quotes are stripped; expressions yield null so callers can distinguish
// "present but dynamic" from "absent".
export function parseJsxAttrs(attrsText: string): Record<string, string | null | true> {
  const out: Record<string, string | null | true> = {};
  const re = /([A-Za-z_][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
  let m: RegExpExecArray | null = re.exec(attrsText);
  while (m !== null) {
    const name = m[1] as string;
    if (m[2] !== undefined) out[name] = m[2];
    else if (m[3] !== undefined) out[name] = m[3];
    else if (m[4] !== undefined) out[name] = null;
    else out[name] = true;
    m = re.exec(attrsText);
  }
  return out;
}

// Extract the token list from a `className` / `class` attribute. Handles:
//   className="a b"                      → ["a", "b"]
//   className={"a b"}                    → ["a", "b"]
//   className={cn("a", "b", cond && "c")} → ["a", "b", "c"]
// Dynamic parts (non-string expressions) are skipped. Callers looking
// for a specific token can check `tokens.includes("min-h-11")`; callers
// looking for Tailwind variants can iterate and match prefixes.
export function extractClassNames(attrsText: string): string[] {
  const attrs = parseJsxAttrs(attrsText);
  const literal = typeof attrs.className === 'string' ? attrs.className : null;
  const tokens: string[] = [];
  if (literal) tokens.push(...literal.split(/\s+/).filter(Boolean));
  const classExprRe = /className\s*=\s*\{([\s\S]*?)\}/;
  const m = classExprRe.exec(attrsText);
  if (m) {
    const inner = m[1] ?? '';
    const strings = inner.match(/"([^"]*)"|'([^']*)'/g) ?? [];
    for (const raw of strings) {
      const unquoted = raw.slice(1, -1);
      tokens.push(...unquoted.split(/\s+/).filter(Boolean));
    }
  }
  return tokens;
}

// Detect whether a given line opens/closes a fenced code block. Used by
// prose-walking classifiers (metadata-and-og, generate-docs) that must
// skip contents of ``` fences. Returns true for any line whose trim
// starts with ```, regardless of language tag.
export function isFencedCode(line: string): boolean {
  return /^\s*```/.test(line);
}

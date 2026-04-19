import { describe, expect, it } from 'vitest';
import {
  extractClassNames,
  hasUseClient,
  hasUseServer,
  isFencedCode,
  iterateJsxOpenTags,
  matchCloseBrace,
  matchCloseParen,
  parseJsxAttrs,
  stripComments,
} from './tsx-classifier.ts';

describe('stripComments', () => {
  it('strips block comments', () => {
    expect(stripComments('const a = 1; /* keep */ const b = 2;')).toBe(
      'const a = 1;   const b = 2;',
    );
  });
  it('strips line comments and preserves preceding whitespace', () => {
    // The line-comment regex captures the leading whitespace in group 1 so
    // subsequent regex can still rely on whitespace separators.
    expect(stripComments('const a = 1; // drop\nconst b = 2;')).toBe('const a = 1; \nconst b = 2;');
  });
  it('preserves URLs inside strings (line-comment regex requires leading whitespace)', () => {
    const src = 'const url = "https://example.com/path";';
    expect(stripComments(src)).toBe(src);
  });
});

describe('hasUseClient / hasUseServer', () => {
  it('detects use client on first non-blank line', () => {
    expect(hasUseClient('"use client";\nimport x from "y";')).toBe(true);
    expect(hasUseClient("'use client'\nexport default ...")).toBe(true);
    expect(hasUseClient('\n\n"use client";\n')).toBe(true);
  });
  it('rejects use client that is not first directive', () => {
    expect(hasUseClient('import x from "y";\n"use client";')).toBe(false);
  });
  it('detects use server within first 5 lines', () => {
    expect(hasUseServer("'use server';\nexport async function ...")).toBe(true);
    expect(hasUseServer('import x;\nimport y;\n"use server";\n')).toBe(true);
  });
});

describe('matchCloseBrace / matchCloseParen', () => {
  it('finds the matching close brace', () => {
    const src = '{ a: { b: 1 }, c: 2 }';
    expect(matchCloseBrace(src, 0)).toBe(src.length - 1);
  });
  it('returns -1 when the source does not start with an open brace', () => {
    expect(matchCloseBrace('no brace', 0)).toBe(-1);
  });
  it('finds the matching close paren with nesting', () => {
    const src = '(foo(bar(baz)))';
    expect(matchCloseParen(src, 0)).toBe(src.length - 1);
  });
});

describe('iterateJsxOpenTags', () => {
  it('yields each open tag with raw attrs', () => {
    const src = '<div className="a"><Button size="sm" disabled /></div>';
    const tags = [...iterateJsxOpenTags(src)].map((t) => ({
      tag: t.tag,
      selfClosing: t.selfClosing,
    }));
    expect(tags).toEqual([
      { tag: 'div', selfClosing: false },
      { tag: 'Button', selfClosing: true },
    ]);
  });
  it('handles scoped tag names (Dialog.Root)', () => {
    const src = '<Dialog.Root><Dialog.Content>x</Dialog.Content></Dialog.Root>';
    const tags = [...iterateJsxOpenTags(src)].map((t) => t.tag);
    expect(tags).toEqual(['Dialog.Root', 'Dialog.Content']);
  });
  it('skips tags inside stripped block comments', () => {
    const src = '/* <Ghost /> */ <Real />';
    const tags = [...iterateJsxOpenTags(src)].map((t) => t.tag);
    expect(tags).toEqual(['Real']);
  });
});

describe('parseJsxAttrs', () => {
  it('parses quoted, braced, and bare attrs', () => {
    const attrs = parseJsxAttrs('size="sm" onClick={handle} disabled className={cn("a","b")}');
    expect(attrs.size).toBe('sm');
    expect(attrs.onClick).toBe(null);
    expect(attrs.disabled).toBe(true);
    expect(attrs.className).toBe(null);
  });
});

describe('extractClassNames', () => {
  it('splits a literal className', () => {
    expect(extractClassNames('className="a b c"')).toEqual(['a', 'b', 'c']);
  });
  it('pulls tokens from cn(...) string literal args', () => {
    const tokens = extractClassNames('className={cn("a", "b", cond && "c")}');
    expect(tokens.sort()).toEqual(['a', 'b', 'c']);
  });
  it('returns empty for fully-dynamic className', () => {
    expect(extractClassNames('className={cls}')).toEqual([]);
  });
});

describe('isFencedCode', () => {
  it('matches fenced-code markers', () => {
    expect(isFencedCode('```ts')).toBe(true);
    expect(isFencedCode('  ```')).toBe(true);
    expect(isFencedCode('const ` = 1')).toBe(false);
  });
});

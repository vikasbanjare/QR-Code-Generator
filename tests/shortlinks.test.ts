import { describe, expect, it } from 'vitest';
import { decodeBase64Utf8, encodeBase64Utf8 } from '../src/lib/github';
import {
  buildRedirectPages,
  parseLinksFile,
  randomSlug,
  redirectPage,
  serializeLinksFile,
  validateDestination,
  validateSlug,
} from '../src/lib/shortlinks';

describe('validateSlug', () => {
  it('accepts simple slugs', () => {
    for (const s of ['abc', 'menu-2026', 'a1b']) expect(validateSlug(s)).toBeNull();
  });
  it('rejects bad shapes and reserved names', () => {
    for (const s of ['ab', 'Abc', '-abc', 'abc-', 'a b', 'a/b', 'x'.repeat(41), 'assets', '404']) {
      expect(validateSlug(s)).not.toBeNull();
    }
  });
  it('generates valid random slugs', () => {
    for (let i = 0; i < 50; i++) expect(validateSlug(randomSlug())).toBeNull();
  });
});

describe('validateDestination', () => {
  it('adds https and normalises', () => {
    expect(validateDestination('example.com/a b')).toEqual({ url: 'https://example.com/a%20b', error: null });
  });
  it('blocks script and data URLs', () => {
    expect(validateDestination('javascript:alert(1)').error).not.toBeNull();
    expect(validateDestination('data:text/html,hi').error).not.toBeNull();
    expect(validateDestination('').error).not.toBeNull();
  });
});

describe('redirect pages', () => {
  it('escapes URLs so they cannot break out of HTML or script', () => {
    const html = redirectPage('https://example.com/?q="><script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('"><');
    expect(html).toContain('\\u003c/script>');
  });

  it('builds one page per valid link and skips invalid ones', () => {
    const { pages, skipped } = buildRedirectPages({
      version: 1,
      links: {
        menu: { url: 'https://example.com/menu', created: '2026-01-01' },
        bad: { url: 'javascript:alert(1)', created: '2026-01-01' },
        assets: { url: 'https://example.com', created: '2026-01-01' },
      },
    });
    expect(Object.keys(pages)).toEqual(['menu/index.html']);
    expect(pages['menu/index.html']).toContain('url=https://example.com/menu');
    expect(skipped.sort()).toEqual(['assets', 'bad']);
  });
});

describe('links file', () => {
  it('round-trips with sorted keys', () => {
    const text = serializeLinksFile({ version: 1, links: { b: { url: 'https://b.co/', created: 'x' }, a: { url: 'https://a.co/', created: 'y' } } });
    expect(Object.keys(parseLinksFile(text).links)).toEqual(['a', 'b']);
  });
  it('rejects malformed files', () => {
    expect(() => parseLinksFile('{"nope":1}')).toThrow();
  });
  it('base64-encodes UTF-8 for the GitHub API', () => {
    const s = 'चाय ☕ café';
    expect(decodeBase64Utf8(encodeBase64Utf8(s))).toBe(s);
  });
});

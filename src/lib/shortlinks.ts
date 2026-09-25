// Short links stored as a plain JSON file in the repository. At build time every entry
// becomes a static redirect page (/<slug>/index.html), so links need no server or database
// and keep working for as long as the site is hosted.

export interface ShortLink {
  url: string;
  created: string;
  updated?: string;
}

export interface LinksFile {
  version: 1;
  links: Record<string, ShortLink>;
}

export const EMPTY_LINKS: LinksFile = { version: 1, links: {} };

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

/** Paths the site itself uses; a short link must never shadow them. */
export const RESERVED_SLUGS = new Set(['assets', 'index', 'index.html', '404', '404.html', 'links', 'links.json', 'api', 'admin', 'tools', 'qr']);

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (0/o, 1/l/i)

export function randomSlug(length = 6, random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < length; i++) s += SLUG_ALPHABET[Math.floor(random() * SLUG_ALPHABET.length)];
  return s;
}

export function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return 'Use 3–40 lowercase letters, numbers or dashes (not at the start or end).';
  if (RESERVED_SLUGS.has(slug)) return `“${slug}” is reserved by the site.`;
  return null;
}

/** Only http(s) destinations are allowed — anything else (javascript:, data:) could run code. */
export function validateDestination(raw: string): { url: string; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: '', error: 'Enter the long URL to shorten.' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { url: withScheme, error: 'That is not a valid URL.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { url: withScheme, error: 'Only http:// and https:// links can be shortened.' };
  }
  if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
    return { url: withScheme, error: 'The web address looks incomplete.' };
  }
  return { url: parsed.href, error: null };
}

export function parseLinksFile(text: string): LinksFile {
  const data = JSON.parse(text) as Partial<LinksFile>;
  if (!data || typeof data !== 'object' || typeof data.links !== 'object' || data.links === null) {
    throw new Error('links.json is not in the expected format.');
  }
  return { version: 1, links: data.links as Record<string, ShortLink> };
}

export function serializeLinksFile(file: LinksFile): string {
  const sorted = Object.fromEntries(Object.entries(file.links).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ version: 1, links: sorted }, null, 2)}\n`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** A redirect page that works with and without JavaScript. */
export function redirectPage(url: string): string {
  const safe = escapeHtml(url);
  // JSON.stringify alone would let "</script>" close the tag; escape "<" as well.
  const js = JSON.stringify(url).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer-when-downgrade">
<meta http-equiv="refresh" content="0; url=${safe}">
<link rel="canonical" href="${safe}">
<title>Redirecting…</title>
<script>location.replace(${js});</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
<p>Redirecting to <a href="${safe}">${safe}</a></p>
</body>
</html>
`;
}

/**
 * Turns the links file into { "<slug>/index.html": html } for the build. Invalid entries are
 * skipped and reported rather than failing the whole site build.
 */
export function buildRedirectPages(file: LinksFile): { pages: Record<string, string>; skipped: string[] } {
  const pages: Record<string, string> = {};
  const skipped: string[] = [];
  for (const [slug, link] of Object.entries(file.links)) {
    const dest = validateDestination(link?.url ?? '');
    if (validateSlug(slug) || dest.error) {
      skipped.push(slug);
      continue;
    }
    pages[`${slug}/index.html`] = redirectPage(dest.url);
  }
  return { pages, skipped };
}

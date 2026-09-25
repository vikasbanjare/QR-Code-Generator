// Minimal GitHub REST client used by the link shortener to read and commit links.json.
// The token is a fine-grained personal access token that never leaves the owner's browser.
import { EMPTY_LINKS, parseLinksFile, serializeLinksFile, type LinksFile } from './shortlinks';

export const REPO = { owner: 'vikasbanjare', repo: 'QR-Code-Generator', path: 'links.json' } as const;

const API = 'https://api.github.com';
const TOKEN_KEY = 'forever-tools.github-token';

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the token then lasts for this page only.
  }
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const hint =
      res.status === 401 ? 'The token is invalid or expired.'
      : res.status === 403 ? 'The token does not have permission to write to this repository.'
      : res.status === 404 ? 'Repository not found for this token — check its repository access.'
      : res.status === 409 ? 'Someone else changed the links at the same time.'
      : `GitHub returned ${res.status}.`;
    throw new GitHubError(hint, res.status);
  }
  return (await res.json()) as T;
}

interface RepoInfo {
  default_branch: string;
  permissions?: { push?: boolean };
}

/** Confirms the token can push to the repository and returns the branch to commit to. */
export async function verifyToken(token: string): Promise<{ branch: string }> {
  const info = await call<RepoInfo>(token, `/repos/${REPO.owner}/${REPO.repo}`);
  if (!info.permissions?.push) {
    throw new GitHubError('The token can read the repository but cannot write to it. Give it “Contents: Read and write”.', 403);
  }
  return { branch: info.default_branch };
}

interface ContentResponse {
  sha: string;
  content: string;
}

export async function readLinks(token: string, branch: string): Promise<{ file: LinksFile; sha: string | null }> {
  try {
    const res = await call<ContentResponse>(token, `/repos/${REPO.owner}/${REPO.repo}/contents/${REPO.path}?ref=${encodeURIComponent(branch)}`);
    return { file: parseLinksFile(decodeBase64Utf8(res.content)), sha: res.sha };
  } catch (e) {
    // A missing links.json just means no links yet; the first save creates it.
    if (e instanceof GitHubError && e.status === 404) return { file: EMPTY_LINKS, sha: null };
    throw e;
  }
}

/**
 * Applies `change` to the latest links.json and commits it. On a concurrent edit (409) the
 * file is re-read and the change re-applied once.
 */
export async function updateLinks(
  token: string,
  branch: string,
  message: string,
  change: (file: LinksFile) => LinksFile,
): Promise<LinksFile> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { file, sha } = await readLinks(token, branch);
    const next = change(file);
    try {
      await call(token, `/repos/${REPO.owner}/${REPO.repo}/contents/${REPO.path}`, {
        method: 'PUT',
        body: JSON.stringify({ message, branch, content: encodeBase64Utf8(serializeLinksFile(next)), ...(sha ? { sha } : {}) }),
      });
      return next;
    } catch (e) {
      if (!(e instanceof GitHubError && e.status === 409) || attempt === 1) throw e;
    }
  }
  throw new Error('unreachable');
}

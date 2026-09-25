import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { TextInput } from '../../components/ui';
import { GitHubError, loadToken, readLinks, REPO, storeToken, updateLinks, verifyToken } from '../../lib/github';
import { randomSlug, validateDestination, validateSlug, type LinksFile } from '../../lib/shortlinks';
import { navigate } from '../../site/router';

/** The published site root, e.g. https://vikasbanjare.github.io/QR-Code-Generator/ */
const SITE_BASE = new URL('./', location.href.split('#')[0]).href;
const shortUrl = (slug: string) => `${SITE_BASE}${slug}`;

type LiveState = 'publishing' | 'live' | 'slow';

function errorText(e: unknown) {
  return e instanceof GitHubError || e instanceof Error ? e.message : String(e);
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-small btn-soft copy-btn${done ? ' done' : ''}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt('Copy this link:', text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      <span className="copy-label">{done ? 'Copied' : label}</span>
    </button>
  );
}

function ConnectPanel({ onConnected }: { onConnected: (token: string, branch: string) => void }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { branch } = await verifyToken(token.trim());
      storeToken(token.trim());
      onConnected(token.trim(), branch);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card connect-card">
      <h2>Connect your GitHub (one time)</h2>
      <p className="muted">
        Short links are saved in <code>links.json</code> in your repository <strong>{REPO.owner}/{REPO.repo}</strong>. To save them, this
        page needs a GitHub key (a “token”) that can only edit that one repository.
      </p>
      <ol className="connect-steps">
        <li>
          Open{' '}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            GitHub → New fine-grained token
          </a>
          .
        </li>
        <li>Name it “Forever Tools links” and pick the longest expiration.</li>
        <li>
          Under <strong>Repository access</strong> choose <em>Only select repositories</em> → <strong>{REPO.repo}</strong>.
        </li>
        <li>
          Under <strong>Permissions → Repository permissions</strong>, set <strong>Contents</strong> to <em>Read and write</em>.
        </li>
        <li>Click <strong>Generate token</strong>, copy it and paste it below.</li>
      </ol>
      <form onSubmit={connect} className="connect-form">
        <TextInput label="GitHub token" type="password" value={token} placeholder="github_pat_…" onChange={setToken} />
        <button className="btn btn-primary" disabled={!token.trim() || busy}>{busy ? 'Checking…' : 'Connect'}</button>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}
      <p className="hint">
        The token stays in this browser only. If it expires, existing links keep working; you only need a new token to create or edit links.
      </p>
    </section>
  );
}

export function LinkTool() {
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [branch, setBranch] = useState<string | null>(null);
  const [file, setFile] = useState<LinksFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveState>>({});
  const [editing, setEditing] = useState<{ slug: string; url: string } | null>(null);
  const [filter, setFilter] = useState('');
  const pollers = useRef(new Map<string, number>());

  // Verify a stored token and load the current links.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { branch } = await verifyToken(token);
        const { file } = await readLinks(token, branch);
        if (!cancelled) {
          setBranch(branch);
          setFile(file);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => () => pollers.current.forEach((id) => clearInterval(id)), []);

  /** Polls the published links.json until the new destination is live (usually 1–2 minutes). */
  const watch = useCallback((s: string, dest: string) => {
    setLive((l) => ({ ...l, [s]: 'publishing' }));
    const started = Date.now();
    clearInterval(pollers.current.get(s));
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`${SITE_BASE}links.json?t=${Date.now()}`, { cache: 'no-store' });
        const data = res.ok ? ((await res.json()) as LinksFile) : null;
        if (data?.links?.[s]?.url === dest) {
          setLive((l) => ({ ...l, [s]: 'live' }));
          clearInterval(id);
          return;
        }
      } catch {
        // Network hiccup; keep polling.
      }
      if (Date.now() - started > 6 * 60_000) {
        setLive((l) => ({ ...l, [s]: 'slow' }));
        clearInterval(id);
      }
    }, 8000);
    pollers.current.set(s, id);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!token || !branch) return;
    setFormError(null);
    const dest = validateDestination(url);
    if (dest.error) return setFormError(dest.error);
    const wanted = slug.trim().toLowerCase();
    if (wanted) {
      const err = validateSlug(wanted);
      if (err) return setFormError(err);
    }
    setBusy(true);
    try {
      let finalSlug = wanted;
      const next = await updateLinks(token, branch, wanted ? `Add short link /${wanted}` : 'Add short link', (current) => {
        if (wanted && current.links[wanted]) throw new Error(`/${wanted} is already taken. Pick another name.`);
        // Re-pick on every attempt so a retry after a concurrent edit can't reuse a taken name.
        if (!wanted) {
          do finalSlug = randomSlug();
          while (current.links[finalSlug]);
        }
        return { ...current, links: { ...current.links, [finalSlug]: { url: dest.url, created: new Date().toISOString() } } };
      });
      setFile(next);
      setCreated(finalSlug);
      setUrl('');
      setSlug('');
      watch(finalSlug, dest.url);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!token || !branch || !editing) return;
    const dest = validateDestination(editing.url);
    if (dest.error) return setLoadError(dest.error);
    setBusy(true);
    try {
      const target = editing.slug;
      const next = await updateLinks(token, branch, `Change destination of /${target}`, (current) => {
        const existing = current.links[target];
        if (!existing) throw new Error(`/${target} no longer exists.`);
        return { ...current, links: { ...current.links, [target]: { ...existing, url: dest.url, updated: new Date().toISOString() } } };
      });
      setFile(next);
      setEditing(null);
      setLoadError(null);
      watch(target, dest.url);
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    storeToken(null);
    setToken(null);
    setBranch(null);
    setFile(null);
  }

  const entries = useMemo(() => {
    const all = Object.entries(file?.links ?? {}).sort(([, a], [, b]) => (b.created ?? '').localeCompare(a.created ?? ''));
    const q = filter.trim().toLowerCase();
    return q ? all.filter(([s, l]) => s.includes(q) || l.url.toLowerCase().includes(q)) : all;
  }, [file, filter]);

  if (!token) return <div className="tool-narrow"><ConnectPanel onConnected={(t, b) => { setToken(t); setBranch(b); }} /></div>;

  const liveBadge = (s: string) => {
    const state = live[s];
    if (!state) return null;
    return (
      <span className={`live-badge live-${state}`}>
        {state === 'live' ? 'Live' : state === 'publishing' ? 'Publishing…' : 'Still publishing: check GitHub Actions'}
      </span>
    );
  };

  return (
    <div className="tool-narrow">
      <section className="card create-card">
        {/* noValidate: people type "example.com" without https://, which validateDestination fixes up. */}
        <form onSubmit={create} noValidate>
          <TextInput label="Long URL" inputMode="url" value={url} placeholder="https://example.com/a/very/long/link" onChange={setUrl} />
          <div className="field">
            <label htmlFor="slug">Custom name (optional)</label>
            <div className="slug-input">
              <span className="slug-prefix" title={SITE_BASE}>
                {/* rtl trims long addresses from the left; <bdi> keeps the text itself in normal order. */}
                <bdi>{SITE_BASE.replace(/^https?:\/\//, '')}</bdi>
              </span>
              <input id="slug" value={slug} placeholder="menu" spellCheck={false} autoCapitalize="none" onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
            </div>
            <p className="hint">Leave empty for a random name like /k7m2qa.</p>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || !branch || !url.trim()}>
            {busy ? 'Saving…' : 'Create short link'}
          </button>
        </form>
        {formError && <p className="error-text" role="alert">{formError}</p>}
        {loadError && <p className="error-text" role="alert">{loadError}</p>}

        {created && file?.links[created] && (
          <div className="result pop-in" role="status">
            <div className="result-link">
              <a href={shortUrl(created)} target="_blank" rel="noreferrer">{shortUrl(created).replace(/^https?:\/\//, '')}</a>
              {liveBadge(created)}
            </div>
            <p className="hint">Goes to {file.links[created].url}. New links usually go live within 1–2 minutes.</p>
            <div className="result-actions">
              <CopyButton text={shortUrl(created)} label="Copy link" />
              <button type="button" className="btn btn-small btn-soft" onClick={() => navigate('/qr', { url: shortUrl(created) })}>Make QR code</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="list-head">
          <h2>Your links {file && <span className="count">{Object.keys(file.links).length}</span>}</h2>
          {file && Object.keys(file.links).length > 4 && (
            <input className="search" placeholder="Search links" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search links" />
          )}
        </div>
        {!file && !loadError && <p className="muted">Loading your links…</p>}
        {file && entries.length === 0 && <p className="muted">{filter ? 'No links match.' : 'No links yet. Create your first one above.'}</p>}
        <ul className="link-list">
          {entries.map(([s, l]) => (
            <li key={s} className="link-row">
              <div className="link-main">
                <div className="link-slug">
                  <a href={shortUrl(s)} target="_blank" rel="noreferrer">/{s}</a>
                  {liveBadge(s)}
                </div>
                {editing?.slug === s ? (
                  <div className="edit-row">
                    <input value={editing.url} onChange={(e) => setEditing({ slug: s, url: e.target.value })} aria-label={`New destination for /${s}`} autoFocus />
                    <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={saveEdit}>Save</button>
                    <button type="button" className="btn btn-small btn-soft" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                ) : (
                  <div className="link-dest" title={l.url}>{l.url}</div>
                )}
              </div>
              {editing?.slug !== s && (
                <div className="link-actions">
                  <CopyButton text={shortUrl(s)} />
                  <button type="button" className="btn btn-small btn-soft" onClick={() => navigate('/qr', { url: shortUrl(s) })}>QR</button>
                  <button type="button" className="btn btn-small btn-soft" onClick={() => setEditing({ slug: s, url: l.url })}>Edit</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {editing && <p className="hint">Changing the destination also changes where every printed QR code of this link goes.</p>}
      </section>

      <p className="fine-print">
        Links can’t be deleted here on purpose: a deleted link breaks every place it was shared or printed. Point it somewhere new instead.{' '}
        <button type="button" className="text-btn" onClick={disconnect}>Disconnect GitHub</button>
      </p>
    </div>
  );
}

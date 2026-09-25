import { useEffect, useState, type ReactNode } from 'react';
import { LinkTool } from '../tools/links/LinkTool';
import { QrTool } from '../tools/qr/QrTool';
import { GitHubIcon } from './icons';
import { Landing } from './Landing';
import { href, useRoute } from './router';
import { LIVE_TOOLS, SITE, TOOLS, type ToolInfo } from './tools';

function Logo() {
  return (
    <a className="logo" href={href('/')} aria-label={`${SITE.name} home`}>
      <span className="logo-mark" aria-hidden="true">
        <i /><i /><i /><i />
      </span>
      <span>{SITE.name}</span>
    </a>
  );
}

function Header({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}${open ? ' open' : ''}`}>
      <div className="container header-inner">
        <Logo />
        <button className="menu-toggle" aria-expanded={open} aria-controls="site-nav" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          <span /><span />
        </button>
        <nav id="site-nav" className="site-nav" aria-label="Main">
          {LIVE_TOOLS.map((t) => (
            <a key={t.id} href={href(t.path)} className={path === t.path ? 'active' : ''} aria-current={path === t.path ? 'page' : undefined}>
              {t.name}
            </a>
          ))}
          <a className="nav-github" href={SITE.repoUrl} target="_blank" rel="noreferrer" aria-label="Source code on GitHub">
            <GitHubIcon />
          </a>
        </nav>
      </div>
    </header>
  );
}

function ToolPage({ tool, children }: { tool: ToolInfo; children: ReactNode }) {
  const Icon = tool.icon;
  return (
    <>
      <section className="tool-hero">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href={href('/')}>All tools</a>
            <span aria-hidden="true">/</span>
            <span>{tool.name}</span>
          </nav>
          <div className="tool-title">
            <span className="tool-icon lg" style={{ color: tool.accent, background: `${tool.accent}14` }}><Icon /></span>
            <div>
              <h1>{tool.name}</h1>
              <p>{tool.description}</p>
            </div>
          </div>
        </div>
      </section>
      <div className="container tool-body">{children}</div>
    </>
  );
}

function NotFound() {
  return (
    <section className="section">
      <div className="container empty-state">
        <h1>Page not found</h1>
        <p>That page doesn’t exist.</p>
        <a className="btn btn-primary" href={href('/')}>Back to all tools</a>
      </div>
    </section>
  );
}

export function Site() {
  const { path, params } = useRoute();
  const tool = TOOLS.find((t) => t.status === 'live' && t.path === path);

  useEffect(() => {
    document.title = tool ? `${tool.name} · ${SITE.name}` : `${SITE.name}: free tools that never expire`;
  }, [tool]);

  let page: ReactNode;
  if (path === '/') page = <Landing />;
  else if (tool?.id === 'qr') page = <ToolPage tool={tool}><QrTool key={params.get('url') ?? ''} initialUrl={params.get('url') ?? undefined} /></ToolPage>;
  else if (tool?.id === 'links') page = <ToolPage tool={tool}><LinkTool /></ToolPage>;
  else page = <NotFound />;

  return (
    <div className="site">
      {/* Not a #fragment link: the hash is used for routing. */}
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>Skip to content</button>
      <Header path={path} />
      {/* Keyed by route so each page plays its enter animation. */}
      <main id="main" key={path} className="page-enter" tabIndex={-1}>
        {page}
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Logo />
          <nav aria-label="Tools">
            {LIVE_TOOLS.map((t) => <a key={t.id} href={href(t.path)}>{t.name}</a>)}
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <p>Free and open source. Nothing you type leaves your browser unless you save a short link.</p>
        </div>
      </footer>
    </div>
  );
}

import { useMemo } from 'react';
import { buildMatrix, inFinder, isDark } from '../lib/matrix';
import { ArrowIcon, InfinityIcon, LockIcon, ShieldIcon } from './icons';
import { resetPointer, trackPointer, useReveal } from './motion';
import { href } from './router';
import { SITE, TOOLS } from './tools';

/** A real, scannable QR whose modules ripple in from the centre. */
function HeroQr() {
  const cells = useMemo(() => {
    const m = buildMatrix('https://vikasbanjare.github.io/QR-Code-Generator/', 'M');
    const out: Array<{ x: number; y: number; d: number }> = [];
    const c = m.size / 2;
    for (let y = 0; y < m.size; y++) {
      for (let x = 0; x < m.size; x++) {
        if (isDark(m, y, x) && !inFinder(m.size, y, x)) out.push({ x, y, d: Math.hypot(x - c, y - c) });
      }
    }
    return { size: m.size, cells: out };
  }, []);
  const n = cells.size;
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]];
  return (
    <svg className="hero-qr" viewBox={`-4 -4 ${n + 8} ${n + 8}`} role="img" aria-label="Sample QR code">
      <rect x="-4" y="-4" width={n + 8} height={n + 8} rx="3" fill="#fff" />
      {cells.cells.map(({ x, y, d }) => (
        <rect key={`${x}-${y}`} className="hero-cell" x={x + 0.08} y={y + 0.08} width="0.84" height="0.84" rx="0.3" style={{ animationDelay: `${0.25 + d * 0.035}s` }} />
      ))}
      {eyes.map(([x, y]) => (
        <g key={`${x}-${y}`} className="hero-eye">
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx="1.8" fill="none" stroke="var(--navy)" strokeWidth="1" />
          <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.9" fill="var(--orange-ink)" />
        </g>
      ))}
    </svg>
  );
}

const PROMISES = [
  { icon: InfinityIcon, title: 'Nothing expires', text: 'QR codes hold your real link inside them. No middleman server means nothing that can be switched off.' },
  { icon: LockIcon, title: 'Your data stays yours', text: 'Codes are made in your browser. Short links live in your own GitHub repository, not someone else’s database.' },
  { icon: ShieldIcon, title: 'Checked before you print', text: 'Every QR code is scanned automatically, and colours or logos that could fail are flagged before export.' },
];

const STEPS = [
  { title: 'Pick a tool', text: 'Everything is free and runs in your browser. No account needed.' },
  { title: 'Make it yours', text: 'Add your logo and colours, or pick a custom short name.' },
  { title: 'Download & share', text: 'Print-ready files, or a short link that points wherever you choose.' },
];

export function Landing() {
  useReveal();
  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Free · No sign-up · No expiry</span>
            <h1>
              Everyday tools that <span className="highlight">never expire</span>.
            </h1>
            <p className="lead">
              Make branded QR codes and short links that keep working for as long as you need them. No subscription and no expiry date.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href={href('/qr')}>
                Make a QR code <ArrowIcon />
              </a>
              <a className="btn btn-ghost" href={href('/links')}>
                Shorten a link
              </a>
            </div>
          </div>
          <div className="hero-visual" onMouseMove={trackPointer} onMouseLeave={resetPointer}>
            <div className="hero-card">
              <HeroQr />
            </div>
            <div className="chip chip-a"><span className="dot pass" />Scan-safe</div>
            <div className="chip chip-b"><InfinityIcon /> No expiry</div>
          </div>
        </div>
      </section>

      <section className="section" id="tools">
        <div className="container">
          <div className="section-head reveal">
            <h2>Tools</h2>
            <p>Pick one to get started. More are on the way.</p>
          </div>
          <div className="tool-grid">
            {TOOLS.map((t, i) => {
              const Icon = t.icon;
              const body = (
                <>
                  <span className="tool-icon" style={{ color: t.accent, background: `${t.accent}14` }}><Icon /></span>
                  <h3>{t.name}</h3>
                  <p>{t.tagline}</p>
                  {t.features.length > 0 && (
                    <ul className="tool-features">
                      {t.features.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  )}
                  {t.status === 'live' ? (
                    <span className="tool-cta">Open tool <ArrowIcon /></span>
                  ) : (
                    <span className="soon-badge">Coming soon</span>
                  )}
                </>
              );
              return t.status === 'live' ? (
                <a key={t.id} href={href(t.path)} className="tool-card reveal" style={{ transitionDelay: `${i * 80}ms` }} onMouseMove={trackPointer}>
                  {body}
                </a>
              ) : (
                <div key={t.id} className="tool-card tool-card-soon reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <div className="section-head reveal">
            <h2>Why nothing here expires</h2>
            <p>Most QR and link services send every scan through their own servers, so they can switch your links off when you stop paying. These tools don’t work that way.</p>
          </div>
          <div className="promise-grid">
            {PROMISES.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="promise reveal" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="promise-icon"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <h2>How it works</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step-card reveal" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="step-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-cta">
        <div className="container">
          <div className="cta-band reveal">
            <div>
              <h2>Ready when you are.</h2>
              <p>Free and open source on GitHub.</p>
            </div>
            <div className="hero-actions">
              <a className="btn btn-light" href={href('/qr')}>Make a QR code <ArrowIcon /></a>
              <a className="btn btn-outline-light" href={SITE.repoUrl} target="_blank" rel="noreferrer">View source</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

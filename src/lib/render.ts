// SVG-first renderer. Everything is drawn in module units so the output is resolution
// independent; PNG and PDF exports are derived from this single SVG.
import type { Design, EyeBallStyle, EyeFrameStyle, Logo } from './design';
import { MIN_QUIET_ZONE } from './design';
import { inFinder, isDark, type QrMatrix } from './matrix';

type Radii = [number, number, number, number]; // tl, tr, br, bl

export interface LogoGeometry {
  /** Centre of the symbol, in symbol module coordinates. */
  center: number;
  /** Side of the plate (logo + padding), in modules. */
  box: number;
  /** Side of the logo image itself, in modules. */
  logoSize: number;
  /** True when the requested size had to be reduced to keep finder patterns clear. */
  clamped: boolean;
  /** Modules (dark or light) that sit under the plate. */
  coveredModules: number;
}

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
  /** Symbol + quiet zone side, in modules. */
  qrSide: number;
  logo: LogoGeometry | null;
}

const f = (n: number) => Number(n.toFixed(3)).toString();

function roundedRect(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: Radii): string {
  return (
    `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}` +
    (tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + w)} ${f(y + tr)}` : '') +
    `V${f(y + h - br)}` +
    (br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)}` : '') +
    `H${f(x + bl)}` +
    (bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + h - bl)}` : '') +
    `V${f(y + tl)}` +
    (tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : '') +
    'Z'
  );
}

function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

function diamond(x: number, y: number, s: number): string {
  const h = s / 2;
  return `M${f(x + h)} ${f(y)}L${f(x + s)} ${f(y + h)}L${f(x + h)} ${f(y + s)}L${f(x)} ${f(y + h)}Z`;
}

/** Leaf shapes round the eye's outer corner and the corner facing the symbol centre. */
function leafRadii(corner: 'tl' | 'tr' | 'bl', r: number): Radii {
  return corner === 'tl' ? [r, 0, r, 0] : [0, r, 0, r];
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export function logoGeometry(m: QrMatrix, logo: Logo): LogoGeometry {
  const center = m.size / 2;
  // Keep one clear module between the plate and each finder separator.
  const maxBox = Math.max(0, m.size - 18);
  const requested = logo.size * m.size + 2 * logo.padding;
  const box = Math.min(requested, maxBox);
  const logoSize = Math.max(0, box - 2 * logo.padding);
  let covered = 0;
  const half = box / 2;
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      const dx = c + 0.5 - center;
      const dy = r + 0.5 - center;
      const inside = logo.shape === 'circle' ? dx * dx + dy * dy <= half * half : Math.abs(dx) <= half && Math.abs(dy) <= half;
      if (inside) covered++;
    }
  }
  return { center, box, logoSize, clamped: requested > maxBox + 1e-9, coveredModules: covered };
}

function isCovered(geo: LogoGeometry, shape: Logo['shape'], row: number, col: number): boolean {
  const dx = col + 0.5 - geo.center;
  const dy = row + 0.5 - geo.center;
  const half = geo.box / 2;
  return shape === 'circle' ? dx * dx + dy * dy <= half * half : Math.abs(dx) <= half && Math.abs(dy) <= half;
}

function bodyPath(m: QrMatrix, design: Design, off: number, skip: (r: number, c: number) => boolean): string {
  const on = (r: number, c: number) => isDark(m, r, c) && !inFinder(m.size, r, c) && !skip(r, c);
  const parts: string[] = [];
  const n = m.size;

  if (design.body === 'bars-v' || design.body === 'bars-h') {
    const vertical = design.body === 'bars-v';
    const w = 0.8;
    const inset = (1 - w) / 2;
    for (let a = 0; a < n; a++) {
      let b = 0;
      while (b < n) {
        const [r, c] = vertical ? [b, a] : [a, b];
        if (!on(r, c)) { b++; continue; }
        let len = 0;
        while (b + len < n && on(...((vertical ? [b + len, a] : [a, b + len]) as [number, number]))) len++;
        const x = off + (vertical ? a + inset : b);
        const y = off + (vertical ? b : a + inset);
        const rad = w / 2;
        parts.push(roundedRect(x, y, vertical ? w : len, vertical ? len : w, [rad, rad, rad, rad]));
        b += len;
      }
    }
    return parts.join('');
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!on(r, c)) continue;
      const x = off + c;
      const y = off + r;
      switch (design.body) {
        case 'square':
          parts.push(`M${x} ${y}h1v1h-1Z`);
          break;
        case 'dots':
          parts.push(circle(x + 0.5, y + 0.5, 0.45));
          break;
        case 'diamond':
          parts.push(diamond(x - 0.05, y - 0.05, 1.1));
          break;
        case 'rounded': {
          const up = on(r - 1, c), down = on(r + 1, c), left = on(r, c - 1), right = on(r, c + 1);
          const k = 0.5;
          parts.push(roundedRect(x, y, 1, 1, [
            !up && !left ? k : 0,
            !up && !right ? k : 0,
            !down && !right ? k : 0,
            !down && !left ? k : 0,
          ]));
          break;
        }
      }
    }
  }
  return parts.join('');
}

function eyeFramePath(style: EyeFrameStyle, x: number, y: number, corner: 'tl' | 'tr' | 'bl'): string {
  switch (style) {
    case 'square':
      return roundedRect(x, y, 7, 7, [0, 0, 0, 0]) + roundedRect(x + 1, y + 1, 5, 5, [0, 0, 0, 0]);
    case 'rounded':
      return roundedRect(x, y, 7, 7, [2, 2, 2, 2]) + roundedRect(x + 1, y + 1, 5, 5, [1.2, 1.2, 1.2, 1.2]);
    case 'circle':
      return circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
    case 'leaf':
      return roundedRect(x, y, 7, 7, leafRadii(corner, 3)) + roundedRect(x + 1, y + 1, 5, 5, leafRadii(corner, 2));
  }
}

function eyeBallPath(style: EyeBallStyle, x: number, y: number, corner: 'tl' | 'tr' | 'bl'): string {
  switch (style) {
    case 'square':
      return roundedRect(x, y, 3, 3, [0, 0, 0, 0]);
    case 'rounded':
      return roundedRect(x, y, 3, 3, [0.8, 0.8, 0.8, 0.8]);
    case 'circle':
      return circle(x + 1.5, y + 1.5, 1.5);
    case 'diamond':
      return diamond(x - 0.3, y - 0.3, 3.6);
    case 'leaf':
      return roundedRect(x, y, 3, 3, leafRadii(corner, 1.4));
  }
}

function gradientDef(design: Design, id: string, off: number, n: number): string {
  const g = design.gradient!;
  const stops = `<stop offset="0" stop-color="${escapeXml(g.from)}"/><stop offset="1" stop-color="${escapeXml(g.to)}"/>`;
  const cx = off + n / 2;
  if (g.type === 'radial') {
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cx)}" r="${f(n * 0.71)}">${stops}</radialGradient>`;
  }
  const rad = (g.angle * Math.PI) / 180;
  const dx = (Math.cos(rad) * n) / 2;
  const dy = (Math.sin(rad) * n) / 2;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(cx - dx)}" y1="${f(cx - dy)}" x2="${f(cx + dx)}" y2="${f(cx + dy)}">${stops}</linearGradient>`;
}

export interface RenderOptions {
  /** Output width in px (height follows the aspect ratio). Omit for a unitless SVG. */
  width?: number;
  /** Stored in <metadata> so every exported file carries its validation report. */
  metadata?: string;
}

export function renderSvg(m: QrMatrix, design: Design, opts: RenderOptions = {}): RenderResult {
  const n = m.size;
  const margin = Math.max(MIN_QUIET_ZONE, Math.round(design.margin));
  const qrSide = n + 2 * margin;

  // Frame layout, in module units.
  const frame = design.frame;
  const hasFrame = frame.style !== 'none';
  const border = hasFrame ? Math.max(1, qrSide * 0.04) : 0;
  const band = frame.style === 'top' || frame.style === 'bottom' ? qrSide * 0.2 : 0;
  const width = qrSide + 2 * border;
  const height = qrSide + 2 * border + band;
  const qx = border;
  const qy = border + (frame.style === 'top' ? band : 0);

  const geo = design.logo ? logoGeometry(m, design.logo) : null;
  const skip = design.logo?.knockout && geo
    ? (r: number, c: number) => isCovered(geo, design.logo!.shape, r, c)
    : () => false;

  const defs: string[] = [];
  let bodyFill = escapeXml(design.foreground);
  if (design.gradient) {
    defs.push(gradientDef(design, 'qr-grad', 0, n));
    bodyFill = 'url(#qr-grad)';
  }
  const eyeGrad = design.gradient?.applyToEyes;
  const frameFill = eyeGrad ? bodyFill : escapeXml(design.eyeFrameColor ?? design.foreground);
  const ballFill = eyeGrad ? bodyFill : escapeXml(design.eyeBallColor ?? design.foreground);

  const out: string[] = [];
  if (hasFrame) {
    out.push(`<rect width="${f(width)}" height="${f(height)}" rx="${f(border * 1.5)}" fill="${escapeXml(frame.color)}"/>`);
  }
  if (!design.transparent) {
    out.push(`<rect x="${f(qx)}" y="${f(qy)}" width="${qrSide}" height="${qrSide}" rx="${hasFrame ? f(border * 0.6) : 0}" fill="${escapeXml(design.background)}"/>`);
  } else if (hasFrame) {
    // A frame around a transparent symbol still needs a light field for the quiet zone.
    out.push(`<rect x="${f(qx)}" y="${f(qy)}" width="${qrSide}" height="${qrSide}" fill="#FFFFFF"/>`);
  }

  // The symbol group is translated so that module (0,0) is at the origin of the quiet zone.
  const sym: string[] = [];
  sym.push(`<path fill="${bodyFill}" d="${bodyPath(m, design, 0, skip)}"/>`);
  const eyes: Array<[number, number, 'tl' | 'tr' | 'bl']> = [[0, 0, 'tl'], [n - 7, 0, 'tr'], [0, n - 7, 'bl']];
  sym.push(`<path fill="${frameFill}" fill-rule="evenodd" d="${eyes.map(([x, y, k]) => eyeFramePath(design.eyeFrame, x, y, k)).join('')}"/>`);
  sym.push(`<path fill="${ballFill}" d="${eyes.map(([x, y, k]) => eyeBallPath(design.eyeBall, x + 2, y + 2, k)).join('')}"/>`);

  if (design.logo && geo && geo.logoSize > 0) {
    const logo = design.logo;
    const c = geo.center;
    const plateFill = design.transparent ? '#FFFFFF' : escapeXml(design.background);
    if (logo.knockout) {
      sym.push(
        logo.shape === 'circle'
          ? `<circle cx="${f(c)}" cy="${f(c)}" r="${f(geo.box / 2)}" fill="${plateFill}"/>`
          : `<rect x="${f(c - geo.box / 2)}" y="${f(c - geo.box / 2)}" width="${f(geo.box)}" height="${f(geo.box)}" rx="${f(geo.box * 0.12)}" fill="${plateFill}"/>`,
      );
    }
    const s = geo.logoSize;
    let clip = '';
    if (logo.shape === 'circle') {
      defs.push(`<clipPath id="qr-logo-clip"><circle cx="${f(c)}" cy="${f(c)}" r="${f(s / 2)}"/></clipPath>`);
      clip = ' clip-path="url(#qr-logo-clip)"';
    }
    sym.push(
      `<image href="${escapeXml(logo.src)}" x="${f(c - s / 2)}" y="${f(c - s / 2)}" width="${f(s)}" height="${f(s)}" preserveAspectRatio="xMidYMid ${logo.shape === 'circle' ? 'slice' : 'meet'}"${clip}/>`,
    );
  }
  out.push(`<g transform="translate(${f(qx + margin)} ${f(qy + margin)})">${sym.join('')}</g>`);

  if (band > 0 && frame.text.trim()) {
    const ty = frame.style === 'top' ? border + band / 2 : qy + qrSide + band / 2;
    out.push(
      `<text x="${f(width / 2)}" y="${f(ty)}" fill="${escapeXml(frame.textColor)}" font-family="'Open Sans', Arial, Helvetica, sans-serif" font-weight="700" font-size="${f(band * 0.45)}" text-anchor="middle" dominant-baseline="central" letter-spacing="${f(band * 0.02)}">${escapeXml(frame.text.trim())}</text>`,
    );
  }

  const pxW = opts.width;
  const size = pxW ? ` width="${pxW}" height="${Math.round((pxW * height) / width)}"` : '';
  const meta = opts.metadata ? `<metadata>${escapeXml(opts.metadata)}</metadata>` : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(width)} ${f(height)}"${size} shape-rendering="geometricPrecision">` +
    meta +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    out.join('') +
    '</svg>';

  return { svg, width, height, qrSide, logo: geo };
}

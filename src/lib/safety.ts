// Scan-safety engine: turns a design into a list of pass/warn/fail checks so an unsafe
// code is caught before it is printed, not after.
import { contrastRatio, luminance, mixHex } from './color';
import { EC_RECOVERY, MIN_QUIET_ZONE, type Design } from './design';
import type { QrMatrix } from './matrix';
import type { RenderResult } from './render';

export type Severity = 'pass' | 'warn' | 'fail';

export interface Check {
  id: string;
  label: string;
  severity: Severity;
  detail: string;
}

/** Contrast below this is treated as unscannable on common phone cameras. */
export const MIN_CONTRAST = 3;
export const GOOD_CONTRAST = 4.5;
/** Module sizes (mm) below which print scanning becomes unreliable. */
export const MIN_MODULE_MM = 0.25;
export const GOOD_MODULE_MM = 0.4;

function contrastCheck(id: string, label: string, fg: string, bg: string): Check {
  const ratio = contrastRatio(fg, bg);
  const r = ratio.toFixed(1);
  if (ratio < MIN_CONTRAST) return { id, label, severity: 'fail', detail: `Contrast ${r}:1 is below the ${MIN_CONTRAST}:1 minimum.` };
  if (ratio < GOOD_CONTRAST) return { id, label, severity: 'warn', detail: `Contrast ${r}:1 — aim for ${GOOD_CONTRAST}:1 or more.` };
  return { id, label, severity: 'pass', detail: `Contrast ${r}:1.` };
}

export interface SafetyInput {
  matrix: QrMatrix;
  design: Design;
  render: RenderResult;
  /** Intended printed width of the whole graphic, in millimetres. */
  printWidthMm: number;
}

export function runSafetyChecks({ matrix, design, render, printWidthMm }: SafetyInput): Check[] {
  const checks: Check[] = [];
  const bg = design.transparent ? '#FFFFFF' : design.background;

  // Contrast: foreground (every gradient step) and each eye colour against the background.
  if (design.gradient) {
    const { from, to } = design.gradient;
    const worst = [0, 0.25, 0.5, 0.75, 1]
      .map((t) => mixHex(from, to, t))
      .reduce((a, b) => (contrastRatio(a, bg) < contrastRatio(b, bg) ? a : b));
    checks.push(contrastCheck('contrast-body', 'Gradient contrast', worst, bg));
  } else {
    checks.push(contrastCheck('contrast-body', 'Body contrast', design.foreground, bg));
  }
  if (!design.gradient?.applyToEyes) {
    checks.push(contrastCheck('contrast-eye-frame', 'Eye frame contrast', design.eyeFrameColor ?? design.foreground, bg));
    checks.push(contrastCheck('contrast-eye-ball', 'Eye ball contrast', design.eyeBallColor ?? design.foreground, bg));
  }

  const darkOnLight = luminance(design.gradient?.from ?? design.foreground) < luminance(bg);
  checks.push(
    darkOnLight
      ? { id: 'polarity', label: 'Polarity', severity: 'pass', detail: 'Dark modules on a light background.' }
      : { id: 'polarity', label: 'Polarity', severity: 'warn', detail: 'Inverted (light-on-dark) codes are not read by some scanners.' },
  );

  if (design.transparent) {
    checks.push({
      id: 'background',
      label: 'Background',
      severity: 'warn',
      detail: 'Transparent background: the printed surface must be light, plain and non-reflective.',
    });
  }

  const margin = Math.max(MIN_QUIET_ZONE, Math.round(design.margin));
  checks.push({ id: 'quiet-zone', label: 'Quiet zone', severity: 'pass', detail: `${margin} modules of clear margin (minimum ${MIN_QUIET_ZONE}).` });

  // Logo: modules hidden by the logo must stay well inside the error-correction budget.
  if (design.logo && render.logo) {
    const geo = render.logo;
    const total = matrix.size * matrix.size;
    const share = geo.coveredModules / total;
    const budget = EC_RECOVERY[matrix.ecLevel];
    const pct = (share * 100).toFixed(1);
    const cap = (budget * 100).toFixed(0);
    let severity: Severity = 'pass';
    let detail = `Logo covers ${pct}% of modules; level ${matrix.ecLevel} restores ≈${cap}%.`;
    if (share > budget * 0.8) {
      severity = 'fail';
      detail += ' Too large — reduce the logo or raise error correction.';
    } else if (share > budget * 0.5) {
      severity = 'warn';
      detail += ' Little error-correction headroom left for print damage.';
    }
    checks.push({ id: 'logo-coverage', label: 'Logo coverage', severity, detail });
    if (geo.clamped) {
      checks.push({
        id: 'logo-finder',
        label: 'Finder patterns',
        severity: 'warn',
        detail: 'Logo was shrunk automatically so it cannot cover the finder patterns.',
      });
    }
    if (!design.logo.knockout) {
      checks.push({
        id: 'logo-knockout',
        label: 'Logo background',
        severity: 'warn',
        detail: 'Modules show through the logo; enable the background plate for a cleaner read.',
      });
    }
  }

  // Density.
  const v = matrix.version;
  checks.push(
    v > 15
      ? { id: 'density', label: 'Data density', severity: 'warn', detail: `Version ${v} (${matrix.size}×${matrix.size}) is very dense — shorten the content or print larger.` }
      : v > 10
        ? { id: 'density', label: 'Data density', severity: 'warn', detail: `Version ${v} (${matrix.size}×${matrix.size}) — shorter content scans faster.` }
        : { id: 'density', label: 'Data density', severity: 'pass', detail: `Version ${v} (${matrix.size}×${matrix.size}).` },
  );

  // Print size: module size is what matters, not a single universal pixel number.
  const moduleMm = printWidthMm / render.width;
  const qrMm = (printWidthMm * render.qrSide) / render.width;
  const distanceCm = Math.round((qrMm / 10) * 10);
  const sizeDetail = `${moduleMm.toFixed(2)} mm per module; scannable from roughly ${distanceCm} cm.`;
  checks.push(
    moduleMm < MIN_MODULE_MM
      ? { id: 'print-size', label: 'Print size', severity: 'fail', detail: `${sizeDetail} Modules are too small to print reliably.` }
      : moduleMm < GOOD_MODULE_MM
        ? { id: 'print-size', label: 'Print size', severity: 'warn', detail: `${sizeDetail} Print larger for dependable scanning.` }
        : { id: 'print-size', label: 'Print size', severity: 'pass', detail: sizeDetail },
  );

  if ((design.frame.style === 'top' || design.frame.style === 'bottom') && design.frame.text.trim()) {
    const ratio = contrastRatio(design.frame.textColor, design.frame.color);
    checks.push({
      id: 'cta-legibility',
      label: 'Call-to-action',
      severity: ratio < GOOD_CONTRAST ? 'warn' : 'pass',
      detail: `Label contrast ${ratio.toFixed(1)}:1${ratio < GOOD_CONTRAST ? ' — hard to read.' : '.'}`,
    });
  }

  return checks;
}

export function worstSeverity(checks: Check[]): Severity {
  if (checks.some((c) => c.severity === 'fail')) return 'fail';
  if (checks.some((c) => c.severity === 'warn')) return 'warn';
  return 'pass';
}

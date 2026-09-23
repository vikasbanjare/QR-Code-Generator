import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/lib/color';
import { DEFAULT_DESIGN, type Design } from '../src/lib/design';
import { buildMatrix } from '../src/lib/matrix';
import { renderSvg } from '../src/lib/render';
import { runSafetyChecks, worstSeverity } from '../src/lib/safety';
import { LOGO } from './helpers';

function check(design: Design, printWidthMm = 40, payload = 'https://example.com') {
  const matrix = buildMatrix(payload, design.ecLevel);
  const render = renderSvg(matrix, design);
  return runSafetyChecks({ matrix, design, render, printWidthMm });
}
const byId = (checks: ReturnType<typeof check>, id: string) => checks.find((c) => c.id === id)!;

describe('safety engine', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBe(1);
  });

  it('passes the default design at 4 cm', () => {
    expect(worstSeverity(check(DEFAULT_DESIGN))).toBe('pass');
  });

  it('rejects the raw brand orange for eyes', () => {
    expect(byId(check({ ...DEFAULT_DESIGN, eyeBallColor: '#F58220' }), 'contrast-eye-ball').severity).toBe('fail');
  });

  it('fails low-contrast colours', () => {
    expect(byId(check({ ...DEFAULT_DESIGN, foreground: '#DDDDDD' }), 'contrast-body').severity).toBe('fail');
  });

  it('checks the weakest point of a gradient', () => {
    const d: Design = { ...DEFAULT_DESIGN, gradient: { type: 'linear', from: '#000000', to: '#EEEEEE', angle: 0, applyToEyes: false } };
    expect(byId(check(d), 'contrast-body').severity).toBe('fail');
  });

  it('warns on inverted codes', () => {
    const d: Design = { ...DEFAULT_DESIGN, foreground: '#FFFFFF', background: '#000000', eyeBallColor: null };
    expect(byId(check(d), 'polarity').severity).toBe('warn');
  });

  it('fails an oversized logo at low error correction', () => {
    const d: Design = { ...DEFAULT_DESIGN, ecLevel: 'L', logo: { src: LOGO, size: 0.3, shape: 'square', knockout: true, padding: 1 } };
    expect(byId(check(d), 'logo-coverage').severity).toBe('fail');
  });

  it('flags modules too small to print', () => {
    expect(byId(check(DEFAULT_DESIGN, 5), 'print-size').severity).toBe('fail');
    expect(byId(check(DEFAULT_DESIGN, 40), 'print-size').severity).toBe('pass');
  });
});

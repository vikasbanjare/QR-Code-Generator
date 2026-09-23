import { describe, expect, it } from 'vitest';
import { BODY_STYLES, DEFAULT_DESIGN, EYE_BALL_STYLES, EYE_FRAME_STYLES, type Design } from '../src/lib/design';
import { buildMatrix, resolveEcLevel } from '../src/lib/matrix';
import { logoGeometry, renderSvg } from '../src/lib/render';
import { decodeSvg, LOGO } from './helpers';

const PAYLOAD = 'https://example.com/spring-campaign?utm_source=qr';

/** Decodes at a small and a large raster size; returns the text only if both agree. */
async function roundTrip(design: Design, payload = PAYLOAD) {
  const ec = resolveEcLevel(payload, design.ecLevel, !!design.logo);
  const { svg } = renderSvg(buildMatrix(payload, ec), design);
  const [small, large] = await Promise.all([decodeSvg(svg, 300), decodeSvg(svg, 900)]);
  return small === large ? small : null;
}

describe('renderer decodes for every style combination', () => {
  for (const body of BODY_STYLES) {
    for (const eyeFrame of EYE_FRAME_STYLES) {
      for (const eyeBall of EYE_BALL_STYLES) {
        it(`${body} / ${eyeFrame} / ${eyeBall}`, async () => {
          expect(await roundTrip({ ...DEFAULT_DESIGN, body, eyeFrame, eyeBall })).toBe(PAYLOAD);
        });
      }
    }
  }
});

describe('renderer features', () => {
  it('decodes with a knocked-out logo at the maximum slider size', async () => {
    const design: Design = {
      ...DEFAULT_DESIGN,
      body: 'rounded',
      logo: { src: LOGO, size: 0.3, shape: 'square', knockout: true, padding: 1 },
    };
    expect(await roundTrip(design)).toBe(PAYLOAD);
  });

  it('decodes with a circular logo and dots', async () => {
    const design: Design = {
      ...DEFAULT_DESIGN,
      body: 'dots',
      eyeFrame: 'circle',
      eyeBall: 'circle',
      logo: { src: LOGO, size: 0.25, shape: 'circle', knockout: true, padding: 0.5 },
    };
    expect(await roundTrip(design)).toBe(PAYLOAD);
  });

  it('decodes with linear and radial gradients', async () => {
    for (const type of ['linear', 'radial'] as const) {
      const design: Design = {
        ...DEFAULT_DESIGN,
        gradient: { type, from: '#043B72', to: '#7A2E00', angle: 45, applyToEyes: true },
      };
      expect(await roundTrip(design)).toBe(PAYLOAD);
    }
  });

  it('decodes inside every frame style', async () => {
    for (const style of ['border', 'bottom', 'top'] as const) {
      const design: Design = { ...DEFAULT_DESIGN, frame: { ...DEFAULT_DESIGN.frame, style } };
      expect(await roundTrip(design)).toBe(PAYLOAD);
    }
  });

  it('never renders a quiet zone smaller than 4 modules', () => {
    const m = buildMatrix(PAYLOAD, 'M');
    const r = renderSvg(m, { ...DEFAULT_DESIGN, margin: 0 });
    expect(r.qrSide).toBe(m.size + 8);
  });

  it('keeps the logo plate clear of the finder patterns', () => {
    const m = buildMatrix('hi', 'H'); // version 1, 21×21
    const geo = logoGeometry(m, { src: LOGO, size: 0.3, shape: 'square', knockout: true, padding: 1 });
    expect(geo.clamped).toBe(true);
    expect(m.size / 2 - geo.box / 2).toBeGreaterThanOrEqual(8);
  });

  it('escapes frame text and embeds metadata', () => {
    const m = buildMatrix(PAYLOAD, 'M');
    const { svg } = renderSvg(m, { ...DEFAULT_DESIGN, frame: { ...DEFAULT_DESIGN.frame, style: 'bottom', text: 'A<B & "C"' } }, { metadata: '{"a":1}' });
    expect(svg).toContain('A&lt;B &amp; &quot;C&quot;');
    expect(svg).toContain('<metadata>{&quot;a&quot;:1}</metadata>');
  });
});

describe('error-correction resolution', () => {
  it('raises to H when a logo is present', () => {
    expect(resolveEcLevel(PAYLOAD, 'L', true)).toBe('H');
    expect(resolveEcLevel(PAYLOAD, 'L', false)).toBe('L');
  });

  it('falls back when the payload does not fit at H', () => {
    const long = 'x'.repeat(2500); // fits at L (2953 bytes) but not at M (2331)
    expect(resolveEcLevel(long, 'L', true)).toBe('L');
  });
});

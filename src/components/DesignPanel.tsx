import { useMemo, useState } from 'react';
import {
  BODY_STYLES,
  DEFAULT_DESIGN,
  EC_LEVELS,
  EYE_BALL_STYLES,
  EYE_FRAME_STYLES,
  MIN_QUIET_ZONE,
  type Design,
  type EcLevel,
} from '../lib/design';
import { buildMatrix } from '../lib/matrix';
import { renderSvg } from '../lib/render';
import { ColorInput, Segmented, Slider, TextInput, Toggle } from './ui';

type Tab = 'shape' | 'color' | 'logo' | 'frame' | 'advanced';

const SAMPLE = buildMatrix('QR', 'L');
const LABELS: Record<string, string> = {
  square: 'Square', rounded: 'Rounded', dots: 'Dots', diamond: 'Diamond', 'bars-v': 'Vertical', 'bars-h': 'Horizontal',
  circle: 'Circle', leaf: 'Leaf',
};

/** Swatch rendered by the real renderer, optionally cropped to the top-left eye. */
function Swatch({ design, eyeOnly }: { design: Design; eyeOnly?: boolean }) {
  const svg = useMemo(() => {
    const { svg } = renderSvg(SAMPLE, { ...design, logo: null, frame: DEFAULT_DESIGN.frame, gradient: null, transparent: true });
    const m = MIN_QUIET_ZONE;
    return eyeOnly ? svg.replace(/viewBox="[^"]*"/, `viewBox="${m - 0.5} ${m - 0.5} 8 8"`) : svg;
  }, [design, eyeOnly]);
  return <span className="swatch" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function StylePicker<T extends string>(props: {
  label: string;
  value: T;
  options: T[];
  preview: (v: T) => Design;
  eyeOnly?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <div className="style-grid" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={props.value === o}
            className={`style-option${props.value === o ? ' active' : ''}`}
            onClick={() => props.onChange(o)}
          >
            <Swatch design={props.preview(o)} eyeOnly={props.eyeOnly} />
            <span>{LABELS[o] ?? o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DesignPanel({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  const [tab, setTab] = useState<Tab>('shape');
  const [logoError, setLogoError] = useState<string | null>(null);
  const set = (patch: Partial<Design>) => onChange({ ...design, ...patch });
  const swatchBase = { ...design, foreground: '#043B72', eyeFrameColor: null, eyeBallColor: null };

  function onLogoFile(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) {
      setLogoError('Use a PNG, JPG, WebP or SVG file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      set({
        logo: { src: String(reader.result), size: 0.22, shape: 'square', knockout: true, padding: 1, ...(design.logo ? { ...design.logo, src: String(reader.result) } : {}) },
      });
    reader.readAsDataURL(file);
  }

  return (
    <section className="card" aria-labelledby="design-heading">
      <h2 id="design-heading"><span className="step">2</span>Design</h2>
      <div className="tabs" role="tablist">
        {(['shape', 'color', 'logo', 'frame', 'advanced'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {{ shape: 'Shape', color: 'Colour', logo: 'Logo', frame: 'Frame', advanced: 'Advanced' }[t]}
          </button>
        ))}
      </div>

      {tab === 'shape' && (
        <>
          <StylePicker label="Body" value={design.body} options={BODY_STYLES} preview={(body) => ({ ...swatchBase, body })} onChange={(body) => set({ body })} />
          <StylePicker label="Eye frame" eyeOnly value={design.eyeFrame} options={EYE_FRAME_STYLES} preview={(eyeFrame) => ({ ...swatchBase, eyeFrame })} onChange={(eyeFrame) => set({ eyeFrame })} />
          <StylePicker label="Eye ball" eyeOnly value={design.eyeBall} options={EYE_BALL_STYLES} preview={(eyeBall) => ({ ...swatchBase, eyeBall })} onChange={(eyeBall) => set({ eyeBall })} />
        </>
      )}

      {tab === 'color' && (
        <>
          <Toggle
            label="Gradient body"
            checked={!!design.gradient}
            onChange={(on) => set({ gradient: on ? { type: 'linear', from: design.foreground, to: '#0A5CA8', angle: 45, applyToEyes: false } : null })}
          />
          {design.gradient ? (
            <>
              <Segmented
                label="Gradient type"
                value={design.gradient.type}
                options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }]}
                onChange={(type) => set({ gradient: { ...design.gradient!, type } })}
              />
              <div className="grid-2">
                <ColorInput label="From" value={design.gradient.from} onChange={(from) => set({ gradient: { ...design.gradient!, from } })} />
                <ColorInput label="To" value={design.gradient.to} onChange={(to) => set({ gradient: { ...design.gradient!, to } })} />
              </div>
              {design.gradient.type === 'linear' && (
                <Slider label="Angle" min={0} max={180} step={5} value={design.gradient.angle} format={(v) => `${v}°`} onChange={(angle) => set({ gradient: { ...design.gradient!, angle } })} />
              )}
              <Toggle label="Apply gradient to eyes" checked={design.gradient.applyToEyes} onChange={(applyToEyes) => set({ gradient: { ...design.gradient!, applyToEyes } })} />
            </>
          ) : (
            <ColorInput label="Foreground" value={design.foreground} onChange={(foreground) => set({ foreground })} />
          )}
          <Toggle label="Transparent background" checked={design.transparent} onChange={(transparent) => set({ transparent })} />
          {!design.transparent && <ColorInput label="Background" value={design.background} onChange={(background) => set({ background })} />}
          {!design.gradient?.applyToEyes && (
            <div className="grid-2">
              <ColorInput label="Eye frame" value={design.eyeFrameColor ?? design.foreground} onChange={(eyeFrameColor) => set({ eyeFrameColor })} />
              <ColorInput label="Eye ball" value={design.eyeBallColor ?? design.foreground} onChange={(eyeBallColor) => set({ eyeBallColor })} />
            </div>
          )}
          <button type="button" className="link" onClick={() => set({ eyeFrameColor: null, eyeBallColor: null })}>
            Match eyes to foreground
          </button>
        </>
      )}

      {tab === 'logo' && (
        <>
          <div className="field">
            <span className="field-label">Logo image</span>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="Upload logo" onChange={(e) => onLogoFile(e.target.files?.[0])} />
            {logoError && <p className="error-text">{logoError}</p>}
            <p className="hint">Adding a logo raises error correction automatically where the content allows it.</p>
          </div>
          {design.logo && (
            <>
              <Slider label="Size" min={0.1} max={0.3} step={0.01} value={design.logo.size} format={(v) => `${Math.round(v * 100)}%`} onChange={(size) => set({ logo: { ...design.logo!, size } })} />
              <Segmented label="Shape" value={design.logo.shape} options={[{ value: 'square', label: 'Square' }, { value: 'circle', label: 'Circle' }]} onChange={(shape) => set({ logo: { ...design.logo!, shape } })} />
              <Toggle label="Clear modules behind logo" checked={design.logo.knockout} onChange={(knockout) => set({ logo: { ...design.logo!, knockout } })} />
              {design.logo.knockout && (
                <Slider label="Padding" min={0} max={2} step={0.5} value={design.logo.padding} format={(v) => `${v} modules`} onChange={(padding) => set({ logo: { ...design.logo!, padding } })} />
              )}
              <button type="button" className="button secondary" onClick={() => set({ logo: null })}>Remove logo</button>
            </>
          )}
        </>
      )}

      {tab === 'frame' && (
        <>
          <Segmented
            label="Frame"
            value={design.frame.style}
            options={[{ value: 'none', label: 'None' }, { value: 'border', label: 'Border' }, { value: 'bottom', label: 'Label below' }, { value: 'top', label: 'Label above' }]}
            onChange={(style) => set({ frame: { ...design.frame, style } })}
          />
          {design.frame.style !== 'none' && (
            <>
              {design.frame.style !== 'border' && (
                <TextInput label="Call to action" value={design.frame.text} placeholder="SCAN ME" onChange={(text) => set({ frame: { ...design.frame, text: text.slice(0, 24) } })} hint="Up to 24 characters. Say what happens on scan, not just “scan me”." />
              )}
              <div className="grid-2">
                <ColorInput label="Frame colour" value={design.frame.color} onChange={(color) => set({ frame: { ...design.frame, color } })} />
                {design.frame.style !== 'border' && <ColorInput label="Text colour" value={design.frame.textColor} onChange={(textColor) => set({ frame: { ...design.frame, textColor } })} />}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'advanced' && (
        <>
          <Segmented<EcLevel>
            label="Error correction"
            value={design.ecLevel}
            options={EC_LEVELS.map((l) => ({ value: l, label: { L: 'L · 7%', M: 'M · 15%', Q: 'Q · 25%', H: 'H · 30%' }[l] }))}
            onChange={(ecLevel) => set({ ecLevel })}
          />
          <p className="hint">Higher levels survive more damage but make the code denser.</p>
          <Slider label="Quiet zone" min={MIN_QUIET_ZONE} max={10} step={1} value={design.margin} format={(v) => `${v} modules`} onChange={(margin) => set({ margin })} />
          <p className="hint">The ISO minimum of {MIN_QUIET_ZONE} modules is locked.</p>
        </>
      )}
    </section>
  );
}

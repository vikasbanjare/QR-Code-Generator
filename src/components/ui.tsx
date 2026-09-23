import { useId, type ReactNode } from 'react';

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function TextInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  inputMode?: 'text' | 'tel' | 'email' | 'url' | 'decimal';
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) =>
        props.multiline ? (
          <textarea id={id} rows={3} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
        ) : (
          <input
            id={id}
            type={props.type ?? 'text'}
            inputMode={props.inputMode}
            value={props.value}
            placeholder={props.placeholder}
            onChange={(e) => props.onChange(e.target.value)}
          />
        )
      }
    </Field>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <div className="segmented" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            className={props.value === o.value ? 'active' : ''}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <div className="color-input">
          <input type="color" aria-label={`${label} picker`} value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
          <input
            id={id}
            value={value}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
              onChange(v.toUpperCase());
            }}
          />
        </div>
      )}
    </Field>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={`${props.label}: ${props.format(props.value)}`}>
      {(id) => (
        <input
          id={id}
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
      )}
    </Field>
  );
}

import { DEFAULT_DESIGN, type Design } from './design';

export interface Template {
  id: string;
  name: string;
  design: Design;
  builtIn?: boolean;
}

const KEY = 'qr-studio.templates.v1';

export const BUILT_IN_TEMPLATES: Template[] = [
  { id: 'classic', name: 'Classic', builtIn: true, design: { ...DEFAULT_DESIGN, foreground: '#000000', eyeBallColor: null } },
  { id: 'brand', name: 'Brand', builtIn: true, design: DEFAULT_DESIGN },
  {
    id: 'soft',
    name: 'Soft',
    builtIn: true,
    design: { ...DEFAULT_DESIGN, body: 'rounded', eyeFrame: 'rounded', eyeBall: 'rounded' },
  },
  {
    id: 'dots',
    name: 'Dots',
    builtIn: true,
    design: { ...DEFAULT_DESIGN, body: 'dots', eyeFrame: 'circle', eyeBall: 'circle' },
  },
  {
    id: 'leaf',
    name: 'Leaf',
    builtIn: true,
    design: {
      ...DEFAULT_DESIGN,
      body: 'rounded',
      eyeFrame: 'leaf',
      eyeBall: 'leaf',
      gradient: { type: 'linear', from: '#043B72', to: '#0A5CA8', angle: 45, applyToEyes: false },
    },
  },
  {
    id: 'cta',
    name: 'Scan me',
    builtIn: true,
    design: {
      ...DEFAULT_DESIGN,
      body: 'rounded',
      eyeFrame: 'rounded',
      eyeBall: 'rounded',
      frame: { style: 'bottom', text: 'SCAN ME', color: '#043B72', textColor: '#FFFFFF' },
    },
  },
];

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Template[]) : [];
    // Merge over defaults so templates saved by older versions gain new fields.
    return parsed.map((t) => ({ ...t, design: { ...DEFAULT_DESIGN, ...t.design } }));
  } catch {
    return [];
  }
}

/** Returns false if the browser refused to store (quota, private mode). */
export function saveTemplates(templates: Template[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(templates));
    return true;
  } catch {
    return false;
  }
}

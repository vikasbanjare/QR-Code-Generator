export type EcLevel = 'L' | 'M' | 'Q' | 'H';
export type BodyStyle = 'square' | 'rounded' | 'dots' | 'diamond' | 'bars-v' | 'bars-h';
export type EyeFrameStyle = 'square' | 'rounded' | 'circle' | 'leaf';
export type EyeBallStyle = 'square' | 'rounded' | 'circle' | 'diamond' | 'leaf';
export type FrameStyle = 'none' | 'border' | 'bottom' | 'top';

export interface Gradient {
  type: 'linear' | 'radial';
  from: string;
  to: string;
  /** Degrees, 0 = left→right, 90 = top→bottom. Ignored for radial. */
  angle: number;
  applyToEyes: boolean;
}

export interface Logo {
  /** Data URL (PNG/JPG/SVG). */
  src: string;
  /** Requested logo width as a fraction of the symbol width (without quiet zone). */
  size: number;
  shape: 'square' | 'circle';
  /** Clear the modules behind the logo and draw a background plate. */
  knockout: boolean;
  /** Plate padding around the logo, in modules. */
  padding: number;
}

export interface Frame {
  style: FrameStyle;
  text: string;
  color: string;
  textColor: string;
}

export interface Design {
  ecLevel: EcLevel;
  /** Quiet zone in modules. Values below MIN_QUIET_ZONE are clamped. */
  margin: number;
  body: BodyStyle;
  eyeFrame: EyeFrameStyle;
  eyeBall: EyeBallStyle;
  foreground: string;
  background: string;
  transparent: boolean;
  /** null = use foreground. */
  eyeFrameColor: string | null;
  eyeBallColor: string | null;
  gradient: Gradient | null;
  logo: Logo | null;
  frame: Frame;
}

export const MIN_QUIET_ZONE = 4;
export const EC_LEVELS: EcLevel[] = ['L', 'M', 'Q', 'H'];
/** Approximate share of codewords each level can restore (ISO/IEC 18004). */
export const EC_RECOVERY: Record<EcLevel, number> = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

export const BODY_STYLES: BodyStyle[] = ['square', 'rounded', 'dots', 'diamond', 'bars-v', 'bars-h'];
export const EYE_FRAME_STYLES: EyeFrameStyle[] = ['square', 'rounded', 'circle', 'leaf'];
export const EYE_BALL_STYLES: EyeBallStyle[] = ['square', 'rounded', 'circle', 'diamond', 'leaf'];

export const DEFAULT_DESIGN: Design = {
  ecLevel: 'M',
  margin: MIN_QUIET_ZONE,
  body: 'square',
  eyeFrame: 'square',
  eyeBall: 'square',
  foreground: '#043B72',
  background: '#FFFFFF',
  transparent: false,
  eyeFrameColor: null,
  // Brand orange #F58220 is only 2.6:1 on white; this darker shade keeps the accent scan-safe.
  eyeBallColor: '#B85A05',
  gradient: null,
  logo: null,
  frame: { style: 'none', text: 'SCAN ME', color: '#043B72', textColor: '#FFFFFF' },
};

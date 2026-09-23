import QRCode from 'qrcode';
import { EC_LEVELS, type EcLevel } from './design';

export interface QrMatrix {
  size: number;
  version: number;
  ecLevel: EcLevel;
  /** Row-major; true = dark module. */
  modules: boolean[];
}

export function isDark(m: QrMatrix, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= m.size || col >= m.size) return false;
  return m.modules[row * m.size + col];
}

/** True for modules that belong to one of the three 7×7 finder patterns. */
export function inFinder(size: number, row: number, col: number): boolean {
  return (row < 7 && col < 7) || (row < 7 && col >= size - 7) || (row >= size - 7 && col < 7);
}

export function buildMatrix(payload: string, ecLevel: EcLevel): QrMatrix {
  const qr = QRCode.create(payload, { errorCorrectionLevel: ecLevel });
  const { size, data } = qr.modules;
  return { size, version: qr.version, ecLevel, modules: Array.from(data, (v) => v === 1) };
}

/**
 * Picks the error-correction level actually used. With a logo the level is raised
 * towards H, falling back to lower levels only if the payload no longer fits.
 */
export function resolveEcLevel(payload: string, requested: EcLevel, hasLogo: boolean): EcLevel {
  if (!hasLogo) return requested;
  const start = EC_LEVELS.indexOf(requested);
  for (let i = EC_LEVELS.length - 1; i > start; i--) {
    try {
      QRCode.create(payload, { errorCorrectionLevel: EC_LEVELS[i] });
      return EC_LEVELS[i];
    } catch {
      // Payload too long at this level; try the next one down.
    }
  }
  return requested;
}

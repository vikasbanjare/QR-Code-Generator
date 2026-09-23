// Decode-after-render: the rendered SVG is rasterised under several conditions and read
// back with ZXing (the decoder family used by many phone scanners).
import { rasterize } from './raster';

export interface ScanPass {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ScanResult {
  passed: boolean;
  passes: ScanPass[];
}

type Reader = typeof import('zxing-wasm/reader');
let readerPromise: Promise<Reader> | null = null;

function loadReader(): Promise<Reader> {
  readerPromise ??= Promise.all([
    import('zxing-wasm/reader'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]).then(([reader, wasm]) => {
    reader.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) },
    });
    return reader;
  });
  return readerPromise;
}

export async function runScanTest(
  svg: string,
  aspect: number,
  widthModules: number,
  expected: string,
): Promise<ScanResult> {
  const reader = await loadReader();
  const conditions = [
    { label: 'Sharp, large', width: 900 },
    { label: 'Small (3 px/module)', width: Math.round(widthModules * 3) },
    { label: 'Camera: blur + 12° tilt', width: 600, blur: 1.5, rotate: 12 },
  ];
  const passes: ScanPass[] = [];
  for (const c of conditions) {
    const canvas = await rasterize(svg, {
      width: c.width,
      height: Math.round(c.width * aspect),
      background: '#FFFFFF',
      blur: c.blur,
      rotate: c.rotate,
    });
    const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    const [hit] = await reader.readBarcodes(image, { formats: ['QRCode'], maxNumberOfSymbols: 1 });
    const text = hit?.isValid ? hit.text : null;
    passes.push({
      label: c.label,
      ok: text === expected,
      detail: text === null ? 'No code found.' : text === expected ? 'Decoded correctly.' : 'Decoded different content.',
    });
  }
  return { passed: passes.every((p) => p.ok), passes };
}

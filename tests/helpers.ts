import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';

const require = createRequire(import.meta.url);
prepareZXingModule({
  overrides: { wasmBinary: readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')).buffer as ArrayBuffer },
});

/** Rasterises an SVG and decodes it with ZXing; returns the text or null. */
export async function decodeSvg(svg: string, width = 600): Promise<string | null> {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'white' }).render().asPng();
  const [hit] = await readBarcodes(new Blob([new Uint8Array(png)]), { formats: ['QRCode'], maxNumberOfSymbols: 1 });
  return hit?.isValid ? hit.text : null;
}

// 1×1 orange PNG as a stand-in logo.
export const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8+5ehHgAG3wKLzb1RzwAAAABJRU5ErkJggg==';

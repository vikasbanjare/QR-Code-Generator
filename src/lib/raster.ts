// Browser-only helpers that turn the SVG into pixels (for PNG export and the scan test).

export function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterise the SVG.'));
    };
    img.src = url;
  });
}

export interface RasterOptions {
  width: number;
  height: number;
  /** Fill colour behind the image; omit to keep transparency. */
  background?: string;
  /** Degrees of rotation, used to simulate a tilted phone camera. */
  rotate?: number;
  /** Gaussian blur radius in px, used to simulate camera focus. */
  blur?: number;
}

export async function rasterize(svg: string, opts: RasterOptions): Promise<HTMLCanvasElement> {
  const img = await loadSvgImage(svg);
  const canvas = document.createElement('canvas');
  const pad = opts.rotate ? Math.round(Math.max(opts.width, opts.height) * 0.15) : 0;
  canvas.width = opts.width + 2 * pad;
  canvas.height = opts.height + 2 * pad;
  const ctx = canvas.getContext('2d')!;
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (opts.blur) ctx.filter = `blur(${opts.blur}px)`;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (opts.rotate) ctx.rotate((opts.rotate * Math.PI) / 180);
  ctx.drawImage(img, -opts.width / 2, -opts.height / 2, opts.width, opts.height);
  return canvas;
}

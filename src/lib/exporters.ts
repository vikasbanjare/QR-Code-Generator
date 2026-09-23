import { rasterize } from './raster';

export type ExportFormat = 'svg' | 'png' | 'pdf' | 'report';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(svg: string, name: string) {
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
}

export async function exportPng(svg: string, name: string, widthPx: number, aspect: number) {
  const canvas = await rasterize(svg, { width: widthPx, height: Math.round(widthPx * aspect) });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed.');
  downloadBlob(blob, `${name}.png`);
}

/** Vector PDF sized to the chosen print width. */
export async function exportPdf(svg: string, name: string, widthMm: number, aspect: number) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const heightMm = widthMm * aspect;
  const doc = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation: aspect > 1 ? 'portrait' : 'landscape' });
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement as unknown as SVGElement;
  // svg2pdf needs the element in the document to resolve styles.
  el.style.position = 'absolute';
  el.style.left = '-99999px';
  document.body.appendChild(el);
  try {
    await svg2pdf(el, doc, { x: 0, y: 0, width: widthMm, height: heightMm });
  } finally {
    el.remove();
  }
  doc.setProperties({ title: name, creator: 'QR Studio' });
  downloadBlob(doc.output('blob'), `${name}.pdf`);
}

export function exportReport(report: unknown, name: string) {
  downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `${name}.validation.json`);
}

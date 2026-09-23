import { useEffect, useMemo, useRef, useState } from 'react';
import { ContentForm } from './components/ContentForm';
import { DesignPanel } from './components/DesignPanel';
import { Segmented, TextInput } from './components/ui';
import { DEFAULT_DESIGN, type Design } from './lib/design';
import { exportPdf, exportPng, exportReport, exportSvg, type ExportFormat } from './lib/exporters';
import { buildMatrix, resolveEcLevel, type QrMatrix } from './lib/matrix';
import { CONTENT_LABELS, DEFAULT_CONTENT, encodeContent, type ContentData, type ContentDataMap, type ContentType } from './lib/payloads';
import { renderSvg } from './lib/render';
import { runSafetyChecks, worstSeverity, type Check, type Severity } from './lib/safety';
import { runScanTest, type ScanResult } from './lib/scanTest';
import { BUILT_IN_TEMPLATES, loadTemplates, saveTemplates, type Template } from './lib/templates';

const PRINT_PRESETS = [
  { id: 'packaging', label: 'Packaging (2 cm)', mm: 20 },
  { id: 'card', label: 'Business card (2.5 cm)', mm: 25 },
  { id: 'sticker', label: 'Sticker (4 cm)', mm: 40 },
  { id: 'tent', label: 'Table tent (6 cm)', mm: 60 },
  { id: 'a4', label: 'A4 flyer (8 cm)', mm: 80 },
  { id: 'a3', label: 'A3 / poster (15 cm)', mm: 150 },
  { id: 'banner', label: 'Banner (40 cm)', mm: 400 },
];

const SEVERITY_ICON: Record<Severity, string> = { pass: '✓', warn: '!', fail: '✕' };
const SEVERITY_TEXT: Record<Severity, string> = { pass: 'Pass', warn: 'Warning', fail: 'Fail' };

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qr-code';
}

export default function App() {
  const [type, setType] = useState<ContentType>('url');
  const [content, setContent] = useState<ContentDataMap>(DEFAULT_CONTENT);
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [printMm, setPrintMm] = useState(40);
  const [name, setName] = useState('qr-code');
  const [zoom, setZoom] = useState<'fit' | 'print'>('fit');
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates());
  const [templateName, setTemplateName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingExport, setPendingExport] = useState<ExportFormat | null>(null);
  const [scan, setScan] = useState<{ svg: string; result: ScanResult | null; error?: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const latestSvg = useRef<string | null>(null);

  const encoded = useMemo(() => encodeContent({ type, data: content[type] } as ContentData), [type, content]);

  const built = useMemo((): { matrix: QrMatrix } | { error: string } => {
    if (encoded.errors.length) return { error: encoded.errors[0] };
    try {
      const ec = resolveEcLevel(encoded.payload, design.ecLevel, !!design.logo);
      return { matrix: buildMatrix(encoded.payload, ec) };
    } catch {
      return { error: `Too much content for a QR code at error correction ${design.ecLevel}. Shorten it or lower the level.` };
    }
  }, [encoded, design.ecLevel, design.logo]);

  const matrix = 'matrix' in built ? built.matrix : null;
  const effectiveDesign = useMemo(() => (matrix ? { ...design, ecLevel: matrix.ecLevel } : design), [design, matrix]);
  const rendered = useMemo(() => (matrix ? renderSvg(matrix, effectiveDesign) : null), [matrix, effectiveDesign]);

  const checks = useMemo((): Check[] => {
    if (!matrix || !rendered) return [];
    const list = runSafetyChecks({ matrix, design: effectiveDesign, render: rendered, printWidthMm: printMm });
    if (matrix.ecLevel !== design.ecLevel) {
      list.unshift({ id: 'ec-raised', label: 'Error correction', severity: 'pass', detail: `Raised from ${design.ecLevel} to ${matrix.ecLevel} to protect the logo.` });
    }
    return list;
  }, [matrix, rendered, effectiveDesign, design.ecLevel, printMm]);

  // Decode-after-render, debounced so dragging a slider doesn't queue dozens of runs.
  useEffect(() => {
    if (!rendered) return;
    const svg = rendered.svg;
    latestSvg.current = svg;
    const t = setTimeout(() => {
      // Ignore results that arrive after a newer render has started.
      const keep = (next: NonNullable<typeof scan>) => latestSvg.current === svg && setScan(next);
      runScanTest(svg, rendered.height / rendered.width, rendered.width, encoded.payload)
        .then((result) => keep({ svg, result }))
        .catch((e: unknown) => keep({ svg, result: null, error: e instanceof Error ? e.message : String(e) }));
    }, 300);
    return () => clearTimeout(t);
  }, [rendered, encoded.payload]);

  const scanCurrent = scan && rendered && scan.svg === rendered.svg ? scan : null;
  const scanCheck: Check = !scanCurrent
    ? { id: 'scan-test', label: 'Decode test', severity: 'warn', detail: 'Running…' }
    : scanCurrent.result?.passed
      ? { id: 'scan-test', label: 'Decode test', severity: 'pass', detail: 'Decoded in all simulated conditions.' }
      : {
          id: 'scan-test',
          label: 'Decode test',
          severity: 'fail',
          detail: scanCurrent.error ?? `Failed: ${scanCurrent.result!.passes.filter((p) => !p.ok).map((p) => p.label).join(', ')}.`,
        };
  const allChecks = matrix ? [...checks, scanCheck] : [];
  const overall = matrix ? worstSeverity(allChecks) : 'fail';

  useEffect(() => {
    if (pendingExport) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [pendingExport]);

  async function buildReport() {
    return {
      schema: 'qr-studio/validation-report@1',
      generatedAt: new Date().toISOString(),
      mode: 'static',
      content: { type, length: encoded.payload.length, sha256: await sha256(encoded.payload) },
      symbol: matrix && {
        version: matrix.version,
        modules: matrix.size,
        errorCorrection: matrix.ecLevel,
        requestedErrorCorrection: design.ecLevel,
        quietZoneModules: Math.max(4, design.margin),
      },
      print: { widthMm: printMm },
      overall,
      checks: allChecks.map(({ id, severity, detail }) => ({ id, severity, detail })),
      scanTest: scanCurrent?.result ?? null,
    };
  }

  async function doExport(format: ExportFormat) {
    if (!rendered) return;
    setPendingExport(null);
    const file = slugify(name);
    const aspect = rendered.height / rendered.width;
    try {
      const report = await buildReport();
      if (format === 'report') return exportReport(report, file);
      const svg = renderSvg(matrix!, effectiveDesign, { metadata: JSON.stringify(report) }).svg;
      if (format === 'svg') exportSvg(svg, file);
      else if (format === 'png') await exportPng(svg, file, Math.max(1024, Math.round((printMm / 25.4) * 300)), aspect);
      else await exportPdf(svg, file, printMm, aspect);
      setNotice(`Exported ${file}.${format}`);
    } catch (e) {
      setNotice(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function requestExport(format: ExportFormat) {
    if (format !== 'report' && overall === 'fail') setPendingExport(format);
    else void doExport(format);
  }

  function saveTemplate() {
    const n = templateName.trim();
    if (!n) return;
    const next = [...templates.filter((t) => t.name !== n), { id: crypto.randomUUID(), name: n, design }];
    if (saveTemplates(next)) {
      setTemplates(next);
      setTemplateName('');
      setNotice(`Saved template “${n}”.`);
    } else {
      setNotice('The browser refused to store the template (storage full or disabled). Try without a logo.');
    }
  }

  function deleteTemplate(id: string) {
    const next = templates.filter((t) => t.id !== id);
    saveTemplates(next);
    setTemplates(next);
  }

  const failing = allChecks.filter((c) => c.severity === 'fail');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo-mark" aria-hidden="true" />
          <span>QR Studio</span>
        </div>
        <span className="badge">Static · never expires</span>
      </header>

      <main className="layout">
        <div className="column">
          <section className="card" aria-labelledby="content-heading">
            <h2 id="content-heading"><span className="step">1</span>Content</h2>
            <div className="type-grid" role="tablist" aria-label="QR type">
              {(Object.keys(CONTENT_LABELS) as ContentType[]).map((t) => (
                <button key={t} role="tab" aria-selected={type === t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
                  {CONTENT_LABELS[t]}
                </button>
              ))}
            </div>
            <ContentForm type={type} data={content[type]} onChange={(d) => setContent((c) => ({ ...c, [type]: d }))} />
            {encoded.errors.length > 0 && (
              <ul className="error-list" role="alert">
                {encoded.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </section>

          <DesignPanel design={design} onChange={setDesign} />

          <section className="card" aria-labelledby="templates-heading">
            <h2 id="templates-heading"><span className="step">3</span>Templates</h2>
            <div className="template-list">
              {[...BUILT_IN_TEMPLATES, ...templates].map((t) => (
                <div key={t.id} className="template">
                  <button type="button" onClick={() => setDesign({ ...t.design, logo: t.design.logo ?? design.logo })}>{t.name}</button>
                  {!t.builtIn && (
                    <button type="button" className="icon" aria-label={`Delete template ${t.name}`} onClick={() => deleteTemplate(t.id)}>×</button>
                  )}
                </div>
              ))}
            </div>
            <div className="inline-form">
              <TextInput label="Save current design as" value={templateName} placeholder="Template name" onChange={setTemplateName} />
              <button type="button" className="button secondary" disabled={!templateName.trim()} onClick={saveTemplate}>Save</button>
            </div>
            <p className="hint">Templates store design only, never content, in this browser.</p>
          </section>
        </div>

        <aside className="column preview-column" aria-label="Preview and export">
          <section className="card preview-card">
            <div className="preview-head">
              <h2>Preview</h2>
              <Segmented label="Zoom" value={zoom} options={[{ value: 'fit', label: 'Fit' }, { value: 'print', label: 'Print size' }]} onChange={setZoom} />
            </div>
            <div className={`preview-stage${design.transparent ? ' checker' : ''}`}>
              {rendered ? (
                <div
                  className="preview-svg"
                  style={zoom === 'print' ? { width: `${printMm}mm` } : undefined}
                  role="img"
                  aria-label="QR code preview"
                  dangerouslySetInnerHTML={{ __html: rendered.svg }}
                />
              ) : (
                <p className="placeholder">{'error' in built ? built.error : 'Enter content to generate a code.'}</p>
              )}
            </div>

            <div className={`status status-${overall}`} role="status">
              <strong>
                {!matrix
                  ? 'Waiting for valid content'
                  : overall === 'fail'
                    ? 'Not safe to print'
                    : !scanCurrent
                      ? 'Running decode test…'
                      : overall === 'pass'
                        ? 'Scan-safe'
                        : 'Scannable, with warnings'}
              </strong>
            </div>
            <ul className="checks">
              {allChecks.map((c) => (
                <li key={c.id} className={`check check-${c.severity}`}>
                  <span className="check-icon" aria-label={SEVERITY_TEXT[c.severity]}>{SEVERITY_ICON[c.severity]}</span>
                  <span><strong>{c.label}</strong> {c.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2><span className="step">4</span>Export</h2>
            <div className="field">
              <label htmlFor="print-size">Print size</label>
              <select
                id="print-size"
                value={PRINT_PRESETS.find((p) => p.mm === printMm)?.id ?? 'custom'}
                onChange={(e) => {
                  const p = PRINT_PRESETS.find((x) => x.id === e.target.value);
                  if (p) setPrintMm(p.mm);
                }}
              >
                {PRINT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                {!PRINT_PRESETS.some((p) => p.mm === printMm) && <option value="custom">Custom ({printMm} mm)</option>}
              </select>
            </div>
            <div className="field">
              <label htmlFor="print-mm">Width (mm)</label>
              <input id="print-mm" type="number" min={10} max={2000} value={printMm} onChange={(e) => setPrintMm(Math.min(2000, Math.max(10, Number(e.target.value) || 10)))} />
            </div>
            <TextInput label="File name" value={name} onChange={setName} />
            <div className="export-buttons">
              <button className="button primary" disabled={!rendered} onClick={() => requestExport('svg')}>SVG</button>
              <button className="button primary" disabled={!rendered} onClick={() => requestExport('png')}>PNG</button>
              <button className="button primary" disabled={!rendered} onClick={() => requestExport('pdf')}>PDF</button>
            </div>
            <button className="link" disabled={!rendered} onClick={() => requestExport('report')}>Download validation report (JSON)</button>
            <p className="hint">SVG is the master print file and carries its validation report inside. PNG is rendered at 300 dpi for the chosen width.</p>
            {notice && <p className="notice" role="status">{notice}</p>}
          </section>
        </aside>
      </main>

      <dialog ref={dialogRef} className="dialog" onClose={() => setPendingExport(null)}>
        <h2>This design may not scan</h2>
        <ul>
          {failing.map((c) => <li key={c.id}><strong>{c.label}:</strong> {c.detail}</li>)}
        </ul>
        <p>Printed codes that fail to scan are expensive to replace. Export anyway?</p>
        <div className="dialog-actions">
          <button className="button secondary" onClick={() => setPendingExport(null)}>Go back and fix</button>
          <button className="button danger" onClick={() => pendingExport && void doExport(pendingExport)}>Export anyway</button>
        </div>
      </dialog>
    </div>
  );
}

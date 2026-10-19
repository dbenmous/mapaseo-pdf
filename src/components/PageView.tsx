import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { pdfjs } from '../lib/renderer';
import type { PDFDocumentProxy } from '../lib/renderer';
import type { Annotation, Point, Tool } from '../types';

type PageViewProps = {
  pdf: PDFDocumentProxy;
  page: number;
  width: number;
  tool: Tool;
  color: string;
  annotations: Annotation[];
  onAdd: (annotation: Annotation) => void;
  onSelectPage?: (page: number) => void;
  textValue?: string;
  signaturePoints?: Point[];
  onReady?: (page: number) => void;
};

type Draft = { start: Point; end: Point; points: Point[]; pointerId: number };
type PageLink = { id: string; left: number; top: number; width: number; height: number; url?: string; page?: number };
const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

function rectangle(start: Point, end: Point) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

function pointsPath(points: Point[], width: number, height: number) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(point.x * width).toFixed(3)},${(point.y * height).toFixed(3)}`).join(' ');
}

let annotationTextContext: CanvasRenderingContext2D | null | undefined;
function wrappedLines(value: string, fontSize: number, availableWidth: number): string[] {
  annotationTextContext ??= document.createElement('canvas').getContext('2d');
  if (annotationTextContext) annotationTextContext.font = `${fontSize}px Arial`;
  const result: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      const width = annotationTextContext?.measureText(candidate).width ?? candidate.length * fontSize * 0.55;
      if (line && width > availableWidth) { result.push(line); line = word; }
      else line = candidate;
    }
    result.push(line);
  }
  return result;
}

function safeLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (['https:', 'http:', 'mailto:'].includes(url.protocol)) return url.href;
  } catch { /* Invalid and executable document links remain inert. */ }
}

function AnnotationShape({ annotation, width, height, originalHeight }: { annotation: Annotation; width: number; height: number; originalHeight: number }) {
  const { x, y, width: boxWidth, height: boxHeight } = annotation;
  const scale = height / originalHeight;
  if (annotation.type === 'draw' || annotation.type === 'signature') {
    return <path d={pointsPath(annotation.points || [], width, height)} fill="none" stroke={annotation.color} strokeWidth={(annotation.type === 'signature' ? 1.6 : 2) * scale} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (annotation.type === 'note') {
    const fontSize = annotation.fontSize || 11;
    const lines = wrappedLines(annotation.text || 'Note', fontSize, Math.max(40, boxWidth * width / scale - 12));
    const noteHeight = Math.max(boxHeight * height, (lines.length * fontSize * 1.25 + 12) * scale);
    return <g>
      <title>{annotation.text || 'Note'}</title>
      <rect x={x * width} y={y * height} width={boxWidth * width} height={noteHeight} fill="#fff5ba" stroke={annotation.color} strokeWidth={0.7 * scale} />
      <text fill="#3b3a28" fontSize={fontSize * scale} fontFamily="Arial, Helvetica, sans-serif">
        {lines.map((line, index) => <tspan key={index} x={x * width + 6 * scale} y={y * height + (6 + fontSize * 0.82 + index * fontSize * 1.25) * scale}>{line || ' '}</tspan>)}
      </text>
    </g>;
  }
  if (annotation.type === 'text') {
    const fontSize = (annotation.fontSize || 14) * height / originalHeight;
    return <text x={x * width} y={y * height + fontSize * 0.82} fill={annotation.color} fontFamily="Arial, Helvetica, sans-serif" fontSize={fontSize}>
      {(annotation.text || '').split('\n').map((line, index) => <tspan key={index} x={x * width} dy={index === 0 ? 0 : fontSize * 1.25}>{line || ' '}</tspan>)}
    </text>;
  }
  return <rect x={x * width} y={y * height} width={boxWidth * width} height={boxHeight * height} fill={annotation.type === 'highlight' ? annotation.color : 'none'} fillOpacity={annotation.type === 'highlight' ? 0.3 : 1} stroke={annotation.type === 'rectangle' ? annotation.color : 'none'} strokeWidth={1.5 * scale} style={annotation.type === 'highlight' ? { mixBlendMode: 'multiply' } : undefined} />;
}

/** Canvas pixels, selectable text, and vectors share one PDF viewport. */
export default function PageView({ pdf, page, width, tool, color, annotations, onAdd, onSelectPage, textValue, signaturePoints, onReady }: PageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textHostRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [size, setSize] = useState({ width: 612, height: 792, userUnit: 1 });
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<PageLink[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const displayWidth = Math.max(100, width);
  const displayHeight = displayWidth * size.height / size.width;

  useEffect(() => {
    let cancelled = false;
    let pageRendered = false;
    let renderTask: ReturnType<pdfjs.PDFPageProxy['render']> | undefined;
    let textLayer: InstanceType<typeof pdfjs.TextLayer> | undefined;
    setRendering(true);
    setError('');
    setLinks([]);
    setDraft(null);
    draftRef.current = null;
    textHostRef.current?.replaceChildren();
    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const original = pdfPage.getViewport({ scale: 1 });
        setSize({ width: original.width, height: original.height, userUnit: original.userUnit });
        const viewport = pdfPage.getViewport({ scale: displayWidth / original.width });
        const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
        // A private canvas prevents overlapping renders when zoom changes quickly.
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('The document canvas could not be created.');
        renderTask = pdfPage.render({ canvas, canvasContext: context, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0], background: '#ffffff', annotationMode: pdfjs.AnnotationMode.ENABLE });
        await renderTask.promise;
        if (cancelled || !canvasRef.current) return;
        const visible = canvasRef.current;
        visible.width = canvas.width;
        visible.height = canvas.height;
        visible.getContext('2d', { alpha: false })?.drawImage(canvas, 0, 0);
        canvas.width = 0;
        canvas.height = 0;
        pageRendered = true;
        setRendering(false);
        readyRef.current?.(page);

        // Keep every PDF text run in its native position; no raster OCR substitution.
        const textContent = await pdfPage.getTextContent();
        if (cancelled) return;
        const textContainer = document.createElement('div');
        textContainer.className = 'textLayer';
        textContainer.style.setProperty('--scale-factor', String(viewport.scale));
        textContainer.style.setProperty('--total-scale-factor', String(viewport.scale * viewport.userUnit));
        textContainer.style.setProperty('--scale-round-x', '1px');
        textContainer.style.setProperty('--scale-round-y', '1px');
        textLayer = new pdfjs.TextLayer({ textContentSource: textContent, container: textContainer, viewport });
        await textLayer.render();
        if (cancelled) return;
        textHostRef.current?.replaceChildren(textContainer);

        const pdfAnnotations = await pdfPage.getAnnotations({ intent: 'display' });
        const pageLinks = await Promise.all(pdfAnnotations.filter(annotation => annotation.subtype === 'Link').map(async annotation => {
          const [a, b, c, d, e, f] = viewport.transform;
          const [x1, y1, x2, y2] = annotation.rect;
          const rect = [a * x1 + c * y1 + e, b * x1 + d * y1 + f, a * x2 + c * y2 + e, b * x2 + d * y2 + f];
          const link: PageLink = { id: annotation.id, left: Math.min(rect[0], rect[2]), top: Math.min(rect[1], rect[3]), width: Math.abs(rect[2] - rect[0]), height: Math.abs(rect[3] - rect[1]), url: safeLink(annotation.url) };
          if (!link.url && annotation.dest) {
            try {
              const destination = typeof annotation.dest === 'string' ? await pdf.getDestination(annotation.dest) : annotation.dest;
              if (Array.isArray(destination) && destination.length) {
                const index = typeof destination[0] === 'number' ? destination[0] : await pdf.getPageIndex(destination[0]);
                if (index >= 0 && index < pdf.numPages) link.page = index + 1;
              }
            } catch { /* A malformed destination must not break the document. */ }
          }
          return link;
        }));
        if (!cancelled) setLinks(pageLinks.filter(link => link.url || link.page));
      } catch (reason) {
        if (cancelled || (reason instanceof Error && reason.name === 'RenderingCancelledException')) return;
        if (pageRendered) { console.warn('PDF text or link layer unavailable', reason); return; }
        console.error('PDF page render failed', reason);
        setRendering(false);
        setError(reason instanceof Error ? reason.message : 'This page could not be rendered.');
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); };
  }, [pdf, page, displayWidth]);

  function pointFor(event: ReactPointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
  }

  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    if (tool === 'select' || event.button !== 0 || rendering || error) return;
    event.preventDefault();
    const point = pointFor(event);
    const next = { start: point, end: point, points: [point], pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    draftRef.current = next;
    setDraft(next);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const current = draftRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = pointFor(event);
    const previous = current.points[current.points.length - 1];
    const points = tool === 'draw' && Math.hypot(point.x - previous.x, point.y - previous.y) > 0.0005 ? [...current.points, point] : current.points;
    const next = { ...current, end: point, points };
    draftRef.current = next;
    setDraft(next);
  }

  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const current = draftRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    draftRef.current = null;
    setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const last = pointFor(event);
    const box = rectangle(current.start, last);
    const base = { id: crypto.randomUUID(), page, color, createdAt: Date.now() };
    if (tool === 'highlight' || tool === 'rectangle') {
      if (box.width * displayWidth < 3 || box.height * displayHeight < 3) return;
      onAdd({ ...base, ...box, type: tool });
    } else if (tool === 'draw') {
      const points = [...current.points, last];
      const xs = points.map(point => point.x), ys = points.map(point => point.y);
      onAdd({ ...base, type: 'draw', x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points });
    } else if (tool === 'signature') {
      if (!signaturePoints?.length) return;
      const signatureWidth = 0.3;
      const signatureHeight = signatureWidth * displayWidth / displayHeight * 0.34;
      const x = clamp(last.x, 0, 1 - signatureWidth), y = clamp(last.y, 0, 1 - signatureHeight);
      onAdd({ ...base, type: 'signature', x, y, width: signatureWidth, height: signatureHeight, points: signaturePoints.map(point => ({ x: x + clamp(point.x) * signatureWidth, y: y + clamp(point.y) * signatureHeight })) });
    } else if (tool === 'text' || tool === 'note') {
      const text = textValue?.trim() || (tool === 'text' ? 'Your text' : 'Note');
      const originalWidth = size.width / size.userUnit, originalHeight = size.height / size.userUnit;
      const boxWidth = tool === 'note' ? 0.3 : Math.min(0.5, Math.max(0.2, text.split('\n').reduce((longest, line) => Math.max(longest, line.length), 0) * 7 / originalWidth));
      const boxHeight = tool === 'note' ? (wrappedLines(text, 11, Math.max(40, boxWidth * originalWidth - 12)).length * 11 * 1.25 + 12) / originalHeight : Math.max(20, text.split('\n').length * 17.5) / originalHeight;
      onAdd({ ...base, type: tool, x: clamp(last.x, 0, 1 - boxWidth), y: clamp(last.y, 0, Math.max(0, 1 - boxHeight)), width: boxWidth, height: boxHeight, text, fontSize: tool === 'note' ? 11 : 14 });
    }
  }

  const draftAnnotation: Annotation | undefined = draft && (tool === 'draw' || tool === 'highlight' || tool === 'rectangle') ? { id: 'draft', page, type: tool, color, ...rectangle(draft.start, draft.end), points: draft.points, createdAt: 0 } : undefined;

  return <div className={`pdf-page tool-${tool}${rendering ? ' is-rendering' : ''}`} style={{ width: displayWidth, height: displayHeight, position: 'relative', background: '#fff', touchAction: tool === 'select' ? 'auto' : 'none' }} role="region" aria-label={`Document page ${page}`} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { draftRef.current = null; setDraft(null); }}>
    <canvas ref={canvasRef} className="pdf-canvas" style={{ display: 'block', width: '100%', height: '100%' }} aria-label={`Page ${page} of ${pdf.numPages}`} />
    <div ref={textHostRef} className="pdf-text-host" style={{ position: 'absolute', inset: 0, pointerEvents: tool === 'select' ? 'auto' : 'none', userSelect: tool === 'select' ? 'text' : 'none' }} />
    <svg className="annotation-surface" width="100%" height="100%" viewBox={`0 0 ${displayWidth} ${displayHeight}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} aria-label="Document annotations">
      {annotations.filter(annotation => annotation.page === page).map(annotation => <AnnotationShape key={annotation.id} annotation={annotation} width={displayWidth} height={displayHeight} originalHeight={size.height / size.userUnit} />)}
      {draftAnnotation && <AnnotationShape annotation={draftAnnotation} width={displayWidth} height={displayHeight} originalHeight={size.height / size.userUnit} />}
    </svg>
    <div className="page-links" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {links.map(link => link.url ? <a className="pdf-link" key={link.id} href={link.url} title={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open link: ${link.url}`} style={{ position: 'absolute', left: link.left, top: link.top, width: link.width, height: link.height, pointerEvents: tool === 'select' ? 'auto' : 'none' }} /> : <button className="pdf-link" key={link.id} type="button" title={`Go to page ${link.page}`} aria-label={`Go to page ${link.page}`} onClick={() => link.page && onSelectPage?.(link.page)} style={{ position: 'absolute', left: link.left, top: link.top, width: link.width, height: link.height, padding: 0, border: 0, background: 'transparent', pointerEvents: tool === 'select' ? 'auto' : 'none' }} />)}
    </div>
    {rendering && <div className="page-render-status" role="status">Rendering page {page}…</div>}
    {error && <div className="page-render-error" role="alert"><strong>Unable to display this page</strong><span>{error}</span></div>}
  </div>;
}

export function Thumbnail({ pdf, page, width = 116, active, onClick }: { pdf: PDFDocumentProxy; page: number; width?: number; active: boolean; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(width * 792 / 612);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '220px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [pdf, page]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: ReturnType<pdfjs.PDFPageProxy['render']> | undefined;
    setError(false);
    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const original = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: width / original.width });
        setHeight(viewport.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width * 1.5);
        canvas.height = Math.ceil(viewport.height * 1.5);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;
        task = pdfPage.render({ canvas, canvasContext: context, viewport, transform: [1.5, 0, 0, 1.5, 0, 0], background: '#fff' });
        await task.promise;
        if (cancelled || !canvasRef.current) return;
        canvasRef.current.width = canvas.width;
        canvasRef.current.height = canvas.height;
        canvasRef.current.getContext('2d', { alpha: false })?.drawImage(canvas, 0, 0);
        canvas.width = 0;
        canvas.height = 0;
      } catch (reason) {
        if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) setError(true);
      }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, page, width, visible]);

  return <button type="button" ref={containerRef} className={`thumbnail-preview${active ? ' active' : ''}`} onClick={onClick} aria-label={`Go to page ${page}`} aria-current={active ? 'page' : undefined}>
    <div style={{ width, height, position: 'relative', background: '#fff' }}><canvas className="thumbnail-canvas" ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />{error && <span className="thumbnail-error">Preview unavailable</span>}</div>
    <span className="thumbnail-number">{page}</span>
  </button>;
}

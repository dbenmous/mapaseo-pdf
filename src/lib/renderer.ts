import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Keep the renderer and its worker on exactly the same bundled version.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function assetUrl(folder: string): string {
  return new URL(`pdf-assets/${folder}/`, document.baseURI).href;
}

/** PDF.js transfers its input to the worker; retain the original for lossless export. */
export function getDocument(data: Uint8Array | ArrayBuffer) {
  return pdfjs.getDocument({
    data: data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0)),
    cMapUrl: assetUrl('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('standard_fonts'),
    wasmUrl: assetUrl('wasm'),
    useSystemFonts: true,
  });
}

export { pdfjs };
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

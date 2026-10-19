import { describe, expect, it } from 'vitest';
import {
  PDFDocument, PDFArray, PDFRawStream, PDFName, PDFDict, PDFNumber, decodePDFRawStream, degrees, StandardFonts,
} from 'pdf-lib';
import {
  createBlankPdf, createSamplePdf, exportPdf, rotatePage, reorderPages, mergePdfs,
  extractPages, getFormFields, fillFormFields, watermarkPdf,
} from '../src/lib/pdf';
import type { Annotation } from '../src/types';

const decoder = new TextDecoder();
function content(pdf: PDFDocument, index = 0): string {
  const object = pdf.getPage(index).node.Contents();
  if (!object) return '';
  const streams = object instanceof PDFArray
    ? Array.from({ length: object.size() }, (_, i) => object.lookup(i, PDFRawStream))
    : [object as PDFRawStream];
  return streams.map(stream => decoder.decode(decodePDFRawStream(stream).decode())).join('\n');
}

async function fixture(rotation = 0) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 600]);
  page.setCropBox(10, 20, 300, 500);
  page.setRotation(degrees(rotation));
  page.drawText('ORIGINAL VECTOR TEXT', { x: 45, y: 270, size: 14 });
  return pdf.save();
}

const annotation = (override: Partial<Annotation> = {}): Annotation => ({
  id: 'a', page: 1, type: 'draw', color: '#167d78', x: 0.1, y: 0.2,
  width: 0.3, height: 0.1, createdAt: 1,
  points: [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.3 }], ...override,
});

describe('vector PDF engine', () => {
  it('creates an original seven-page searchable vector sample with no raster images', async () => {
    const bytes = await createSamplePdf();
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(7);
    expect(pdf.getTitle()).toBe('A better space to do great work');
    expect(pdf.getAuthor()).toBe('Studio North');
    for (let i = 0; i < 7; i++) {
      const operations = content(pdf, i);
      expect(operations).toContain(' Tj');
      expect(operations).toContain(' l');
      expect(operations.length).toBeGreaterThan(1000);
    }
    const imageObjects = pdf.context.enumerateIndirectObjects().filter(([, o]) =>
      o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    expect(imageObjects).toHaveLength(0);
  });

  it('creates a clean A4 page', async () => {
    const pdf = await PDFDocument.load(await createBlankPdf());
    expect(pdf.getPages()).toHaveLength(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89);
  });

  it.each([
    [0, [40, 420, 130, 370]], [90, [70, 70, 100, 220]],
    [180, [280, 120, 190, 170]], [270, [250, 470, 220, 320]],
  ])('exports display-normalized drawing correctly for %i degrees and a nonzero crop box', async (rotation, points) => {
    const pdf = await PDFDocument.load(await exportPdf(await fixture(rotation as number), [annotation()]));
    const operations = content(pdf);
    const match = operations.match(/([-\d.]+) ([-\d.]+) m\n([-\d.]+) ([-\d.]+) l/);
    expect(match).not.toBeNull();
    match!.slice(1).map(Number).forEach((v, i) => expect(v).toBeCloseTo((points as number[])[i], 6));
    expect(pdf.getPage(0).getRotation().angle).toBe(rotation);
  });

  it('preserves source vector operators while appending all annotation types', async () => {
    const bytes = await fixture(90), before = await PDFDocument.load(bytes);
    const result = await PDFDocument.load(await exportPdf(bytes, [
      annotation({ type: 'highlight' }), annotation({ type: 'rectangle' }),
      annotation({ type: 'text', text: 'Added text', fontSize: 14 }),
      annotation({ type: 'note', text: 'Review this paragraph', fontSize: 11 }),
      annotation({ type: 'signature' }),
    ]));
    expect(content(result)).toContain(content(before));
    expect(content(result)).toContain('41646465642074657874'); // "Added text" in the font encoding.
    const states = result.getPage(0).node.Resources()!.lookup(PDFName.of('ExtGState'), PDFDict);
    const opacity = states.values().map(value => result.context.lookup(value, PDFDict).get(PDFName.of('ca')))
      .filter((value): value is PDFNumber => value instanceof PDFNumber).map(value => value.asNumber());
    expect(opacity).toContain(0.3);
    expect(result.getPage(0).getCropBox()).toEqual(before.getPage(0).getCropBox());
    expect(result.getPage(0).getRotation().angle).toBe(90);
  });

  it('rejects missing annotation pages and unsupported text instead of losing annotations silently', async () => {
    const bytes = await fixture();
    await expect(exportPdf(bytes, [annotation({ page: 2 })])).rejects.toThrow('missing page');
    await expect(exportPdf(bytes, [annotation({ type: 'text', text: '\u4f60\u597d' })])).rejects.toThrow('cannot encode');
  });

  it('matches the renderer when the CropBox extends past the MediaBox', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([400, 600]);
    page.setCropBox(-20, 20, 500, 700);
    const pdf = await PDFDocument.load(await exportPdf(await source.save(), [annotation()]));
    const match = content(pdf).match(/([-\d.]+) ([-\d.]+) m\n([-\d.]+) ([-\d.]+) l/);
    expect(match).not.toBeNull();
    match!.slice(1).map(Number).forEach((v, i) => expect(v).toBeCloseTo([40, 484, 160, 426][i], 6));
  });

  it('rotates by increments, preserves page content and normalizes negative rotations', async () => {
    const bytes = await fixture();
    const after = await PDFDocument.load(await rotatePage(bytes, 0, -90));
    expect(after.getPage(0).getRotation().angle).toBe(270);
    expect(content(after)).toBe(content(await PDFDocument.load(bytes)));
    await expect(rotatePage(bytes, 0, 45)).rejects.toThrow('90 degree');
    await expect(rotatePage(bytes, 8, 90)).rejects.toThrow('does not exist');
  });

  it('reorders whole pages, extracts selected pages and combines without changing dimensions', async () => {
    const source = await PDFDocument.create();
    source.addPage([100, 200]); source.addPage([300, 400]); source.addPage([500, 600]);
    const bytes = await source.save();
    const reordered = await PDFDocument.load(await reorderPages(bytes, [2, 0, 1]));
    expect(reordered.getPages().map(p => p.getWidth())).toEqual([500, 100, 300]);
    const extracted = await extractPages(bytes, [2, 0]);
    expect((await PDFDocument.load(extracted)).getPages().map(p => p.getWidth())).toEqual([500, 100]);
    const combined = await PDFDocument.load(await mergePdfs([extracted, bytes]));
    expect(combined.getPages().map(p => p.getWidth())).toEqual([500, 100, 100, 300, 500]);
    await expect(reorderPages(bytes, [0, 0, 2])).rejects.toThrow('only appear once');
    const removed = await PDFDocument.load(await reorderPages(bytes, [0, 2]));
    expect(removed.getPages().map(p => p.getWidth())).toEqual([100, 500]);
    await expect(extractPages(bytes, [])).rejects.toThrow('at least one');
  });

  it('retains nested page-tree inherited resources, crop, size and rotation after moving a page', async () => {
    const source = await PDFDocument.create();
    const first = source.addPage([333, 555]), second = source.addPage([200, 300]);
    first.drawText('INHERITED FONT', { x: 25, y: 100, size: 12 });
    const root = source.catalog.Pages();
    const branch = source.context.obj({ Type: 'Pages', Kids: [first.ref], Count: 1,
      Parent: source.catalog.get(PDFName.of('Pages')), MediaBox: [0, 0, 333, 555],
      CropBox: [10, 20, 320, 540], Rotate: 90, Resources: first.node.Resources() });
    const branchRef = source.context.register(branch);
    root.lookup(PDFName.of('Kids'), PDFArray).set(0, branchRef);
    first.node.setParent(branchRef);
    for (const key of ['MediaBox', 'CropBox', 'Rotate', 'Resources']) first.node.delete(PDFName.of(key));
    const result = await PDFDocument.load(await reorderPages(await source.save(), [1, 0]));
    expect(result.getPage(0).getWidth()).toBe(second.getWidth());
    expect(result.getPage(1).getWidth()).toBe(333);
    expect(result.getPage(1).getHeight()).toBe(555);
    expect(result.getPage(1).getCropBox()).toEqual({ x: 10, y: 20, width: 310, height: 520 });
    expect(result.getPage(1).getRotation().angle).toBe(90);
    expect(result.getPage(1).node.Resources()!.lookup(PDFName.of('Font'), PDFDict).keys().length).toBeGreaterThan(0);
    expect(content(result, 1)).toContain('494E4845524954454420464F4E54');
  });

  it('reads and fills interactive fields, updates canonical values and widget appearances, then preserves them when reordering', async () => {
    const original = await PDFDocument.create();
    const p1 = original.addPage(), p2 = original.addPage();
    const form = original.getForm();
    form.createTextField('name').addToPage(p1, { x: 50, y: 400, width: 160, height: 25 });
    form.createCheckBox('approved').addToPage(p1, { x: 50, y: 350, width: 20, height: 20 });
    const drop = form.createDropdown('region'); drop.addOptions(['North', 'South']);
    drop.addToPage(p2, { x: 50, y: 400, width: 160, height: 25 });
    const originalBytes = await original.save();
    const filledBytes = await fillFormFields(originalBytes, [
      { name: 'name', type: 'text', value: 'Alex North' },
      { name: 'approved', type: 'checkbox', value: true },
      { name: 'region', type: 'dropdown', value: 'North' },
    ]);
    expect(await getFormFields(filledBytes)).toEqual([
      { name: 'name', type: 'text', value: 'Alex North' },
      { name: 'approved', type: 'checkbox', value: true },
      { name: 'region', type: 'dropdown', value: 'North', options: ['North', 'South'] },
    ]);
    const saved = await PDFDocument.load(filledBytes);
    for (const field of saved.getForm().getFields()) for (const widget of field.acroField.getWidgets()) {
      expect(widget.getAppearances()?.normal).toBeDefined();
    }
    const reordered = await reorderPages(filledBytes, [1, 0]);
    expect(await getFormFields(reordered)).toEqual(await getFormFields(filledBytes));
    expect((await PDFDocument.load(reordered)).getPage(0).node.Annots()?.size()).toBe(1);
    await expect(mergePdfs([filledBytes])).rejects.toThrow('interactive forms');
    await expect(extractPages(filledBytes, [0])).rejects.toThrow('interactive forms');
    await expect(reorderPages(filledBytes, [0])).rejects.toThrow('Removing pages from interactive forms');
    await expect(fillFormFields(originalBytes, [{ name: 'region', type: 'dropdown', value: 'Unknown' }])).rejects.toThrow('available option');
  });

  it('adds a searchable vector watermark to every page without rasterizing', async () => {
    const bytes = await createSamplePdf();
    const result = await PDFDocument.load(await watermarkPdf(bytes, 'DRAFT'));
    for (let i = 0; i < result.getPageCount(); i++) expect(content(result, i)).toContain('4452414654');
    expect(result.getPages()).toHaveLength(7);
    await expect(watermarkPdf(bytes, ' ')).rejects.toThrow('Enter some text');
    const font = await result.embedFont(StandardFonts.Helvetica);
    expect(font.widthOfTextAtSize('DRAFT', 10)).toBeGreaterThan(20);
  });
});

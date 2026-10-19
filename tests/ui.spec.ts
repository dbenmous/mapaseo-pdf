import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PDFDocument, StandardFonts } = createRequire(import.meta.url)('pdf-lib/dist/pdf-lib.js') as typeof import('pdf-lib');

async function ready(page: Page) {
  await expect(page.locator('.pdf-canvas')).toBeVisible();
  await expect(page.locator('.page-render-status')).toHaveCount(0);
  await expect(page.locator('.textLayer span').first()).toBeAttached();
}

async function documentPoint(page: Page, x: number, y: number) {
  const bounds = await page.locator('.pdf-page').boundingBox();
  if (!bounds) throw new Error('The document page is not visible.');
  return { x: bounds.x + bounds.width * x, y: bounds.y + bounds.height * y };
}

async function dragOnPage(page: Page, start: [number, number], end: [number, number]) {
  const first = await documentPoint(page, ...start), last = await documentPoint(page, ...end);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.mouse.move(last.x, last.y, { steps: 16 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await ready(page);
});

test('Mac interface reserves space for native controls and shows Command shortcuts', async ({ page }) => {
  // Renderer-only Mac preview; native signing and window behavior are tested on macOS.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'desktop', { value: {
      platform: 'darwin', getRecent: async () => [], aiModels: async () => [],
      onOpenFile: () => () => {}, onMenuAction: () => () => {},
      openFiles: async () => [],
    } });
  });
  await page.reload();
  await ready(page);
  await expect(page.locator('.app')).toHaveClass(/platform-mac/);
  await expect(page.locator('.window-actions')).toHaveCount(0);
  const brand = await page.locator('.titlebar-brand').boundingBox();
  expect(brand!.x).toBeGreaterThanOrEqual(100);
  await expect(page.getByRole('button', { name: 'Open PDF (⌘O)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo (⌘Z)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redo (⌘⇧Z)', exact: true })).toBeVisible();
  expect((await page.locator('.document-stage').boundingBox())!.y).toBeLessThanOrEqual(100);
});

test('renders crisp pages, selectable text, lazy thumbnails, navigation and rapid zoom', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('.navigation-panel .thumbnail-preview')).toHaveCount(7);
  const pixels = await page.locator('.pdf-canvas').evaluate(canvas => {
    const element = canvas as HTMLCanvasElement;
    return { width: element.width, displayed: element.clientWidth };
  });
  expect(pixels.width).toBeGreaterThanOrEqual(pixels.displayed * 1.99);
  const selected = await page.locator('.textLayer span').first().evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    return selection.toString();
  });
  expect(selected.length).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await ready(page);
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('2');
  await expect(page.locator('.textLayer')).toContainText('Good work starts');
  await page.getByLabel('Zoom', { exact: true }).selectOption('200');
  await page.getByLabel('Zoom', { exact: true }).selectOption('50');
  await page.getByLabel('Zoom', { exact: true }).selectOption('150');
  await ready(page);
  await expect(page.locator('.pdf-canvas')).toHaveJSProperty('width', 1785);
  await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'First page', exact: true }).click();
  await ready(page);
  await page.screenshot({ path: testInfo.outputPath('mapaseo-reader.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('finds document passages and follows assistant source pages', async ({ page }) => {
  await page.getByRole('button', { name: 'Search document (Ctrl+F)', exact: true }).click();
  await page.getByPlaceholder('Search words or phrases').fill('prototype');
  await expect(page.locator('.search-result')).toHaveCount(1);
  await page.locator('.search-result').click();
  await ready(page);
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('6');
  await expect(page.locator('.textLayer')).toContainText('Try a small change');
  await page.getByRole('button', { name: 'Give me the big picture', exact: true }).click();
  await expect(page.locator('.chat-message.assistant')).toBeVisible();
  await expect(page.locator('.source-chips button').first()).toBeVisible();
  const source = page.locator('.source-chips button').first();
  const text = await source.innerText();
  await source.click();
  await ready(page);
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue(text.match(/\d+/)![0]);
});

test('adds vector highlights, undo and redo, text and readable notes, then saves and reopens', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Highlight area', exact: true }).click();
  await dragOnPage(page, [0.08, 0.18], [0.65, 0.27]);
  await expect(page.locator('.annotation-surface rect')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).click();
  await expect(page.locator('.annotation-surface rect')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo (Ctrl+Y)', exact: true }).click();
  await expect(page.locator('.annotation-surface rect')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Text', { exact: true }).fill('Review sign off');
  await page.getByRole('button', { name: 'Place on page', exact: true }).click();
  const textSpot = await documentPoint(page, 0.1, 0.36);
  await page.mouse.click(textSpot.x, textSpot.y);
  await expect(page.locator('.annotation-surface text')).toContainText('Review sign off');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Your comment').fill('Confirm the final floor plan before approval.');
  await page.getByRole('button', { name: 'Place on page', exact: true }).click();
  const noteSpot = await documentPoint(page, 0.65, 0.40);
  await page.mouse.click(noteSpot.x, noteSpot.y);
  await expect(page.locator('.comment-card')).toContainText('Confirm the final floor plan');
  await expect(page.locator('.annotation-surface')).toContainText('Confirm the final floor plan');
  await page.screenshot({ path: testInfo.outputPath('mapaseo-review.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
  const download = await downloadPromise;
  const output = testInfo.outputPath('reviewed.pdf');
  await download.saveAs(output);
  const exported = await PDFDocument.load(await readFile(output));
  expect(exported.getPageCount()).toBe(7);
  expect(exported.getPage(0).node.Contents()).toBeTruthy();
  await page.locator('input[type=file]').first().setInputFiles(output);
  await ready(page);
  await expect(page.locator('.textLayer')).toContainText('Review sign off');
  await expect(page.locator('.textLayer')).toContainText('Confirm the final floor plan');
});

test('captures and places a vector signature', async ({ page }) => {
  await page.getByRole('button', { name: 'Fit page', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'Add signature', exact: true }).click();
  const pad = await page.locator('.signature-pad canvas').boundingBox();
  if (!pad) throw new Error('Signature pad was not opened.');
  await page.mouse.move(pad.x + 30, pad.y + 90);
  await page.mouse.down();
  await page.mouse.move(pad.x + 80, pad.y + 30, { steps: 8 });
  await page.mouse.move(pad.x + 115, pad.y + 95, { steps: 8 });
  await page.mouse.move(pad.x + 180, pad.y + 60, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Use signature', exact: true }).click();
  const spot = await documentPoint(page, 0.42, 0.85);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator('.annotation-surface path')).toHaveCount(1);
  const path = await page.locator('.annotation-surface path').getAttribute('d');
  expect(path?.split('L').length).toBeGreaterThan(15);
});

for (const viewport of [{ width: 1536, height: 960 }, { width: 1366, height: 768 }]) {
  test(`keeps a spacious reader and reachable vertical controls at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await expect(page.locator('.editing-toolbar, .stage-topline, .page-navigator')).toHaveCount(0);

    const stage = page.locator('.document-stage');
    const stageBounds = await stage.boundingBox();
    if (!stageBounds) throw new Error('The reading area is not visible.');
    expect(stageBounds.y).toBeLessThanOrEqual(100);
    expect(stageBounds.height).toBeGreaterThanOrEqual(viewport.height - 125);

    const select = await page.locator('.quick-tools').getByRole('button', { name: 'Select text (Escape)', exact: true }).boundingBox();
    const highlight = await page.locator('.quick-tools').getByRole('button', { name: 'Highlight area', exact: true }).boundingBox();
    const signature = await page.locator('.quick-tools').getByRole('button', { name: 'Add signature', exact: true }).boundingBox();
    if (!select || !highlight || !signature) throw new Error('The annotation controls are not reachable.');
    expect(select.x).toBeLessThan(stageBounds.x + 64);
    expect(Math.abs(select.x - highlight.x)).toBeLessThan(3);
    expect(highlight.y).toBeGreaterThanOrEqual(select.y + select.height);
    expect(signature.y + signature.height).toBeLessThanOrEqual(viewport.height);

    const rail = page.locator('.view-rail');
    await expect(rail.locator('.view-controls')).toBeVisible();
    await expect(rail.getByLabel('Current page', { exact: true })).toBeVisible();
    await expect(rail.getByLabel('Zoom', { exact: true })).toBeVisible();
    const zoomIn = await rail.getByRole('button', { name: 'Zoom in', exact: true }).boundingBox();
    const zoomOut = await rail.getByRole('button', { name: 'Zoom out', exact: true }).boundingBox();
    if (!zoomIn || !zoomOut) throw new Error('The zoom controls are not reachable.');
    expect(Math.abs(zoomIn.x - zoomOut.x)).toBeLessThan(3);
    expect(Math.abs(zoomIn.y - zoomOut.y)).toBeGreaterThanOrEqual(zoomIn.height);
    expect(Math.max(zoomIn.y + zoomIn.height, zoomOut.y + zoomOut.height)).toBeLessThanOrEqual(viewport.height);

    await mkdir('tmp/qa', { recursive: true });
    if (viewport.width === 1536) await page.screenshot({ path: 'tmp/qa/compact-expanded.png', fullPage: true });
    await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Hide tools panel', exact: true }).click();
    await expect(page.locator('.navigation-panel, .inspector-panel')).toHaveCount(0);
    await expect.poll(async () => (await stage.boundingBox())?.width).toBeGreaterThanOrEqual(viewport.width - 100);
    await ready(page);
    await page.screenshot({ path: `tmp/qa/${viewport.width === 1536 ? 'compact-reader' : 'compact-laptop'}.png`, fullPage: true });

    await rail.getByRole('button', { name: 'Next page', exact: true }).click();
    await ready(page);
    await expect(rail.getByLabel('Current page', { exact: true })).toHaveValue('2');
    await rail.getByLabel('Zoom', { exact: true }).selectOption('150');
    await ready(page);
    await expect(page.locator('.pdf-canvas')).toHaveJSProperty('width', 1785);
  });
}

test('remembers each folded panel and its selected contents after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Document outline', exact: true }).click();
  await page.getByRole('button', { name: 'Comments', exact: true }).click();
  await expect(page.locator('.navigation-panel')).toContainText('Contents');
  await expect(page.locator('.inspector-panel')).toContainText('A place for your thoughts.');
  await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Hide tools panel', exact: true }).click();
  await page.reload();
  await ready(page);
  await expect(page.locator('.navigation-panel, .inspector-panel')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mapaseo-layout') || '{}'))).toMatchObject({
    leftOpen: false, rightOpen: false, leftMode: 'outline', rightMode: 'comments',
  });

  await page.getByRole('button', { name: 'Show navigation', exact: true }).click();
  await expect(page.locator('.navigation-panel')).toContainText('Contents');
  await page.reload();
  await ready(page);
  await expect(page.locator('.navigation-panel')).toContainText('Contents');
  await expect(page.locator('.inspector-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Show tools panel', exact: true }).click();
  await expect(page.locator('.inspector-panel')).toContainText('A place for your thoughts.');
  await page.reload();
  await ready(page);
  await expect(page.locator('.navigation-panel')).toHaveCount(0);
  await expect(page.locator('.inspector-panel')).toContainText('A place for your thoughts.');

  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  await expect(page.locator('.navigation-panel .thumbnail-preview')).toHaveCount(7);
  await page.getByRole('button', { name: 'Hide tools panel', exact: true }).click();
  await page.getByRole('button', { name: 'Comments', exact: true }).click();
  await expect(page.locator('.inspector-panel')).toContainText('A place for your thoughts.');
});

test('zooms the document around the pointer with Ctrl + wheel while ordinary wheel scrolls', async ({ page }) => {
  await page.getByLabel('Zoom', { exact: true }).selectOption('200');
  await ready(page);
  const canvas = page.locator('.pdf-canvas');
  const stage = await page.locator('.document-stage').boundingBox();
  const beforePage = await page.locator('.pdf-page').boundingBox();
  if (!stage || !beforePage) throw new Error('The document is not ready to zoom.');
  const pointer = { x: stage.x + stage.width * 0.58, y: stage.y + stage.height * 0.48 };
  const documentPointUnderPointer = {
    x: (pointer.x - beforePage.x) / beforePage.width,
    y: (pointer.y - beforePage.y) / beforePage.height,
  };
  const browserMetrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, ratio: devicePixelRatio }));
  const initialWidth = await canvas.evaluate(element => (element as HTMLCanvasElement).width);
  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width)).toBeGreaterThan(initialWidth);
  await ready(page);
  const enlargedPage = await page.locator('.pdf-page').boundingBox();
  if (!enlargedPage) throw new Error('The zoomed document is not visible.');
  expect(Math.abs(enlargedPage.x + enlargedPage.width * documentPointUnderPointer.x - pointer.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(enlargedPage.y + enlargedPage.height * documentPointUnderPointer.y - pointer.y)).toBeLessThanOrEqual(4);
  const enlargedWidth = await canvas.evaluate(element => (element as HTMLCanvasElement).width);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width)).toBeLessThan(enlargedWidth);
  await page.keyboard.up('Control');
  await ready(page);
  expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, ratio: devicePixelRatio }))).toEqual(browserMetrics);

  const widthBeforeScroll = await canvas.evaluate(element => (element as HTMLCanvasElement).width);
  const scroll = page.locator('.page-scroll');
  const initialTop = await scroll.evaluate(element => element.scrollTop);
  await page.mouse.wheel(0, 360);
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(initialTop);
  await expect(canvas).toHaveJSProperty('width', widthBeforeScroll);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await ready(page);
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBe(0);
});

test('reorders and removes pages with undo and redo', async ({ page }) => {
  await page.getByRole('button', { name: 'Organize', exact: true }).click();
  await page.getByRole('button', { name: 'Move page 1 later', exact: true }).click();
  await page.getByRole('button', { name: 'Select page 7', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ready(page);
  await expect(page.locator('.navigation-panel .thumbnail-preview')).toHaveCount(6);
  await expect(page.locator('.textLayer')).toContainText('Good work starts');
  await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).click();
  await ready(page);
  await expect(page.locator('.navigation-panel .thumbnail-preview')).toHaveCount(7);
  await page.getByRole('button', { name: 'Redo (Ctrl+Y)', exact: true }).click();
  await ready(page);
  await expect(page.locator('.navigation-panel .thumbnail-preview')).toHaveCount(6);
});

test('fills real PDF form fields and preserves editable values on save', async ({ page }, testInfo) => {
  const fixture = await PDFDocument.create();
  const sheet = fixture.addPage([612, 792]);
  const font = await fixture.embedFont(StandardFonts.Helvetica);
  sheet.drawText('Project approval', { x: 50, y: 735, font, size: 24 });
  const form = fixture.getForm();
  const name = form.createTextField('Full name');
  name.addToPage(sheet, { x: 50, y: 650, width: 300, height: 25 });
  const consent = form.createCheckBox('Approved');
  consent.addToPage(sheet, { x: 50, y: 600, width: 18, height: 18 });
  const team = form.createDropdown('Team');
  team.addOptions(['Design', 'Operations']); team.select('Design');
  team.addToPage(sheet, { x: 50, y: 550, width: 200, height: 25 });
  form.updateFieldAppearances(font);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'approval.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await fixture.save()) });
  await ready(page);
  await expect(page.locator('.textLayer')).toContainText('Project approval');
  await page.getByRole('button', { name: 'All tools', exact: true }).click();
  await page.getByRole('button', { name: /Fill form fields Complete interactive PDF forms/ }).click();
  await page.getByRole('dialog').getByLabel('Full name').fill('Maya Ortiz');
  await page.getByRole('dialog').getByLabel('Approved').check();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Team', exact: true }).selectOption('Operations');
  await page.getByRole('button', { name: 'Apply values', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ready(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
  const download = await downloadPromise;
  const output = testInfo.outputPath('approval-filled.pdf');
  await download.saveAs(output);
  const result = (await PDFDocument.load(await readFile(output))).getForm();
  expect(result.getTextField('Full name').getText()).toBe('Maya Ortiz');
  expect(result.getCheckBox('Approved').isChecked()).toBe(true);
  expect(result.getDropdown('Team').getSelected()).toEqual(['Operations']);
});

test('keeps professional panels usable on a Windows laptop and supports dark appearance', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  const navigation = await page.locator('.navigation-panel').boundingBox();
  const document = await page.locator('.document-stage').boundingBox();
  const inspector = await page.locator('.inspector-panel').boundingBox();
  expect(navigation && document && inspector).toBeTruthy();
  expect(navigation!.x + navigation!.width).toBeLessThanOrEqual(document!.x + 1);
  expect(document!.x + document!.width).toBeLessThanOrEqual(inspector!.x + 1);
  expect(inspector!.x + inspector!.width).toBeLessThanOrEqual(1366);
  await page.screenshot({ path: testInfo.outputPath('mapaseo-laptop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Light', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('mapaseo-dark.png'), fullPage: true });
});

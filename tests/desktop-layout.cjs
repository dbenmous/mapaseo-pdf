/* Run after npm run build. Real Electron checks use a fresh workspace profile,
   then cold-start the app twice to verify durable reader preferences. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');

(async () => {
  const root = path.resolve(__dirname, '..');
  await fs.mkdir(path.join(root, 'tmp'), { recursive: true });
  const folder = await fs.mkdtemp(path.join(root, 'tmp', 'desktop-layout-'));
  const bootstrap = path.join(folder, 'bootstrap.cjs');
  await fs.writeFile(bootstrap, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(folder, 'profile'))});require(${JSON.stringify(path.join(root, 'electron/main.cjs'))});\n`);
  let electron;
  const rendererErrors = [];

  async function ready(page) {
    await expect(page.locator('.pdf-canvas')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.page-render-status')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('.textLayer span').first()).toBeAttached({ timeout: 30000 });
  }

  async function launch() {
    electron = await _electron.launch({ args: [bootstrap], cwd: root, timeout: 30000 });
    const page = await electron.firstWindow();
    page.on('pageerror', error => rendererErrors.push(error.message));
    await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1366, 768));
    await ready(page);
    assert.equal(page.url(), 'mapaseo://app/index.html');
    return page;
  }

  async function close() {
    await electron.close();
    electron = undefined;
  }

  try {
    let page = await launch();
    await expect(page.locator('.editing-toolbar, .stage-topline, .page-navigator')).toHaveCount(0);
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, ratio: devicePixelRatio }));
    const expanded = await page.locator('.document-stage').boundingBox();
    assert.ok(expanded.y <= 100, `Reader starts ${expanded.y}px below the window top.`);
    assert.ok(expanded.height >= viewport.height - 125, 'Top controls take too much reader height.');

    await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Hide tools panel', exact: true }).click();
    await expect(page.locator('.navigation-panel, .inspector-panel')).toHaveCount(0);
    await expect.poll(async () => (await page.locator('.document-stage').boundingBox()).width).toBeGreaterThanOrEqual(viewport.width - 100);
    await ready(page);

    await page.getByLabel('Zoom', { exact: true }).selectOption('200');
    await ready(page);
    const canvas = page.locator('.pdf-canvas');
    const stage = await page.locator('.document-stage').boundingBox();
    const pointer = { x: stage.x + stage.width * 0.58, y: stage.y + stage.height * 0.48 };
    const beforeWidth = await canvas.evaluate(element => element.width);
    const beforeWindowZoom = await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor());
    await page.mouse.move(pointer.x, pointer.y);
    await page.keyboard.down('Control');
    try {
      await page.mouse.wheel(0, -120);
      await expect.poll(() => canvas.evaluate(element => element.width)).toBeGreaterThan(beforeWidth);
      await ready(page);
      const enlargedWidth = await canvas.evaluate(element => element.width);
      await page.mouse.wheel(0, 120);
      await expect.poll(() => canvas.evaluate(element => element.width)).toBeLessThan(enlargedWidth);
    } finally { await page.keyboard.up('Control'); }
    await ready(page);
    assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, ratio: devicePixelRatio })), viewport);
    assert.equal(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()), beforeWindowZoom);

    const beforeScroll = await page.locator('.page-scroll').evaluate(element => ({ top: element.scrollTop, width: document.querySelector('.pdf-canvas').width }));
    await page.mouse.wheel(0, 360);
    await expect.poll(() => page.locator('.page-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(beforeScroll.top);
    assert.equal(await canvas.evaluate(element => element.width), beforeScroll.width);
    await page.getByLabel('Zoom', { exact: true }).selectOption('fit');
    await ready(page);
    await page.screenshot({ path: path.join(folder, 'compact-native-reader.png') });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mapaseo-layout')))).toMatchObject({ leftOpen: false, rightOpen: false });
    await close();

    page = await launch();
    await expect(page.locator('.navigation-panel, .inspector-panel')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show navigation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show tools panel', exact: true })).toBeVisible();
    await expect.poll(async () => (await page.locator('.document-stage').boundingBox()).width).toBeGreaterThanOrEqual(viewport.width - 100);
    await page.getByRole('button', { name: 'Document outline', exact: true }).click();
    await expect(page.locator('.navigation-panel')).toContainText('Contents');
    await expect(page.locator('.inspector-panel')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mapaseo-layout')))).toMatchObject({ leftOpen: true, rightOpen: false, leftMode: 'outline' });
    await close();

    page = await launch();
    await expect(page.locator('.navigation-panel')).toContainText('Contents');
    await expect(page.locator('.outline-list')).toBeVisible();
    await expect(page.locator('.inspector-panel')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Hide navigation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show tools panel', exact: true })).toBeVisible();
    assert.deepEqual(rendererErrors, []);
    console.log(`PASS: real Electron compact reader (${expanded.y}px top chrome), wide document stage, native Ctrl + wheel zoom in/out without Chromium zoom, ordinary wheel scrolling, and folded/mixed panel state plus outline mode across two cold restarts.`);
    console.log(`Isolated profile and native screenshot: ${folder}`);
  } finally { if (electron) await electron.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

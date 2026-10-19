// Run only on the macOS Apple Silicon runner, after npm run package:mac.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');

(async () => {
  assert.equal(process.platform, 'darwin', 'This is a native macOS test.');
  assert.equal(process.arch, 'arm64', 'Run on an Apple Silicon host.');
  const root = path.resolve(__dirname, '..');
  const executablePath = path.join(root, 'release/mac-arm64/Mapaseo PDF.app/Contents/MacOS/Mapaseo PDF');
  await fs.mkdir(path.join(root, 'tmp'), { recursive: true });
  const profile = await fs.mkdtemp(path.join(root, 'tmp/mac-smoke-'));
  let electron;
  const errors = [];
  async function launch() {
    electron = await _electron.launch({ executablePath, args: [`--user-data-dir=${profile}`], timeout: 60000 });
    const page = await electron.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await expect(page.locator('.pdf-canvas')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.textLayer span').first()).toBeAttached({ timeout: 60000 });
    await expect(page.locator('.page-render-status')).toHaveCount(0);
    return page;
  }
  try {
    let page = await launch();
    assert.equal(await page.evaluate(() => window.desktop.platform), 'darwin');
    await expect(page.locator('.window-actions')).toHaveCount(0);
    const state = await electron.evaluate(({ app, BrowserWindow, Menu }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const prefs = win.webContents.getLastWebPreferences();
      return { packaged: app.isPackaged, arch: process.arch, sandbox: prefs.sandbox,
        isolation: prefs.contextIsolation, node: prefs.nodeIntegration,
        menu: Menu.getApplicationMenu().items.map(item => item.label) };
    });
    assert.equal(state.packaged, true);
    assert.equal(state.arch, 'arm64');
    assert.equal(state.sandbox, true);
    assert.equal(state.isolation, true);
    assert.equal(state.node, false);
    assert.ok(state.menu.includes('Mapaseo PDF') && state.menu.includes('Window'));
    const pixels = await page.locator('.pdf-canvas').evaluate(canvas => {
      const colors = new Set();
      const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < bytes.length; i += 68) colors.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]}`);
      return colors.size;
    });
    assert.ok(pixels > 15, 'The PDF is blank.');
    const top = await page.locator('.document-stage').boundingBox();
    assert.ok(top.y <= 100, 'Mac titlebar consumes too much height.');
    await page.keyboard.press('Meta+f');
    await expect(page.locator('#document-search')).toBeVisible();
    await page.getByRole('button', { name: 'Pages', exact: true }).click();
    await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Hide tools panel', exact: true }).click();
    await page.getByLabel('Zoom', { exact: true }).selectOption('100');
    const stage = await page.locator('.document-stage').boundingBox();
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    // Ctrl+wheel is retained on Mac too; Command+wheel is also accepted.
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await expect(page.getByLabel('Zoom', { exact: true })).toHaveValue('110');
    await expect(page.locator('.page-render-status')).toHaveCount(0);
    await electron.close(); electron = undefined;
    page = await launch();
    await expect(page.locator('.navigation-panel, .inspector-panel')).toHaveCount(0);
    // macOS keeps the application alive after closing the last window.
    const nextWindow = electron.waitForEvent('window');
    await electron.evaluate(({ app, BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].close();
      setTimeout(() => app.emit('activate'), 300);
    });
    const reopened = await nextWindow;
    await expect(reopened.locator('.pdf-canvas')).toBeVisible({ timeout: 60000 });
    assert.deepEqual(errors, []);
    console.log('PASS native packaged Mac arm64: PDF canvas/text, sandbox, native menu, compact controls, Command+F, Ctrl+wheel, saved panel preferences and Dock reopen.');
  } finally { if (electron) await electron.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

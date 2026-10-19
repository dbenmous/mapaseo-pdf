/* Run after building release/win-unpacked. No installer or registry changes. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require('playwright');
const asar = require('@electron/asar');

(async () => {
  const root = path.resolve(__dirname, '..');
  const unpacked = path.join(root, 'release', 'win-unpacked');
  const executablePath = path.join(unpacked, 'Mapaseo PDF.exe');
  const archivePath = path.join(unpacked, 'resources', 'app.asar');
  const expectedVersion = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
  await fs.access(executablePath);
  await fs.mkdir(path.join(root, 'tmp', 'qa'), { recursive: true });
  const profile = await fs.mkdtemp(path.join(root, 'tmp', 'packaged-profile-'));
  const files = asar.listPackage(archivePath).map((file) => file.replaceAll('\\', '/'));
  for (const required of ['/LICENSE', '/THIRD_PARTY_NOTICES.md', '/THIRD_PARTY_LICENSES.txt', '/electron/mapaseo.ico', '/electron/main.cjs', '/electron/preload.cjs', '/dist/index.html']) assert.ok(files.includes(required), `Missing packaged file: ${required}`);
  assert.ok(!files.some((file) => /(^|\/)node_modules(?:\/|$)/.test(file)), 'Unused Node dependencies were included in app.asar.');
  assert.ok(!files.some((file) => /napi-rs|canvas-win32|\.node$/.test(file)), 'Unused native canvas binaries were included.');
  const licenses = asar.extractFile(archivePath, 'THIRD_PARTY_LICENSES.txt');
  assert.ok(licenses.length > 10 * 1024 * 1024, 'Chromium license texts are missing.');
  assert.ok(licenses.includes(Buffer.from('LICENSES.chromium.html')));
  const workerPath = files.find((file) => /^\/dist\/assets\/pdf\.worker\.min-.*\.mjs$/.test(file));
  assert.ok(workerPath, 'The PDF worker was not packaged.');
  assert.ok(asar.extractFile(archivePath, workerPath.slice(1).split('/').join(path.sep)).includes(Buffer.from('6.4.299')), 'The worker is not the security-updated PDF.js version.');

  // Confirm the 256px source icon frame is actually embedded in the PE resources.
  const icon = asar.extractFile(archivePath, path.join('electron', 'mapaseo.ico'));
  let iconFrame;
  for (let index = 0; index < icon.readUInt16LE(4); index++) {
    const entry = 6 + index * 16;
    if (icon[entry] === 0 && icon[entry + 1] === 0) {
      const length = icon.readUInt32LE(entry + 8);
      const offset = icon.readUInt32LE(entry + 12);
      iconFrame = icon.subarray(offset, offset + length);
    }
  }
  assert.ok(iconFrame?.length > 100, 'The packaged brand icon has no 256px frame.');
  assert.ok((await fs.readFile(executablePath)).includes(iconFrame), 'The executable does not contain the original Mapaseo icon.');

  const electron = await _electron.launch({ executablePath, args: [`--user-data-dir=${profile}`], cwd: root, timeout: 30000 });
  try {
    const page = await electron.firstWindow();
    page.on('pageerror', (error) => console.error('PACKAGED RENDERER:', error.message));
    await page.waitForFunction(() => !!window.desktop && !!document.querySelector('.pdf-canvas') && !!document.querySelector('.textLayer span'), { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('.pdf-page.is-rendering'), { timeout: 30000 });
    assert.equal(page.url(), 'mapaseo://app/index.html');
    const runtime = await electron.evaluate(({ app, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const p = win.webContents.getLastWebPreferences();
      return { isPackaged: app.isPackaged, userData: app.getPath('userData'), version: app.getVersion(), sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
    });
    assert.equal(runtime.isPackaged, true);
    assert.equal(runtime.version, expectedVersion, 'The packaged version does not match the current release.');
    assert.equal(path.resolve(runtime.userData).toLowerCase(), path.resolve(profile).toLowerCase(), 'The packaged test profile is not isolated.');
    assert.equal(runtime.sandbox, true);
    assert.equal(runtime.contextIsolation, true);
    assert.equal(runtime.nodeIntegration, false);
    const renderer = await page.evaluate(() => {
      const canvas = document.querySelector('.pdf-canvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let index = 0; index < pixels.length; index += 68) colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      return { require: typeof require, process: typeof process, bridge: typeof window.desktop.openFiles, text: document.querySelector('.textLayer')?.textContent, colors: colors.size, width: canvas.width, height: canvas.height };
    });
    assert.equal(renderer.require, 'undefined');
    assert.equal(renderer.process, 'undefined');
    assert.equal(renderer.bridge, 'function');
    assert.ok(renderer.text.length > 40, 'The packaged PDF text layer is empty.');
    assert.ok(renderer.colors > 15, 'The packaged PDF page is blank.');
    assert.ok(renderer.width > 300 && renderer.height > 400);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('.document-stage').getBoundingClientRect();
      return { top: stage.top, height: stage.height, windowHeight: innerHeight, oldControls: document.querySelectorAll('.editing-toolbar, .stage-topline, .page-navigator').length };
    });
    assert.ok(layout.top <= 100, 'The packaged reader has oversized top controls.');
    assert.ok(layout.height >= layout.windowHeight - 125, 'The packaged document loses too much vertical space.');
    assert.equal(layout.oldControls, 0, 'The package still contains the previous reader controls.');
    for (const label of ['Select text (Escape)', 'Highlight area', 'Add signature']) assert.ok(await page.locator('.quick-tools').getByRole('button', { name: label, exact: true }).isVisible(), `Missing vertical annotation control: ${label}`);
    for (const label of ['Fit width', 'Fit page', 'Zoom in', 'Zoom out']) assert.ok(await page.locator('.view-rail').getByRole('button', { name: label, exact: true }).isVisible(), `Missing right-rail view control: ${label}`);
    await page.screenshot({ path: path.join(root, 'tmp', 'qa', 'mapaseo-windows.png'), fullPage: false });
    await page.getByRole('button', { name: 'Hide navigation', exact: true }).click();
    await page.getByRole('button', { name: 'Hide tools panel', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.navigation-panel, .inspector-panel') && document.querySelector('.document-stage').getBoundingClientRect().width >= innerWidth - 100);
    await page.waitForFunction(() => !document.querySelector('.pdf-page.is-rendering'));
    await page.screenshot({ path: path.join(root, 'tmp', 'qa', 'compact-packaged.png'), fullPage: false });
    console.log(`PASS packaged Mapaseo PDF ${runtime.version}: app.isPackaged, matching release version, isolated profile, ${layout.top}px top chrome, new vertical controls, wide folded reader, custom protocol, PDF rendering/text, sandbox/bridge, original PE icon, complete licenses, no Node modules/native canvas. ${files.length} files in app.asar.`);
    console.log(`Screenshots: ${path.join(root, 'tmp', 'qa', 'mapaseo-windows.png')} and ${path.join(root, 'tmp', 'qa', 'compact-packaged.png')}`);
  } finally { await electron.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

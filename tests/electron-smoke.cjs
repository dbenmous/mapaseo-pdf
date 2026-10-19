/* Real Electron integration checks; run after npm run build.
   Dialog results are stubbed in the test process, never in production code. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require('playwright');
const { PDFDocument, StandardFonts } = require('pdf-lib');

(async () => {
  const root = path.resolve(__dirname, '..');
  await fs.mkdir(path.join(root, 'tmp'), { recursive: true });
  const folder = await fs.mkdtemp(path.join(root, 'tmp', 'electron-smoke-'));
  const input = path.join(folder, 'bridge-test.pdf');
  const output = path.join(folder, 'saved.pdf');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('Desktop bridge smoke test', { x: 40, y: 700, font, size: 18 });
  await fs.writeFile(input, await pdf.save());
  const bootstrap = path.join(folder, 'bootstrap.cjs');
  // Keep test profiles and recents inside the workspace, isolated from real use.
  await fs.writeFile(bootstrap, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(folder, 'profile'))});require(${JSON.stringify(path.join(root, 'electron/main.cjs'))});\n`);
  const electron = await _electron.launch({ args: [bootstrap], cwd: root, timeout: 30000 });
  try {
    const page = await electron.firstWindow();
    page.on('pageerror', (error) => console.error('RENDERER ERROR:', error.message));
    page.on('console', (message) => { if (message.type() === 'error') console.error('RENDERER CONSOLE:', message.text()); });
    await page.waitForFunction(() => !!window.desktop && !!document.querySelector('main'), { timeout: 30000 });
    try { await page.waitForSelector('canvas', { timeout: 30000 }); }
    catch (error) {
      console.error('Renderer state:', await page.evaluate(() => document.body.innerText.slice(0, 5000)));
      await page.screenshot({ path: path.join(folder, 'renderer-failure.png') });
      throw error;
    }
    assert.equal(page.url(), 'mapaseo://app/index.html');
    const isolation = await page.evaluate(() => ({ require: typeof require, nodeProcess: typeof process, ipc: typeof window.desktop.ipcRenderer, platform: window.desktop.platform }));
    assert.deepEqual(isolation, { require: 'undefined', nodeProcess: 'undefined', ipc: 'undefined', platform: 'win32' });
    const preferences = await electron.evaluate(({ BrowserWindow }) => {
      const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration, webSecurity: p.webSecurity };
    });
    assert.deepEqual(preferences, { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true });

    await electron.evaluate(({ dialog }, choices) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [choices.input] });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: choices.output });
    }, { input, output });
    const opened = await page.evaluate(async () => {
      const files = await window.desktop.openFiles();
      window.__smokePdf = files[0];
      return { count: files.length, name: files[0].name, bytes: files[0].data.length };
    });
    assert.equal(opened.count, 1);
    assert.equal(opened.name, 'bridge-test.pdf');
    assert.ok(opened.bytes > 100);
    const recents = await page.evaluate(() => window.desktop.getRecent());
    assert.equal(recents[0].path.toLowerCase(), input.toLowerCase());
    assert.equal(await page.evaluate(async (file) => (await window.desktop.openRecent(file)).data.length, input), opened.bytes);
    await assert.rejects(page.evaluate((file) => window.desktop.openRecent(file), path.join(root, 'LICENSE')), /recent list/);
    const saved = await page.evaluate(() => window.desktop.saveFile('saved.pdf', window.__smokePdf.data, 'C:\\untrusted\\path.pdf'));
    assert.equal(saved, output);
    assert.equal((await fs.stat(output)).size, opened.bytes);
    await assert.rejects(page.evaluate(() => window.desktop.saveFile('unsafe.exe', new Uint8Array([1, 2, 3]))), /Supported exports/);
    await assert.rejects(page.evaluate(() => window.desktop.print(new Uint8Array([1, 2, 3]))), /PDF data/);
    const unauthorized = await electron.evaluate(async ({ BrowserWindow }, preload) => {
      const untrusted = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false } });
      try {
        await untrusted.loadURL('data:text/html,<p>Untrusted frame test</p>');
        return await untrusted.webContents.executeJavaScript("window.desktop.getRecent().then(() => 'UNEXPECTED ACCESS').catch(error => error.message)");
      } finally { untrusted.destroy(); }
    }, path.join(root, 'electron/preload.cjs'));
    assert.match(unauthorized, /only in the Mapaseo PDF window/);

    // Exercise the real PDF-viewer and temporary-file path, stubbing only the
    // final OS printer callback so this test never opens a printer dialog.
    await electron.evaluate(({ app }) => {
      app.once('browser-window-created', (_event, win) => {
        win.webContents.print = (options, callback) => {
          globalThis.__smokePrint = { options, url: win.webContents.getURL() };
          callback(true, '');
        };
      });
    });
    await page.evaluate(() => window.desktop.print(window.__smokePdf.data));
    const printJob = await electron.evaluate(() => globalThis.__smokePrint);
    assert.equal(printJob.options.silent, false);
    assert.ok(printJob.url.startsWith('file:///'));
    const { fileURLToPath } = require('node:url');
    await assert.rejects(fs.stat(fileURLToPath(printJob.url)), /ENOENT/);
    await assert.rejects(page.evaluate(() => window.desktop.aiChat('model:cloud', 'Question', '[p. 1] Text')), /Choose a local model/);
    const localAI = await page.evaluate(async () => {
      try { return { models: await window.desktop.aiModels() }; }
      catch (error) { return { error: error.message }; }
    });
    if (localAI.models) assert.ok(localAI.models.every((model) => !/cloud/i.test(model)));
    else assert.match(localAI.error, /Ollama|Local AI|local AI/);

    const priorWindows = electron.windows().length;
    await page.evaluate(() => window.open('https://example.com'));
    await page.waitForTimeout(100);
    assert.equal(electron.windows().length, priorWindows);
    await page.evaluate(() => { window.location.href = 'https://example.com'; });
    await page.waitForTimeout(100);
    assert.equal(page.url(), 'mapaseo://app/index.html');

    await page.evaluate(() => window.desktop.windowControl('maximize'));
    await page.waitForTimeout(150);
    assert.equal(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
    await page.evaluate(() => window.desktop.windowControl('maximize'));
    await page.evaluate(() => window.desktop.windowControl('minimize'));
    await page.waitForTimeout(150);
    assert.equal(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
    await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore());
    console.log('PASS: real Electron protocol rendering, sandbox/isolation, native file bridge, recent whitelist, export validation, unauthorized renderer rejection, PDF print-viewer/temp cleanup, AI local-only validation, navigation/window denial, and native window controls.');
    console.log('Native printer output and generative inference require a configured printer and local Ollama model and were not exercised.');
  } finally { await electron.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

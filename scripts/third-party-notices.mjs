import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const packages = new Map();

async function locatePackage(name, from) {
  let current = from;
  while (true) {
    const candidate = path.join(current, 'node_modules', name);
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(candidate, 'package.json'), 'utf8'));
      return { dir: candidate, pkg };
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Missing dependency ${name}. Run npm ci before collecting notices.`);
    current = parent;
  }
}

async function collectPackage(name, from, optional = false, includeDependencies = true) {
  let item;
  try { item = await locatePackage(name, from); }
  catch (error) { if (optional) return; throw error; }
  const key = `${item.pkg.name}@${item.pkg.version}`;
  if (packages.has(key)) return;
  packages.set(key, item);
  if (!includeDependencies) return;
  const optionalNames = new Set(Object.keys(item.pkg.optionalDependencies || {}));
  for (const dependency of Object.keys({ ...item.pkg.dependencies, ...item.pkg.optionalDependencies }).sort()) {
    await collectPackage(dependency, item.dir, optionalNames.has(dependency));
  }
}

async function licenseFiles(dir, relative = '') {
  const found = [];
  for (const entry of await fs.readdir(path.join(dir, relative), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) found.push(...await licenseFiles(dir, rel));
    else if (entry.isFile() && /^(?:licen[cs]es?|copying|notice|copyright)(?:[._-].*)?$/i.test(entry.name)) found.push(rel);
  }
  return found.sort();
}

for (const name of Object.keys(manifest.dependencies || {}).sort()) await collectPackage(name, root);
// Electron is a development dependency, but its runtime is redistributed. Its
// dist/LICENSES.chromium.html supplies Chromium's bundled third-party notices.
await collectPackage('electron', root, false, false);
const electronRuntime = [...packages.values()].find(({ pkg }) => pkg.name === 'electron');
try { await fs.access(path.join(electronRuntime.dir, 'dist', 'LICENSES.chromium.html')); }
catch { throw new Error('Electron runtime is not installed. Run node node_modules/electron/install.js before collecting distributable Chromium notices.'); }

const sections = [
  'MAPASEO PDF — THIRD-PARTY LICENSE TEXTS',
  'Generated from the installed dependency versions by scripts/third-party-notices.mjs.',
  'Mapaseo application code is licensed separately in LICENSE.',
  'This file includes production dependency licenses, PDF.js asset notices, and Electron/Chromium runtime notices.',
  '',
];
const rows = [];
for (const [key, { dir, pkg }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  let sourceDir = dir;
  let licenses = await licenseFiles(dir);
  let inherited = '';
  // Some native platform companion packages omit the shared upstream license.
  // Reuse a verbatim license only from the exact same repository and version.
  if (!licenses.length && pkg.repository?.url) {
    for (const [, candidate] of packages) {
      if (candidate.dir === dir || candidate.pkg.repository?.url !== pkg.repository.url || candidate.pkg.version !== pkg.version || candidate.pkg.license !== pkg.license) continue;
      const shared = await licenseFiles(candidate.dir);
      if (shared.length) {
        sourceDir = candidate.dir; licenses = shared;
        inherited = `License text supplied by companion package ${candidate.pkg.name}@${candidate.pkg.version} from the same upstream repository.`;
        break;
      }
    }
  }
  sections.push('='.repeat(80), key, `Declared license: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license || 'See bundled notices')}`, `Project: ${pkg.homepage || pkg.repository?.url || pkg.repository || ''}`, '');
  if (!licenses.length) throw new Error(`No license text found for ${key}; inspect the dependency before distribution.`);
  if (inherited) sections.push(inherited, '');
  for (const file of licenses) {
    const contents = await fs.readFile(path.join(sourceDir, file), 'utf8');
    sections.push(`--- ${key} / ${file.replaceAll(path.sep, '/')} ---`, contents.trimEnd(), '');
  }
  rows.push(`| ${pkg.name} | ${pkg.version} | ${typeof pkg.license === 'string' ? pkg.license : 'See license texts'} |`);
}

await fs.writeFile(path.join(root, 'THIRD_PARTY_LICENSES.txt'), `${sections.join('\n')}\n`, 'utf8');
const notice = `# Third-party notices\n\nMapaseo PDF is an independent project. It is not affiliated with Adobe, and no Adobe application code, branding, icons, or document samples are included. The application uses the open-source PDF.js rendering engine and pdf-lib for PDF modification.\n\nThe installed versions below were read from node_modules when this notice was generated. Full original license and notice texts are in THIRD_PARTY_LICENSES.txt, including PDF.js font/CMap assets and Electron's Chromium notices. Regenerate both files after changing dependencies.\n\n| Package | Installed version | License |\n| --- | --- | --- |\n${rows.join('\n')}\n\nReact and React DOM are copyright Meta Platforms, Inc. and affiliates. PDF.js is copyright Mozilla Foundation and other contributors. pdf-lib is copyright Andrew Dillon and other contributors. Lucide includes Lucide Contributors and Feather Icons attribution; its original license texts are included without modification. Electron is copyright Electron contributors. The respective authors retain ownership of their work.\n\nNo AI model weights or Ollama binaries are bundled. Optional models and Ollama must be installed separately; their own licenses and terms apply. This application does not grant rights to third-party documents.\n\nTo refresh redistribution notices:\n\n\`\`\`powershell\nnode scripts/third-party-notices.mjs\n\`\`\`\n`;
await fs.writeFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), notice, 'utf8');
console.log(`Collected original license texts for ${packages.size} packages (${(Buffer.byteLength(sections.join('\n')) / 1024 / 1024).toFixed(1)} MB).`);

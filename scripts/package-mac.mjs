import { spawnSync } from 'node:child_process';

// A real Mac is required for codesign and DMG creation. Never silently produce
// an unvalidated Windows cross-build labelled as a ready-to-install Mac app.
if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('Build on an Apple Silicon Mac or run the macOS Apple Silicon GitHub workflow. This command requires macOS arm64.');
}
const run = (script, args) => {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run('scripts/third-party-notices.mjs', []);
run('node_modules/typescript/bin/tsc', ['-b']);
run('scripts/copy-pdf-assets.mjs', []);
run('node_modules/vite/bin/vite.js', ['build']);
run('node_modules/electron-builder/cli.js', ['--mac', 'dmg', 'zip', '--arm64', '--publish', 'never']);

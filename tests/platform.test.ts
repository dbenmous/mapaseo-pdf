import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const { pathKey, windowChrome } = createRequire(import.meta.url)('../electron/platform.cjs');

describe('platform-specific document access and window chrome', () => {
  it('does not authorize a different case-sensitive Mac file through a recent entry', () => {
    expect(pathKey('/Users/me/Contract.pdf', 'darwin')).not.toBe(pathKey('/Users/me/contract.pdf', 'darwin'));
    expect(pathKey('/Users/me/Contract.pdf', 'darwin')).toBe('/Users/me/Contract.pdf');
  });
  it('preserves Windows case-insensitive recent-file matching', () => {
    expect(pathKey('C:\\Docs\\Contract.pdf', 'win32')).toBe(pathKey('c:\\docs\\contract.pdf', 'win32'));
  });
  it('uses real native Mac controls while preserving the compact Windows frame', () => {
    expect(windowChrome('darwin')).toMatchObject({ frame: true, titleBarStyle: 'hiddenInset' });
    expect(windowChrome('win32')).toEqual({ frame: false });
  });
  it('contains valid ICNS PNG representations through native 1024px resolution', () => {
    const icon = readFileSync(new URL('../electron/mapaseo.icns', import.meta.url));
    expect(icon.toString('ascii', 0, 4)).toBe('icns');
    expect(icon.readUInt32BE(4)).toBe(icon.length);
    let offset = 8;
    const sizes = [];
    while (offset < icon.length) {
      const length = icon.readUInt32BE(offset + 4);
      expect(length).toBeGreaterThan(32);
      const png = icon.subarray(offset + 8, offset + length);
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      sizes.push(png.readUInt32BE(16));
      expect(png.readUInt32BE(20)).toBe(png.readUInt32BE(16));
      offset += length;
    }
    expect(offset).toBe(icon.length);
    expect(sizes).toEqual([16, 32, 64, 128, 256, 512, 1024]);
  });
});

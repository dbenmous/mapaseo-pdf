// Original Mapaseo vector artwork; no third-party application assets.
import fs from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const source = (await fs.readFile(new URL('../electron/mapaseo.svg', import.meta.url), 'utf8'))
  .replace('width="256" height="256"', 'width="1024" height="1024"');
const image = await loadImage(Buffer.from(source));
const chunks = [];
for (const [kind, size] of [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]]) {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(image, 0, 0, size, size);
  const png = canvas.toBuffer('image/png');
  const header = Buffer.alloc(8);
  header.write(kind, 0, 4, 'ascii');
  header.writeUInt32BE(png.length + 8, 4);
  chunks.push(header, png);
}
const header = Buffer.alloc(8);
header.write('icns', 0, 4, 'ascii');
header.writeUInt32BE(8 + chunks.reduce((size, chunk) => size + chunk.length, 0), 4);
await fs.writeFile(new URL('../electron/mapaseo.icns', import.meta.url), Buffer.concat([header, ...chunks]));
console.log('Created original Mac icon (16–1024 px).');

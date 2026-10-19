// Original vector mark, rasterized only for Windows' ICO container.
import fs from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const source = await fs.readFile(new URL('../electron/mapaseo.svg', import.meta.url));
const image = await loadImage(source);
const sizes = [16, 24, 32, 48, 64, 128, 256];
const frames = sizes.map((size) => {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(image, 0, 0, size, size);
  return canvas.toBuffer('image/png');
});
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const start = 6 + 16 * index;
  header[start] = sizes[index] === 256 ? 0 : sizes[index];
  header[start + 1] = header[start];
  header.writeUInt16LE(1, start + 4);
  header.writeUInt16LE(32, start + 6);
  header.writeUInt32LE(frame.length, start + 8);
  header.writeUInt32LE(offset, start + 12);
  offset += frame.length;
});
await fs.writeFile(new URL('../electron/mapaseo.ico', import.meta.url), Buffer.concat([header, ...frames]));
console.log('Created original Mapaseo Windows icon (16–256 px).');

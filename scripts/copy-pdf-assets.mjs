import { cpSync,mkdirSync } from 'node:fs';
import { join } from 'node:path';
for(const folder of ['cmaps','standard_fonts','wasm']){mkdirSync('public/pdf-assets',{recursive:true});cpSync(join('node_modules/pdfjs-dist',folder),join('public/pdf-assets',folder),{recursive:true});}
console.log('PDF fonts, character maps, and codecs are bundled for offline rendering.');

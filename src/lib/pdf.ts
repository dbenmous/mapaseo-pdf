import {
  PDFDocument, PDFPage, PDFFont, StandardFonts, PDFTextField, PDFCheckBox,
  PDFDropdown, PDFName, rgb, degrees, LineCapStyle, BlendMode,
} from 'pdf-lib';
import type { Annotation, FormField, Point } from '../types';

const PAPER = { width: 595.28, height: 841.89 };
const C = {
  navy: rgb(0.063, 0.137, 0.18), ink: rgb(0.12, 0.19, 0.22),
  muted: rgb(0.40, 0.46, 0.47), teal: rgb(0.10, 0.46, 0.43),
  mint: rgb(0.79, 0.88, 0.82), pale: rgb(0.89, 0.93, 0.88),
  paper: rgb(0.975, 0.973, 0.95), line: rgb(0.80, 0.84, 0.80),
  white: rgb(1, 1, 1), sand: rgb(0.88, 0.78, 0.61),
};

/** Original, entirely vector sample. No rendered page images are used. */
export async function createSamplePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('A better space to do great work');
  pdf.setAuthor('Studio North');
  pdf.setSubject('An original illustrative workplace design report');
  pdf.setCreator('Mapaseo PDF');
  pdf.setKeywords(['workplace', 'design', 'original sample', 'Studio North']);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const page = () => {
    const p = pdf.addPage([PAPER.width, PAPER.height]);
    p.drawRectangle({ x: 0, y: 0, ...PAPER, color: C.paper });
    return p;
  };
  const text = (p: PDFPage, str: string, x: number, top: number, size = 11,
    font = regular, color = C.ink) => p.drawText(str, { x, y: PAPER.height - top - size,
      size, font, color });
  const para = (p: PDFPage, str: string, x: number, top: number, width: number,
    size = 11, font = regular, color = C.ink, leading = size * 1.55) => {
    let y = top;
    for (const paragraph of str.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > width) {
          text(p, line, x, y, size, font, color); y += leading; line = word;
        } else line = next;
      }
      if (line) { text(p, line, x, y, size, font, color); y += leading; }
      y += leading * 0.35;
    }
    return y;
  };
  const rect = (p: PDFPage, x: number, top: number, width: number, height: number,
    color = C.pale) => p.drawRectangle({ x, y: PAPER.height - top - height, width, height, color });
  const line = (p: PDFPage, x: number, top: number, x2: number, top2: number,
    color = C.line, thickness = 0.7) => p.drawLine({ start: { x, y: PAPER.height - top },
      end: { x: x2, y: PAPER.height - top2 }, color, thickness });
  const header = (p: PDFPage, section: string, n: number) => {
    text(p, 'STUDIO NORTH', 48, 36, 9, bold, C.teal);
    text(p, section.toUpperCase(), 325, 36, 8, regular, C.muted);
    line(p, 48, 62, 547, 62);
    line(p, 48, 786, 547, 786);
    text(p, 'A BETTER SPACE TO DO GREAT WORK', 48, 799, 7, regular, C.muted);
    text(p, String(n).padStart(2, '0'), 531, 797, 9, bold, C.teal);
  };
  const heading = (p: PDFPage, a: string, b: string, top = 96) => {
    text(p, a, 48, top, 35, bold, C.navy);
    text(p, b, 48, top + 42, 35, bold, C.navy);
  };

  // 01 / Cover: a geometric light-filled architectural study.
  {
    const p = page();
    text(p, 'STUDIO', 48, 41, 14, bold, C.navy);
    text(p, 'NORTH', 48, 57, 14, bold, C.navy);
    text(p, 'WORKPLACE OUTLOOK / 2026', 339, 46, 8, regular, C.muted);
    line(p, 48, 101, 547, 101);
    text(p, 'A better space', 48, 133, 43, bold, C.navy);
    text(p, 'to do great work', 48, 184, 43, bold, C.navy);
    para(p, 'A thoughtful guide to places that help people focus,\nconnect and feel at their best.', 50, 257, 400, 12, regular, C.muted, 18);
    rect(p, 48, 343, 499, 340, C.mint);
    // layered buildings and open arch, with an uninterrupted vector sun.
    p.drawCircle({ x: 434, y: PAPER.height - 409, size: 40, color: C.sand });
    rect(p, 48, 545, 499, 138, C.pale);
    rect(p, 97, 405, 155, 278, C.teal);
    rect(p, 119, 425, 112, 258, C.navy);
    p.drawCircle({ x: 175, y: PAPER.height - 491, size: 56, color: C.mint });
    rect(p, 119, 491, 112, 192, C.mint);
    rect(p, 252, 460, 156, 223, C.paper);
    rect(p, 275, 486, 49, 65, C.navy);
    rect(p, 338, 486, 49, 65, C.teal);
    rect(p, 275, 566, 49, 83, C.teal);
    rect(p, 338, 566, 49, 83, C.navy);
    rect(p, 408, 530, 90, 153, C.teal);
    rect(p, 424, 551, 58, 95, C.mint);
    line(p, 48, 683, 547, 683, C.navy, 1);
    text(p, 'PEOPLE. PLACE. POSSIBILITY.', 48, 721, 9, bold, C.teal);
    text(p, 'An original, illustrative design report', 48, 749, 9, regular, C.muted);
    text(p, '01 / 07', 504, 749, 8, regular, C.muted);
  }
  // 02 / Executive overview.
  {
    const p = page(); header(p, 'The perspective', 2);
    heading(p, 'Good work starts', 'with good space.');
    para(p, 'The most useful workplace is not a collection of desks. It is a collection of possibilities: a quiet corner for concentration, a generous table for exchange, and a welcoming place to begin the day.', 48, 213, 480, 13, regular, C.muted, 20);
    rect(p, 48, 330, 499, 141, C.navy);
    para(p, '"A workplace should make the right thing\nfeel like the natural thing."', 70, 355, 450, 23, serif, C.white, 30);
    text(p, 'THE STUDIO NORTH DESIGN PRINCIPLE', 71, 439, 7.5, bold, C.mint);
    const cols = [48, 221, 394];
    const items = [
      ['01', 'Make focus easy', 'Protect time and attention with quiet settings, clear boundaries and comfortable light.'],
      ['02', 'Bring people closer', 'Make shared spaces inviting, useful and simple to find throughout the working day.'],
      ['03', 'Leave room to adapt', 'Choose flexible furniture, test small changes and listen to the people who use the space.'],
    ];
    items.forEach(([n, title, body], i) => {
      text(p, n, cols[i], 516, 29, regular, C.teal);
      text(p, title, cols[i], 569, 11, bold);
      para(p, body, cols[i], 599, 146, 10, regular, C.muted, 16);
    });
    text(p, 'A practical starting point for teams of every size.', 48, 731, 11, serif, C.teal);
  }
  // 03 / Space planning and original vector plan.
  {
    const p = page(); header(p, 'A place for every mode', 3);
    heading(p, 'The workplace is', 'a shared resource.');
    para(p, 'A balanced plan supports different kinds of work without asking one room to do everything. Make the transition between focus and collaboration clear, comfortable and intuitive.', 48, 213, 480, 12, regular, C.muted, 19);
    rect(p, 48, 318, 499, 263, C.white);
    p.drawRectangle({ x: 67, y: PAPER.height - 556, width: 460, height: 215, borderWidth: 2, borderColor: C.navy });
    rect(p, 69, 343, 135, 126, C.pale);
    rect(p, 207, 343, 177, 126, C.mint);
    rect(p, 387, 343, 138, 210, C.pale);
    line(p, 205, 342, 205, 553, C.navy, 1.5);
    line(p, 385, 342, 385, 553, C.navy, 1.5);
    line(p, 68, 471, 384, 471, C.navy, 1.5);
    [[91, 371], [91, 409], [145, 371], [145, 409]].forEach(([x, y]) => rect(p, x, y, 37, 19, C.teal));
    rect(p, 244, 380, 102, 44, C.white);
    [252, 283, 314, 345].forEach(x => {
      p.drawCircle({ x, y: PAPER.height - 370, size: 5, color: C.teal });
      p.drawCircle({ x, y: PAPER.height - 434, size: 5, color: C.teal });
    });
    rect(p, 411, 369, 89, 26, C.teal);
    rect(p, 411, 439, 89, 26, C.teal);
    text(p, 'FOCUS', 91, 449, 7.5, bold, C.teal);
    text(p, 'COLLABORATE', 259, 449, 7.5, bold, C.teal);
    text(p, 'RECHARGE', 430, 510, 7.5, bold, C.teal);
    text(p, 'WELCOME / SHARED PATH', 142, 508, 8, regular, C.muted);
    text(p, 'Illustrative space plan. Not an architectural drawing.', 68, 597, 8, regular, C.muted);
    para(p, 'Quiet at the edges.\nConnection at the heart.', 48, 645, 235, 22, serif, C.teal, 28);
    para(p, 'Separate noisy and quiet activities. Use shared paths to create useful encounters, and make every setting easy to understand without a manual.', 313, 644, 234, 10.5, regular, C.muted, 17);
  }
  // 04 / Charts: planning targets, explicitly illustrative.
  {
    const p = page(); header(p, 'A balanced brief', 4);
    heading(p, 'Design for the work,', 'not the desk.');
    para(p, 'Start with the activities that matter to your team. The example below is a planning exercise, not research data. Use observation and conversation to find your own balance.', 48, 214, 480, 12, regular, C.muted, 19);
    text(p, 'EXAMPLE SPACE ALLOCATION', 48, 323, 9, bold, C.teal);
    text(p, 'Share of usable floor area / illustrative targets', 48, 345, 10, regular, C.muted);
    const bars: [string, number, string][] = [['Individual focus', 40, 'Quiet, heads-down settings'], ['Collaboration', 30, 'Rooms and open project areas'], ['Social & recharge', 20, 'Lounge, kitchen and informal space'], ['Support', 10, 'Storage and service functions']];
    bars.forEach(([label, value, detail], i) => {
      const y = 400 + i * 72;
      text(p, label, 48, y, 11, bold);
      text(p, `${value}%`, 512, y, 12, bold, C.teal);
      rect(p, 48, y + 24, 499, 11, C.pale);
      rect(p, 48, y + 24, 499 * value / 100, 11, i % 2 ? C.mint : C.teal);
      text(p, detail, 48, y + 42, 8.5, regular, C.muted);
    });
    line(p, 48, 712, 547, 712);
    para(p, 'Measure use, not just occupancy. A space earns its place when it helps people do something well.', 48, 729, 475, 11, serif, C.teal, 16);
  }
  // 05 / Meeting and comfort principles.
  {
    const p = page(); header(p, 'Better together', 5);
    heading(p, 'A calmer way', 'to come together.');
    para(p, 'Good collaboration needs more than a meeting room. It needs the right scale, a clear purpose and small details that make participation easier for everyone.', 48, 213, 480, 12, regular, C.muted, 19);
    const cards = [
      ['01 / LIGHT', 'Let daylight lead', 'Place everyday work near natural light. Add adjustable task lighting and reduce glare on screens.'],
      ['02 / SOUND', 'Give quiet a home', 'Use acoustic finishes, soft furnishings and enclosed settings to keep conversations where they belong.'],
      ['03 / ACCESS', 'Make joining easy', 'Provide clear routes, adjustable settings and inclusive options for people with different needs.'],
      ['04 / TOOLS', 'Remove the friction', 'Keep power, display connections and simple room guidance within easy reach of every seat.'],
    ];
    cards.forEach(([label, title, body], i) => {
      const x = 48 + (i % 2) * 257, y = 324 + Math.floor(i / 2) * 194;
      rect(p, x, y, 242, 178, i === 0 ? C.navy : C.white);
      text(p, label, x + 18, y + 19, 8, bold, i === 0 ? C.mint : C.teal);
      text(p, title, x + 18, y + 51, 16, bold, i === 0 ? C.white : C.navy);
      para(p, body, x + 18, y + 86, 205, 10.5, regular, i === 0 ? C.mint : C.muted, 16.5);
    });
    text(p, 'Comfort is a system. Every small detail contributes.', 48, 737, 12, serif, C.teal);
  }
  // 06 / Implementation roadmap.
  {
    const p = page(); header(p, 'Make it happen', 6);
    heading(p, 'From intention', 'to everyday habit.');
    para(p, 'The best changes are made with people. Begin with a focused pilot, make it easy to give feedback, and create a rhythm for improving the space after opening day.', 48, 214, 480, 12, regular, C.muted, 19);
    const phases = [
      ['01', 'Listen & learn', 'WEEKS 01-02', 'Map daily activities. Ask what helps and what gets in the way. Walk the space together at different times of day.'],
      ['02', 'Try a small change', 'WEEKS 03-04', 'Choose one opportunity. Create a simple prototype with existing furniture and agree on what success would look like.'],
      ['03', 'Review & refine', 'WEEKS 05-06', 'Combine observations with short feedback sessions. Keep what works, adjust what does not, and share what you learned.'],
      ['04', 'Build the habit', 'ONGOING', 'Assign a space owner. Review the plan regularly as the team changes. Make improvement part of normal working life.'],
    ];
    line(p, 66, 340, 66, 690, C.line, 2);
    phases.forEach(([n, title, when, body], i) => {
      const y = 322 + i * 107;
      p.drawCircle({ x: 66, y: PAPER.height - y - 18, size: 18, color: C.teal });
      text(p, n, 59, y + 11, 10, bold, C.white);
      text(p, title, 105, y, 17, bold, C.navy);
      text(p, when, 418, y + 5, 8, bold, C.teal);
      para(p, body, 105, y + 31, 435, 10.5, regular, C.muted, 16.5);
    });
    text(p, 'Start small. Learn together. Make room for the next idea.', 48, 745, 11, serif, C.teal);
  }
  // 07 / Closing and transparent sample provenance.
  {
    const p = page(); header(p, 'Looking forward', 7);
    heading(p, 'Make room', 'for what matters.');
    para(p, 'A thoughtful workplace gives people more choice and less friction. It supports the work in front of them while leaving enough space for what comes next.', 48, 214, 475, 14, regular, C.muted, 22);
    rect(p, 48, 347, 499, 178, C.teal);
    text(p, 'Your next conversation', 71, 371, 11, bold, C.mint);
    para(p, 'What is one change to our space\nthat would make tomorrow better?', 71, 409, 450, 25, serif, C.white, 32);
    text(p, 'ABOUT THIS REPORT', 48, 573, 8, bold, C.teal);
    para(p, 'Studio North is a fictional design studio created for this original Mapaseo PDF sample. All writing, diagrams and charts in this document are original illustrative content. The planning percentages are examples, not survey findings or measured outcomes.', 48, 599, 480, 10.5, regular, C.muted, 17);
    text(p, 'DESIGN NOTE', 48, 696, 8, bold, C.teal);
    para(p, 'Every page is made from searchable text and resolution-independent vector shapes. Zoom in, add a note, or try an export to explore the workspace.', 48, 719, 480, 10, regular, C.muted, 16);
  }
  return pdf.save();
}

export async function createBlankPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([PAPER.width, PAPER.height]);
  pdf.setTitle('Untitled'); pdf.setCreator('Mapaseo PDF');
  return pdf.save();
}

async function load(data: Uint8Array) {
  return PDFDocument.load(data.slice(), { updateMetadata: false });
}

function checkPages(pdf: PDFDocument, pages: number[], allowDuplicates = false) {
  if (!pages.length) throw new Error('Choose at least one page.');
  if (pages.some(i => !Number.isInteger(i) || i < 0 || i >= pdf.getPageCount())) {
    throw new Error('A selected page does not exist in this document.');
  }
  if (!allowDuplicates && new Set(pages).size !== pages.length) {
    throw new Error('A page can only appear once in this operation.');
  }
}

function rotation(page: PDFPage) {
  return ((page.getRotation().angle % 360) + 360) % 360;
}

/** Convert PDF.js display coordinates back to the unrotated crop-box user space. */
function geometry(page: PDFPage) {
  const crop = page.getCropBox(), media = page.getMediaBox();
  // PDF.js displays the intersection, and falls back to MediaBox for invalid crops.
  const left = Math.max(crop.x, media.x), bottom = Math.max(crop.y, media.y);
  const right = Math.min(crop.x + crop.width, media.x + media.width);
  const top = Math.min(crop.y + crop.height, media.y + media.height);
  const box = right > left && top > bottom
    ? { x: left, y: bottom, width: right - left, height: top - bottom } : media;
  const r = rotation(page);
  if (![0, 90, 180, 270].includes(r)) throw new Error('This page has an unsupported rotation.');
  const width = r % 180 ? box.height : box.width;
  const height = r % 180 ? box.width : box.height;
  const point = ({ x: u, y: v }: Point): Point => {
    if (r === 90) return { x: box.x + v * box.width, y: box.y + u * box.height };
    if (r === 180) return { x: box.x + (1 - u) * box.width, y: box.y + v * box.height };
    if (r === 270) return { x: box.x + (1 - v) * box.width, y: box.y + (1 - u) * box.height };
    return { x: box.x + u * box.width, y: box.y + (1 - v) * box.height };
  };
  return { point, width, height, rotation: r };
}

function annotationColor(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#167d78';
  return rgb(parseInt(normalized.slice(1, 3), 16) / 255,
    parseInt(normalized.slice(3, 5), 16) / 255, parseInt(normalized.slice(5, 7), 16) / 255);
}

function safeText(value: string, font: PDFFont) {
  // Standard PDF fonts use WinAnsi. Keep export reliable for copied Unicode text.
  // Unsupported glyphs are rejected rather than silently replaced.
  try { font.encodeText(value); return value; }
  catch { throw new Error('This annotation contains characters the built-in export font cannot encode. Use Latin text or remove the annotation before exporting.'); }
}

function wrapText(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

/** Append vector annotation content; preserve the source pages and their quality. */
export async function exportPdf(data: Uint8Array, annotations: Annotation[]): Promise<Uint8Array> {
  const pdf = await load(data);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const a of annotations) {
    if (!Number.isInteger(a.page) || a.page < 1 || a.page > pdf.getPageCount()) {
      throw new Error('An annotation refers to a missing page.');
    }
    if (![a.x, a.y, a.width, a.height].every(Number.isFinite)) throw new Error('An annotation has invalid coordinates.');
    const page = pdf.getPage(a.page - 1), g = geometry(page), color = annotationColor(a.color);
    const box = () => {
      const points = [g.point({ x: a.x, y: a.y }), g.point({ x: a.x + a.width, y: a.y + a.height })];
      return { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)),
        width: Math.abs(points[1].x - points[0].x), height: Math.abs(points[1].y - points[0].y) };
    };
    if (a.type === 'highlight') {
      page.drawRectangle({ ...box(), color, opacity: 0.3, blendMode: BlendMode.Multiply });
    } else if (a.type === 'rectangle') {
      page.drawRectangle({ ...box(), borderColor: color, borderWidth: 1.5 });
    } else if (a.type === 'draw' || a.type === 'signature') {
      const points = a.points || [];
      if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('A drawing has invalid coordinates.');
      for (let i = 1; i < points.length; i++) page.drawLine({ start: g.point(points[i - 1]), end: g.point(points[i]),
        thickness: a.type === 'signature' ? 1.6 : 2, color, lineCap: LineCapStyle.Round });
    } else {
      const isNote = a.type === 'note';
      const size = Math.max(6, Math.min(a.fontSize || (isNote ? 11 : 14), 96));
      const value = safeText(a.text || (isNote ? 'Note' : ''), font);
      const availableWidth = Math.max(40, (a.width || 0.25) * g.width - (isNote ? 12 : 0));
      const lines = isNote ? wrapText(value, font, size, availableWidth) : value.split(/\r?\n/);
      const pad = isNote ? 6 : 0;
      if (isNote) {
        const h = Math.max(a.height * g.height, lines.length * size * 1.25 + 12);
        const notePoints = [g.point({ x: a.x, y: a.y }), g.point({ x: a.x + (availableWidth + 12) / g.width, y: a.y + h / g.height })];
        page.drawRectangle({ x: Math.min(...notePoints.map(p => p.x)), y: Math.min(...notePoints.map(p => p.y)),
          width: Math.abs(notePoints[1].x - notePoints[0].x), height: Math.abs(notePoints[1].y - notePoints[0].y),
          color: rgb(1, 0.96, 0.73), borderColor: color, borderWidth: 0.7 });
      }
      lines.forEach((line, i) => {
        const origin = g.point({ x: a.x + pad / g.width, y: a.y + (pad + size * 0.82 + i * size * 1.25) / g.height });
        page.drawText(line, { ...origin, size, font,
          color: isNote ? rgb(59 / 255, 58 / 255, 40 / 255) : color, rotate: degrees(g.rotation) });
      });
    }
  }
  return pdf.save();
}

export async function rotatePage(data: Uint8Array, page: number, amount: number): Promise<Uint8Array> {
  const pdf = await load(data); checkPages(pdf, [page]);
  if (!Number.isInteger(amount) || amount % 90) throw new Error('Page rotation must use 90 degree increments.');
  const target = pdf.getPage(page);
  target.setRotation(degrees(((target.getRotation().angle + amount) % 360 + 360) % 360));
  return pdf.save();
}

export async function reorderPages(data: Uint8Array, order: number[]): Promise<Uint8Array> {
  const pdf = await load(data); checkPages(pdf, order);
  if (order.length !== pdf.getPageCount() && pdf.getForm().getFields().length) {
    throw new Error('Removing pages from interactive forms is not supported yet. You can reorder the complete form.');
  }
  // Keep the original document catalog, forms and page objects intact.
  const pages = pdf.getPages();
  // A moved leaf no longer inherits from its old nested page-tree branch.
  // Materialize those values before changing parent references.
  for (const page of pages) for (const key of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) {
    const name = PDFName.of(key);
    if (!page.node.get(name)) {
      const inherited = page.node.getInheritableAttribute(name);
      if (inherited) page.node.set(name, inherited);
    }
  }
  for (let i = pages.length - 1; i >= 0; i--) pdf.removePage(i);
  for (const index of order) pdf.addPage(pages[index]);
  return pdf.save();
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (!files.length) throw new Error('Choose at least one PDF to combine.');
  const merged = await PDFDocument.create();
  merged.setCreator('Mapaseo PDF');
  for (const bytes of files) {
    const pdf = await load(bytes);
    if (pdf.getForm().getFields().length) {
      throw new Error('Combining interactive forms is not supported yet. Save a separate copy with the form completed first.');
    }
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  return merged.save();
}

export async function extractPages(data: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const source = await load(data); checkPages(source, pages);
  if (source.getForm().getFields().length) {
    throw new Error('Page extraction from interactive forms is not supported yet. Keep the complete form document.');
  }
  const extracted = await PDFDocument.create();
  (await extracted.copyPages(source, pages)).forEach(p => extracted.addPage(p));
  extracted.setCreator('Mapaseo PDF');
  return extracted.save();
}

export async function getFormFields(data: Uint8Array): Promise<FormField[]> {
  const pdf = await load(data);
  return pdf.getForm().getFields().flatMap<FormField>(field => {
    const name = field.getName();
    if (field instanceof PDFTextField) return [{ name, type: 'text' as const, value: field.getText() || '' }];
    if (field instanceof PDFCheckBox) return [{ name, type: 'checkbox' as const, value: field.isChecked() }];
    if (field instanceof PDFDropdown) return [{ name, type: 'dropdown' as const, value: field.getSelected()[0] || '', options: field.getOptions() }];
    return [];
  });
}

export async function fillFormFields(data: Uint8Array, fields: FormField[]): Promise<Uint8Array> {
  const pdf = await load(data), form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const value of fields) {
    const field = form.getField(value.name);
    if (field instanceof PDFTextField && value.type === 'text') field.setText(safeText(String(value.value), font));
    else if (field instanceof PDFCheckBox && value.type === 'checkbox') {
      if (value.value === true) field.check(); else field.uncheck();
    } else if (field instanceof PDFDropdown && value.type === 'dropdown') {
      const selected = String(value.value);
      if (!selected) field.clear();
      else if (field.getOptions().includes(selected) || field.isEditable()) field.select(safeText(selected, font));
      else throw new Error(`The value for "${value.name}" is not an available option.`);
    } else throw new Error(`The form field "${value.name}" has an unsupported or different type.`);
  }
  form.updateFieldAppearances(font);
  return pdf.save();
}

export async function watermarkPdf(data: Uint8Array, value: string): Promise<Uint8Array> {
  if (!value.trim()) throw new Error('Enter some text for the watermark.');
  const pdf = await load(data), font = await pdf.embedFont(StandardFonts.HelveticaBold);
  safeText(value, font);
  for (const page of pdf.getPages()) {
    const g = geometry(page);
    const size = Math.min(64, g.width * 0.76 / Math.max(font.widthOfTextAtSize(value, 1), 1));
    const textWidth = font.widthOfTextAtSize(value, size);
    const origin = g.point({ x: 0.5 - textWidth / g.width / 2, y: 0.5 + size / g.height / 3 });
    page.drawText(value, { ...origin, font, size, color: rgb(0.3, 0.35, 0.4), opacity: 0.18, rotate: degrees(g.rotation) });
  }
  return pdf.save();
}

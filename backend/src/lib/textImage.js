import path from 'path';
import { fileURLToPath } from 'url';
import { GlobalFonts, createCanvas } from '@napi-rs/canvas';

// Gmail ignores web fonts, so the email's words would come out in whatever Arabic face the reader's system has, beside
// a headline in Thmanyah. To keep one typeface everywhere, each block of words is drawn here with the app's own fonts
// (Thmanyah for Arabic, General Sans for Latin — the same pairing the app uses) and travels as a picture; the words
// are also its `alt` text, and the message has a plain-text part.

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'fonts');
const FILES = [
  ['General Sans', 'GeneralSans-500.ttf'], ['General Sans', 'GeneralSans-700.ttf'],
  ['Thmanyah', 'Thmanyah-400.woff2'], ['Thmanyah', 'Thmanyah-700.woff2'], ['Thmanyah', 'Thmanyah-900.woff2'],
];
let ready = false;
function registerFonts() {
  if (ready) return;
  for (const [family, file] of FILES) GlobalFonts.registerFromPath(path.join(FONTS, file), family);
  ready = true;
}

/** Pictures are drawn at this multiple of the size they are shown at, so they stay sharp on a phone. */
const SCALE = 2;
const STACK = "'General Sans','Thmanyah'";

/** Breaks `text` into lines no wider than `width` (px), at spaces. */
export function wrapLines(measure, text, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > width) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * `text` drawn in the app's fonts on a transparent (or `background`) picture `width` px wide, wrapped, and aligned to
 * `align` ('right' for Arabic). Returns `{ png, width, height }` — the size it is to be shown at, in CSS px.
 */
export function textImage({ text, size = 16, weight = 400, color = '#EDEDED', width = 492, lineHeight = 1.8, align = 'right', background = null, maxLines = Infinity, family = STACK }) {
  registerFonts();
  const font = `${weight} ${size * SCALE}px ${family}`;
  const probe = createCanvas(10, 10).getContext('2d');
  probe.font = font;
  probe.direction = 'rtl';
  const measure = (s) => probe.measureText(s).width / SCALE;
  let lines = wrapLines(measure, text, width);
  if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), `${lines.slice(maxLines - 1).join(' ').slice(0, 80).trimEnd()}…`];
  const lineBox = Math.round(size * lineHeight);
  const height = Math.max(lineBox, lines.length * lineBox);

  const canvas = createCanvas(width * SCALE, height * SCALE);
  const ctx = canvas.getContext('2d');
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.direction = 'rtl';
  ctx.textAlign = align === 'right' ? 'right' : align === 'center' ? 'center' : 'left';
  ctx.textBaseline = 'middle';
  const x = align === 'right' ? canvas.width : align === 'center' ? canvas.width / 2 : 0;
  lines.forEach((line, i) => ctx.fillText(line, x, (i + 0.5) * lineBox * SCALE));
  return { png: canvas.toBuffer('image/png'), width, height };
}

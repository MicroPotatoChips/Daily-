import { readFile, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const vector = async (name, x, y, width, height) => {
  const svg = await readFile(`assets/vectors/${name}.svg`, 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/)[1];
  const drawing = svg.replace(/<svg[^>]*>|<\/svg>|<title>.*?<\/title>/gs, '');
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${box}">${drawing}</svg>`;
};
let body = `<rect width="1600" height="1120" fill="#EAEDE5"/>
<text x="66" y="67" font-family="sans-serif" font-size="14" letter-spacing="3" fill="#67766D">DAILY+ / A QUIETER WAY TO BUILD HABITS</text>
<text x="64" y="133" font-family="sans-serif" font-size="52" font-weight="bold" letter-spacing="-2" fill="#24352B">Small habits. Better days.</text>
<text x="1534" y="126" text-anchor="end" font-family="sans-serif" font-size="15" fill="#67766D">VISUAL SYSTEM / 1.1</text>`;
const rect = (x, y, w, h, fill, r = 28) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const text = (x, y, t, color = '#67766D', size = 16) =>
  `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="${color}">${t}</text>`;
body += rect(64, 173, 396, 422, '#F6F7F2');
body += text(90, 211, '01 / APP ICON');
body += await vector('mark', 132, 246, 254, 235);
body += text(90, 558, 'Leaf-shaped d. One small plus.', '#24352B', 18);
body += rect(64, 619, 188, 318, '#FFFFFF');
body += rect(272, 619, 188, 318, '#131C17');
body += await vector('mark', 82, 679, 151, 146);
body += await vector('mark-dark', 290, 679, 151, 146);
body += text(88, 899, 'LIGHT');
body += text(296, 899, 'DARK', '#AFBEB2');
body += rect(484, 173, 390, 764, '#F6F7F2', 42);
body += text(510, 211, '02 / NATIVE LAUNCH');
body += await vector('mark', 589, 444, 180, 180);
body += rect(621, 905, 116, 4, '#24352B', 2);
body += text(504, 976, 'Logo-only launch. No artificial wait.', '#67766D', 15);
for (const [i, name, label] of [
  ['0', 'growth', '03 / GROW'],
  ['1', 'focus', '04 / FOCUS'],
  ['2', 'celebrate', '05 / CELEBRATE'],
]) {
  const y = 173 + Number(i) * 261;
  body += rect(898, y, 636, 237, '#F6F7F2');
  body += text(924, y + 37, label);
  body += await vector(name, 999, y + 8, 350, 224);
  body += text(1380, y + 206, 'SVG PATHS', '#67766D', 12);
}
body += text(66, 1030, 'Forest / Sage / Ivory / A little sunshine', '#24352B', 20);
['#39765C', '#C8DBC0', '#F6F7F2', '#B8CC82', '#E8B594'].forEach((c, i) => {
  body += rect(65 + i * 60, 1056, 44, 14, c, 7);
});
body += text(
  1534,
  1030,
  'Editable vectors · Light + dark · Native PNG exports',
  '#67766D',
  16,
).replace('x="1534"', 'x="1534" text-anchor="end"');
body += text(
  1534,
  1065,
  'Artwork and launch layout preview, not a device screenshot.',
  '#67766D',
  13,
).replace('x="1534"', 'x="1534" text-anchor="end"');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1120" viewBox="0 0 1600 1120">${body}</svg>`;
await writeFile('docs/design/preview.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('docs/design/preview.png');
console.log('Created visual-system preview.');

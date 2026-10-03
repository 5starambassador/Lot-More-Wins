import fs from 'fs';
import path from 'path';
import * as opentype from 'opentype.js';
import QRCode from 'qrcode';
import sharp from 'sharp';

/**
 * Branded QR card the Partner App downloads and shares: the Lot More logo and title at the top,
 * the QR on an ivory plate, then the code itself, all on the app's red gradient.
 *
 * Drawn as an SVG and rasterised with sharp. Text is converted to outlines with the bundled
 * Poppins fonts, so the image never depends on fonts installed on the server.
 */

const ASSETS = path.join(process.cwd(), 'assets');

const W = 1080;
const H = 1350;
const CX = W / 2;
const WHITE = '#FFFFFF';
const GOLD = '#F5C542';
const IVORY = '#FBF7F0';
const QR_INK = '#750505';

let cache: { semibold: opentype.Font; medium: opentype.Font; logo: string } | null = null;

function loadFont(file: string): opentype.Font {
  const buf = fs.readFileSync(path.join(ASSETS, 'fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function assets() {
  cache ??= {
    semibold: loadFont('Poppins_600SemiBold.ttf'),
    medium: loadFont('Poppins_500Medium.ttf'),
    logo: fs.readFileSync(path.join(ASSETS, 'brand', 'logo.png')).toString('base64'),
  };
  return cache;
}

/**
 * SVG path data from the outline commands. opentype.js's own toPathData() emits "NaN" for some
 * coordinates, and the SVG renderer stops drawing at the first one, cutting text short.
 */
function pathData(path: opentype.Path): string {
  const n = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '0');
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        default:
          return 'Z';
      }
    })
    .join('');
}

/** Text runs on one baseline, centred as a whole on CX; each run keeps its own colour. Shrinks to fit the card. */
function centredText(font: opentype.Font, runs: { text: string; fill: string }[], y: number, maxSize: number, letterSpacing = 0) {
  const options = { letterSpacing };
  const natural = runs.reduce((sum, r) => sum + font.getAdvanceWidth(r.text, maxSize, options), 0);
  const size = Math.min(maxSize, (maxSize * (W - 140)) / natural);
  const widths = runs.map((r) => font.getAdvanceWidth(r.text, size, options));
  let x = CX - widths.reduce((a, b) => a + b, 0) / 2;
  return runs
    .map((r, i) => {
      const d = pathData(font.getPath(r.text, x, y, size, options));
      x += widths[i]!;
      return `<path d="${d}" fill="${r.fill}"/>`;
    })
    .join('');
}

/** All dark modules as one path, `cell` px each, from (x, y). */
function qrPath(code: string, x: number, y: number, area: number) {
  const { modules } = QRCode.create(code, { errorCorrectionLevel: 'M' });
  const cell = Math.floor(area / modules.size);
  const offset = (area - cell * modules.size) / 2;
  let d = '';
  for (let r = 0; r < modules.size; r++) {
    for (let c = 0; c < modules.size; c++) {
      if (modules.get(r, c)) d += `M${x + offset + c * cell} ${y + offset + r * cell}h${cell}v${cell}h-${cell}z`;
    }
  }
  return `<path d="${d}" fill="${QR_INK}" shape-rendering="crispEdges"/>`;
}

function corners(x: number, y: number, size: number, len: number) {
  const s = `fill="none" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"`;
  const r = x + size;
  const b = y + size;
  return [
    `M${x} ${y + len}V${y}H${x + len}`,
    `M${r - len} ${y}H${r}V${y + len}`,
    `M${x} ${b - len}V${b}H${x + len}`,
    `M${r - len} ${b}H${r}V${b - len}`,
  ]
    .map((d) => `<path d="${d}" ${s}/>`)
    .join('');
}

export async function renderQrCard(options: { code: string; label: string }): Promise<Buffer> {
  const { semibold, medium, logo } = assets();

  const disc = 190;
  const discY = 70;
  const plate = 640;
  const plateX = CX - plate / 2;
  const plateY = 470;
  const pad = 44;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8C0A0A"/><stop offset="0.4" stop-color="#750505"/><stop offset="1" stop-color="#430202"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFE9A8"/><stop offset="0.22" stop-color="#B8922F"/><stop offset="0.45" stop-color="#FFF6D6"/>
      <stop offset="0.62" stop-color="#F5C542"/><stop offset="0.82" stop-color="#8E6B1F"/><stop offset="1" stop-color="#FFDD75"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="disc"><circle cx="${CX}" cy="${discY + disc / 2}" r="${disc / 2 - 7}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <circle cx="${CX}" cy="${discY + disc / 2}" r="${disc / 2}" fill="url(#gold)"/>
  <circle cx="${CX}" cy="${discY + disc / 2}" r="${disc / 2 - 7}" fill="${WHITE}"/>
  <image x="${CX - disc * 0.4}" y="${discY + disc * 0.1}" width="${disc * 0.8}" height="${disc * 0.8}" clip-path="url(#disc)"
    href="data:image/png;base64,${logo}" xlink:href="data:image/png;base64,${logo}"/>

  ${centredText(semibold, [{ text: 'LOT MORE ', fill: WHITE }, { text: 'WINS', fill: GOLD }], 350, 64, 0.12)}
  ${centredText(medium, [{ text: options.label.toUpperCase(), fill: GOLD }], 408, 28, 0.22)}

  ${corners(plateX - 26, plateY - 26, plate + 52, 70)}
  <rect x="${plateX}" y="${plateY}" width="${plate}" height="${plate}" rx="24" fill="${IVORY}"/>
  ${qrPath(options.code, plateX + pad, plateY + pad, plate - pad * 2)}

  ${centredText(semibold, [{ text: options.code, fill: WHITE }], plateY + plate + 108, 46, 0.08)}
  ${centredText(medium, [{ text: 'Show this QR at any participating Lot More outlet', fill: '#F3D9A4' }], H - 80, 26, 0.02)}
</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

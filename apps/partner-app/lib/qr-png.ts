import QRCode from 'qrcode';

/**
 * Renders a QR code straight to a PNG in JavaScript: black modules on white with the
 * standard 4-module quiet zone. Nothing is captured from the screen, so the image is the
 * same on every device and can be produced before (or without) the QR being displayed.
 *
 * The PNG is 1-bit greyscale with an uncompressed (stored) zlib stream — tiny for a QR code
 * and needing no compression library.
 */

const QUIET_ZONE_MODULES = 4;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  out.set(uint32(data.length), 0);
  out.set(body, 4);
  out.set(uint32(crc32(body)), 8 + data.length);
  return out;
}

/** zlib container around stored (uncompressed) deflate blocks of at most 65535 bytes. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const MAX_BLOCK = 65535;
  const blocks = Math.max(1, Math.ceil(raw.length / MAX_BLOCK));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let i = 0; i < blocks; i++) {
    const start = i * MAX_BLOCK;
    const length = Math.min(MAX_BLOCK, raw.length - start);
    out[o++] = i === blocks - 1 ? 1 : 0;
    out[o++] = length & 0xff;
    out[o++] = (length >>> 8) & 0xff;
    out[o++] = ~length & 0xff;
    out[o++] = (~length >>> 8) & 0xff;
    out.set(raw.subarray(start, start + length), o);
    o += length;
  }
  out.set(uint32(adler32(raw)), o);
  return out;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let part = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    part += BASE64[b0 >> 2] + BASE64[((b0 & 3) << 4) | (b1 >> 4)];
    part += i + 1 < bytes.length ? BASE64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    part += i + 2 < bytes.length ? BASE64[b2 & 63] : '=';
    // Build in slices: one very long string concatenation is slow on Hermes.
    if (part.length >= 8192) {
      parts.push(part);
      part = '';
    }
  }
  parts.push(part);
  return parts.join('');
}

export interface QrPng {
  bytes: Uint8Array;
  /** Width and height of the image in pixels. */
  size: number;
}

/**
 * @param value Text to encode.
 * @param targetSize Approximate image size in pixels; the result is the largest whole-pixel
 *   module size that fits, so every module is perfectly square and sharp.
 */
export function qrToPng(value: string, targetSize = 720, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): QrPng {
  const { modules } = QRCode.create(value, { errorCorrectionLevel });
  const count = modules.size;
  const total = count + QUIET_ZONE_MODULES * 2;
  const scale = Math.max(1, Math.floor(targetSize / total));
  const size = total * scale;

  // One scanline: a filter byte (0 = none) then 1 bit per pixel, most significant bit first; 1 = white.
  const rowBytes = Math.ceil(size / 8);
  const raw = new Uint8Array((rowBytes + 1) * size);
  const row = new Uint8Array(rowBytes);
  for (let moduleY = 0; moduleY < total; moduleY++) {
    row.fill(0xff);
    const y = moduleY - QUIET_ZONE_MODULES;
    if (y >= 0 && y < count) {
      for (let x = 0; x < count; x++) {
        if (!modules.data[y * count + x]) continue;
        const startPx = (x + QUIET_ZONE_MODULES) * scale;
        for (let px = startPx; px < startPx + scale; px++) row[px >> 3] &= ~(0x80 >> (px & 7));
      }
    }
    // Bits past the image edge in the last byte are ignored by decoders.
    for (let repeat = 0; repeat < scale; repeat++) {
      const offset = (moduleY * scale + repeat) * (rowBytes + 1);
      raw[offset] = 0;
      raw.set(row, offset + 1);
    }
  }

  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR: width, height, bit depth 1, colour type 0 (greyscale), default compression/filter, no interlace.
  const ihdr = chunk('IHDR', Uint8Array.from([...uint32(size), ...uint32(size), 1, 0, 0, 0, 0]));
  const idat = chunk('IDAT', zlibStored(raw));
  const iend = chunk('IEND', new Uint8Array(0));

  const bytes = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let o = 0;
  for (const part of [signature, ihdr, idat, iend]) {
    bytes.set(part, o);
    o += part.length;
  }
  return { bytes, size };
}

export function qrToPngBase64(value: string, targetSize?: number): string {
  return bytesToBase64(qrToPng(value, targetSize).bytes);
}

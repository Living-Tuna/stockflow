// Generates the ecbills-scanner tray/app icon as assets/icon.png.
// Pure Node: builds a minimal PNG (barcode motif) with zlib.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 64;

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function rgba(x, y) {
  // Background transparent
  if (x < 6 || y < 6 || x >= SIZE - 6 || y >= SIZE - 6) return [0, 0, 0, 0];

  const gx = x - 6;
  const gy = y - 6;
  const w = SIZE - 12;

  // Barcode bars pattern in lower two thirds
  const barRegionTop = Math.floor(w * 0.28);
  if (gy >= barRegionTop) {
    const columns = 21;
    const barWidth = w / columns;
    const col = Math.floor(gx / barWidth);
    // deterministic bar pattern
    const pattern = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0];
    if (pattern[col % pattern.length]) return [15, 23, 42, 255];
    return [255, 255, 255, 255];
  }

  // QR-ish corners in the top region
  const corner = 10;
  const inBox = (bx, by) => x >= bx && x < bx + corner && y >= by && y < by + corner;
  const isFindenerCell = (bx, by) => {
    const local = inBox(bx, by);
    if (!local) return null;
    const lx = x - bx;
    const ly = y - by;
    if (lx === 0 || ly === 0 || lx === corner - 1 || ly === corner - 1) return true;
    const inner = lx >= 2 && lx < corner - 2 && ly >= 2 && ly < corner - 2;
    const center = lx >= 3 && lx < corner - 3 && ly >= 3 && ly < corner - 3;
    return inner && !center;
  };
  const tl = isFindenerCell(6, 6);
  if (tl) return [15, 23, 42, 255];
  const tr = isFindenerCell(SIZE - 6 - corner, 6);
  if (tr) return [15, 23, 42, 255];
  if (inBox(6, 6) || inBox(SIZE - 6 - corner, 6)) return [255, 255, 255, 255];

  // Random-ish data modules between the corners (deterministic)
  if (gy < barRegionTop) {
    const seed = (x * 7 + y * 13 + (x * y) & 3) % 3;
    if (seed === 0 && x > SIZE / 2) return [15, 23, 42, 255];
    return [255, 255, 255, 255];
  }

  return [0, 0, 0, 0];
}

function buildPng() {
  const rows = [];
  for (let y = 0; y < SIZE; y++) {
    const row = Buffer.alloc(1 + SIZE * 4);
    row[0] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = rgba(x, y);
      const o = 1 + x * 4;
      row[o] = r;
      row[o + 1] = g;
      row[o + 2] = b;
      row[o + 3] = a;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

const outDir = path.join(__dirname, 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const pngPath = path.join(outDir, 'icon.png');
fs.writeFileSync(pngPath, buildPng());
console.log('Wrote', pngPath, buildPng().length, 'bytes');
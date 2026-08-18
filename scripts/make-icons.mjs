/* Erzeugt die App-Icons als PNG – ohne externe Abhängigkeiten. */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 bit, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Abstand eines Punktes zur Strecke AB – für die Striche des „W“. */
function distToSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 ? (wx * vx + wy * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

function icon(size, { radius = 0.22, inset = 0 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const c1 = [79, 140, 255], c2 = [139, 92, 246];
  const pad = size * inset;
  const box = size - 2 * pad;
  const r = box * radius;
  // Strichpunkte des Buchstabens W, relativ zur inneren Box
  const S = (fx, fy) => [pad + box * fx, pad + box * fy];
  const p = [S(0.20, 0.30), S(0.345, 0.72), S(0.50, 0.42), S(0.655, 0.72), S(0.80, 0.30)];
  const stroke = box * 0.075;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Abgerundetes Quadrat als Maske
      const qx = Math.max(pad + r - x, 0, x - (pad + box - r));
      const qy = Math.max(pad + r - y, 0, y - (pad + box - r));
      const outside = Math.hypot(qx, qy) - r;
      const inBox = x >= pad && x <= pad + box && y >= pad && y <= pad + box;
      const alpha = !inBox ? 0 : Math.max(0, Math.min(1, 1 - outside));
      if (alpha <= 0) { buf[i + 3] = 0; continue; }

      const g = mix(c1, c2, (x / size) * 0.5 + (y / size) * 0.5);
      let d = Infinity;
      for (let k = 0; k < p.length - 1; k++) {
        d = Math.min(d, distToSeg(x + 0.5, y + 0.5, p[k][0], p[k][1], p[k + 1][0], p[k + 1][1]));
      }
      const w = Math.max(0, Math.min(1, (stroke - d) + 0.5));   // weiche Kante
      const col = mix(g, [255, 255, 255], w);
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2];
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return png(size, buf);
}

mkdirSync('icons', { recursive: true });
const files = [
  ['icons/icon-192.png', icon(192)],
  ['icons/icon-512.png', icon(512)],
  ['icons/icon-180.png', icon(180, { radius: 0.0 })],                 // iOS rundet selbst
  ['icons/icon-512-maskable.png', icon(512, { radius: 0.5, inset: 0.06 })],
  ['icons/favicon-32.png', icon(32, { radius: 0.2 })]
];
for (const [name, data] of files) {
  writeFileSync(name, data);
  console.log(name, data.length, 'Bytes');
}

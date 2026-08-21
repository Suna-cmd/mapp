// PWA アイコン（PNG）を Node 標準モジュールだけで生成する。
// 外部パッケージも画像ツールも使わないので、`node scripts/make-icons.mjs` だけで完結する。
//
// 絵柄: 紫のグラデーション背景に白いチェックマーク。
// マスカブル対応のため背景は全面塗り（角丸は OS 側のマスクに任せる）で、
// チェックは中央 80% の安全領域に収まるサイズにしてある。

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'icons');

// ---- PNG エンコード ----

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGB のピクセル配列（Uint8Array, 幅*高さ*3）を PNG バッファにする */
function encodePNG(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 2; // カラータイプ: トゥルーカラー(RGB)
  ihdr[10] = 0; // 圧縮方式
  ihdr[11] = 0; // フィルタ方式
  ihdr[12] = 0; // インターレースなし

  // 各走査線の先頭にフィルタタイプ 0（フィルタなし）を挟む
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 描画 ----

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

/** 点 p から線分 ab までの距離 */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / lenSq);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// グラデーションの両端（インディゴ → バイオレット）
const FROM = [99, 102, 241];
const TO = [168, 85, 247];

// チェックマークの折れ線（0..1 の正規化座標）と太さ
const CHECK = [
  [0.26, 0.53],
  [0.43, 0.70],
  [0.75, 0.33],
];
const STROKE = 0.095;

function render(size) {
  const rgb = new Uint8Array(size * size * 3);
  const half = (STROKE * size) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 背景: 左上から右下への線形グラデーション
      const t = clamp01((x + y) / (2 * (size - 1)));
      let r = mix(FROM[0], TO[0], t);
      let g = mix(FROM[1], TO[1], t);
      let b = mix(FROM[2], TO[2], t);

      // チェックマーク: 線分までの距離でアンチエイリアスをかける
      const px = x + 0.5;
      const py = y + 0.5;
      let dist = Infinity;
      for (let i = 0; i < CHECK.length - 1; i++) {
        const [ax, ay] = CHECK[i];
        const [bx, by] = CHECK[i + 1];
        dist = Math.min(dist, distToSegment(px, py, ax * size, ay * size, bx * size, by * size));
      }
      const alpha = clamp01(half - dist + 0.5);
      if (alpha > 0) {
        r = mix(r, 255, alpha);
        g = mix(g, 255, alpha);
        b = mix(b, 255, alpha);
      }

      const o = (y * size + x) * 3;
      rgb[o] = Math.round(r);
      rgb[o + 1] = Math.round(g);
      rgb[o + 2] = Math.round(b);
    }
  }
  return encodePNG(size, size, rgb);
}

// ---- 出力 ----

const TARGETS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180], // iOS のホーム画面用
  ['favicon.png', 64],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of TARGETS) {
  const png = render(size);
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name} (${size}x${size}, ${png.length} bytes)`);
}

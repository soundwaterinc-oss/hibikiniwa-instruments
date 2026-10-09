// 標本生成：実在組織を模したボロノイ描画。canvas を使わない純粋なラスタ処理なので、
// ブラウザ・Worker・Node で同じ画素になる（決定性のテストができる）
// 戻り値：{ width, height, data: Uint8ClampedArray(RGBA), truth: { seeds } }
import { rng, hashSeed } from './rng.js';

export const SPECIMENS = [
  { id: 'cork', code: 'QRC.SUBR', plain: 'コルク（Hooke 1665の蜂の巣状組織）' },
  { id: 'onion', code: 'ALL.CEPA', plain: 'タマネギ表皮（細長い煉瓦積み・核あり）' },
  { id: 'moss', code: 'BRY.FOL', plain: '蘚類の葉（菱形細胞・葉緑体・中肋）' },
  { id: 'stoma', code: 'EPD.STM', plain: '葉の表皮（ジグソー状の細胞と気孔）' },
];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 楕円の塗り（縁は1画素で滑らかに、アルファ合成）
function fillEllipse(img, W, H, cx, cy, rx, ry, rot, rgb, alpha) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const R = Math.max(rx, ry) + 2;
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, Math.ceil(cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = dx * c + dy * s, v = -dx * s + dy * c;
      const d = Math.sqrt((u / rx) ** 2 + (v / ry) ** 2);
      const edge = (d - 1) * Math.min(rx, ry);
      const a = alpha * (1 - smooth(-0.5, 0.5, edge));
      if (a <= 0) continue;
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) img[o + k] = img[o + k] * (1 - a) + rgb[k] * a;
    }
  }
}

// 楕円の輪郭線
function strokeEllipse(img, W, H, cx, cy, rx, ry, rot, rgb, width) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const R = Math.max(rx, ry) + width + 2;
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, Math.ceil(cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = dx * c + dy * s, v = -dx * s + dy * c;
      const d = Math.sqrt((u / rx) ** 2 + (v / ry) ** 2);
      const dist = Math.abs(d - 1) * Math.min(rx, ry);
      const a = 1 - smooth(width / 2 - 0.5, width / 2 + 0.5, dist);
      if (a <= 0) continue;
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) img[o + k] = img[o + k] * (1 - a) + rgb[k] * a;
    }
  }
}

function gaussRGB(img, W, H, sig) {
  const r = Math.ceil(sig * 3), k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sig * sig)); k.push(v); sum += v; }
  k.forEach((v, i) => { k[i] = v / sum; });
  const tmp = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += img[(y * W + Math.min(W - 1, Math.max(0, x + i))) * 4 + c] * k[i + r];
    tmp[(y * W + x) * 3 + c] = a;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += tmp[(Math.min(H - 1, Math.max(0, y + i)) * W + x) * 3 + c] * k[i + r];
    img[(y * W + x) * 4 + c] = a;
  }
}

// opts.contents=false で細胞内容物（核・葉緑体・気孔）を描かない（テストの比較用）
export function renderSpecimen(kind, seed = 1, { size = 384, contents = true } = {}) {
  const S = size, W = S, H = S;
  const R = rng(hashSeed(kind, seed));
  const sx = [], sy = [], tint = [];
  const C = S / 2;
  const rot = -0.5, cr = Math.cos(rot), sr = Math.sin(rot);
  let cfg;

  if (kind === 'cork') {
    const sp = 29;
    for (let j = -1; j < S / (sp * 0.866) + 1; j++) for (let i = -1; i < S / sp + 1; i++) {
      sx.push(i * sp + (j & 1 ? sp / 2 : 0) + (R() - 0.5) * sp * 0.38); sy.push(j * sp * 0.866 + (R() - 0.5) * sp * 0.38); tint.push(R() < 0.09 ? -0.55 : (R() - 0.5) * 0.25);
    }
    cfg = { mx: 1, my: 1, w: 3.6, bg: [228, 206, 166], wall: [84, 52, 26] };
  } else if (kind === 'onion') {
    const spx = 96, spy = 27;
    for (let j = -1; j < S / spy + 1; j++) { const off = R() * spx; for (let i = -1; i < S / spx + 1; i++) { sx.push(i * spx + off + (R() - 0.5) * 22); sy.push(j * spy + (R() - 0.5) * 6); tint.push((R() - 0.5) * 0.3); } }
    cfg = { mx: 0.28, my: 1, w: 1.7, bg: [226, 210, 236], wall: [88, 56, 118] };
  } else if (kind === 'moss') {
    const sa = 50, sc = 19;
    for (let j = -14; j <= 14; j++) for (let i = -6; i <= 6; i++) { sx.push(i * sa + (j & 1 ? sa / 2 : 0) + (R() - 0.5) * 8); sy.push(j * sc + (R() - 0.5) * 3); tint.push((R() - 0.5) * 0.3); }
    cfg = { mx: 0.37, my: 1, w: 1.6, bg: [206, 226, 176], wall: [52, 92, 40], leaf: true };
  } else {
    const sp = 47;
    for (let j = -1; j < S / sp + 1; j++) for (let i = -1; i < S / sp + 1; i++) { sx.push(i * sp + (R() - 0.5) * sp * 0.7); sy.push(j * sp + (R() - 0.5) * sp * 0.7); tint.push((R() - 0.5) * 0.2); }
    cfg = { mx: 1, my: 1, w: 2.1, bg: [216, 226, 210], wall: [48, 66, 58], warp: true };
  }

  const img = new Float32Array(W * H * 4);
  const n = sx.length;
  const ph = R() * 6.28;
  const owner = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let u = x, v = y, inLeaf = true, rib = 0;
    if (cfg.leaf) {
      const px = x - C, py = y - C; u = px * cr - py * sr; v = px * sr + py * cr;
      const a = u / 205, b = v / (122 * Math.max(0.05, 1 - 0.7 * a * a));
      const lr = a * a + b * b;
      inLeaf = lr < 1;
      rib = Math.max(1 - smooth(4, 8, Math.abs(v)), smooth(0.9, 0.97, lr)); // 中肋と葉縁
    }
    if (cfg.warp) { u = x + 7 * Math.sin(y * 0.085 + 3 * Math.sin(x * 0.047 + ph)); v = y + 7 * Math.sin(x * 0.079 + 2 * Math.cos(y * 0.061 - ph)); }
    let d1 = 1e12, d2 = 1e12, i1 = 0;
    for (let k = 0; k < n; k++) { const dx = (u - sx[k]) * cfg.mx, dy = (v - sy[k]) * cfg.my, d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; i1 = k; } else if (d < d2) d2 = d; }
    owner[y * W + x] = inLeaf ? i1 : -1;
    const e = Math.sqrt(d2) - Math.sqrt(d1);
    let wl = 1 - smooth(cfg.w * 0.45, cfg.w, e);
    const shade = 1 - 0.14 * Math.exp(-e / 5) + tint[i1] * 0.18;
    const o = (y * W + x) * 4;
    let r, gg, b;
    if (!inLeaf) { r = 222; gg = 228; b = 222; wl = 0; }
    else {
      wl = Math.max(wl, rib * 0.9);
      r = cfg.bg[0] * shade * (1 - wl) + cfg.wall[0] * wl;
      gg = cfg.bg[1] * shade * (1 - wl) + cfg.wall[1] * wl;
      b = cfg.bg[2] * shade * (1 - wl) + cfg.wall[2] * wl;
    }
    const gr = (R() - 0.5) * 12;
    img[o] = r + gr; img[o + 1] = gg + gr; img[o + 2] = b + gr; img[o + 3] = 255;
  }

  // 細胞内容物
  if (contents && kind === 'onion') {
    for (let k = 0; k < n; k++) if (R() < 0.8) fillEllipse(img, W, H, sx[k] + (R() - 0.5) * 30, sy[k] + (R() - 0.5) * 4, 5.5, 4, 0, [70, 36, 98], 0.75);
  }
  if (contents && kind === 'moss') {
    for (let k = 0; k < n; k++) {
      const X = C + sx[k] * cr + sy[k] * sr, Y = C - sx[k] * sr + sy[k] * cr;
      const a = sx[k] / 205, b = sy[k] / (122 * Math.max(0.05, 1 - 0.7 * a * a));
      if (a * a + b * b > 0.85 || Math.abs(sy[k]) < 9) continue;
      const m = 4 + Math.floor(R() * 4);
      for (let q = 0; q < m; q++) { const t = (q / m - 0.5) * 50; fillEllipse(img, W, H, X + t * cr * 0.6 + (R() - 0.5) * 3, Y - t * sr * 0.6 + (R() - 0.5) * 3, 2.1, 2.1, 0, [96, 168, 70], 0.55); }
    }
  }
  if (contents && kind === 'stoma') {
    for (let q = 0; q < 10; q++) {
      const X = 30 + R() * (S - 60), Y = 30 + R() * (S - 60), a = R() * 3.14;
      for (const sgn of [-1, 1]) {
        const ox = -Math.sin(a) * sgn * 5.2, oy = Math.cos(a) * sgn * 5.2;
        fillEllipse(img, W, H, X + ox, Y + oy, 11, 5, a, [196, 214, 170], 1);
        strokeEllipse(img, W, H, X + ox, Y + oy, 11, 5, a, [40, 58, 44], 2.2);
      }
      fillEllipse(img, W, H, X, Y, 6, 1.3, a, [30, 40, 32], 1);
    }
  }
  if (contents && kind === 'cork') {
    for (let q = 0; q < 220; q++) fillEllipse(img, W, H, R() * S, R() * S, 0.8 + R() * 1.4, 0.8 + R() * 1.4, 0, [120, 80, 40], 0.25);
  }
  // わずかなぼけ（光学系）
  gaussRGB(img, W, H, 0.6);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < data.length; i++) data[i] = img[i];

  // 正解の手がかり：画像の内側に中心がある細胞の数
  let seeds = 0;
  const seen = new Set();
  for (let i = 0; i < owner.length; i++) if (owner[i] >= 0) seen.add(owner[i]);
  for (const k of seen) {
    const X = cfg.leaf ? C + sx[k] * cr + sy[k] * sr : sx[k], Y = cfg.leaf ? C - sx[k] * sr + sy[k] * cr : sy[k];
    if (X > 8 && Y > 8 && X < W - 8 && Y < H - 8) seeds++;
  }
  return { width: W, height: H, data, truth: { seeds } };
}

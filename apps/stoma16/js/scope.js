// 標本の表示：画像（長方形のまま）＋解析オーバーレイ（細胞の輪郭、走査線、同心円、中心）
// 発音した細胞は輪郭が0.5秒かけてゆっくり消えるだけ。画面全体の明滅・8Hz以上の点滅はしない
import { U } from './analysis/morph.js';

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export class Scope {
  constructor(box, cvImg, cvOvl) {
    this.box = box; this.cvImg = cvImg; this.cvOvl = cvOvl;
    this.img = null; this.A = null; this.edge = null; this.lit = [];
    this.colorMode = 'track';
    this.trackColors = [0, 1, 2, 3, 4, 5].map((v) => css(`--v${v}`));
    new ResizeObserver(() => this.resize()).observe(box);
  }

  resize() {
    const d = Math.min(2, devicePixelRatio || 1);
    for (const cv of [this.cvImg, this.cvOvl]) {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d));
    }
    this.drawImage();
  }

  // bmp（ImageBitmap）があればそれを表示に使う（画素の書き戻しをしない）
  setImage(img, bmp = null) {
    this.img = img;
    this.box.style.setProperty('--ar', `${img.width} / ${img.height}`);
    if (bmp) this.imgCanvas = bmp;
    else {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
      this.imgCanvas = c;
    }
    this.drawImage();
  }

  drawImage() {
    if (!this.imgCanvas) return;
    const g = this.cvImg.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.imgCanvas, 0, 0, this.cvImg.width, this.cvImg.height);
  }

  // 細胞の輪郭の層（解析画素の大きさで作り、表示で拡大する）
  setAnalysis(A, tracks) {
    this.A = A;
    if (!A) { this.edge = null; return; }
    const W = A.W, H = A.H, lab = A.lab;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), im = g.createImageData(W, H);
    const vOf = new Map();
    if (tracks) for (const t of tracks.tracks) for (const e of t.events) if (e.cell >= 0) vOf.set(e.cell, t.v);
    const trackRgb = this.trackColors.map(hexRgb);
    const clsRgb = new Map((A.classes?.list || []).map((cl) => [cl.id, cl.rgb.map((x) => Math.round(Math.min(255, x * 255 * 1.15)))]));
    for (let i = 0; i < lab.length; i++) {
      const l = lab[i]; if (l < 0) continue;
      const x = i % W;
      const e = (x < W - 1 && lab[i + 1] !== l) || (i + W < lab.length && lab[i + W] !== l);
      if (!e) continue;
      const cell = A.cells[l];
      let rgb, a;
      if (cell.bg) { rgb = [90, 90, 90]; a = 40; }
      else if (this.colorMode === 'class' && clsRgb.has(cell.cls)) { rgb = clsRgb.get(cell.cls); a = 230; }
      else if (vOf.has(l)) { rgb = trackRgb[vOf.get(l)]; a = 235; }
      else { rgb = [210, 214, 205]; a = cell.border ? 70 : 130; }
      const o = i * 4; im.data[o] = rgb[0]; im.data[o + 1] = rgb[1]; im.data[o + 2] = rgb[2]; im.data[o + 3] = a;
    }
    g.putImageData(im, 0, 0);
    this.edge = c;
  }

  hit(v, e, when) { if (e.cell >= 0) this.lit.push({ v, cell: e.cell, at: when }); }

  // 表示座標 → 基準座標（クリック位置で中心を置く）
  toUnit(clientX, clientY) {
    const r = this.cvOvl.getBoundingClientRect(), A = this.A || { W: 1, H: 1 };
    const Wn = (A.W / Math.max(A.W, A.H)) * U, Hn = (A.H / Math.max(A.W, A.H)) * U;
    return [((clientX - r.left) / r.width) * Wn, ((clientY - r.top) / r.height) * Hn];
  }

  draw({ phase = 0, running = false, now = 0, mode = 'SWEEP', bars = 2, center = null, walk = [] }) {
    const g = this.cvOvl.getContext('2d'), W = this.cvOvl.width, H = this.cvOvl.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8,12,14,0.30)'; g.fillRect(0, 0, W, H);
    const A = this.A;
    if (!A) return;
    if (this.edge) { g.imageSmoothingEnabled = false; g.drawImage(this.edge, 0, 0, W, H); }
    const Wn = (A.W / Math.max(A.W, A.H)) * U;
    const k = W / Wn;
    const brass = css('--brass');
    g.lineWidth = Math.max(1, W / 500);
    // 同心円（推定した中心と環の境界）
    if (A.center && A.center.method !== 'none') {
      g.strokeStyle = 'rgba(125,183,187,0.35)';
      g.setLineDash([4, 4]);
      for (const r of A.center.edges || []) { g.beginPath(); g.arc(A.center.cx * k, A.center.cy * k, r * k, 0, 6.29); g.stroke(); }
      g.setLineDash([]);
    }
    const c = center || (A.center ? [A.center.cx, A.center.cy] : [Wn / 2, (A.H / Math.max(A.W, A.H)) * U / 2]);
    const cx = c[0] * k, cy = c[1] * k;
    if (mode === 'SWEEP') {
      const ring = Math.floor(phase * bars), a = (phase * bars - ring) * 2 * Math.PI;
      if (running) { g.strokeStyle = 'rgba(196,166,105,0.85)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * W * 2, cy - Math.cos(a) * W * 2); g.stroke(); }
      g.fillStyle = brass; g.fillRect(cx - 3, cy - 3, 6, 6);
    } else if (mode === 'RASTER') {
      if (running) { const band = Math.floor(phase * bars), x = (phase * bars - band) * W; g.strokeStyle = 'rgba(196,166,105,0.85)'; g.beginPath(); g.moveTo(x, (band / bars) * H); g.lineTo(x, ((band + 1) / bars) * H); g.stroke(); }
    } else if (walk.length) {
      g.strokeStyle = 'rgba(196,166,105,0.35)'; g.beginPath();
      walk.forEach((cc, i) => (i ? g.lineTo(cc.cx * k, cc.cy * k) : g.moveTo(cc.cx * k, cc.cy * k))); g.stroke();
    }
    // 発音した細胞：輪郭が0.5秒かけて消える（明滅させない）
    this.lit = this.lit.filter((l) => now - l.at < 0.5);
    for (const l of this.lit) {
      if (l.at > now) continue;
      const cell = A.cells[l.cell]; if (!cell) continue;
      const a = 1 - (now - l.at) / 0.5;
      g.strokeStyle = this.trackColors[l.v]; g.globalAlpha = a * 0.9; g.lineWidth = Math.max(1.5, W / 300);
      g.beginPath(); g.arc(cell.cx * k, cell.cy * k, Math.sqrt(cell.A / Math.PI) * k * (1 + 0.2 * (1 - a)), 0, 6.29); g.stroke();
      g.globalAlpha = 1;
    }
  }
}

// IKD：細胞データの数値行列とバーコード。拍ごと（8Hz 未満）にだけ更新する
export function drawIkd(canvas, A, tracks, beatIdx) {
  const d = Math.min(2, devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  g.fillStyle = '#07090a'; g.fillRect(0, 0, W, H);
  if (!A) return;
  const cells = A.cells.filter((c) => !c.bg);
  // バーコード（上段）：細胞の面積を幅に
  let x = 0;
  const off = (beatIdx * 7) % Math.max(1, cells.length);
  g.fillStyle = '#d6d9d3';
  for (let i = 0; x < W && i < cells.length * 2; i++) {
    const c = cells[(i + off) % cells.length];
    const w = Math.max(1, Math.round(Math.sqrt(c.A) * 0.35 * d));
    if (i % 2 === 0) g.fillRect(x, 0, w, H * 0.38);
    x += w;
  }
  // 数値行列（下段）：A / n / θ
  g.font = `${9 * d}px "IBM Plex Mono", monospace`;
  g.fillStyle = '#7db7bb';
  const cols = Math.max(1, Math.floor(W / (54 * d))), rows = Math.max(1, Math.floor((H * 0.58) / (11 * d)));
  for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
    const c = cells[(off + rr * cols + cc) % cells.length];
    if (!c) continue;
    g.fillText(`${Math.round(c.A).toString(16).toUpperCase().padStart(3, '0')}.${c.nb.length}.${Math.round(((c.angle + Math.PI / 2) / Math.PI) * 255).toString(16).padStart(2, '0')}`, cc * 54 * d + 2, H * 0.42 + (rr + 1) * 11 * d);
  }
  void tracks;
}

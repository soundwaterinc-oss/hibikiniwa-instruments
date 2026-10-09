// 形態量・隣接グラフ・統計
// cells[k]: { id, A, cx, cy, per, circ, elong, angle, convex, br, lab:[L,a,b], rgb:[r,g,b], nb:[...], border, nbAreaRatio, align }
// 座標・面積は解析画素ではなく「基準座標」（長辺 U=256 に正規化）で持つ。表示・写像は常にこの座標系
import { rgbToLab } from './image.js';

export const U = 256;

function convexHullArea(pts) {
  if (pts.length < 3) return 0;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let a = 0;
  for (let i = 0; i < hull.length; i++) { const [x1, y1] = hull[i], [x2, y2] = hull[(i + 1) % hull.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}

// lab: ラベル画像（-1=背景）、bgIds: 背景とみなすラベル
export function measure(lab, count, W, H, rgb, bright, { minPairs = 2, bgIds = new Set() } = {}) {
  const k2 = U / Math.max(W, H);
  const acc = Array.from({ length: count }, () => ({ A: 0, mx: 0, my: 0, br: 0, r: 0, g: 0, b: 0, sxx: 0, syy: 0, sxy: 0, per: 0, border: false, pts: [] }));
  const L = W * H;
  for (let i = 0; i < L; i++) {
    const l = lab[i]; if (l < 0) continue;
    const a = acc[l], x = i % W, y = (i / W) | 0;
    a.A++; a.mx += x; a.my += y; a.br += bright[i];
    a.r += rgb[i * 3]; a.g += rgb[i * 3 + 1]; a.b += rgb[i * 3 + 2];
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) a.border = true;
  }
  for (const a of acc) if (a.A) { a.mx /= a.A; a.my /= a.A; }
  for (let i = 0; i < L; i++) {
    const l = lab[i]; if (l < 0) continue;
    const a = acc[l], x = i % W, y = (i / W) | 0, X = x - a.mx, Y = y - a.my;
    a.sxx += X * X; a.syy += Y * Y; a.sxy += X * Y;
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || lab[i - 1] !== l || lab[i + 1] !== l || lab[i - W] !== l || lab[i + W] !== l;
    if (edge) { a.per++; a.pts.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]); }
  }
  // 隣接：共有境界が minPairs 画素対以上
  const pairCount = new Map();
  const addPair = (p, q) => {
    if (p < 0 || q < 0 || p === q) return;
    const key = p < q ? p * 1048576 + q : q * 1048576 + p;
    pairCount.set(key, (pairCount.get(key) || 0) + 1);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x < W - 1) addPair(lab[i], lab[i + 1]);
    if (y < H - 1) addPair(lab[i], lab[i + W]);
  }
  const nbs = Array.from({ length: count }, () => new Set());
  for (const [key, n] of pairCount) {
    if (n < minPairs) continue;
    const p = Math.floor(key / 1048576), q = key % 1048576;
    nbs[p].add(q); nbs[q].add(p);
  }
  const cells = acc.map((a, id) => {
    const A = a.A;
    const sxx = a.sxx / A, syy = a.syy / A, sxy = a.sxy / A;
    const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
    const hull = convexHullArea(a.pts);
    const r = a.r / A, g = a.g / A, b = a.b / A;
    // 周長は境界画素数（4連結）×π/4 で近似
    const per = a.per * (Math.PI / 4) * 1.12;
    return {
      id, A: A * k2 * k2, cx: (a.mx + 0.5) * k2, cy: (a.my + 0.5) * k2, per: per * k2,
      circ: Math.min(1, (4 * Math.PI * A) / Math.max(1, per * per)),
      elong: Math.sqrt(l1 / l2), angle: 0.5 * Math.atan2(2 * sxy, sxx - syy),
      convex: hull > 0 ? Math.min(1, A / hull) : 1,
      br: a.br / A, rgb: [r, g, b], lab: rgbToLab(r, g, b),
      nb: [...nbs[id]].filter((j) => !bgIds.has(j)),
      border: a.border || [...nbs[id]].some((j) => bgIds.has(j)),
      bg: bgIds.has(id),
    };
  });
  // 隣接細胞との面積比・向きの局所的な揃い
  for (const c of cells) {
    const ns = c.nb.map((j) => cells[j]);
    c.nbAreaRatio = ns.length ? ns.reduce((s, n) => s + n.A, 0) / ns.length / c.A : 1;
    c.align = ns.length ? ns.reduce((s, n) => s + Math.abs(Math.cos(2 * (c.angle - n.angle))), 0) / ns.length : 0;
  }
  return cells;
}

// 統計：⟨n⟩・六角形率・ルイスの法則・アボフ–ウィアの法則（境界に触れない細胞だけで数える）
export function statistics(cells) {
  const inner = cells.filter((c) => !c.border && !c.bg);
  const n = inner.length;
  if (!n) return { n: 0, meanN: 0, hex: 0, lewisR: 0, lewisSlope: 0, aboavA: 0, aboavMu2: 0, meanA: 0, cvA: 0, meanElong: 0, meanConvex: 0 };
  const deg = inner.map((c) => c.nb.length);
  const meanN = deg.reduce((s, v) => s + v, 0) / n;
  const hex = deg.filter((d) => d === 6).length / n;
  const meanA = inner.reduce((s, c) => s + c.A, 0) / n;
  const sdA = Math.sqrt(inner.reduce((s, c) => s + (c.A - meanA) ** 2, 0) / n);
  // ルイスの法則：辺の数 n と面積の相関（正の相関・ほぼ線形）
  let sxy = 0, sxx = 0, syy = 0;
  inner.forEach((c, i) => { const dx = deg[i] - meanN, dy = c.A / meanA - 1; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; });
  const lewisR = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  const lewisSlope = sxx ? sxy / sxx : 0;
  // アボフ–ウィア：n·m(n) = (6 − a)n + 6a + μ2。m(n) は n 辺の細胞の隣接細胞の平均辺数
  const mu2 = deg.reduce((s, v) => s + (v - meanN) ** 2, 0) / n;
  const byN = new Map();
  for (const c of inner) {
    const ms = c.nb.map((j) => cells[j]).filter((x) => x && !x.bg).map((x) => x.nb.length);
    if (!ms.length) continue;
    const m = ms.reduce((s, v) => s + v, 0) / ms.length;
    const e = byN.get(c.nb.length) || { s: 0, k: 0 };
    e.s += m; e.k++; byN.set(c.nb.length, e);
  }
  let X = 0, Y = 0, XX = 0, XY = 0, K = 0;
  for (const [nn, e] of byN) { const y = nn * (e.s / e.k); X += nn * e.k; Y += y * e.k; XX += nn * nn * e.k; XY += nn * y * e.k; K += e.k; }
  const slope = K && XX * K - X * X ? (XY * K - X * Y) / (XX * K - X * X) : 6;
  const aboavA = 6 - slope;
  return {
    n, meanN, hex, lewisR, lewisSlope, aboavA, aboavMu2: mu2, meanA, cvA: sdA / meanA,
    meanElong: inner.reduce((s, c) => s + c.elong, 0) / n,
    meanConvex: inner.reduce((s, c) => s + c.convex, 0) / n,
  };
}

// 細胞の量の順位（0..1）
export function ranks(cells, keys = ['A', 'circ', 'elong', 'br', 'convex']) {
  const use = cells.filter((c) => !c.bg);
  for (const key of keys) {
    const arr = use.map((c) => [c[key], c]).sort((a, b) => a[0] - b[0]);
    arr.forEach(([, c], r) => { c[`${key}Q`] = arr.length > 1 ? r / (arr.length - 1) : 0.5; });
  }
}

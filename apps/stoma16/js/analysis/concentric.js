// 同心円構造の検出：横断面の写真で回転走査の中心を推定し、半径で「環（リング）」を定義する
//   1) 環状の組織クラスに円をフィット（中心のまわりに均等に並び、半径がそろうクラス）
//   2) だめなら、細胞の大きさの放射状勾配（中心ほど小さい／大きい）が最も強くなる点
//   3) どちらも弱ければ画像中心
import { U } from './morph.js';

// 代数的な円フィット（Kåsa）
export function fitCircle(pts) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  const n = pts.length;
  for (const [x, y] of pts) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  // [sxx sxy sx][D]   [-sxz]
  // [sxy syy sy][E] = [-syz]
  // [sx  sy  n ][F]   [-sz ]
  const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], b = [-sxz, -syz, -sz];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(M);
  if (Math.abs(d) < 1e-9) return null;
  const sol = [0, 1, 2].map((c) => det(M.map((row, r) => row.map((v, j) => (j === c ? b[r] : v)))) / d);
  const cx = -sol[0] / 2, cy = -sol[1] / 2;
  const r = Math.sqrt(Math.max(0, cx * cx + cy * cy - sol[2]));
  return { cx, cy, r };
}

export function concentric(A, { nRings = 4 } = {}) {
  const cells = A.cells.filter((c) => !c.bg);
  const Hn = (A.H / Math.max(A.W, A.H)) * U, Wn = (A.W / Math.max(A.W, A.H)) * U;
  let best = null;
  const tried = [];
  // 1) 環状のクラス
  for (const cl of A.classes?.list || []) {
    const mem = cells.filter((c) => c.cls === cl.id);
    if (mem.length < 10) continue;
    const f = fitCircle(mem.map((c) => [c.cx, c.cy]));
    if (!f || f.r < 0.12 * Math.min(Wn, Hn) || f.r > 0.75 * Math.max(Wn, Hn)) continue;
    if (f.cx < 0 || f.cy < 0 || f.cx > Wn || f.cy > Hn) continue;
    const ds = mem.map((c) => Math.hypot(c.cx - f.cx, c.cy - f.cy));
    const mean = ds.reduce((s, v) => s + v, 0) / ds.length;
    const sd = Math.sqrt(ds.reduce((s, v) => s + (v - mean) ** 2, 0) / ds.length);
    const sectors = new Set(mem.map((c) => Math.floor(((Math.atan2(c.cy - f.cy, c.cx - f.cx) + Math.PI) / (2 * Math.PI)) * 12) % 12));
    const ringness = Math.max(0, 1 - sd / Math.max(1e-6, mean));
    const coverage = sectors.size / 12;
    // 環は細く（ringness 高）、全周にわたり（coverage 高）、全体の一部（あまり多すぎない）
    const score = ringness ** 2 * coverage * (cl.frac < 0.5 ? 1 : 0.5);
    tried.push({ cls: cl.code, ringness: +ringness.toFixed(2), coverage: +coverage.toFixed(2), score: +score.toFixed(2) });
    if (!best || score > best.score) best = { method: 'ring', score, cx: f.cx, cy: f.cy, radius: mean, ringClass: cl.id, ringness, coverage };
  }
  // 2) 大きさの放射状勾配
  if (!best || best.score < 0.45) {
    let g = null;
    for (let gy = 1; gy < 16; gy++) for (let gx = 1; gx < 16; gx++) {
      const cx = (gx / 16) * Wn, cy = (gy / 16) * Hn;
      let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      for (const c of cells) { const r = Math.hypot(c.cx - cx, c.cy - cy), a = Math.log(c.A); sx += r; sy += a; sxx += r * r; syy += a * a; sxy += r * a; }
      const n = cells.length;
      const cov = sxy / n - (sx / n) * (sy / n), vr = sxx / n - (sx / n) ** 2, va = syy / n - (sy / n) ** 2;
      const corr = vr > 0 && va > 0 ? cov / Math.sqrt(vr * va) : 0;
      if (!g || Math.abs(corr) > Math.abs(g.corr)) g = { cx, cy, corr };
    }
    if (g && Math.abs(g.corr) > 0.3 && (!best || Math.abs(g.corr) > best.score)) best = { method: 'gradient', score: Math.abs(g.corr), cx: g.cx, cy: g.cy, radius: 0, ringClass: -1 };
  }
  if (!best || best.score < 0.2) best = { method: 'none', score: 0, cx: Wn / 2, cy: Hn / 2, radius: 0, ringClass: -1 };
  // 環（リング）：中心からの距離の分位で nRings 個に分ける（外側が 0）
  const ds = cells.map((c) => Math.hypot(c.cx - best.cx, c.cy - best.cy)).sort((a, b) => a - b);
  const edges = Array.from({ length: nRings - 1 }, (_, i) => ds[Math.floor(((i + 1) / nRings) * (ds.length - 1))] ?? 0);
  for (const c of cells) {
    const r = Math.hypot(c.cx - best.cx, c.cy - best.cy);
    let k = 0;
    while (k < edges.length && r > edges[k]) k++;
    c.ring = nRings - 1 - k; // 外側＝0、中心＝nRings-1
    c.r = r;
  }
  return { ...best, nRings, edges, W: Wn, H: Hn, tried };
}

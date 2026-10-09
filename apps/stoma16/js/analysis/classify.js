// 組織の分類：細胞の平均色（Lab）と形態量を k-means にかけ「組織クラス」を作る
// k は 2〜6。AUTO はシルエット係数が最大の k を選ぶ。名前は色名＋大きさ（例 TIS.R-sm ＝「赤・小さい」）
import { rng } from '../rng.js';

const COLORS = [
  // [記号, 平文, Lab の色相角の範囲（度）]
  // 赤はサフラニン染色の赤紫寄りまで含める（色相角 310〜50 度）。細胞の平均色は白い内部と染まった壁が混ざり、
  // 実際の染色より淡く紫側に寄るため
  ['R', '赤', -50, 50], ['Y', '黄', 50, 105], ['G', '緑', 105, 190], ['C', '青緑', 190, 235], ['B', '青', 235, 285], ['V', '紫', 285, 310],
];
const SIZE = { sm: '小さい', md: '中くらい', lg: '大きい' };

export function colorName([L, a, b]) {
  const chroma = Math.hypot(a, b);
  if (chroma < 10) return L > 72 ? ['W', '白'] : L < 38 ? ['K', '黒'] : ['N', '灰'];
  let hue = (((Math.atan2(b, a) * 180) / Math.PI) + 360) % 360; // 0..360
  if (hue >= 310) hue -= 360; // 赤は −50..50 にまとめる
  for (const [c, p, lo, hi] of COLORS) if (hue >= lo && hue < hi) return [c, p];
  return ['R', '赤'];
}

function features(cells) {
  const raw = cells.map((c) => [c.lab[0], c.lab[1], c.lab[2], Math.log(c.A), Math.log(c.elong), c.convex]);
  const d = raw[0]?.length || 0;
  const mean = Array(d).fill(0), sd = Array(d).fill(0);
  raw.forEach((r) => r.forEach((v, j) => { mean[j] += v / raw.length; }));
  raw.forEach((r) => r.forEach((v, j) => { sd[j] += (v - mean[j]) ** 2 / raw.length; }));
  // 色（とくに赤み a* と青み b*）を重く、形を軽く（同じ組織は同じ染まり方をする）
  const wgt = [1.0, 2.6, 2.0, 0.9, 0.4, 0.3];
  return raw.map((r) => r.map((v, j) => ((v - mean[j]) / (Math.sqrt(sd[j]) || 1)) * wgt[j]));
}

const dist2 = (a, b) => { let s = 0; for (let j = 0; j < a.length; j++) s += (a[j] - b[j]) ** 2; return s; };

export function kmeans(X, k, seed = 1, iters = 40) {
  const R = rng(seed);
  const n = X.length;
  // k-means++
  const C = [X[Math.floor(R() * n)].slice()];
  while (C.length < k) {
    const d = X.map((x) => Math.min(...C.map((c) => dist2(x, c))));
    const tot = d.reduce((s, v) => s + v, 0);
    let r = R() * tot, i = 0;
    while (i < n - 1 && (r -= d[i]) > 0) i++;
    C.push(X[i].slice());
  }
  const lab = new Int32Array(n);
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) { const dd = dist2(X[i], C[c]); if (dd < bd) { bd = dd; best = c; } }
      if (lab[i] !== best) { lab[i] = best; moved++; }
    }
    const sum = Array.from({ length: k }, () => Array(X[0].length).fill(0)), cnt = Array(k).fill(0);
    for (let i = 0; i < n; i++) { cnt[lab[i]]++; X[i].forEach((v, j) => { sum[lab[i]][j] += v; }); }
    for (let c = 0; c < k; c++) if (cnt[c]) C[c] = sum[c].map((v) => v / cnt[c]);
    if (!moved && it) break;
  }
  return { lab, C };
}

// シルエット係数（大きいときは間引いて計算）
export function silhouette(X, lab, k, seed = 3) {
  const R = rng(seed);
  const idx = X.map((_, i) => i);
  const sample = idx.length > 320 ? idx.filter(() => R() < 320 / idx.length) : idx;
  let s = 0, m = 0;
  for (const i of sample) {
    const dsum = Array(k).fill(0), dcnt = Array(k).fill(0);
    for (const j of sample) { if (i === j) continue; const d = Math.sqrt(dist2(X[i], X[j])); dsum[lab[j]] += d; dcnt[lab[j]]++; }
    const own = lab[i];
    if (dcnt[own] === 0) continue;
    const a = dsum[own] / dcnt[own];
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && dcnt[c]) b = Math.min(b, dsum[c] / dcnt[c]);
    if (!Number.isFinite(b)) continue;
    s += (b - a) / Math.max(a, b); m++;
  }
  return m ? s / m : -1;
}

// cells: 背景を除いた細胞。各細胞に c.cls を書き込む
export function classify(cells, { k = 'auto', seed = 7 } = {}) {
  if (cells.length < 6) { cells.forEach((c) => { c.cls = 0; }); return { k: 1, silhouette: 0, list: [{ id: 0, code: 'TIS.N-md', plain: '灰・中くらい', count: cells.length, frac: 1 }] }; }
  const X = features(cells);
  const ks = k === 'auto' ? [2, 3, 4, 5, 6].filter((x) => x < cells.length / 3) : [Math.max(2, Math.min(6, k))];
  const runs = ks.map((kk) => { const r = kmeans(X, kk, seed + kk); return { k: kk, sil: silhouette(X, r.lab, kk), lab: r.lab }; });
  const top = Math.max(...runs.map((r) => r.sil));
  // シルエットが最大値に近い（−0.06 以内）なら、組織を細かく分ける方（k が大きい方）を選ぶ
  const best = runs.filter((r) => r.sil >= top - 0.06).sort((a, b) => b.k - a.k)[0];
  cells.forEach((c, i) => { c.cls = best.lab[i]; });
  const medA = [...cells.map((c) => c.A)].sort((a, b) => a - b)[Math.floor(cells.length / 2)];
  const used = new Map();
  const list = Array.from({ length: best.k }, (_, id) => {
    const mem = cells.filter((c) => c.cls === id);
    const lab = [0, 1, 2].map((j) => mem.reduce((s, c) => s + c.lab[j], 0) / Math.max(1, mem.length));
    const rgb = [0, 1, 2].map((j) => mem.reduce((s, c) => s + c.rgb[j], 0) / Math.max(1, mem.length));
    const meanA = mem.reduce((s, c) => s + c.A, 0) / Math.max(1, mem.length);
    const [cc, cp] = colorName(lab);
    const sz = meanA < medA * 0.6 ? 'sm' : meanA > medA * 1.6 ? 'lg' : 'md';
    let code = `TIS.${cc}-${sz}`;
    const nUsed = used.get(code) || 0;
    used.set(code, nUsed + 1);
    if (nUsed) code += `${nUsed + 1}`;
    return { id, code, plain: `${cp}・${SIZE[sz]}${nUsed ? `（${nUsed + 1}）` : ''}`, color: cc, size: sz, count: mem.length, frac: mem.length / cells.length, lab, rgb, meanA };
  });
  return { k: best.k, silhouette: best.sil, sils: runs.map((r) => [r.k, +r.sil.toFixed(3)]), list };
}

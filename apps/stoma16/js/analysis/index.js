// 解析の入口：画像 → 細胞（形態量・隣接・組織クラス・同心円構造）
// DOM を使わないので Worker と Node（テスト）でそのまま動く
import { resample, channels, gauss, quantile, clamp } from './image.js';
import { ridgeMap, lineIntegral } from './ridge.js';
import { hysteresis, thin, pruneComponents, spur, bridgeGaps, markers, watershed, mergeWeak, compact } from './segment.js';
import { measure, statistics, ranks, U } from './morph.js';
import { classify } from './classify.js';
import { concentric } from './concentric.js';

export { U };

// 見る特徴（CH）
export const CHANNELS = [
  { id: 0, code: 'LUMA', plain: '明るさ（暗い壁）／INVで明るい壁' },
  { id: 1, code: 'CHL', plain: '葉緑体・染色の密度の谷（密な細胞の間の壁）' },
  { id: 2, code: 'WALL', plain: '透明な細胞壁（明るく色の抜けた線）' },
  { id: 3, code: 'RIDGE', plain: '線状の壁（ヘッセ行列のFrangi型。INVで明るい線＋彩度ゲート）' },
];

export const DEFAULT_SEG = { ch: 3, inv: 0, res: 384, hi: 0.32, lo: 0.14, gap: 6, mina: 14, fill: 2.6, merge: 0.55, sig: 1, lin: 0, edge: 1 };

// 解像度ごとに使い回す下ごしらえ（AUTO で同じ画像を何度も解析するため）
export function prepare(img, res, cache = new Map()) {
  const key = `prep:${res}`;
  if (cache.has(key)) return cache.get(key);
  const R = resample(img, res);
  const { lum, sat } = channels(R);
  const out = { ...R, lum, sat };
  cache.set(key, out);
  return out;
}

const sigmasFor = (W, H, sig) => {
  const k = Math.max(W, H) / 384;
  return [1, 1.7, 2.8].map((s) => Math.max(0.7, s * k * sig));
};

// 壁らしさ地図（0..1、壁で大きい）
export function wallMap(prep, P, cache = new Map()) {
  const key = `wall:${prep.W}:${P.ch}:${P.inv}:${P.sig}:${P.lin}`;
  if (cache.has(key)) return cache.get(key);
  const { W, H, rgb, lum, sat } = prep;
  const L = W * H, sig = sigmasFor(W, H, P.sig);
  const dir = P.lin > 0 ? new Float32Array(L) : null;
  const lin = (V) => (dir ? lineIntegral(V, dir, W, H, P.lin * Math.max(W, H) / 384) : V);
  let Wm;
  if (P.ch === 1) {
    // 葉緑体・染色の密度。密な細胞の間（谷）が壁
    const f = new Float32Array(L);
    for (let i = 0; i < L; i++) f[i] = 1 - (sat[i] * 0.65 + (1 - lum[i]) * 0.35);
    Wm = lin(ridgeMap(f, W, H, sig, { bright: !P.inv, dir }));
  } else if (P.ch === 2) {
    // 透明な壁：明るく、色が抜けている
    const f = new Float32Array(L);
    for (let i = 0; i < L; i++) f[i] = clamp(lum[i] - sat[i] * 1.4 + 0.3, 0, 1);
    Wm = lin(ridgeMap(f, W, H, sig, { bright: true, dir }));
  } else if (P.ch === 3) {
    Wm = lin(ridgeMap(lum, W, H, sig, { bright: !!P.inv, sat: P.inv ? sat : null, dir }));
  } else {
    // LUMA：明るさの線（暗い壁、INVで明るい壁）に、太い壁のための局所コントラストを足す
    const r = ridgeMap(lum, W, H, sig, { bright: !!P.inv });
    const bl = gauss(lum, W, H, 6 * Math.max(W, H) / 384);
    Wm = new Float32Array(L);
    const loc = new Float32Array(L);
    for (let i = 0; i < L; i++) loc[i] = (P.inv ? lum[i] - bl[i] : bl[i] - lum[i]);
    const top = Math.max(1e-6, quantile(loc, 0.98));
    for (let i = 0; i < L; i++) Wm[i] = Math.max(r[i], clamp(loc[i] / top, 0, 1) * 0.8);
  }
  void rgb;
  cache.set(key, Wm);
  return Wm;
}

// 境界の妥当性を測る「壁らしさ」地図（AUTO用）：明暗両方の線の強い方。CH に依存しない
// lin>0 のときは線の向きに沿って平均し、まっすぐ続く壁だけを強く残す（短い葉緑体の隙間は弱まる）
export function evidenceMap(prep, cache = new Map(), lin = 0) {
  const key = `ev:${prep.W}:${lin}`;
  if (cache.has(key)) return cache.get(key);
  const { W, H, lum, sat } = prep;
  const sig = sigmasFor(W, H, 1);
  const da = new Float32Array(W * H), db = new Float32Array(W * H);
  const a = ridgeMap(lum, W, H, sig, { bright: true, sat, dir: da }), b = ridgeMap(lum, W, H, sig, { bright: false, dir: db });
  let e = new Float32Array(W * H);
  const d = new Float32Array(W * H);
  for (let i = 0; i < e.length; i++) { if (a[i] >= b[i]) { e[i] = a[i]; d[i] = da[i]; } else { e[i] = b[i]; d[i] = db[i]; } }
  if (lin > 0) e = lineIntegral(e, d, W, H, lin * Math.max(W, H) / 384);
  cache.set(key, e);
  return e;
}

// 切り分け（ラベル画像まで）
export function segment(prep, P, cache) {
  const { W, H } = prep;
  const k = Math.max(W, H) / 384;
  const Wm = wallMap(prep, P, cache);
  const mask = hysteresis(Wm, W, H, P.hi, P.lo);
  let sk = thin(mask, W, H);
  sk = spur(sk, W, H, Math.round(2 * k));
  const minA = Math.max(4, Math.round(P.mina * k * k));
  const br = bridgeGaps(sk, W, H, Math.round(P.gap * k));
  const pr = pruneComponents(br.mask, W, H, { minLen: Math.max(4, Math.round(6 * k)), blobArea: P.fill * minA * 2.2 });
  const mk = markers(pr.mask, W, H, minA);
  const ws = watershed(gauss(Wm, W, H, 0.7), mk.lab, W, H);
  // 背景の候補を除いた面積の中央値から、併合の上限を決める
  const areas = new Map();
  for (const l of ws) if (l >= 0) areas.set(l, (areas.get(l) || 0) + 1);
  const sorted = [...areas.values()].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 1;
  const mg = mergeWeak(ws, Wm, W, H, { ratio: P.merge, maxArea: med * 2.2, minPairs: Math.max(2, Math.round(3 * k)) });
  const { lab, count } = compact(mg.lab);
  return { lab, count, Wm, skeleton: pr.mask, info: { markers: mk.count, pruned: pr.removed, bridged: br.bridged, merged: mg.merged } };
}

// 解析一式
export function analyze(img, Pin = {}, { cache = new Map(), evidence = true, classes = true, rings = true } = {}) {
  const P = { ...DEFAULT_SEG, ...Pin };
  const prep = prepare(img, P.res, cache);
  const { W, H, rgb, lum } = prep;
  const seg = segment(prep, P, cache);
  // 背景：中央値の12倍を超える巨大な領域
  const areas = new Float64Array(seg.count);
  for (const l of seg.lab) if (l >= 0) areas[l]++;
  const sortedA = Array.from(areas).sort((a, b) => a - b);
  const medA = sortedA[Math.floor(sortedA.length / 2)] || 1;
  const bgIds = new Set();
  areas.forEach((a, i) => { if (a > medA * 12 || a > W * H * 0.25) bgIds.add(i); });
  // 隣接は共有境界の画素対の数で判定する。解像度384以下では1画素の接触も本当の短い辺
  const cells = measure(seg.lab, seg.count, W, H, rgb, lum, { minPairs: P.mp ?? Math.max(1, Math.round(Math.max(W, H) / 384)), bgIds });
  ranks(cells);
  const stats = statistics(cells);
  const bs = evidence ? boundaryScores(seg.lab, bgIds, evidenceMap(prep, cache), W, H, cache) : { evidence: 0, excess: 0 };
  const res = { W, H, scale: prep.scale, cells, lab: seg.lab, stats, evidence: bs.evidence, excess: bs.excess, info: seg.info, params: P };
  if (classes) res.classes = classify(cells.filter((c) => !c.bg), { seed: 7 });
  if (rings) res.center = concentric(res);
  return res;
}

// 境界の評価（境界画素は±1画素の範囲で最も壁らしい値を採る。境界は画素の格子に乗るため）
//   evidence：境界上の壁らしさの平均 ÷ 画像全体の平均
//   excess  ：Σ(境界上の壁らしさ − 画像の85%分位点) ÷ 画素数 ×100。本当の壁を境界にすると増え、壁でない所を切ると減る
//             （平均の evidence は弱い本物の壁を落とすほど上がってしまうので、AUTO の採点には excess を使う）
export function boundaryScores(lab, bgIds, E, W, H, cache) {
  const key = `evq85:${W}`;
  let ref = cache?.get(key);
  if (ref === undefined) {
    const s = [];
    for (let i = 0; i < E.length; i += 3) s.push(E[i]);
    s.sort((a, b) => a - b);
    ref = s[Math.floor(0.85 * (s.length - 1))];
    cache?.set(key, ref);
  }
  let eb = 0, nb = 0, ea = 0, ex = 0;
  for (let i = 0; i < lab.length; i++) {
    ea += E[i];
    const l = lab[i], x = i % W, y = (i / W) | 0;
    if (l < 0 || bgIds.has(l)) continue;
    if (!((x < W - 1 && lab[i + 1] !== l && lab[i + 1] >= 0) || (i + W < lab.length && lab[i + W] !== l && lab[i + W] >= 0))) continue;
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < H && E[Y * W + X] > m) m = E[Y * W + X];
    }
    eb += m; nb++; ex += m - ref;
  }
  return { evidence: nb ? eb / nb / Math.max(1e-6, ea / lab.length) : 0, excess: (ex / (W * H)) * 100 };
}

// 音楽に使う細胞（EDGE=EXCL なら縁に触れる細胞を除く）
export const usableCells = (A, edgeExcl = true) => A.cells.filter((c) => !c.bg && (!edgeExcl || !c.border));

// リッジ（線状構造）検出：ヘッセ行列の固有値による Frangi 型フィルター（多重スケール）
// bright=true：明るい線（透明な細胞壁）。dark=false：暗い線（染まった壁）
// satGate：明るい線のとき、色の付いた部分（葉緑体の縁など）を彩度で抑える
import { gauss, quantile, clamp } from './image.js';

export function ridgeMap(src, W, H, sigmas, { bright = false, sat = null, beta = 0.5, c = null, dir = null } = {}) {
  const L = W * H, V = new Float32Array(L);
  let sLo = 0, sHi = 1;
  if (sat) { sLo = quantile(sat, 0.05); sHi = Math.max(sLo + 1e-3, quantile(sat, 0.95)); }
  for (const sig of sigmas) {
    const g = gauss(src, W, H, sig);
    const s2 = sig * sig;
    // 構造強度の基準 c：ヘッセの大きさの分布から自動で決める（画像のコントラストに依存しない）
    const S = new Float32Array(L), RB = new Float32Array(L), OK = new Uint8Array(L), TH = new Float32Array(L);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const dxx = (g[i - 1] - 2 * g[i] + g[i + 1]) * s2, dyy = (g[i - W] - 2 * g[i] + g[i + W]) * s2;
      const dxy = ((g[i - W - 1] + g[i + W + 1] - g[i - W + 1] - g[i + W - 1]) / 4) * s2;
      const tr = dxx + dyy, df = Math.sqrt((dxx - dyy) ** 2 + 4 * dxy * dxy);
      let l1 = (tr + df) / 2, l2 = (tr - df) / 2;
      if (Math.abs(l1) > Math.abs(l2)) { const t = l1; l1 = l2; l2 = t; }
      // 明るい線は l2<0、暗い線は l2>0
      if (bright ? l2 >= 0 : l2 <= 0) continue;
      OK[i] = 1;
      RB[i] = l1 / l2;
      S[i] = Math.sqrt(l1 * l1 + l2 * l2);
      // 線の向き（接線）：固有値 l1（曲率の小さい方）の固有ベクトル
      TH[i] = 0.5 * Math.atan2(2 * dxy, dxx - dyy) + (Math.abs(l1 - ((dxx + dyy) / 2 + df / 2)) < 1e-12 ? 0 : Math.PI / 2);
    }
    const cc = c ?? Math.max(1e-6, 0.5 * quantile(S, 0.98));
    for (let i = 0; i < L; i++) {
      if (!OK[i]) continue;
      let v = Math.exp(-(RB[i] * RB[i]) / (2 * beta * beta)) * (1 - Math.exp(-(S[i] * S[i]) / (2 * cc * cc)));
      if (sat && bright) { const ds = 1 - clamp((sat[i] - sLo) / (sHi - sLo), 0, 1); v *= ds * ds; }
      if (v > V[i]) { V[i] = v; if (dir) dir[i] = TH[i]; }
    }
  }
  const top = Math.max(1e-6, quantile(V, 0.99));
  for (let i = 0; i < L; i++) V[i] = Math.min(1, V[i] / top);
  return V;
}

// 線の向きに沿った平均（長さ ±len 画素）。まっすぐ続く壁は残り、葉緑体の縁のような短く曲がった線は弱まる
export function lineIntegral(V, dir, W, H, len) {
  if (len <= 0) return V;
  const out = new Float32Array(W * H);
  const sample = (x, y) => {
    if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return 0;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
    return (V[y0 * W + x0] * (1 - fx) + V[y0 * W + x1] * fx) * (1 - fy) + (V[y1 * W + x0] * (1 - fx) + V[y1 * W + x1] * fx) * fy;
  };
  const steps = Math.max(2, Math.round(len));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (V[i] < 0.02) continue;
    const c = Math.cos(dir[i]), s = Math.sin(dir[i]);
    let a = 0, mn = Infinity;
    // 両方向それぞれの平均の小さい方を使う（片側だけ続く端点でも線なら残る、両側が途切れる短い弧は消える）
    let fwd = 0, back = 0;
    for (let t = 1; t <= steps; t++) { fwd += sample(x + c * t, y + s * t); back += sample(x - c * t, y - s * t); }
    fwd /= steps; back /= steps;
    a = (V[i] + Math.max(fwd, back) * 2 + Math.min(fwd, back)) / 4;
    mn = Math.max(fwd, back);
    out[i] = Math.min(V[i], a, mn * 1.4);
  }
  const top = Math.max(1e-6, quantile(out, 0.99));
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / top);
  return out;
}

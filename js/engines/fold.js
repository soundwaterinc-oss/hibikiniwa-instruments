// F0LD — 正弦をウェーブフォールダー（Buchla系の折り返し）に通す
// Α=折り返し量 Β=対称性（0で対称、上げると偶数倍音） Γ=後段ローパス
import { gain, osc, lp, hp, clamp, glideTo, shaper, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 2;
const G = 5; // 入力振幅1のときの折り返し倍率
const foldCurve = (() => {
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.sin((x * G * Math.PI) / 2); }
  return c;
})();
const ampOf = (p) => 0.18 + 0.82 * p.ma;
const cutOf = (p, f) => clamp(f * (2 + p.mc * 18), 80, 3000);

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.46);
  const o = osc(ctx, 'sine', hz);
  const pre = gain(ctx, ampOf(p));
  const bias = ctx.createConstantSource();
  const biasG = gain(ctx, 0);
  const fold = shaper(ctx, foldCurve);
  const dc = hp(ctx, 12);
  const f1 = lp(ctx, cutOf(p, hz)), f2 = lp(ctx, cutOf(p, hz));
  o.connect(pre).connect(fold);
  bias.connect(biasG).connect(fold);
  fold.connect(dc).connect(f1).connect(f2).connect(env).connect(out);
  wireDrift(drift, [o.detune]);
  let curHz = hz, curP = p;
  const setParams = (q) => {
    const now = ctx.currentTime;
    curP = q;
    glideTo(pre.gain, ampOf(q), now);
    glideTo(biasG.gain, q.mb * 0.35, now);
    glideTo(f1.frequency, cutOf(q, curHz), now);
    glideTo(f2.frequency, cutOf(q, curHz), now);
  };
  setParams(p);
  const sources = [o, bias];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      curHz = f;
      glideTo(o.frequency, f, at, glide / 3);
      glideTo(f1.frequency, cutOf(curP, f), at, glide / 3);
      glideTo(f2.frequency, cutOf(curP, f), at, glide / 3);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [pre, biasG, fold, dc, f1, f2] }),
  };
}

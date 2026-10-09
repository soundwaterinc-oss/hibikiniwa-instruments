// ORG.16 — ドローバー・オルガン。F₀ を 16′ とし、8′・5⅓′・4′ は 2・3・4 倍音
// 8′ は固定で中くらい。Α=16′ Β=5⅓′ Γ=4′
import { gain, osc, glideTo, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 4;
const MULT = [1, 2, 3, 4];
const levelsOf = (p) => [p.ma, 0.55, p.mb * 0.8, p.mc * 0.7];

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.75);
  const sum = gain(ctx, 1);
  sum.connect(env).connect(out);
  const bars = MULT.map((m) => {
    const o = osc(ctx, 'sine', hz * m);
    const g = gain(ctx, 0);
    o.connect(g).connect(sum);
    return { o, g, m };
  });
  wireDrift(drift, bars.map((b) => b.o.detune));
  const setParams = (q) => {
    const now = ctx.currentTime;
    const lv = levelsOf(q);
    const norm = 1 / Math.max(1, lv.reduce((a, b) => a + b, 0));
    bars.forEach((b, i) => glideTo(b.g.gain, lv[i] * norm, now, 0.08));
  };
  setParams(p);
  const sources = bars.map((b) => b.o);
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => bars.forEach((b) => glideTo(b.o.frequency, f * b.m, at, glide / 3)),
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [sum, ...bars.map((b) => b.g)] }),
  };
}

// R33S — リース・ベース：デチューンしたノコギリ2〜4本。位相が少しずつずれて、うねりが生まれる
// Α=デチューン幅 Β=本数（2〜4） Γ=ローパスの開き
import { gain, osc, lp, rand, glideTo, makeRelease, wireDrift } from './util.js';

export const cost = () => 4;
const countOf = (p) => 2 + Math.round(p.mb * 2);
const cutOf = (p, f) => Math.min(2400, f * (1.5 + p.mc * 12));

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.55);
  const f1 = lp(ctx, cutOf(p, hz), 0.9), f2 = lp(ctx, cutOf(p, hz), 0.6);
  const sum = gain(ctx, 1);
  sum.connect(f1).connect(f2).connect(env).connect(out);
  const saws = [];
  for (let i = 0; i < 4; i++) {
    const o = osc(ctx, 'sawtooth', hz);
    const g = gain(ctx, 0);
    o.connect(g).connect(sum);
    saws.push({ o, g, jitter: rand(-0.3, 0.3) });
  }
  wireDrift(drift, saws.map((s) => s.o.detune));
  const setParams = (q, at = ctx.currentTime) => {
    const n = countOf(q);
    const spread = q.ma * 28;
    saws.forEach((s, i) => {
      const on = i < n;
      const off = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      glideTo(s.g.gain, on ? 1 / Math.sqrt(n) : 0, at, 0.08);
      glideTo(s.o.detune, on ? off * spread + s.jitter : 0, at, 0.1);
    });
    const c = cutOf(q, curHz);
    glideTo(f1.frequency, c, at, 0.08);
    glideTo(f2.frequency, c, at, 0.08);
    curP = q;
  };
  let curHz = hz, curP = p;
  setParams(p, t);
  // 開始位相をずらす
  saws.forEach((s) => s.o.start(t + rand(0, 1 / hz)));
  const sources = saws.map((s) => s.o);
  return {
    setHz: (f, at, glide) => {
      curHz = f;
      saws.forEach((s) => glideTo(s.o.frequency, f, at, glide / 3));
      const c = cutOf(curP, f);
      glideTo(f1.frequency, c, at, glide / 3); glideTo(f2.frequency, c, at, glide / 3);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [f1, f2, sum, ...saws.map((s) => s.g)] }),
  };
}

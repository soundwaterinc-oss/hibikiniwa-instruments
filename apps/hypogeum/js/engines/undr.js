// UNDR — アンダートーン分周（Subharmonicon的）。基音のノコギリに f/2・f/3・f/4 の矩形を混ぜる
// 同時刻に開始するので位相は揃い、分周器と同じ周期関係になる
// Α=f/2量 Β=f/3量 Γ=f/4量
import { gain, osc, lp, clamp, glideTo, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 4;
const DIV = [2, 3, 4];
const cutOf = (f) => clamp(f * 5, 150, 1000);

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.7);
  const f1 = lp(ctx, cutOf(hz)), f2 = lp(ctx, cutOf(hz));
  const sum = gain(ctx, 1);
  sum.connect(f1).connect(f2).connect(env).connect(out);
  const main = osc(ctx, 'sawtooth', hz);
  main.connect(gain(ctx, 0.45)).connect(sum);
  const subs = DIV.map((d) => {
    const o = osc(ctx, 'square', hz / d);
    const g = gain(ctx, 0);
    o.connect(g).connect(sum);
    return { o, g, d };
  });
  wireDrift(drift, [main.detune, ...subs.map((s) => s.o.detune)]);
  const setParams = (q) => {
    const now = ctx.currentTime;
    [q.ma, q.mb, q.mc].forEach((v, i) => glideTo(subs[i].g.gain, v * 0.45, now));
  };
  setParams(p);
  const sources = [main, ...subs.map((s) => s.o)];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      const tc = glide / 3;
      glideTo(main.frequency, f, at, tc);
      subs.forEach((s) => glideTo(s.o.frequency, f / s.d, at, tc));
      glideTo(f1.frequency, cutOf(f), at, tc); glideTo(f2.frequency, cutOf(f), at, tc);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [f1, f2, sum, ...subs.map((s) => s.g)] }),
  };
}

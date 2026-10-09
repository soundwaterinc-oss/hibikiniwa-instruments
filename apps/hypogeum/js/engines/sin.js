// SIN.0 — 純正弦＋2倍音・3倍音、tanh飽和
// Α=2倍音量 Β=飽和 Γ=3倍音量
import { gain, osc, glideTo, shaper, tanhCurve, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 3;
const satOf = (p) => 0.6 + p.mb * 5;

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.4);
  const sum = gain(ctx, 0.75);
  const sat = shaper(ctx, tanhCurve(satOf(p)));
  sum.connect(sat).connect(env).connect(out);
  const o1 = osc(ctx, 'sine', hz), o2 = osc(ctx, 'sine', hz * 2), o3 = osc(ctx, 'sine', hz * 3);
  const g2 = gain(ctx, 0), g3 = gain(ctx, 0);
  o1.connect(sum);
  o2.connect(g2).connect(sum);
  o3.connect(g3).connect(sum);
  wireDrift(drift, [o1.detune, o2.detune, o3.detune]);
  let curSat = satOf(p);
  const setParams = (q) => {
    const now = ctx.currentTime;
    glideTo(g2.gain, q.ma * 0.5, now);
    glideTo(g3.gain, q.mc * 0.35, now);
    const s = satOf(q);
    if (Math.abs(s - curSat) > 0.01) { sat.curve = tanhCurve(s); curSat = s; }
  };
  setParams(p);
  const sources = [o1, o2, o3];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => { glideTo(o1.frequency, f, at, glide / 3); glideTo(o2.frequency, f * 2, at, glide / 3); glideTo(o3.frequency, f * 3, at, glide / 3); },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [sum, sat, g2, g3] }),
  };
}

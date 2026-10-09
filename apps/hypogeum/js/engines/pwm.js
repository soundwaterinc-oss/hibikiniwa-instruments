// PWM — パルス幅変調。ノコギリから、遅らせて反転したノコギリを引くとパルスになる（位相差法）
// 遅延時間＝幅×周期 をLFOで動かす
// Α=パルス幅 Β=PWMの速さ Γ=PWMの深さ
import { gain, osc, lp, clamp, glideTo, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 3;
const widthOf = (p) => 0.05 + p.ma * 0.45;
const depthOf = (p) => { const w = widthOf(p); return p.mc * Math.min(w - 0.02, 0.95 - w); };
const rateOf = (p) => 0.03 + p.mb * 2.5;
const cutOf = (f) => clamp(f * 6, 150, 1200);

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.39);
  const a = osc(ctx, 'sawtooth', hz), b = osc(ctx, 'sawtooth', hz);
  const dl = ctx.createDelay(1);
  const inv = gain(ctx, -1);
  const f1 = lp(ctx, cutOf(hz)), f2 = lp(ctx, cutOf(hz));
  const sum = gain(ctx, 1);
  a.connect(sum);
  b.connect(dl).connect(inv).connect(sum);
  sum.connect(f1).connect(f2).connect(env).connect(out);
  const lfo = osc(ctx, 'sine', rateOf(p));
  const lfoG = gain(ctx, 0);
  lfo.connect(lfoG).connect(dl.delayTime);
  wireDrift(drift, [a.detune, b.detune]);
  let curHz = hz, curP = p;
  const apply = (q, f, at, tc) => {
    glideTo(dl.delayTime, widthOf(q) / f, at, tc);
    glideTo(lfoG.gain, depthOf(q) / f, at, tc);
  };
  const setParams = (q) => {
    const now = ctx.currentTime;
    curP = q;
    apply(q, curHz, now, 0.05);
    glideTo(lfo.frequency, rateOf(q), now, 0.1);
  };
  dl.delayTime.value = widthOf(p) / hz;
  setParams(p);
  const sources = [a, b, lfo];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      curHz = f;
      const tc = glide / 3;
      glideTo(a.frequency, f, at, tc); glideTo(b.frequency, f, at, tc);
      apply(curP, f, at, tc);
      glideTo(f1.frequency, cutOf(f), at, tc); glideTo(f2.frequency, cutOf(f), at, tc);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [dl, inv, f1, f2, sum, lfoG] }),
  };
}

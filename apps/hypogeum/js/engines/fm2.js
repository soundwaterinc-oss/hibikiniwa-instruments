// FM.2 — 2オペレーターFM。モジュレータは正弦と鋸歯状の波を混ぜ、フィードバックFM風の歪みを作る
// Α=変調指数 Β=周波数比（0.5/1/2/3） Γ=フィードバック風の歪み
import { gain, osc, lp, glideTo, harmonicWave, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 3;
export const RATIOS = [0.5, 1, 2, 3];
const ratioOf = (p) => RATIOS[Math.min(3, Math.floor(p.mb * 4))];
const devOf = (p, f) => p.ma * 6 * f * ratioOf(p);
const cutOf = (f) => Math.min(2000, f * 10);

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.5);
  const car = osc(ctx, 'sine', hz);
  const f1 = lp(ctx, cutOf(hz));
  car.connect(f1).connect(env).connect(out);
  const mSin = osc(ctx, 'sine', hz * ratioOf(p));
  const mSaw = osc(ctx, harmonicWave(ctx, 6, 1, 0), hz * ratioOf(p));
  const gSin = gain(ctx, 1), gSaw = gain(ctx, 0);
  const dev = gain(ctx, devOf(p, hz));
  mSin.connect(gSin).connect(dev);
  mSaw.connect(gSaw).connect(dev);
  dev.connect(car.frequency);
  wireDrift(drift, [car.detune, mSin.detune, mSaw.detune]);
  let curHz = hz, curP = p;
  const setParams = (q) => {
    const now = ctx.currentTime;
    curP = q;
    const r = ratioOf(q);
    glideTo(mSin.frequency, curHz * r, now, 0.05);
    glideTo(mSaw.frequency, curHz * r, now, 0.05);
    glideTo(dev.gain, devOf(q, curHz), now, 0.05);
    glideTo(gSin.gain, 1 - q.mc, now, 0.05);
    glideTo(gSaw.gain, q.mc, now, 0.05);
  };
  setParams(p);
  const sources = [car, mSin, mSaw];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      curHz = f;
      const r = ratioOf(curP), tc = glide / 3;
      glideTo(car.frequency, f, at, tc);
      glideTo(mSin.frequency, f * r, at, tc);
      glideTo(mSaw.frequency, f * r, at, tc);
      glideTo(dev.gain, devOf(curP, f), at, tc);
      glideTo(f1.frequency, cutOf(f), at, tc);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [f1, gSin, gSaw, dev] }),
  };
}

// ADD.H — 加算合成（旧KUKURUの持続ボイス）。ユニゾンごとに周期の違う超低速ドリフトを持つ
// Α=明るさ（倍音の傾き） Β=ユニゾンの広がり Γ=飽和
import { gain, osc, rand, clamp, glideTo, harmonicWave, shaper, tanhCurve, makeRelease, startAll } from './util.js';

export const ownDrift = true;
export const cost = (p) => 2 * p.uni;

const rolloffOf = (p) => clamp(p.rho + (0.35 - p.ma) * 1.5, 0.4, 3);
const satOf = (p) => 0.2 + Math.max(0, p.mc - 0.2) * 6;

export function create(ctx, { hz, out, params: p }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.65);
  const sat = shaper(ctx, tanhCurve(satOf(p)));
  const sum = gain(ctx, 0.6);
  sum.connect(sat).connect(env).connect(out);
  const n = p.uni;
  const wave = harmonicWave(ctx, p.hN, rolloffOf(p), p.oe);
  const oscs = [];
  const sources = [];
  for (let u = 0; u < n; u++) {
    const o = osc(ctx, wave, hz);
    const lfo = osc(ctx, 'sine', 0);
    const mult = rand(0.55, 1.6); // マスタークロックを持たない：各々が違う周期で漂う
    const lg = gain(ctx, 0);
    lfo.connect(lg).connect(o.detune);
    const og = gain(ctx, 1 / Math.sqrt(n));
    o.connect(og).connect(sum);
    oscs.push({ o, lfo, lg, og, mult, offset: n === 1 ? 0 : (u / (n - 1)) * 2 - 1 });
    sources.push(o, lfo);
  }
  let curSat = satOf(p);
  const setParams = (q) => {
    const now = ctx.currentTime;
    const w = harmonicWave(ctx, q.hN, rolloffOf(q), q.oe);
    const spread = 0.3 + 2 * q.mb;
    oscs.forEach((x) => {
      x.o.setPeriodicWave(w);
      glideTo(x.o.detune, x.offset * q.dt * spread, now, 0.1);
      glideTo(x.lg.gain, q.dfc, now, 0.1);
      glideTo(x.lfo.frequency, q.dfr * x.mult, now, 0.1);
    });
    const s = satOf(q);
    if (Math.abs(s - curSat) > 0.01) { sat.curve = tanhCurve(s); curSat = s; }
  };
  setParams(p);
  startAll(sources, t + rand(0, 0.03));
  return {
    setHz: (f, at, glide) => oscs.forEach((x) => glideTo(x.o.frequency, f, at, glide / 3)),
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [sat, sum, ...oscs.flatMap((x) => [x.lg, x.og])] }),
  };
}

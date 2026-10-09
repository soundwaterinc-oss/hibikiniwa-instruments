// ADD.H — 加算合成（旧KUKURUの持続ボイス）。ユニゾンごとに周期の違う超低速ドリフトを持つ
// マクロは基準値（H.n / ρ / O/E）からのずれとして効く。0.35 で基準値そのまま
// Α=倍音数 Β=減衰 Γ=奇偶
import { gain, osc, rand, clamp, glideTo, harmonicWave, makeRelease, startAll } from './util.js';

export const ownDrift = true;
export const cost = (p) => 2 * p.uni;

const M0 = 0.35;
export const shape = (p) => ({
  N: Math.round(clamp(p.hN * Math.pow(2, (p.ma - M0) * 3), 1, 64)),
  rolloff: clamp(p.rho + (p.mb - M0) * 1.6, 0.4, 3),
  oddEven: clamp(p.oe + (p.mc - M0) * 1.6, -1, 1),
});

export function create(ctx, { hz, out, params: p }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.62);
  const sum = gain(ctx, 1);
  sum.connect(env).connect(out);
  const n = p.uni;
  const s0 = shape(p);
  const wave = harmonicWave(ctx, s0.N, s0.rolloff, s0.oddEven);
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
  let key = '';
  const setParams = (q) => {
    const now = ctx.currentTime;
    const s = shape(q);
    const k = `${s.N}|${s.rolloff}|${s.oddEven}`;
    const w = k !== key ? harmonicWave(ctx, s.N, s.rolloff, s.oddEven) : null;
    key = k;
    oscs.forEach((x) => {
      if (w) x.o.setPeriodicWave(w);
      glideTo(x.o.detune, x.offset * q.dt, now, 0.1);
      glideTo(x.lg.gain, q.dfc, now, 0.1);
      glideTo(x.lfo.frequency, q.dfr * x.mult, now, 0.1);
    });
  };
  setParams(p);
  startAll(sources, t + rand(0, 0.03));
  return {
    setHz: (f, at, glide) => oscs.forEach((x) => glideTo(x.o.frequency, f, at, glide / 3)),
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [sum, ...oscs.flatMap((x) => [x.lg, x.og])] }),
  };
}

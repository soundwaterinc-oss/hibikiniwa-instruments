// B0W — 擦弦ベース。帯域を絞ったノイズ（弓）で、フィードバック・コム（Karplus-Strongの持続版）を励振し続ける
// ループ内のローパスが生む位相遅れは遅延時間から差し引いて音程を合わせる。ループ内の tanh で発散を防ぐ
// Α=弓圧（ノイズ量） Β=胴鳴り Γ=減衰（大きいほど早く減衰＝こもる）
import { gain, lp, bp, clamp, glideTo, shaper, noiseSource, lpDelay, combDelay, makeRelease, startAll } from './util.js';

export const cost = () => 3;
// 小信号では傾き1、大振幅で 0.5 に飽和
const softCurve = (() => {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = 0.5 * Math.tanh(2 * x); }
  return c;
})();
const loopCut = (f) => Math.min(f * 6, 4000);
const fbOf = (p) => 0.995 - p.mc * 0.12;

export function create(ctx, { hz, out, params: p }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 1);
  const noise = noiseSource(ctx);
  const bow = bp(ctx, hz, 2);
  const exc = gain(ctx, 0);
  const loopIn = gain(ctx, 1);
  const dl = ctx.createDelay(1);
  const damp = lp(ctx, loopCut(hz));
  const sat = shaper(ctx, softCurve);
  const fb = gain(ctx, fbOf(p));
  noise.connect(bow).connect(exc).connect(loopIn);
  loopIn.connect(dl).connect(damp).connect(sat).connect(fb).connect(loopIn);
  // 胴：木の箱の低い共鳴2つ
  const b1 = ctx.createBiquadFilter(); b1.type = 'peaking'; b1.frequency.value = 98; b1.Q.value = 1.4;
  const b2 = ctx.createBiquadFilter(); b2.type = 'peaking'; b2.frequency.value = 210; b2.Q.value = 1.8;
  const tone = lp(ctx, clamp(hz * 8, 200, 2500));
  const outG = gain(ctx, 2.4);
  sat.connect(b1).connect(b2).connect(tone).connect(outG).connect(env).connect(out);

  const delayFor = (f) => combDelay(ctx, f, lpDelay(f, loopCut(f)));
  dl.delayTime.value = delayFor(hz);
  const setParams = (q) => {
    const now = ctx.currentTime;
    glideTo(exc.gain, 0.3 + q.ma * 2.5, now);
    glideTo(b1.gain, q.mb * 9, now);
    glideTo(b2.gain, q.mb * 6, now);
    glideTo(fb.gain, fbOf(q), now);
  };
  setParams(p);
  const sources = [noise];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      const tc = glide / 3;
      glideTo(dl.delayTime, delayFor(f), at, tc);
      glideTo(damp.frequency, loopCut(f), at, tc);
      glideTo(bow.frequency, f, at, tc);
      glideTo(tone.frequency, clamp(f * 8, 200, 2500), at, tc);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [bow, exc, loopIn, dl, damp, sat, fb, b1, b2, tone, outG] }),
  };
}

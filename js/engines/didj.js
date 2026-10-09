// D1DJ — ディジュリドゥ。唇の低いパルス列を、口腔フォルマントの掃引（舌と頬の動き）に通す
// Α=掃引幅 Β=掃引の速さ Γ=唇の詰まり（パルスが細く・明るく・押しつぶされる）
import { gain, osc, lp, bp, clamp, glideTo, shaper, tanhCurve, pulseWave, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 3;
const widthOf = (p) => 0.28 - p.mc * 0.18;
const cutOf = (p, f) => clamp(f * (5 + p.mc * 10), 200, 2500);

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.7);
  let curW = widthOf(p);
  const lips = osc(ctx, pulseWave(ctx, 40, curW), hz);
  const press = shaper(ctx, tanhCurve(1 + p.mc * 3));
  const pre = lp(ctx, cutOf(p, hz));
  lips.connect(press).connect(pre);
  // 乾いた低域
  const dry = gain(ctx, 0.5);
  pre.connect(dry).connect(env);
  // 掃引する口腔フォルマント
  const F = bp(ctx, 520, 3.5);
  const fG = gain(ctx, 1.6);
  pre.connect(F).connect(fG).connect(env);
  const lfo = osc(ctx, 'sine', 0.08 + p.mb * 1.6);
  const lfoG = gain(ctx, p.ma * 1100);
  lfo.connect(lfoG).connect(F.detune);
  // 固定の高いフォルマント（うなり声の倍音）
  const F2 = bp(ctx, 1500, 6);
  const f2G = gain(ctx, 0.25);
  pre.connect(F2).connect(f2G).connect(env);
  env.connect(out);
  wireDrift(drift, [lips.detune]);

  let curHz = hz, curP = p, curK = 1 + p.mc * 3;
  const setParams = (q) => {
    const now = ctx.currentTime;
    curP = q;
    glideTo(lfo.frequency, 0.08 + q.mb * 1.6, now, 0.1);
    glideTo(lfoG.gain, q.ma * 1100, now, 0.1);
    glideTo(pre.frequency, cutOf(q, curHz), now);
    const w = widthOf(q);
    if (Math.abs(w - curW) > 0.01) { lips.setPeriodicWave(pulseWave(ctx, 40, w)); curW = w; }
    const k = 1 + q.mc * 3;
    if (Math.abs(k - curK) > 0.01) { press.curve = tanhCurve(k); curK = k; }
  };
  const sources = [lips, lfo];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      curHz = f;
      glideTo(lips.frequency, f, at, glide / 3);
      glideTo(pre.frequency, cutOf(curP, f), at, glide / 3);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [press, pre, dry, F, fG, lfoG, F2, f2G] }),
  };
}

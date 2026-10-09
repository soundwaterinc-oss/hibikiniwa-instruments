// TAPE — 低域ノイズを共鳴コムで音程化し、テープのワウ（約0.4Hz）とフラッター（約6.5Hz）で遅延時間を揺らす
// Α=共鳴 Β=フラッター（ワウも比例） Γ=帯域（ノイズの明るさ）
import { gain, osc, lp, clamp, glideTo, shaper, tanhCurve, noiseSource, lpDelay, combDelay, makeRelease, startAll } from './util.js';

export const cost = () => 4;
const fbCut = (f) => Math.min(f * 5, 3000);
const bandOf = (p, f) => clamp(f * (1.5 + p.mc * 8), 60, 2500);
const fbOf = (p) => 0.78 + p.ma * 0.19;

export function create(ctx, { hz, out, params: p }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 1);
  const noise = noiseSource(ctx);
  const band = lp(ctx, bandOf(p, hz), 0.9);
  const inG = gain(ctx, 1.2);
  const loopIn = gain(ctx, 1);
  const dl = ctx.createDelay(1);
  const damp = lp(ctx, fbCut(hz));
  const fb = gain(ctx, fbOf(p));
  noise.connect(band).connect(inG).connect(loopIn);
  loopIn.connect(dl).connect(damp).connect(fb).connect(loopIn);
  // ワウ・フラッター：周期に比例した遅延の揺れ＝一定のセント幅の揺れ
  const wow = osc(ctx, 'sine', 0.4), flut = osc(ctx, 'sine', 6.5);
  const wowG = gain(ctx, 0), flutG = gain(ctx, 0);
  wow.connect(wowG).connect(dl.delayTime);
  flut.connect(flutG).connect(dl.delayTime);
  const sat = shaper(ctx, tanhCurve(1.5));
  const tone = lp(ctx, clamp(hz * 6, 150, 2000));
  const outG = gain(ctx, 0.9);
  damp.connect(sat).connect(tone).connect(outG).connect(env).connect(out);

  const delayFor = (f) => combDelay(ctx, f, lpDelay(f, fbCut(f)), 0.012 / f);
  let curHz = hz, curP = p;
  const applyMod = (q, f, at, tc) => {
    glideTo(wowG.gain, (q.mb * 0.012) / f, at, tc);
    glideTo(flutG.gain, (q.mb * 0.004) / f, at, tc);
  };
  dl.delayTime.value = delayFor(hz);
  const setParams = (q) => {
    const now = ctx.currentTime;
    curP = q;
    glideTo(fb.gain, fbOf(q), now);
    glideTo(band.frequency, bandOf(q, curHz), now);
    glideTo(outG.gain, 0.9 * (1.3 - q.ma * 0.6), now);
    applyMod(q, curHz, now, 0.1);
  };
  setParams(p);
  const sources = [noise, wow, flut];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      curHz = f;
      const tc = glide / 3;
      glideTo(dl.delayTime, delayFor(f), at, tc);
      glideTo(damp.frequency, fbCut(f), at, tc);
      glideTo(band.frequency, bandOf(curP, f), at, tc);
      glideTo(tone.frequency, clamp(f * 6, 150, 2000), at, tc);
      applyMod(curP, f, at, tc);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [band, inG, loopIn, dl, damp, fb, wowG, flutG, sat, tone, outG] }),
  };
}

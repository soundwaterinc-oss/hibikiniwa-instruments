// KRG — カルグラ（トゥバ喉歌の低い唸り）。仮声帯が声帯の半分の速さで振動する「周期倍化」を、
// f/2 の正弦による振幅変調と f/2 のノコギリで近似し、母音フォルマントに通す
// Α=母音 o→u→a Β=分周（周期倍化）の量 Γ=ざらつき（声門パルスに同期したノイズ）
import { gain, osc, lp, bp, glideTo, noiseSource, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 5;
// 男性低声の母音フォルマント（F1, F2）の代表値
const O = [450, 800], U = [325, 700], A = [650, 1080];
const lerp = (a, b, x) => a + (b - a) * x;
function vowel(v) {
  const [p, q, x] = v < 0.5 ? [O, U, v * 2] : [U, A, (v - 0.5) * 2];
  return [lerp(p[0], q[0], x), lerp(p[1], q[1], x)];
}

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 1.75);
  const saw = osc(ctx, 'sawtooth', hz);
  const vca = gain(ctx, 0.6);
  const half = osc(ctx, 'sine', hz / 2);
  const halfG = gain(ctx, 0);
  const halfSaw = osc(ctx, 'sawtooth', hz / 2);
  const halfSawG = gain(ctx, 0);
  const src = gain(ctx, 1);
  saw.connect(vca).connect(src);
  half.connect(halfG).connect(vca.gain);
  halfSaw.connect(halfSawG).connect(src);

  // 声門パルスに同期したノイズ（ざらつき）
  const noise = noiseSource(ctx);
  const nVca = gain(ctx, 0);
  const nG = gain(ctx, 0);
  noise.connect(nVca).connect(nG).connect(src);
  saw.connect(nVca.gain);

  // フォルマント＋胴（低域）
  const [v1, v2] = vowel(p.ma);
  const body = lp(ctx, hz * 3);
  const F1 = bp(ctx, v1, 5), F2 = bp(ctx, v2, 6);
  const g1 = gain(ctx, 1.1), g2 = gain(ctx, 0.35), gb = gain(ctx, 0.8);
  const top = lp(ctx, 1500);
  src.connect(body).connect(gb).connect(top);
  src.connect(F1).connect(g1).connect(top);
  src.connect(F2).connect(g2).connect(top);
  top.connect(env).connect(out);

  wireDrift(drift, [saw.detune, half.detune, halfSaw.detune]);
  const setParams = (q) => {
    const now = ctx.currentTime;
    const [a, b] = vowel(q.ma);
    glideTo(F1.frequency, a, now, 0.1);
    glideTo(F2.frequency, b, now, 0.1);
    glideTo(halfG.gain, q.mb * 0.45, now);
    glideTo(halfSawG.gain, q.mb * 0.3, now);
    glideTo(nG.gain, q.mc * 0.5, now);
  };
  setParams(p);
  const sources = [saw, half, halfSaw, noise];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      const tc = glide / 3;
      glideTo(saw.frequency, f, at, tc);
      glideTo(half.frequency, f / 2, at, tc);
      glideTo(halfSaw.frequency, f / 2, at, tc);
      glideTo(body.frequency, f * 3, at, tc);
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [vca, halfG, halfSawG, src, nVca, nG, body, F1, F2, g1, g2, gb, top] }),
  };
}

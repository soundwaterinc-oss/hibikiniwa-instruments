// L4DR — ラダー・ローパスの近似。ノコギリ → (tanh → biquad) × 4段（各極の前で飽和、最後はLPで終わる）
// 本物のラダーは出力から入力への帰還でレゾナンスを作るが、Web Audio の閉路は128サンプル以上の遅延が必要で
// コムフィルターになってしまう。そこで最終段のQでピークを作る
// Α=カットオフ Β=レゾナンス Γ=ドライブ
import { gain, osc, lp, clamp, glideTo, shaper, tanhCurve, makeRelease, startAll, wireDrift } from './util.js';

export const cost = () => 2;
const cutOf = (p, f) => clamp(f * Math.pow(2, p.ma * 6), 40, 4000);
const qOf = (p) => 0.5 + p.mb * 11;
const kOf = (p) => 1 + p.mc * 4;

export function create(ctx, { hz, out, params: p, drift }) {
  const t = ctx.currentTime;
  const env = gain(ctx, 0.6);
  const o = osc(ctx, 'sawtooth', hz);
  const comp = gain(ctx, 1);
  const stages = [];
  let node = o;
  for (let i = 0; i < 4; i++) {
    const f = lp(ctx, cutOf(p, hz), i < 3 ? 0.5 : qOf(p));
    const s = shaper(ctx, tanhCurve(kOf(p)));
    node.connect(s).connect(f);
    node = f;
    stages.push({ f, s });
  }
  node.connect(comp).connect(env).connect(out);
  wireDrift(drift, [o.detune]);
  let curHz = hz, curP = p, curK = kOf(p);
  const setParams = (q) => {
    const now = ctx.currentTime;
    curP = q;
    const c = cutOf(q, curHz);
    stages.forEach((st, i) => {
      glideTo(st.f.frequency, c, now);
      if (i === 3) glideTo(st.f.Q, 20 * Math.log10(qOf(q)), now);
    });
    glideTo(comp.gain, 1 / (1 + q.mb * 2.5), now);
    const k = kOf(q);
    if (Math.abs(k - curK) > 0.01) { stages.forEach((st) => { st.s.curve = tanhCurve(k); }); curK = k; }
  };
  setParams(p);
  const sources = [o];
  startAll(sources, t);
  return {
    setHz: (f, at, glide) => {
      curHz = f;
      glideTo(o.frequency, f, at, glide / 3);
      stages.forEach((st) => glideTo(st.f.frequency, cutOf(curP, f), at, glide / 3));
    },
    setParams,
    release: makeRelease(ctx, { env, sources, nodes: [comp, ...stages.flatMap((s) => [s.f, s.s])] }),
  };
}

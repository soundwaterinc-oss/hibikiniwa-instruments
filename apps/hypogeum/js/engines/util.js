// エンジン共通の部品。各エンジンは
//   create(ctx, { hz, out, params, drift }) → { setHz(hz, t, glide), setParams(p), release(sec, at?) }
// を返す。drift はセント単位の揺らぎ信号（AudioNode）で、オシレータの detune に足す。

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const nyq = (ctx) => ctx.sampleRate * 0.45;

export function gain(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }

export function osc(ctx, type, hz) {
  const o = ctx.createOscillator();
  if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
  o.frequency.value = hz;
  return o;
}

// Web Audio の lowpass / highpass の Q は dB 指定。ここでは線形Q（0.7071=バターワース）で受けて変換する
export const qdb = (qLin) => 20 * Math.log10(qLin);
export function lp(ctx, hz, q = 0.7071) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = clamp(hz, 10, nyq(ctx)); f.Q.value = qdb(q); return f;
}
export function hp(ctx, hz, q = 0.7071) {
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hz; f.Q.value = qdb(q); return f;
}

// 2次ローパス（線形Q）が周波数 f で生む位相遅れ[秒]。フィードバック・コムの音程補正に使う
export function lpDelay(f, fc, q = 0.7071) {
  const x = f / fc;
  return Math.atan2(x / q, 1 - x * x) / (2 * Math.PI * f);
}

// フィードバック経路に入る DelayNode の遅延。Web Audio では閉路の遅延は1レンダー量子（128フレーム）以上が必要なので、
// 周期の整数倍に伸ばして音程（の倍音列）を保つ
export function combDelay(ctx, f, comp = 0, margin = 0) {
  const minD = 128 / ctx.sampleRate + margin + 1e-4;
  let n = 1;
  while (n / f - comp < minD) n++;
  return n / f - comp;
}
export function bp(ctx, hz, q = 1) {
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = clamp(hz, 10, nyq(ctx)); f.Q.value = q; return f;
}

// AudioParam を滑らかに目標へ
export const glideTo = (param, v, t, tc = 0.05) => param.setTargetAtTime(v, t, Math.max(0.001, tc));

// tanh 飽和（k=1でほぼ線形、出力はピーク1に正規化）
const curveCache = new Map();
export function tanhCurve(k = 1, n = 2048) {
  const key = `tanh|${k.toFixed(3)}`;
  if (curveCache.has(key)) return curveCache.get(key);
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
  curveCache.set(key, c);
  return c;
}

export function shaper(ctx, curve) {
  const w = ctx.createWaveShaper();
  w.curve = curve;
  return w;
}

// ループ再生するホワイトノイズ（コンテキストごとに1本を共有）
const noiseCache = new WeakMap();
export function noiseSource(ctx) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * 3.1);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.loopStart = 0;
  return s;
}

// 倍音列の PeriodicWave（コンテキストごとにキャッシュ）
const waveCache = new WeakMap();
export function harmonicWave(ctx, N, rolloff, oddEven) {
  let m = waveCache.get(ctx);
  if (!m) { m = new Map(); waveCache.set(ctx, m); }
  N = Math.round(clamp(N, 1, 64));
  const key = `${N}|${rolloff.toFixed(3)}|${oddEven.toFixed(3)}`;
  if (m.has(key)) return m.get(key);
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  for (let k = 1; k <= N; k++) {
    let a = 1 / Math.pow(k, rolloff);
    if (k > 1) a *= k % 2 ? (oddEven > 0 ? 1 - oddEven : 1) : (oddEven < 0 ? 1 + oddEven : 1);
    imag[k] = a;
  }
  const w = ctx.createPeriodicWave(real, imag);
  if (m.size > 24) m.delete(m.keys().next().value);
  m.set(key, w);
  return w;
}

// 帯域制限したパルス列（ディジュリドゥの唇など）。width: 0..1（小さいほど細いパルス）
export function pulseWave(ctx, N = 40, width = 0.15) {
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  for (let k = 1; k <= N; k++) {
    const hann = 0.5 + 0.5 * Math.cos((Math.PI * k) / (N + 1));
    real[k] = (Math.sin(Math.PI * k * width) / (Math.PI * k)) * hann;
  }
  return ctx.createPeriodicWave(real, imag);
}

// 音源群の後片付け。release(sec, at) で共通に使う
export function makeRelease(ctx, { env, sources, nodes }) {
  let done = false;
  return (sec = 0.05, at = ctx.currentTime) => {
    if (done) return;
    done = true;
    const now = ctx.currentTime;
    const t = Math.max(at, now);
    // 未来の時刻の解放（撥弦）は外側のエンベロープが閉じているので、音源を止めるだけ
    if (t <= now + 0.01) {
      const g = env.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + Math.max(0.01, sec));
    }
    const end = t + sec + 0.1;
    sources.forEach((s) => { try { s.stop(end); } catch { /* 停止済み */ } });
    const last = sources[0];
    if (last) {
      const prev = last.onended;
      last.onended = () => { prev?.(); [...sources, ...nodes, env].forEach((n) => { try { n.disconnect(); } catch { /* noop */ } }); };
    }
  };
}

export function startAll(sources, t) { sources.forEach((s) => s.start(t)); }

// drift（セント信号）を複数の detune へ
export function wireDrift(drift, params) { if (drift) params.forEach((p) => drift.connect(p)); }

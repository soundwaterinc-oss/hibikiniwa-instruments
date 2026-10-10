// マスター段：DCカット → ソフトクリップ（任意）→ ルックアヘッド・リミッター（-1 dBTP 目安）→ メーター
// AudioWorklet を使わず標準ノードだけで組む（ブラウザとオフライン描画の両方で同じ音になるように）
//
//   in ─▶ DC ─┬─▶ dry ───────────┬─▶ sum ─┬─▶ delay(先読み) ─▶ vca ─▶ ceiling ─▶ meter(analyser) ─▶ out
//             └─▶ clip ─▶ wet ───┘        └─▶ ÷4 ─▶ |x| ─▶ LP ─▶ g(e)=min(1,T/e) ─────┘(vca.gain)

export const dbToLin = (db) => Math.pow(10, db / 20);
export const linToDb = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

const SIDE_RANGE = 4; // サイドチェーンが扱える振幅の上限（WaveShaper の入力範囲 ±1 に収めるための縮尺）

function curve(n, f) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = f((i / (n - 1)) * 2 - 1);
  return c;
}

// 天井：0.75までは線形、その上は -1 dBFS（0.891）へ柔らかく収める
export const CEILING = dbToLin(-1);
export const ceilingCurve = () => curve(4096, (x) => {
  const a = Math.abs(x), k = CEILING - 0.75;
  return a < 0.75 ? x : Math.sign(x) * (0.75 + k * Math.tanh((a - 0.75) / k));
});
export const softClipCurve = (amount) => {
  const k = 1 + amount * 8, n = Math.tanh(k);
  return curve(2048, (x) => Math.tanh(k * x) / n);
};

export function createMaster(ctx, { lookahead = 0.005, threshold = -3, release = 0.006, destination = ctx.destination } = {}) {
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const input = g(1);
  const dc = ctx.createBiquadFilter(); dc.type = 'highpass'; dc.frequency.value = 6; dc.Q.value = -3.01;
  const dry = g(1), wet = g(0), sum = g(1);
  const clip = ctx.createWaveShaper(); clip.curve = softClipCurve(0.3);
  input.connect(dc);
  dc.connect(dry).connect(sum);
  dc.connect(clip).connect(wet).connect(sum);

  // 主経路：先読みぶん遅らせる
  const delay = ctx.createDelay(0.05); delay.delayTime.value = lookahead;
  const vca = g(0);
  const ceiling = ctx.createWaveShaper(); ceiling.curve = ceilingCurve();
  const meter = ctx.createAnalyser(); meter.fftSize = 2048; meter.smoothingTimeConstant = 0;
  sum.connect(delay).connect(vca).connect(ceiling).connect(meter);
  if (destination) meter.connect(destination);

  // サイドチェーン：整流 → 平滑 → 利得曲線 → vca.gain
  const side = g(1 / SIDE_RANGE);
  side.channelCount = 1; side.channelCountMode = 'explicit';
  const rect = ctx.createWaveShaper(); rect.curve = curve(2048, (x) => Math.abs(x));
  const smooth = ctx.createBiquadFilter(); smooth.type = 'lowpass'; smooth.frequency.value = 1 / (2 * Math.PI * release); smooth.Q.value = -3.01;
  const peakScale = g(1.57); // 整流平均→ピークの換算（正弦で π/2）
  const gainCurve = ctx.createWaveShaper();
  const T = dbToLin(threshold);
  gainCurve.curve = curve(4096, (x) => (x <= 0 ? 1 : Math.min(1, T / (x * SIDE_RANGE))));
  sum.connect(side).connect(rect).connect(smooth).connect(peakScale).connect(gainCurve).connect(vca.gain);

  const buf = new Float32Array(meter.fftSize);
  let hold = -Infinity, holdAt = 0, clipNode = clip, clipAmt = 0.3;
  return {
    input, output: meter, meter,
    // DRV：0 で素通し。曲線は差し替えず、WaveShaper ごと入れ替える（curve の再代入を禁じる実装があるため）
    setDrive(amount, t = ctx.currentTime) {
      if (amount > 0 && Math.abs(amount - clipAmt) > 1e-3) {
        const next = ctx.createWaveShaper();
        next.curve = softClipCurve(amount);
        dc.connect(next).connect(wet);
        try { dc.disconnect(clipNode); clipNode.disconnect(); } catch { /* noop */ }
        clipNode = next; clipAmt = amount;
      }
      dry.gain.setTargetAtTime(amount > 0 ? 0 : 1, t, 0.02);
      wet.gain.setTargetAtTime(amount > 0 ? 1 / (1 + amount * 1.5) : 0, t, 0.02);
    },
    // メーター値（dBFS）。peakHold は1.5秒保持してから下がる（点滅させない）
    read(now = (globalThis.performance?.now?.() ?? Date.now())) {
      meter.getFloatTimeDomainData(buf);
      let pk = 0, sq = 0;
      for (let i = 0; i < buf.length; i++) { const v = buf[i]; pk = Math.max(pk, Math.abs(v)); sq += v * v; }
      const peak = linToDb(pk), rms = linToDb(Math.sqrt(sq / buf.length));
      if (peak >= hold || now - holdAt > 1500) { hold = peak; holdAt = now; }
      return { peak, rms, hold };
    },
  };
}

// メーター表示（canvas）。値は平滑化し、明滅しない
export function drawMeter(canvas, m, colors) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pos = (db) => Math.max(0, Math.min(1, (db + 60) / 60));
  g.clearRect(0, 0, W, H);
  g.fillStyle = colors.slot; g.fillRect(0, 0, W, H);
  g.fillStyle = colors.cyan; g.fillRect(0, H * 0.15, W * pos(m.rms), H * 0.7);
  g.fillStyle = colors.brass; g.fillRect(W * pos(m.peak) - 1, H * 0.1, 2, H * 0.8);
  g.fillStyle = m.hold > -1.2 ? colors.amber : colors.fg; g.fillRect(W * pos(m.hold) - 1, 0, 2, H);
  g.fillStyle = colors.line;
  for (const db of [-48, -36, -24, -12, -6, -1]) g.fillRect(W * pos(db), H - 3, 1, 3);
}

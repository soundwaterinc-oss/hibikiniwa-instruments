// 音源：スタイル標準のキット（4スタイル×6トラック）と、差し替えられる16音色。サンプルは使わない（すべて合成）
// どれも ctx を受け取る関数なので、ブラウザでもオフライン描画でも同じ音になる
// ev: { aQ（大きさの順位）, eQ（細長さの順位）, per（周長）, tone（向き→音色 0..1 or null）}
// o : { tun（音程倍率）, dc（減衰の倍率）, m1, m2（音色固有のマクロ 0..1）, f0（基音）, scale（セントの配列：音程の量子化先）}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const kits = new WeakMap();

// 共有バッファ（コンテキストごとに1回だけ作る）
export function kit(ctx) {
  let k = kits.get(ctx);
  if (k) return k;
  const sr = ctx.sampleRate;
  const noise = ctx.createBuffer(1, sr * 2, sr);
  { const d = noise.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 4294967296) * 2 - 1; } }
  const bit = ctx.createBuffer(1, sr, sr);
  { const d = bit.getChannelData(0); let v = 1, s = 777; for (let i = 0; i < d.length; i++) { if (i % 37 === 0) { s = (s * 1103515245 + 12345) >>> 0; v = s & 1 ? 1 : -1; } d[i] = v; } }
  const imp = ctx.createBuffer(1, 64, sr); imp.getChannelData(0)[0] = 1;
  // 和音（Dm9風、エレピ的な減衰と揺れ）1.5秒
  const chord = ctx.createBuffer(1, Math.floor(sr * 1.5), sr);
  {
    const d = chord.getChannelData(0), notes = [146.83, 174.61, 220, 261.63, 329.63];
    for (let i = 0; i < d.length; i++) { const t = i / sr; let s = 0; notes.forEach((f, j) => { s += Math.sin(2 * Math.PI * f * t + 0.6 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 3)) * (1 - j * 0.12); }); d[i] = s * 0.22 * Math.exp(-t * 0.9) * (1 + 0.15 * Math.sin(2 * Math.PI * 4.6 * t)); }
  }
  // BDM のチョップ用：合成した1小節のループ（88BPM、エレピの和音＋ベース＋ゴースト打楽器）
  const barSec = (4 * 60) / 88;
  const loop = ctx.createBuffer(1, Math.floor(sr * barSec), sr);
  {
    const d = loop.getChannelData(0), chords = [[146.83, 174.61, 220, 261.63], [130.81, 164.81, 196, 246.94]];
    for (let i = 0; i < d.length; i++) {
      const t = i / sr, half = t < barSec / 2 ? 0 : 1, tl = t - half * (barSec / 2);
      let s = 0;
      chords[half].forEach((f, j) => { s += Math.sin(2 * Math.PI * f * t + 0.5 * Math.sin(2 * Math.PI * f * t) * Math.exp(-tl * 4)) * (1 - j * 0.15); });
      s *= 0.18 * Math.exp(-tl * 1.2);
      const bf = half ? 65.41 : 73.42;
      s += 0.25 * Math.sin(2 * Math.PI * bf * t) * Math.exp(-((tl % (barSec / 4)) * 3));
      d[i] = s;
    }
  }
  k = { noise, bit, imp, chord, loop, loopSec: barSec, drive: null };
  kits.set(ctx, k);
  return k;
}

// ── 部品 ──
function vca(ctx, t, peak, atk, dcy, dest) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + Math.max(0.0005, atk));
  g.gain.setTargetAtTime(0, t + atk, Math.max(0.002, dcy / 4));
  g.connect(dest);
  return g;
}
function tone(ctx, t, type, f0, f1, pd, peak, atk, dcy, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + Math.max(0.001, pd));
  o.connect(vca(ctx, t, peak, atk, dcy, dest));
  o.start(t); o.stop(t + atk + dcy * 1.2 + 0.05);
  return o;
}
let rngState = 99;
const rnd = () => { rngState = (rngState * 1103515245 + 12345) >>> 0; return rngState / 4294967296; };
export const reseedVoices = (s) => { rngState = s >>> 0; };
function noise(ctx, t, ftype, f, Q, peak, atk, dcy, dest, buf, gate = 0) {
  const k = kit(ctx);
  buf = buf || k.noise;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const off = rnd() * Math.max(0, buf.duration - 0.6);
  let node = s;
  if (ftype) { const fl = ctx.createBiquadFilter(); fl.type = ftype; fl.frequency.value = clamp(f, 20, ctx.sampleRate * 0.45); fl.Q.value = Q; s.connect(fl); node = fl; }
  if (gate) { const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.setValueAtTime(0, t + gate); node.connect(g).connect(dest); }
  else node.connect(vca(ctx, t, peak, atk, dcy, dest));
  s.start(t, off); s.stop(t + (gate || atk + dcy * 1.2) + 0.05);
}
function driveTo(ctx, dest, amt = 2.5) {
  const w = ctx.createWaveShaper();
  const c = new Float32Array(1024), n = Math.tanh(amt);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * amt) / n; }
  w.curve = c; w.connect(dest);
  return w;
}
function modal(ctx, t, f, ratios, amps, decays, peak, dest) {
  ratios.forEach((r, i) => tone(ctx, t, 'sine', f * r, f * r, 0, peak * amps[i], 0.001, decays[i], dest));
}
// 音程の量子化：細胞が小さいほど高い度数。scale（セント）が来ていればその音階、なければ五音音階
const PENT = [0, 300, 500, 700, 1000, 1200, 1500, 1700];
export function degreeHz(base, aQ, o, span = 1) {
  const sc = o.scale && o.scale.length ? [...o.scale, ...o.scale.map((c) => c + 1200)] : PENT;
  const i = Math.min(sc.length - 1, Math.floor((1 - aQ) * Math.min(sc.length, 5 * span)));
  return base * Math.pow(2, sc[i] / 1200) * o.tun;
}

// ── 16音色 ──
// 各音色の単発ピークがおおよそ 0.15〜0.4 になるよう trim を合わせてある（scripts/smoke.mjs で計測）
// NAT はスタイル標準キット全体に掛ける共通の補正（トラックごとの釣り合いは styles.js の trim）
export const MODEL_TRIM = { NAT: 0.29, K808: 0.085, FMK: 0.27, MBR: 0.15, WOD: 0.165, GLS: 0.135, KLM: 0.175, MTL: 0.19, SNP: 1.23, SUB: 0.11, GRN: 0.067, VOX: 1.28, DRP: 0.27, LEF: 0.6, IMP: 0.3, BIT: 0.28 };

export function playModel(ctx, m, t, vel, out, ev, o) {
  const { aQ = 0.5, eQ = 0.5 } = ev;
  const m1 = o.m1 ?? 0.5, m2 = ev.tone ?? o.m2 ?? 0.5, tun = o.tun, dc = o.dc;
  vel *= MODEL_TRIM[m] || 1;
  switch (m) {
    case 'K808': tone(ctx, t, 'sine', (60 + m2 * 40) * tun, 42 * tun, 0.09, vel, 0.002, 1.4 * dc, driveTo(ctx, out, 1 + m1 * 4)); break;
    case 'FMK': {
      const c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain();
      c.frequency.setValueAtTime(170 * tun, t); c.frequency.exponentialRampToValueAtTime(48 * tun, t + 0.07);
      mo.frequency.setValueAtTime(170 * tun * 1.4, t); mo.frequency.exponentialRampToValueAtTime(48 * tun * 1.4, t + 0.07);
      mg.gain.setValueAtTime(300 + (m1 + eQ) * 900, t); mg.gain.setTargetAtTime(0, t, 0.006 + (1 - m2) * 0.025);
      mo.connect(mg).connect(c.frequency); c.connect(vca(ctx, t, vel, 0.001, 0.45 * dc, out));
      c.start(t); mo.start(t); c.stop(t + 0.5 * dc + 0.1); mo.stop(t + 0.5 * dc + 0.1); break;
    }
    case 'MBR': { const f = (70 + (1 - aQ) * 120 + m1 * 80) * tun; modal(ctx, t, f, [1, 1.59, 2.14, 2.3, 2.65], [1, 0.5, 0.35, 0.25, 0.2], [0.55, 0.32, 0.22, 0.16, 0.12].map((d) => d * dc * (0.5 + m2)), vel, out); noise(ctx, t, 'bandpass', 1100, 1, vel * 0.3, 0.001, 0.03, out); break; }
    case 'WOD': { const f = (300 + (1 - aQ) * 800 + m2 * 400) * tun; modal(ctx, t, f, [1, 2.76, 5.4], [1, 0.3 + m1 * 0.5, 0.1 + m1 * 0.3], [0.13, 0.05, 0.03].map((d) => d * dc), vel, out); break; }
    case 'GLS': { const f = (520 + (1 - aQ) * 1500) * tun, k = 1 + (m1 - 0.5) * 0.3; modal(ctx, t, f, [1, 2.32 * k, 4.25 * k, 6.63 * k], [1, 0.6, 0.35, 0.2], [1.8, 1.2, 0.7, 0.4].map((d) => d * dc * (0.4 + m2 * 1.2)), vel, out); break; }
    case 'KLM': { const f = degreeHz(220 * (m2 > 0.66 ? 2 : m2 < 0.33 ? 0.5 : 1), aQ, o, 2); modal(ctx, t, f, [1, 5.95, 1.003 + m1 * 0.01], [1, 0.3, m1 * 0.6], [0.9 * dc, 0.07, 0.9 * dc], vel, out); break; }
    case 'MTL': {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = (6000 + m2 * 6000) * tun; bp.Q.value = 0.8;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000 + m2 * 3000;
      const env = vca(ctx, t, vel, 0.001, (0.04 + (eQ * 0.5 + m1 * 0.5) * 0.7) * dc, out); bp.connect(hp).connect(env);
      for (const f of [205.3, 304.4, 369.6, 522.7, 800, 540]) { const os = ctx.createOscillator(); os.type = 'square'; os.frequency.value = f * (1 + aQ * 0.3) * tun; os.connect(bp); os.start(t); os.stop(t + 0.8 * dc + 0.1); }
      break;
    }
    case 'SNP': { const gap = 0.006 + m1 * 0.01; for (let k = 0; k < 3; k++) noise(ctx, t + k * gap, 'bandpass', 1500 * tun, 1.4, vel * 0.5, 0.001, 0.012, out); noise(ctx, t + gap * 3, 'bandpass', 1300 * tun, 1, vel * 0.45, 0.001, (0.06 + m2 * 0.2) * dc, out); break; }
    case 'SUB': { const f = degreeHz(o.f0 || 41.2, aQ, o); tone(ctx, t, 'sine', f * (1 + m1), f, 0.05, vel, 0.004, 0.8 * dc, driveTo(ctx, out, 1 + m2 * 3)); break; }
    case 'GRN': {
      const k = kit(ctx), len = (0.04 + aQ * 0.1 + m1 * 0.15), rate = (0.5 * 2 ** Math.floor((1 - aQ) * 3)) * (0.75 + m2 * 0.5) * tun, off = rnd() * 1.1;
      const s = ctx.createBufferSource(); s.buffer = k.chord; s.playbackRate.value = rate;
      // 和音のバッファは exp(-0.9t) で減衰しているので、切り出し位置ぶんの減衰を打ち消して音量をそろえる
      const comp = Math.exp(0.9 * off);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * comp, t + 0.01); g.gain.setTargetAtTime(0, t + len * 0.6, len * 0.3 * dc);
      s.connect(g).connect(out); s.start(t, off, len * 3 * rate); break;
    }
    case 'VOX': {
      const V = [[800, 1150], [400, 800], [350, 2000], [450, 800], [325, 700]][Math.min(4, Math.floor(clamp(m1 * 0.5 + eQ * 0.5, 0, 0.999) * 5))];
      for (const [i, f] of V.entries()) noise(ctx, t, 'bandpass', f * tun, 9 - m2 * 6, vel * (i ? 0.6 : 1), 0.025, 0.28 * dc, out);
      break;
    }
    case 'DRP': { const f = (480 + (1 - aQ) * 900) * tun; tone(ctx, t, 'sine', f, f * (1.3 + m1 * 2), 0.03, vel, 0.001, (0.04 + m2 * 0.1) * dc, out); break; }
    case 'LEF': { const n = 3 + Math.floor((eQ + m1) * 5); for (let k = 0; k < n; k++) noise(ctx, t + rnd() * 0.12 * dc, 'bandpass', (2000 + m2 * 2500 + rnd() * 3800) * tun, 3, vel * (0.4 + rnd() * 0.6), 0.0005, 0.006, out); break; }
    case 'IMP': {
      const k = kit(ctx); const s = ctx.createBufferSource(); s.buffer = k.imp;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (800 + m1 * 6000) * tun; f.Q.value = 0.7 + m2 * 20;
      const g = ctx.createGain(); g.gain.value = vel * (8 + m2 * 30); s.connect(f).connect(g).connect(out); s.start(t); break;
    }
    case 'BIT': { const k = kit(ctx); const s = ctx.createBufferSource(); s.buffer = k.bit; s.playbackRate.value = 0.5 + m2 * 1.5; const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.setValueAtTime(0, t + (0.01 + m1 * 0.06) * dc); s.connect(g).connect(out); s.start(t, rnd() * 0.5); s.stop(t + 0.2); break; }
    default: break;
  }
}

// ── スタイル標準のキット ── fx: 投げ（throw）用のバス
export function playNative(ctx, style, v, t, vel, out, ev, o, fx) {
  const { aQ = 0.5, eQ = 0.5 } = ev;
  const tun = o.tun, dc = o.dc * (0.6 + (o.m2 ?? 0.5) * 0.8), br = 0.6 + (o.m1 ?? 0.5) * 0.8;
  if (style === 'TWL') {
    if (v === 0) { tone(ctx, t, 'sine', 125 * tun, 41 * tun, 0.13, vel * 0.95, 0.003, 0.95 * dc, out); noise(ctx, t, 'lowpass', 900 * br, 0.7, vel * 0.18, 0.001, 0.02, out); }
    if (v === 1) { const f = degreeHz(66, aQ, o); tone(ctx, t, 'sine', f * 1.35, f, 0.06, vel * 0.7, 0.004, 0.42 * dc, out); noise(ctx, t, 'bandpass', 280 * br, 1.2, vel * 0.25, 0.002, 0.08, out); }
    if (v === 2) { noise(ctx, t, 'bandpass', 1300 * tun * br, 0.9, vel * 0.55, 0.001, 0.11 * dc, out); noise(ctx, t, 'bandpass', 3600 * tun * br, 2.5, vel * 0.3, 0.004, 0.28 * dc, out); }
    if (v === 3) { noise(ctx, t, 'bandpass', 8500 * tun * br, 1.5, vel * 0.45, 0.002, 0.06 * dc, out); noise(ctx, t, 'highpass', 11000, 0.7, vel * 0.2, 0.012, 0.05 * dc, out); }
    if (v === 4) tone(ctx, t, 'triangle', 820 * tun * br, 760 * tun * br, 0.02, vel * 0.35, 0.001, 0.03 * dc, out);
    if (v === 5) { const th = ctx.createGain(); th.connect(fx.throwBus); noise(ctx, t, 'bandpass', (600 + eQ * 2400) * br, 3, vel * 0.5, 0.005, 0.12 * dc, th); noise(ctx, t, 'bandpass', (600 + eQ * 2400) * br, 3, vel * 0.2, 0.005, 0.12 * dc, out); }
  } else if (style === 'IKD') {
    if (v === 0) tone(ctx, t, 'sine', 50 * tun, 50 * tun, 0, vel * 0.9, 0.0015, 0.09 * dc, out);
    if (v === 1) { const f = 1000 * 2 ** ((1 - aQ) * 3) * tun * br; tone(ctx, t, 'sine', f, f, 0, vel * 0.22, 0.0008, 0.035 * dc, out); }
    if (v === 2) noise(ctx, t, null, 0, 0, vel * 0.32, 0, 0, out, null, 0.012 + eQ * 0.03 * dc);
    if (v === 3) { const f = (10000 + aQ * 6000) * tun * Math.min(1.2, br); tone(ctx, t, 'sine', f, f, 0, vel * 0.1, 0.0005, 0.006 * dc, out); }
    if (v === 4) { const k = kit(ctx), s = ctx.createBufferSource(); s.buffer = k.imp; const g = ctx.createGain(); g.gain.value = vel * 0.9; s.connect(g).connect(out); s.start(t); }
    if (v === 5) noise(ctx, t, null, 0, 0, vel * 0.16, 0, 0, out, kit(ctx).bit, 0.02 * dc);
  } else if (style === 'BDM') {
    if (v === 0) { tone(ctx, t, 'sine', 95 * tun, 47 * tun, 0.09, vel * 0.95, 0.004, 0.5 * dc, out); noise(ctx, t, 'lowpass', 300 * br, 0.8, vel * 0.3, 0.003, 0.05, out); }
    if (v === 1) {
      // 合成ループのチョップ：16分割のどこを鳴らすかを細胞の大きさで選ぶ
      const k = kit(ctx), slice = Math.floor((1 - aQ) * 15.99), sl = k.loopSec / 16;
      const s = ctx.createBufferSource(); s.buffer = k.loop; s.playbackRate.value = tun;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + br * 1800;
      const g = ctx.createGain(); const len = sl * (1 + Math.round(eQ * 2)) * dc;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.9, t + 0.004); g.gain.setValueAtTime(vel * 0.9, t + Math.max(0.01, len - 0.01)); g.gain.linearRampToValueAtTime(0, t + len);
      s.connect(lp).connect(g).connect(out); s.start(t, slice * sl, len + 0.02);
    }
    if (v === 2) { noise(ctx, t, 'bandpass', 1750 * tun * br, 0.7, vel * 0.55, 0.002, 0.2 * dc, out); tone(ctx, t, 'triangle', 190 * tun, 160 * tun, 0.05, vel * 0.35, 0.002, 0.08, out); for (let k = 0; k < 3; k++) noise(ctx, t + k * 0.011, 'bandpass', 1200, 1.5, vel * 0.25, 0.001, 0.02, out); }
    if (v === 3) noise(ctx, t, 'highpass', 7600 * tun * br, 0.8, vel * (0.75 + rnd() * 0.5) * 0.32, 0.001, 0.045 * dc, out);
    if (v === 4) { tone(ctx, t, 'triangle', 1700 * tun * br, 1650 * tun * br, 0.01, vel * 0.3, 0.001, 0.03 * dc, out); noise(ctx, t, 'bandpass', 2500, 2, vel * 0.25, 0.001, 0.02, out); }
    if (v === 5) noise(ctx, t, 'bandpass', 4200 * tun * br, 1, vel * 0.26, 0.012, 0.07 * dc, out);
  } else {
    if (v === 0) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600 * br; lp.connect(out); tone(ctx, t, 'sine', 72 * tun, 50 * tun, 0.05, vel * 0.7, 0.003, 0.26 * dc, lp); }
    if (v === 1) {
      // グラニュラー：粒の長さ＝細胞の周長（基準座標の px を ms に）
      const k = kit(ctx), grain = clamp((ev.per || 50) / 1000, 0.012, 0.12) * dc, n = 2 + Math.round(eQ * 4);
      const rate = (0.5 * 2 ** Math.floor((1 - aQ) * 3)) * tun, off = rnd() * 1.2;
      for (let j = 0; j < n; j++) {
        const s = ctx.createBufferSource(); s.buffer = k.chord; s.playbackRate.value = rate;
        const g = ctx.createGain(), tt = t + j * grain * 0.7;
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(vel * 0.7 * (1 - j * 0.12), tt + grain * 0.3); g.gain.linearRampToValueAtTime(0, tt + grain);
        s.connect(g).connect(out); s.start(tt, off + j * grain * 0.15, grain * rate + 0.01);
      }
    }
    if (v === 2) noise(ctx, t, 'bandpass', 2400 * tun * br, 1.2, vel * 0.3, 0.001, 0.05 * dc, out);
    if (v === 3) noise(ctx, t, 'highpass', 9000 * tun, 0.7, vel * 0.22, 0.0005, 0.004 * dc, out);
    if (v === 4) { const k = kit(ctx), s = ctx.createBufferSource(); s.buffer = k.imp; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + rnd() * 5000; f.Q.value = 6; const g = ctx.createGain(); g.gain.value = vel * 4; s.connect(f).connect(g).connect(out); s.start(t); }
    if (v === 5) for (let k = 0; k < 3; k++) noise(ctx, t + k * (o.stepDur || 0.03), 'bandpass', 800 * tun, 4, vel * 0.3 * (1 - k * 0.25), 0.001, 0.025 * dc, out);
  }
}

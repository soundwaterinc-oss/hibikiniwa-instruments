// HYPOGEUM // KKR-40 — 低域ドローン音響エンジン（Web Audio API、依存ライブラリなし）
//
// 信号経路
//   voices(ENG) ─▶ voiceBus ─▶ LP.ω ─▶ amGain(Γ.hz AM) ─▶ breathGain ─┬─▶ dry ─────────────┐
//                                                                     ├─▶ convolver ─▶ wet ┤
//                                                                     └─▶ delay(+fb) ─▶ dly┤
//                                                                                 musicBus ◀┘
//   musicBus ─▶ DCカット ─▶ HPF.ω(24dB/oct) ─┬─▶ LR4 LP ─▶ モノ加算 ─────────────┬─▶ postMono ─┬──────────┐
//                                           └─▶ LR4 HP ─▶ M/S幅(W.st) ─────────┘             │          │
//                                              PSY.h: 低域抽出 ─▶ 2・3倍音生成 ─▶ HP ─────────┘(加算)     │
//   isochronic / binaural ─▶ therapyBus（モノ化・残響を通さない＝左右差を保つ）──────────────────────────────┤
//                                                       mix ◀──────────────────────────────────────────────┘
//   mix ─▶ sessionGain ─▶ volume ─▶ DRV(ソフトクリップ) ─▶ limiter ─▶ ceiling(≤0.95) ─▶ analyser ─▶ out
import { getScale, parsePitchList, nearestFifthIndex } from './scales.js';
import { DEFAULTS, PARAM_BY_KEY, normalizeImport, sanitize } from './params.js';
import { getEngine, VOICE_BUDGET } from './engines/index.js';
import { lp, hp, tanhCurve } from './engines/util.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);

// 天井：0.8までは線形、その上は 0.93 へ柔らかく収める（ピーク≤0.95の保証）
const CEILING = (() => {
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    c[i] = a < 0.8 ? x : Math.sign(x) * (0.8 + 0.15 * Math.tanh((a - 0.8) / 0.15));
  }
  return c;
})();

// PSY.h：低域から2倍音（x²）と3倍音（x³）を作る。直流は後段のHPで除く
const PSY_CURVE = (() => {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = 0.7 * x * x + 0.6 * x * x * x; }
  return c;
})();

export class DroneEngine {
  constructor() {
    this.p = structuredClone(DEFAULTS);
    this.ctx = null;
    this.running = false;
    this.voices = [];
    this.voiceSig = '';
    this.listeners = new Set();
    this.startTime = 0;
    this.breath = { anchor: 0, period: 0, inhale: 0, next: 0 };
    this.nextPluck = 0;
    this.pluckIndex = 0;
    this.stopping = false;
    this.voiceInfo = { used: 0, wanted: 0 };
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { this.listeners.forEach((fn) => fn(type, data)); }

  // ── 初期化（ユーザー操作の中で呼ぶ）。ctx を渡すとオフライン描画などにも使える ──
  init(ctx = null, { scheduler = true } = {}) {
    if (this.ctx) return;
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      ctx = new AC({ latencyHint: 'playback' });
    }
    this.ctx = ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    this.voiceBus = g(1);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.amGain = g(1);
    this.breathGain = g(1);
    this.dry = g(1);
    this.reverbSend = g(0);
    this.convolver = ctx.createConvolver();
    this.delaySend = g(0);
    this.delay = ctx.createDelay(4);
    this.delayFb = g(0);
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.delayTone.frequency.value = 2400;
    this.musicBus = g(1);

    this.voiceBus.connect(this.filter).connect(this.amGain).connect(this.breathGain);
    this.breathGain.connect(this.dry).connect(this.musicBus);
    this.breathGain.connect(this.reverbSend).connect(this.convolver).connect(this.musicBus);
    this.breathGain.connect(this.delaySend).connect(this.delay);
    this.delay.connect(this.delayTone).connect(this.delayFb).connect(this.delay);
    this.delayTone.connect(this.musicBus);

    // ── 低域マスター ──
    this.dcCut = hp(ctx, 8);
    this.hpfA = hp(ctx, this.p.hpf, 0.5412); // 4次バターワース = Q 0.5412 と 1.3066 の2段
    this.hpfB = hp(ctx, this.p.hpf, 1.3066);
    this.musicBus.connect(this.dcCut).connect(this.hpfA).connect(this.hpfB);

    // LR4クロスオーバー（バターワース2段×2）。低域は左右を加算してモノ、高域だけM/Sで幅を付ける
    this.xLowA = lp(ctx, this.p.monoX); this.xLowB = lp(ctx, this.p.monoX);
    this.xHighA = hp(ctx, this.p.monoX); this.xHighB = hp(ctx, this.p.monoX);
    this.monoSum = g(1);
    this.monoSum.channelCount = 1;
    this.monoSum.channelCountMode = 'explicit';
    this.monoSum.channelInterpretation = 'speakers';
    this.postMono = g(1);
    this.hpfB.connect(this.xLowA).connect(this.xLowB).connect(this.monoSum).connect(this.postMono);
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    this.wLL = g(1); this.wRL = g(0); this.wRR = g(1); this.wLR = g(0);
    this.hpfB.connect(this.xHighA).connect(this.xHighB).connect(split);
    split.connect(this.wLL, 0); this.wLL.connect(merge, 0, 0);
    split.connect(this.wRL, 1); this.wRL.connect(merge, 0, 0);
    split.connect(this.wRR, 1); this.wRR.connect(merge, 0, 1);
    split.connect(this.wLR, 0); this.wLR.connect(merge, 0, 1);
    merge.connect(this.postMono);

    // PSY.h：ミッシング・ファンダメンタル（低域の2・3倍音を足し、小型スピーカーでも基音を感じさせる）
    this.mix = g(1);
    this.postMono.connect(this.mix);
    this.psyIn = g(2.5);
    this.psyIn.channelCount = 1;
    this.psyIn.channelCountMode = 'explicit';
    this.psyLp = lp(ctx, 150);
    this.psyShape = ctx.createWaveShaper();
    this.psyShape.curve = PSY_CURVE;
    this.psyHpA = hp(ctx, 90); this.psyHpB = hp(ctx, 90);
    this.psyGain = g(0);
    this.postMono.connect(this.psyIn).connect(this.psyLp).connect(this.psyShape)
      .connect(this.psyHpA).connect(this.psyHpB).connect(this.psyGain).connect(this.mix);

    this.therapyBus = g(1);
    this.therapyBus.connect(this.mix);

    this.sessionGain = g(0);
    this.volumeGain = g(0.5);
    // DRV：オフのときは素通し、オンのときはソフトクリップ側へ切り替える
    this.driveDry = g(1);
    this.driveWet = g(0);
    this.driveShaper = ctx.createWaveShaper();
    this.driveShaper.curve = tanhCurve(1);
    this.driveSum = g(1);
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 2;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.3;
    this.ceiling = ctx.createWaveShaper();
    this.ceiling.curve = CEILING;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 16384;
    this.analyser.smoothingTimeConstant = 0.88;
    this.mix.connect(this.sessionGain).connect(this.volumeGain);
    this.volumeGain.connect(this.driveDry).connect(this.driveSum);
    this.volumeGain.connect(this.driveShaper).connect(this.driveWet).connect(this.driveSum);
    this.driveSum.connect(this.limiter).connect(this.ceiling).connect(this.analyser).connect(ctx.destination);

    // 療法用LFO（AM・アイソクロニックで共有し位相を揃える）
    this.therapyLfo = ctx.createOscillator();
    this.amLfoGain = g(0);
    this.isoLfoGain = g(0.5);
    this.therapyLfo.connect(this.amLfoGain).connect(this.amGain.gain);

    // アイソクロニック音：キャリア正弦をΓ.hzでゲート
    this.isoOsc = ctx.createOscillator();
    this.isoGate = g(0.5);
    this.isoLevel = g(0);
    this.isoOsc.connect(this.isoGate).connect(this.isoLevel).connect(this.therapyBus);
    this.therapyLfo.connect(this.isoLfoGain).connect(this.isoGate.gain);

    // バイノーラル：左右で Γ.hz だけずらした正弦
    this.binL = ctx.createOscillator();
    this.binR = ctx.createOscillator();
    const bm = ctx.createChannelMerger(2);
    this.binLevel = g(0);
    this.binL.connect(bm, 0, 0);
    this.binR.connect(bm, 0, 1);
    bm.connect(this.binLevel).connect(this.therapyBus);

    [this.therapyLfo, this.isoOsc, this.binL, this.binR].forEach((o) => o.start());
    this.buildImpulse();
    this.applyAll(true);
    if (scheduler) this.timer = setInterval(() => this.tick(), 200);
  }

  dispose() { clearInterval(this.timer); clearTimeout(this.stopTimer); clearTimeout(this.irTimer); }

  // ── 音階・ボイス構成 ────────────────────────
  scaleCents() {
    if (this.p.scl === 'custom') {
      const c = parsePitchList(this.p.cst || '');
      return c.length ? c : [0];
    }
    return getScale(this.p.scl).cents;
  }

  scaleLabels() {
    const s = this.p.scl === 'custom' ? null : getScale(this.p.scl);
    const cents = this.scaleCents();
    return s?.labels && s.labels.length === cents.length ? s.labels : cents.map((c) => `${Math.round(c)}`);
  }

  activeDegrees() {
    const cents = this.scaleCents();
    const valid = (this.p.deg || []).filter((i) => i >= 0 && i < cents.length);
    return valid.length ? [...new Set(valid)].sort((a, b) => a - b) : [0];
  }

  baseHz() { return this.p.f0 * Math.pow(2, this.p.dc / 1200); }

  // 1ボイスあたりの音源コスト（エンジンの発音体＋揺らぎLFO）
  voiceCost() {
    const mod = getEngine(this.p.eng);
    return mod.cost(this.p) + (mod.ownDrift ? 1 : 2);
  }

  // 鳴らすボイスの仕様（周波数比・重み・定位）。CPU上限を超える分は優先度の低い順に落とす
  voiceSpecs() {
    const cents = this.scaleCents();
    const deg = this.activeDegrees();
    const n = deg.length;
    const pan = (i) => (n === 1 ? 0 : (i / (n - 1)) * 2 - 1);
    const main = deg.map((d, i) => ({ id: `d${d}`, cents: cents[d], oct: 0, w: 1, pan: pan(i) }));
    const sub = { id: 'sub', cents: 0, oct: -1, w: this.p.subK, pan: 0 };
    const upper = deg.map((d, i) => ({ id: `u${d}`, cents: cents[d], oct: 1, w: this.p.hiK, pan: -pan(i) }));
    const all = [main[0], sub, ...main.slice(1), ...upper];
    const max = Math.max(2, Math.floor(VOICE_BUDGET / this.voiceCost()));
    this.voiceInfo = { used: Math.min(max, all.length), wanted: all.length };
    return all.slice(0, max);
  }

  specHz(s) { return this.baseHz() * Math.pow(2, s.cents / 1200 + s.oct); }

  levelFor(s) {
    const n = this.activeDegrees().length;
    return (s.w / Math.sqrt(n + 1)) * 0.5;
  }

  // 構成が変わったらクロスフェードで差し替え、同じなら周波数だけ滑らかに動かす
  syncVoices(glide = 0.6) {
    if (!this.ctx) return;
    const specs = this.voiceSpecs();
    const p = this.p;
    const sig = `${specs.map((s) => s.id).join(',')}|${p.uni}|${p.exc}|${p.scl}|${p.cst}|${p.eng}`;
    const sustain = p.exc !== 'tanpura';
    if (sig === this.voiceSig && this.voices.length) {
      const t = this.ctx.currentTime;
      this.voices.forEach((v, i) => v.update(specs[i], this.specHz(specs[i]), this.levelFor(specs[i]), t, glide));
      return;
    }
    this.voiceSig = sig;
    const old = this.voices;
    old.forEach((v) => v.release(2.5));
    this.voices = sustain ? specs.map((s) => new Voice(this, s, this.specHz(s), this.levelFor(s))) : [];
    this.emit('voices', { specs, ...this.voiceInfo });
  }

  // ── パラメータ適用 ───────────────────────────
  set(key, value) {
    if (key === 'scl' && value !== this.p.scl) {
      this.p.scl = value;
      this.p.deg = this.defaultDegrees();
    } else {
      this.p[key] = key in PARAM_BY_KEY ? sanitize(key, value) : value;
    }
    if (this.ctx) this.applyKey(key);
    this.emit('param', { key, value: this.p[key] });
  }

  defaultDegrees() {
    const c = this.scaleCents();
    const f = nearestFifthIndex(c);
    return f > 0 ? [0, f] : c.length > 2 ? [0, Math.floor(c.length / 2)] : [0];
  }

  applyAll() {
    this.syncVoices(); // 先にボイス構成を新しい設定へ合わせる
    ['lpw', 'therapy', 'space', 'session', 'master', 'wid'].forEach((k) => this.applyKey(k));
    this.resetBreath();
  }

  applyKey(key) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const p = this.p;
    const set = (param, v, tc = 0.08) => param.setTargetAtTime(v, t, tc);
    const group = PARAM_BY_KEY[key]?.group || key;

    if (['f0', 'dc', 'subK', 'hiK', 'deg', 'scl', 'cst', 'uni', 'exc', 'eng'].includes(key)) {
      this.syncVoices(key === 'f0' || key === 'dc' ? 0.25 : 0.8);
      if (p.carL === 'on' || key === 'f0' || key === 'dc') this.applyKey('therapy');
      if (key === 'exc') { this.nextPluck = ctx.currentTime + 0.05; this.pluckIndex = 0; }
      return;
    }
    if (group === 'gen') {
      set(this.filter.frequency, p.lpw);
      set(this.filter.Q, p.lpq);
      this.voices.forEach((v) => v.retimbre());
      return;
    }
    if (group === 'drift') {
      const specs = this.voiceSpecs();
      this.voices.forEach((v, i) => { if (specs[i]) v.redrift(specs[i], this.levelFor(specs[i])); });
      // 高域（MONO.xより上）のM/S幅
      const w = 0.4 + 1.2 * p.wid, a = (1 + w) / 2, b = (1 - w) / 2;
      set(this.wLL.gain, a); set(this.wRR.gain, a); set(this.wRL.gain, b); set(this.wLR.gain, b);
      return;
    }
    if (group === 'therapy') {
      set(this.therapyLfo.frequency, p.ghz, 0.05);
      if (this.lfoShape !== p.ams) {
        this.lfoShape = p.ams;
        this.therapyLfo.setPeriodicWave(this.lfoWave(p.ams));
        this.lfoMinVal = this.lfoMin(p.ams);
      }
      // LFO波形 w∈[m,1] を 0..1 のゲートへ写像: gate=(w-m)/(1-m)
      const m = this.lfoMinVal, span = 1 - m;
      set(this.amGain.gain, 1 - p.amd - (p.amd * m) / span);
      set(this.amLfoGain.gain, p.amd / span);
      set(this.isoGate.gain, -m / span);
      set(this.isoLfoGain.gain, 1 / span);
      set(this.isoLevel.gain, p.iso * 0.35);
      set(this.binLevel.gain, p.bin * 0.3);
      const carrier = this.carrierHz();
      set(this.isoOsc.frequency, carrier);
      set(this.binL.frequency, carrier);
      set(this.binR.frequency, carrier + p.ghz);
      this.emit('warn', this.warnings());
      return;
    }
    if (group === 'breath') { this.resetBreath(); return; }
    if (group === 'space' || key === 'master') {
      set(this.reverbSend.gain, p.rvb * 1.2);
      set(this.dry.gain, 1 - p.rvb * 0.5);
      set(this.delaySend.gain, p.dly);
      set(this.delay.delayTime, p.dlt, 0.3);
      set(this.delayFb.gain, p.dlf);
      [this.hpfA, this.hpfB].forEach((f) => set(f.frequency, p.hpf));
      [this.xLowA, this.xLowB, this.xHighA, this.xHighB].forEach((f) => set(f.frequency, p.monoX));
      set(this.psyGain.gain, p.psy * 0.6);
      if (this.driveVal !== p.drv) {
        this.driveVal = p.drv;
        if (p.drv > 0) this.driveShaper.curve = tanhCurve(1 + p.drv * 8);
        const on = p.drv > 0 ? 1 : 0;
        set(this.driveDry.gain, 1 - on, 0.03);
        set(this.driveWet.gain, on / (1 + p.drv * 1.5), 0.03);
      }
      if (key === 'rvt') {
        clearTimeout(this.irTimer);
        this.irTimer = setTimeout(() => this.buildImpulse(), 250);
      }
      return;
    }
    if (group === 'session') {
      set(this.volumeGain.gain, Math.pow(p.vol, 2) * 0.9);
    }
  }

  // 注意表示（平文）。基音がΓ.hzに近いとAMと干渉してうなりになる
  warnings() {
    const out = [];
    const p = this.p;
    const d = Math.abs(this.baseHz() - p.ghz);
    if ((p.amd > 0 || p.iso > 0) && d <= 3) {
      out.push(`基音（${this.baseHz().toFixed(1)}Hz）とΓ.hz（${p.ghz}Hz）が±3Hz以内です。AMと干渉して${d.toFixed(1)}Hzのうなりになります。`);
    }
    return out;
  }

  // キャリアを基音の倍音列に合わせると、バイノーラル音がドローンに溶ける。低域は知覚しにくいので下限120Hz
  carrierHz() {
    if (this.p.carL !== 'on') return Math.max(120, this.p.car);
    let f = this.baseHz();
    while (f < 120) f *= 2;
    while (f > 520) f /= 2;
    return f;
  }

  lfoWave(shape) {
    const real = this.lfoCoeffs(shape);
    return this.ctx.createPeriodicWave(real, new Float32Array(real.length));
  }

  lfoCoeffs(shape) {
    const N = shape === 'pulse' ? 12 : 1;
    const real = new Float32Array(N + 1);
    if (shape === 'pulse') {
      // 角の取れたパルス列：cos級数をHann窓で丸める
      for (let k = 1; k <= N; k++) real[k] = 0.5 * (1 + Math.cos((Math.PI * k) / (N + 1)));
    } else real[1] = 1;
    return real;
  }

  // 正規化後（ピーク=1）の最小値。Web Audioの PeriodicWave 正規化と同じ前提
  lfoMin(shape) {
    const real = this.lfoCoeffs(shape);
    let mx = 0, mn = Infinity;
    for (let i = 0; i < 2048; i++) {
      let v = 0;
      for (let k = 1; k < real.length; k++) v += real[k] * Math.cos((2 * Math.PI * k * i) / 2048);
      mx = Math.max(mx, Math.abs(v)); mn = Math.min(mn, v);
    }
    return mn / mx;
  }

  buildImpulse() {
    const ctx = this.ctx;
    const dur = clamp(this.p.rvt, 1, 20);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lpv = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        const env = Math.exp((-6.9 * t) / dur);
        const k = 0.08 + 0.5 * (1 - t / dur); // 時間とともに高域が減衰（低域の石室らしく暗めに）
        lpv += k * ((Math.random() * 2 - 1) - lpv);
        d[i] = lpv * env * (t < 0.02 ? t / 0.02 : 1);
      }
    }
    this.convolver.buffer = buf;
  }

  // ── 共鳴呼吸：音量とフィルターを呼吸の形で満ち引きさせる ──
  resetBreath() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.breathGain.gain;
    const det = this.filter.detune;
    [g, det].forEach((prm) => { prm.cancelScheduledValues(t); prm.setValueAtTime(prm.value, t); });
    if (!this.p.pbpm) {
      g.setTargetAtTime(1, t, 0.4);
      det.setTargetAtTime(0, t, 0.4);
      this.breath.period = 0;
      return;
    }
    const period = 60 / this.p.pbpm;
    this.breath = { anchor: t + 0.1, period, inhale: period * this.p.pin, next: t + 0.1 };
    this.scheduleBreaths();
  }

  scheduleBreaths() {
    const b = this.breath;
    if (!b.period) return;
    const lo = 1 - this.p.pamp;
    const fOpen = this.p.pflt * 2400; // セント
    const g = this.breathGain.gain;
    const det = this.filter.detune;
    const steps = 12;
    while (b.next < this.ctx.currentTime + 4) {
      const t0 = b.next;
      for (let i = 1; i <= steps; i++) { // 吸う：半コサインで上昇
        const x = 0.5 - 0.5 * Math.cos((Math.PI * i) / steps);
        g.linearRampToValueAtTime(lo + (1 - lo) * x, t0 + (b.inhale * i) / steps);
        det.linearRampToValueAtTime(fOpen * x, t0 + (b.inhale * i) / steps);
      }
      const ex = b.period - b.inhale;
      for (let i = 1; i <= steps; i++) { // 吐く：ゆっくり下降
        const x = 0.5 + 0.5 * Math.cos((Math.PI * i) / steps);
        g.linearRampToValueAtTime(lo + (1 - lo) * x, t0 + b.inhale + (ex * i) / steps);
        det.linearRampToValueAtTime(fOpen * x, t0 + b.inhale + (ex * i) / steps);
      }
      b.next += b.period;
    }
  }

  // 呼吸の位相（可視化用）: {phase:'in'|'out', x:0..1}
  breathState() {
    const b = this.breath;
    if (!this.ctx || !b.period) return null;
    const t = this.ctx.currentTime - b.anchor;
    if (t < 0) return { phase: 'in', x: 0, progress: 0 };
    const m = t % b.period;
    if (m < b.inhale) return { phase: 'in', x: 0.5 - 0.5 * Math.cos((Math.PI * m) / b.inhale), progress: m / b.inhale };
    const e = (m - b.inhale) / (b.period - b.inhale);
    return { phase: 'out', x: 0.5 + 0.5 * Math.cos(Math.PI * e), progress: e };
  }

  // ── タンプーラ：Pa – Sa' – Sa' – Sa の撥弦循環。選んだエンジンをエンベロープで撥弦させる ──
  pluckPattern() {
    const cents = this.scaleCents();
    const deg = this.activeDegrees();
    const others = deg.filter((d) => d !== 0);
    const first = others.length ? others[(Math.floor(this.pluckIndex / 4)) % others.length] : 0;
    return [
      { cents: cents[first], oct: 0 },
      { cents: 0, oct: 1 },
      { cents: 0, oct: 1 },
      { cents: 0, oct: this.p.subK > 0.05 ? -1 : 0 },
    ];
  }

  pluck(spec, when) {
    const ctx = this.ctx;
    const p = this.p;
    const f = this.baseHz() * Math.pow(2, spec.cents / 1200 + spec.oct);
    const decay = p.tau;
    const jaw = p.jaw;
    // ジャワリ：共鳴の強いローパスが高域から下りていく「さわり」のうなり
    const jf = ctx.createBiquadFilter();
    jf.type = 'lowpass';
    jf.Q.value = 2 + jaw * 14;
    jf.frequency.setValueAtTime(Math.min(f * (6 + jaw * 30), 12000), when);
    jf.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 40), when + decay * 0.85);
    const env = ctx.createGain();
    const peak = 0.3 * (spec.oct < 0 ? 1.2 : 1);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.012);
    env.gain.setTargetAtTime(0, when + 0.05, decay / 4.5);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.35, 0.35) * p.wid;
    jf.connect(env).connect(pan).connect(this.voiceBus);
    const params = p.eng === 'add' ? { ...p, hN: Math.min(64, p.hN + 16), uni: 1 } : p;
    const inst = getEngine(p.eng).create(ctx, { hz: f, out: jf, params });
    const end = when + decay + 1.5;
    inst.release(0.05, end);
    setTimeout(() => { [jf, env, pan].forEach((n) => { try { n.disconnect(); } catch { /* noop */ } }); },
      (end - ctx.currentTime + 0.5) * 1000);
  }

  // ── スケジューラ（200ms毎、先読み）────────────
  tick() {
    if (!this.ctx || !this.running) return;
    const now = this.ctx.currentTime;
    this.scheduleBreaths();
    if (this.p.exc !== 'sustain' && !this.stopping) {
      if (this.nextPluck < now) this.nextPluck = now + 0.05;
      const step = this.p.cyc / 4;
      while (this.nextPluck < now + 1.5) {
        const pattern = this.pluckPattern();
        this.pluck(pattern[this.pluckIndex % 4], this.nextPluck);
        this.pluckIndex++;
        // 人間の手のわずかな揺れ
        this.nextPluck += step * rand(0.97, 1.04) * (this.pluckIndex % 4 === 0 ? 1.15 : 1);
      }
    }
    // セッションタイマー
    const elapsed = now - this.startTime;
    if (this.p.ses > 0 && !this.stopping) {
      const total = this.p.ses * 60;
      if (elapsed >= total - this.p.fout) this.stop(Math.max(1, total - elapsed));
    }
    this.emit('tick', { elapsed });
  }

  // 発音開始（同期部分）。オフライン描画ではこれを直接呼ぶ
  begin() {
    const t = this.ctx.currentTime;
    this.running = true;
    this.stopping = false;
    this.startTime = t;
    this.nextPluck = t + 0.1;
    this.pluckIndex = 0;
    if (!this.voices.length) { this.voiceSig = ''; this.syncVoices(); }
    const sg = this.sessionGain.gain;
    sg.cancelScheduledValues(t);
    sg.setValueAtTime(0.0001, t);
    sg.linearRampToValueAtTime(1, t + Math.max(0.05, this.p.fin));
    this.resetBreath();
    this.emit('state', { running: true });
  }

  async start() {
    this.init();
    await this.ctx.resume();
    this.begin();
  }

  stop(fade = 3) {
    if (!this.ctx || !this.running || this.stopping) return;
    this.stopping = true;
    const t = this.ctx.currentTime;
    const sg = this.sessionGain.gain;
    sg.cancelScheduledValues(t);
    sg.setValueAtTime(sg.value, t);
    sg.linearRampToValueAtTime(0, t + fade);
    this.emit('state', { running: true, stopping: true, fade });
    clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => {
      this.running = false;
      this.stopping = false;
      this.voices.forEach((v) => v.release(0.05));
      this.voices = [];
      this.voiceSig = '';
      this.ctx.suspend();
      this.emit('state', { running: false });
    }, fade * 1000 + 200);
  }

  // ── 保存・復元（他モジュールと共通の exportParams / applyParams 形式）──
  exportParams() { return { app: 'hypogeum-kkr40', version: 2, params: structuredClone(this.p) }; }

  // v1（kukuru-drone）の JSON もキー変換して読み込む
  applyParams(obj, { reset = false } = {}) {
    const next = reset ? structuredClone(DEFAULTS) : structuredClone(this.p);
    Object.assign(next, normalizeImport(obj));
    this.p = next;
    if (this.ctx) this.applyAll();
    this.emit('all', this.p);
  }
}

// ── 持続ボイス：エンジンの発音体＋揺らぎLFO（ピッチ・音量）＋定位 ──
class Voice {
  constructor(eng, spec, hz, level) {
    this.eng = eng;
    const ctx = (this.ctx = eng.ctx);
    const t = ctx.currentTime;
    const p = eng.p;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = spec.pan * p.wid;
    this.out.connect(this.panner).connect(eng.voiceBus);

    // 音量の揺らぎ：ボイスごとに異なる極低周波
    this.ampLfo = ctx.createOscillator();
    this.ampLfo.frequency.value = rand(0.012, 0.07);
    this.ampLfoGain = ctx.createGain();
    this.ampLfo.connect(this.ampLfoGain).connect(this.out.gain);
    this.ampLfo.start();

    const mod = getEngine(p.eng);
    // ピッチの揺らぎ（セント信号）。ADD.H はユニゾンごとに自前で持つ
    if (!mod.ownDrift) {
      this.driftLfo = ctx.createOscillator();
      this.driftMult = rand(0.55, 1.6);
      this.driftLfo.frequency.value = p.dfr * this.driftMult;
      this.driftGain = ctx.createGain();
      this.driftGain.gain.value = 0;
      this.driftLfo.connect(this.driftGain);
      this.driftLfo.start();
    }
    this.inst = mod.create(ctx, { hz, out: this.out, params: p, drift: this.driftGain });
    this.spec = spec;
    this.level = level;
    this.redrift(spec, level);
    this.out.gain.setTargetAtTime(this.baseLevel(), t, 0.8);
  }

  baseLevel() { return this.level * (1 - this.eng.p.dfa * 0.5); }

  redrift(spec, level) {
    const t = this.ctx.currentTime;
    const p = this.eng.p;
    this.spec = spec; this.level = level;
    if (this.driftGain) {
      this.driftGain.gain.setTargetAtTime(p.dfc, t, 0.1);
      this.driftLfo.frequency.setTargetAtTime(p.dfr * this.driftMult, t, 0.1);
    }
    this.inst.setParams(p);
    this.ampLfoGain.gain.setTargetAtTime(level * p.dfa * 0.5, t, 0.2);
    this.out.gain.setTargetAtTime(this.baseLevel(), t, 0.2);
    this.panner.pan.setTargetAtTime(spec.pan * p.wid, t, 0.2);
  }

  update(spec, hz, level, t, glide) {
    this.inst.setHz(hz, t, glide);
    this.redrift(spec, level);
  }

  retimbre() { this.inst.setParams(this.eng.p); }

  release(sec) {
    const t = this.ctx.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    this.ampLfoGain.disconnect();
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + sec);
    this.inst.release(sec);
    const end = t + sec + 0.1;
    this.ampLfo.stop(end);
    this.driftLfo?.stop(end);
    setTimeout(() => { try { this.panner.disconnect(); } catch { /* 既に切断済み */ } }, (sec + 0.3) * 1000);
  }
}

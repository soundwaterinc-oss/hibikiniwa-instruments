// KUKURU — ドローン音響エンジン（Web Audio API、依存ライブラリなし）
//
// 信号経路
//   voices ─▶ voiceBus ─▶ filter ─▶ amGain(40Hz等AM) ─▶ breathGain ─┬─▶ dry ──────────────┐
//                                                                   ├─▶ convolver ─▶ wet ─┤
//                                                                   └─▶ delay(+fb) ─▶ dly ┤
//   isochronic / binaural ─▶ therapyBus（残響を通さない＝左右差を保つ）────────────────────┤
//                                                       sessionGain ◀─────────────────────┘
//                                                       ─▶ volume ─▶ limiter ─▶ analyser ─▶ out
import { getScale, parsePitchList, nearestFifthIndex } from './scales.js';
import { DEFAULTS, PARAM_BY_KEY } from './params.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);

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
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { this.listeners.forEach((fn) => fn(type, data)); }

  // ── 初期化（ユーザー操作の中で呼ぶ）──────────────
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC({ latencyHint: 'playback' }));
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
    this.delayTone.frequency.value = 3200;
    this.therapyBus = g(1);
    this.sessionGain = g(0);
    this.volumeGain = g(0.5);
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 2;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.3;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0.88;

    this.voiceBus.connect(this.filter).connect(this.amGain).connect(this.breathGain);
    this.breathGain.connect(this.dry).connect(this.sessionGain);
    this.breathGain.connect(this.reverbSend).connect(this.convolver).connect(this.sessionGain);
    this.breathGain.connect(this.delaySend).connect(this.delay);
    this.delay.connect(this.delayTone).connect(this.delayFb).connect(this.delay);
    this.delayTone.connect(this.sessionGain);
    this.therapyBus.connect(this.sessionGain);
    this.sessionGain.connect(this.volumeGain).connect(this.limiter).connect(this.analyser).connect(ctx.destination);

    // 療法用LFO（AM・アイソクロニックで共有し位相を揃える）
    this.therapyLfo = ctx.createOscillator();
    this.amLfoGain = g(0);
    this.isoLfoGain = g(0.5);
    this.therapyLfo.connect(this.amLfoGain).connect(this.amGain.gain);

    // アイソクロニック音：キャリア正弦をbeatHzでゲート
    this.isoOsc = ctx.createOscillator();
    this.isoGate = g(0.5);
    this.isoLevel = g(0);
    this.isoOsc.connect(this.isoGate).connect(this.isoLevel).connect(this.therapyBus);
    this.therapyLfo.connect(this.isoLfoGain).connect(this.isoGate.gain);

    // バイノーラル：左右で beatHz だけずらした正弦
    this.binL = ctx.createOscillator();
    this.binR = ctx.createOscillator();
    const merger = ctx.createChannelMerger(2);
    this.binLevel = g(0);
    this.binL.connect(merger, 0, 0);
    this.binR.connect(merger, 0, 1);
    merger.connect(this.binLevel).connect(this.therapyBus);

    [this.therapyLfo, this.isoOsc, this.binL, this.binR].forEach((o) => o.start());
    this.waves = {};
    this.buildImpulse();
    this.applyAll(true);
    this.timer = setInterval(() => this.tick(), 200);
  }

  // ── 音階・ボイス構成 ────────────────────────
  scaleCents() {
    if (this.p.scaleId === 'custom') {
      const c = parsePitchList(this.p.customCents || '');
      return c.length ? c : [0];
    }
    return getScale(this.p.scaleId).cents;
  }

  scaleLabels() {
    const s = this.p.scaleId === 'custom' ? null : getScale(this.p.scaleId);
    const cents = this.scaleCents();
    return s?.labels && s.labels.length === cents.length ? s.labels : cents.map((c) => `${Math.round(c)}`);
  }

  activeDegrees() {
    const cents = this.scaleCents();
    const valid = (this.p.degrees || []).filter((i) => i >= 0 && i < cents.length);
    return valid.length ? [...new Set(valid)].sort((a, b) => a - b) : [0];
  }

  baseHz() { return this.p.rootHz * Math.pow(2, this.p.fineCents / 1200); }

  // 鳴らすボイスの仕様（周波数比・重み・定位）
  voiceSpecs() {
    const cents = this.scaleCents();
    const deg = this.activeDegrees();
    const n = deg.length;
    const specs = deg.map((d, i) => ({ id: `d${d}`, cents: cents[d], oct: 0, w: 1, pan: n === 1 ? 0 : (i / (n - 1)) * 2 - 1 }));
    specs.push({ id: 'sub', cents: 0, oct: -1, w: this.p.subLevel, pan: 0 });
    deg.forEach((d, i) => specs.push({ id: `u${d}`, cents: cents[d], oct: 1, w: this.p.upperLevel, pan: n === 1 ? 0 : -((i / (n - 1)) * 2 - 1) }));
    return specs;
  }

  specHz(s) { return this.baseHz() * Math.pow(2, s.cents / 1200 + s.oct); }

  levelFor(s) {
    const n = this.activeDegrees().length;
    return (s.w / Math.sqrt(n + 1)) * 0.5;
  }

  periodicWave(bright = 0) {
    const N = Math.round(clamp(this.p.harmonics + bright, 1, 64));
    const key = `${N}|${this.p.rolloff}|${this.p.oddEven}`;
    if (this.waves[key]) return this.waves[key];
    const real = new Float32Array(N + 1);
    const imag = new Float32Array(N + 1);
    const e = this.p.oddEven;
    for (let k = 1; k <= N; k++) {
      let a = 1 / Math.pow(k, this.p.rolloff);
      if (k > 1) a *= k % 2 ? (e > 0 ? 1 - e : 1) : (e < 0 ? 1 + e : 1);
      imag[k] = a;
    }
    const w = this.ctx.createPeriodicWave(real, imag);
    const keys = Object.keys(this.waves);
    if (keys.length > 8) delete this.waves[keys[0]];
    this.waves[key] = w;
    return w;
  }

  // 構成が変わったらクロスフェードで差し替え、同じなら周波数だけ滑らかに動かす
  syncVoices(glide = 0.6) {
    if (!this.ctx) return;
    const specs = this.voiceSpecs();
    const sig = `${specs.map((s) => s.id).join(',')}|${this.p.unison}|${this.p.mode}|${this.p.scaleId}|${this.p.customCents}`;
    const sustain = this.p.mode !== 'tanpura';
    if (sig === this.voiceSig && this.voices.length) {
      const t = this.ctx.currentTime;
      this.voices.forEach((v, i) => v.update(specs[i], this.specHz(specs[i]), this.levelFor(specs[i]), t, glide));
      return;
    }
    this.voiceSig = sig;
    const old = this.voices;
    old.forEach((v) => v.release(2.5));
    this.voices = sustain ? specs.map((s) => new SustainVoice(this, s, this.specHz(s), this.levelFor(s))) : [];
    this.emit('voices', specs);
  }

  // ── パラメータ適用 ───────────────────────────
  set(key, value) {
    if (key === 'scaleId' && value !== this.p.scaleId) {
      this.p.scaleId = value;
      this.p.degrees = this.defaultDegrees();
    } else {
      this.p[key] = value;
    }
    if (this.ctx) this.applyKey(key);
    this.emit('param', { key, value: this.p[key] });
  }

  defaultDegrees() {
    const c = this.scaleCents();
    const f = nearestFifthIndex(c);
    return f > 0 ? [0, f] : c.length > 2 ? [0, Math.floor(c.length / 2)] : [0];
  }

  applyAll(immediate = false) {
    ['filter', 'therapy', 'space', 'session', 'timbre'].forEach((k) => this.applyKey(k, immediate));
    this.syncVoices();
    this.resetBreath();
  }

  applyKey(key) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const p = this.p;
    const set = (param, v, tc = 0.08) => param.setTargetAtTime(v, t, tc);
    const group = PARAM_BY_KEY[key]?.group || key;

    if (['rootHz', 'fineCents', 'subLevel', 'upperLevel', 'degrees', 'scaleId', 'customCents', 'unison', 'mode'].includes(key)) {
      this.syncVoices(key === 'rootHz' || key === 'fineCents' ? 0.25 : 0.8);
      if (p.carrierLock === 'on') this.applyKey('carrierHz');
      if (key === 'mode') { this.nextPluck = ctx.currentTime + 0.05; this.pluckIndex = 0; }
      return;
    }
    if (group === 'timbre' || key === 'filter') {
      set(this.filter.frequency, p.cutoff);
      set(this.filter.Q, p.resonance);
      const w = this.periodicWave();
      this.voices.forEach((v) => v.retimbre(w));
      return;
    }
    if (group === 'drift') {
      const specs = this.voiceSpecs();
      this.voices.forEach((v, i) => v.redrift(specs[i], this.levelFor(specs[i])));
      return;
    }
    if (group === 'therapy' || key === 'therapy') {
      set(this.therapyLfo.frequency, p.beatHz, 0.05);
      if (this.lfoShape !== p.amShape) {
        this.lfoShape = p.amShape;
        this.therapyLfo.setPeriodicWave(this.lfoWave(p.amShape));
        this.lfoMinVal = this.lfoMin(p.amShape);
      }
      // LFO波形 w∈[m,1] を 0..1 のゲートへ写像: gate=(w-m)/(1-m)
      const m = this.lfoMinVal, span = 1 - m;
      set(this.amGain.gain, 1 - p.amDepth - (p.amDepth * m) / span);
      set(this.amLfoGain.gain, p.amDepth / span);
      set(this.isoGate.gain, -m / span);
      set(this.isoLfoGain.gain, 1 / span);
      set(this.isoLevel.gain, p.isoLevel * 0.35);
      set(this.binLevel.gain, p.binauralLevel * 0.3);
      const carrier = this.carrierHz();
      set(this.isoOsc.frequency, carrier);
      set(this.binL.frequency, carrier);
      set(this.binR.frequency, carrier + p.beatHz);
      return;
    }
    if (group === 'breath') { this.resetBreath(); return; }
    if (group === 'space' || key === 'space') {
      set(this.reverbSend.gain, p.reverbMix * 1.2);
      set(this.dry.gain, 1 - p.reverbMix * 0.5);
      set(this.delaySend.gain, p.delayMix);
      set(this.delay.delayTime, p.delayTime, 0.3);
      set(this.delayFb.gain, p.delayFb);
      if (key === 'reverbDecay') {
        clearTimeout(this.irTimer);
        this.irTimer = setTimeout(() => this.buildImpulse(), 250);
      }
      return;
    }
    if (group === 'session' || key === 'session') {
      set(this.volumeGain.gain, Math.pow(p.volume, 2) * 0.9);
    }
  }

  // キャリアを基音の倍音列に合わせると、バイノーラル音がドローンに溶ける
  carrierHz() {
    if (this.p.carrierLock !== 'on') return this.p.carrierHz;
    let f = this.baseHz();
    while (f < 180) f *= 2;
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
    const dur = clamp(this.p.reverbDecay, 1, 20);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        const env = Math.exp((-6.9 * t) / dur);
        const k = 0.15 + 0.8 * (1 - t / dur); // 時間とともに高域が減衰
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * env * (t < 0.02 ? t / 0.02 : 1);
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
    if (!this.p.breathBpm) {
      g.setTargetAtTime(1, t, 0.4);
      det.setTargetAtTime(0, t, 0.4);
      this.breath.period = 0;
      return;
    }
    const period = 60 / this.p.breathBpm;
    this.breath = { anchor: t + 0.1, period, inhale: period * this.p.inhaleRatio, next: t + 0.1 };
    this.scheduleBreaths();
  }

  scheduleBreaths() {
    const b = this.breath;
    if (!b.period) return;
    const lo = 1 - this.p.breathDepth;
    const fOpen = this.p.breathFilter * 2400; // セント
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

  // ── タンプーラ：Pa – Sa' – Sa' – Sa の撥弦循環 ──
  pluckPattern() {
    const cents = this.scaleCents();
    const deg = this.activeDegrees();
    const others = deg.filter((d) => d !== 0);
    const first = others.length ? others[(Math.floor(this.pluckIndex / 4)) % others.length] : 0;
    return [
      { cents: cents[first], oct: 0 },
      { cents: 0, oct: 1 },
      { cents: 0, oct: 1 },
      { cents: 0, oct: this.p.subLevel > 0.05 ? -1 : 0 },
    ];
  }

  pluck(spec, when) {
    const ctx = this.ctx;
    const f = this.baseHz() * Math.pow(2, spec.cents / 1200 + spec.oct);
    const decay = this.p.pluckDecay;
    const jaw = this.p.jawari;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.periodicWave(16));
    osc.frequency.value = f;
    osc.detune.value = rand(-1.5, 1.5);
    // ジャワリ：共鳴の強いローパスが高域から下りていく「さわり」のうなり
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.Q.value = 2 + jaw * 14;
    bp.frequency.setValueAtTime(Math.min(f * (6 + jaw * 30), 16000), when);
    bp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 60), when + decay * 0.85);
    const env = ctx.createGain();
    const peak = 0.22 * (spec.oct < 0 ? 1.2 : 1);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.012);
    env.gain.setTargetAtTime(0, when + 0.05, decay / 4.5);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.35, 0.35) * this.p.spread;
    osc.connect(bp).connect(env).connect(pan).connect(this.voiceBus);
    osc.start(when);
    osc.stop(when + decay + 2);
    osc.onended = () => { osc.disconnect(); bp.disconnect(); env.disconnect(); pan.disconnect(); };
  }

  // ── スケジューラ（200ms毎、先読み）────────────
  tick() {
    if (!this.ctx || !this.running) return;
    const now = this.ctx.currentTime;
    this.scheduleBreaths();
    if (this.p.mode !== 'sustain' && !this.stopping) {
      if (this.nextPluck < now) this.nextPluck = now + 0.05;
      const step = this.p.tanpuraCycle / 4;
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
    if (this.p.sessionMin > 0 && !this.stopping) {
      const total = this.p.sessionMin * 60;
      if (elapsed >= total - this.p.fadeOut) this.stop(Math.max(1, total - elapsed));
    }
    this.emit('tick', { elapsed });
  }

  async start() {
    this.init();
    await this.ctx.resume();
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
    sg.linearRampToValueAtTime(1, t + Math.max(0.05, this.p.fadeIn));
    this.resetBreath();
    this.emit('state', { running: true });
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
  exportParams() { return { app: 'kukuru-drone', version: 1, params: structuredClone(this.p) }; }

  applyParams(obj, { reset = false } = {}) {
    const src = obj?.params || obj || {};
    const next = reset ? structuredClone(DEFAULTS) : structuredClone(this.p);
    for (const [k, v] of Object.entries(src)) {
      if (k in DEFAULTS) next[k] = v;
    }
    this.p = next;
    if (this.ctx) this.applyAll();
    this.emit('all', this.p);
  }
}

// ── 持続ボイス：ユニゾン数ぶんのオシレータ＋非同期ドリフトLFO ──
class SustainVoice {
  constructor(eng, spec, hz, level) {
    this.eng = eng;
    const ctx = (this.ctx = eng.ctx);
    const t = ctx.currentTime;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = spec.pan * eng.p.spread;
    this.out.connect(this.panner).connect(eng.voiceBus);

    // 音量の揺らぎ：ボイスごとに異なる極低周波
    this.ampLfo = ctx.createOscillator();
    this.ampLfo.frequency.value = rand(0.012, 0.07);
    this.ampLfoGain = ctx.createGain();
    this.ampLfo.connect(this.ampLfoGain).connect(this.out.gain);
    this.ampLfo.start();

    const n = eng.p.unison;
    const wave = eng.periodicWave();
    this.oscs = [];
    for (let u = 0; u < n; u++) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(wave);
      o.frequency.value = hz;
      const lfo = ctx.createOscillator();
      const mult = rand(0.55, 1.6); // マスタークロックを持たない：各々が違う周期で漂う
      lfo.frequency.value = eng.p.driftRate * mult;
      const lg = ctx.createGain();
      lfo.connect(lg).connect(o.detune);
      const og = ctx.createGain();
      og.gain.value = 1 / Math.sqrt(n);
      o.connect(og).connect(this.out);
      o.start(t + rand(0, 0.05));
      lfo.start();
      this.oscs.push({ o, lfo, lg, mult, offset: n === 1 ? 0 : (u / (n - 1)) * 2 - 1 });
    }
    this.spec = spec;
    this.level = level;
    this.redrift(spec, level);
    this.out.gain.setTargetAtTime(this.baseLevel(), t, 0.8);
  }

  baseLevel() { return this.level * (1 - this.eng.p.ampDrift * 0.5); }

  redrift(spec, level) {
    const t = this.ctx.currentTime;
    const p = this.eng.p;
    this.spec = spec; this.level = level;
    this.oscs.forEach((x) => {
      x.o.detune.setTargetAtTime(x.offset * p.detune, t, 0.1);
      x.lg.gain.setTargetAtTime(p.driftCents, t, 0.1);
      x.lfo.frequency.setTargetAtTime(p.driftRate * x.mult, t, 0.1);
    });
    this.ampLfoGain.gain.setTargetAtTime(level * p.ampDrift * 0.5, t, 0.2);
    this.out.gain.setTargetAtTime(this.baseLevel(), t, 0.2);
    this.panner.pan.setTargetAtTime(spec.pan * p.spread, t, 0.2);
  }

  update(spec, hz, level, t, glide) {
    this.oscs.forEach((x) => x.o.frequency.setTargetAtTime(hz, t, glide / 3));
    this.redrift(spec, level);
  }

  retimbre(wave) { this.oscs.forEach((x) => x.o.setPeriodicWave(wave)); }

  release(sec) {
    const t = this.ctx.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    this.ampLfoGain.disconnect();
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + sec);
    const end = t + sec + 0.1;
    this.oscs.forEach((x) => { x.o.stop(end); x.lfo.stop(end); });
    this.ampLfo.stop(end);
    setTimeout(() => { try { this.panner.disconnect(); } catch { /* 既に切断済み */ } }, (sec + 0.3) * 1000);
  }
}

// STOMA//16 の音響：トラックごとのバス → 質感（ビット・ローファイ・ダブディレイ・スプリング・ワウ）→ 共通マスター段
// スケジューラは拍（beat）を基準に、トラックごとに独立したループ長で打点を置く（ポリメトリック）
//
//   打点 ─▶ panner ─▶ trackBus[v] ─▶ (v≠K: duck＝サイドチェイン) ─▶ mainBus ─▶ crush ─▶ lofi ─▶ hp ─┬─▶ sum
//                                                             throwBus ─▶ dtone ─▶ L/R ディレイ（帰還）─┤
//                                                                          sprSend ─▶ スプリング残響 ──┤
//   sum ─▶ vol ─▶ wow（テープの揺れ）─▶ 共通マスター段（DC → クリップ → ルックアヘッド・リミッター → メーター）
import { createMaster } from '../../../packages/core/master.js';
import { STYLES } from './styles.js';
import { playModel, playNative, kit, reseedVoices, MODEL_TRIM } from './voices.js';
import { rng } from './rng.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// スプリング残響のインパルス応答：分散で音程が下がる「びよん」というチャープの繰り返し
function springIR(ctx, sec = 2.2) {
  const sr = ctx.sampleRate, n = Math.floor(sr * sec);
  const b = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let s = ch ? 91 : 17;
    const R = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
    for (let rep = 0; rep < 9; rep++) {
      const t0 = 0.012 + rep * (0.065 + ch * 0.004), amp = Math.pow(0.62, rep);
      const len = Math.floor(sr * 0.05);
      for (let i = 0; i < len; i++) {
        const t = i / sr, idx = Math.floor((t0 + t) * sr);
        if (idx >= n) break;
        d[idx] += amp * Math.sin(2 * Math.PI * (3200 * t - 26000 * t * t)) * Math.exp(-t * 60) * 0.5;
      }
    }
    let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; lp += 0.25 * ((R() * 2 - 1) - lp); d[i] += lp * Math.exp(-t * 2.6) * 0.18; }
  }
  return b;
}
function crushCurve(bits) {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = bits > 0 ? Math.round(x * 2 ** (bits - 1)) / 2 ** (bits - 1) : x; }
  return c;
}

export class StomaAudio {
  constructor() { this.ctx = null; this.tracks = null; this.running = false; this.listeners = new Set(); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, d) { this.listeners.forEach((fn) => fn(type, d)); }

  init(ctx = null, { destination } = {}) {
    if (this.ctx) return;
    if (!ctx) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; ctx = new AC({ latencyHint: 'interactive' }); }
    this.ctx = ctx;
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    kit(ctx);
    this.master = createMaster(ctx, { destination: destination === undefined ? ctx.destination : destination });
    this.vol = g(0.5);
    this.sum = g(1);
    // テープの揺れ（ワウ 0.55Hz ＋ フラッター 6Hz）
    this.wowDl = ctx.createDelay(0.1); this.wowDl.delayTime.value = 0.012;
    this.wowLfo = ctx.createOscillator(); this.wowLfo.frequency.value = 0.55;
    this.flLfo = ctx.createOscillator(); this.flLfo.frequency.value = 6.2;
    this.wowG = g(0); this.flG = g(0);
    this.wowLfo.connect(this.wowG).connect(this.wowDl.delayTime);
    this.flLfo.connect(this.flG).connect(this.wowDl.delayTime);
    this.wowLfo.start(); this.flLfo.start();
    this.sum.connect(this.vol).connect(this.wowDl).connect(this.master.input);

    this.mainBus = g(1);
    this.crush = ctx.createWaveShaper(); this.crush.oversample = 'none'; this.crush.curve = crushCurve(0); this.crushBits = 0;
    this.lofi = ctx.createBiquadFilter(); this.lofi.type = 'lowpass'; this.lofi.Q.value = 0.5;
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 24;
    this.mainBus.connect(this.crush).connect(this.lofi).connect(this.hp).connect(this.sum);
    // ピンポン・ダブディレイ（帰還路にバンドパス）
    this.dsend = g(0); this.throwBus = g(0);
    this.dtone = ctx.createBiquadFilter(); this.dtone.type = 'bandpass'; this.dtone.frequency.value = 1200; this.dtone.Q.value = 0.5;
    this.dl = ctx.createDelay(3); this.dr = ctx.createDelay(3); this.dfb = g(0);
    const merger = ctx.createChannelMerger(2);
    this.hp.connect(this.dsend).connect(this.dtone);
    this.throwBus.connect(this.dtone);
    this.dtone.connect(this.dl); this.dl.connect(this.dr); this.dr.connect(this.dfb).connect(this.dtone);
    this.dl.connect(merger, 0, 0); this.dr.connect(merger, 0, 1); merger.connect(this.sum);
    // スプリング残響
    this.sprSend = g(0); this.spring = ctx.createConvolver(); this.spring.buffer = springIR(ctx);
    this.hp.connect(this.sprSend).connect(this.spring).connect(this.sum);
    // ヒス
    this.hissSrc = ctx.createBufferSource(); this.hissSrc.buffer = kit(ctx).noise; this.hissSrc.loop = true;
    this.hissF = ctx.createBiquadFilter(); this.hissF.type = 'highpass'; this.hissF.frequency.value = 3000;
    this.hissG = g(0);
    this.hissSrc.connect(this.hissF).connect(this.hissG).connect(this.sum); this.hissSrc.start();
    // サブドローン（TWL）：基音の正弦
    this.drone = ctx.createOscillator(); this.drone.frequency.value = 41.2;
    this.droneG = g(0);
    this.drone.connect(this.droneG).connect(this.sum); this.drone.start();
    // トラックのバス（K 以外はサイドチェインで沈める）
    this.duck = g(1);
    this.duck.connect(this.mainBus);
    this.trackBus = Array.from({ length: 6 }, (_, v) => { const b = g(1); b.connect(v === 0 ? this.mainBus : this.duck); return b; });
  }

  // 質感のパラメータを反映。styleMix：STYLE CYCLE のときの移行（{from, to, morph}）
  applyFx(P, E = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (prm, v, tc = 0.05) => prm.setTargetAtTime(v, t, tc);
    const mix = (k) => {
      if (!E || !P.cyc || E.styleFrom === E.styleTo) return P[k];
      const a = STYLES[E.styleFrom].fx[k], b = STYLES[E.styleTo].fx[k];
      return a + (b - a) * E.morph;
    };
    const st = STYLES[this.activeStyle(P, E)];
    const beat = 60 / P.bpm;
    this.setCrush(Math.round(mix('crsh')));
    const lofi = mix('lofi');
    const lp = E ? 300 * Math.pow(lofi / 300, clamp(E.lp, 0.05, 1)) : lofi;
    set(this.lofi.frequency, lp, E ? 0.3 : 0.05);
    set(this.dsend.gain, Math.min(0.9, mix('dly') * (E ? E.dly : 1)));
    set(this.throwBus.gain, st.fx.throwZ);
    set(this.dl.delayTime, beat * st.fx.dtime, 0.1);
    set(this.dr.delayTime, beat * st.fx.dtime, 0.1);
    if (!E?.fbAuto) set(this.dfb.gain, mix('dfb'));
    set(this.sprSend.gain, mix('spr') * 0.9);
    set(this.hissG.gain, mix('hiss'));
    set(this.wowG.gain, mix('wow') * 0.0035);
    set(this.flG.gain, mix('wow') * 0.0005);
    set(this.vol.gain, P.vol ** 2 * 2.6); // 音色の単発ピークを 0.15〜0.4 にそろえたぶん、全体で持ち上げる
    set(this.droneG.gain, this.running && STYLES[P.style].subDrone ? STYLES[P.style].subDrone * 0.35 : 0, 0.5);
    set(this.drone.frequency, P.f0, 0.3);
    for (let v = 0; v < 6; v++) set(this.trackBus[v].gain, P.vmute[v] ? 0 : P.vlvl[v]);
  }

  activeStyle(P, E) { return E && P.cyc ? (E.morph >= 0.5 ? E.styleTo : E.styleFrom) : P.style; }

  // ビット深度：WaveShaper ごと入れ替える（curve の再代入を禁じる実装があるため）
  setCrush(bits) {
    if (bits === this.crushBits) return;
    const next = this.ctx.createWaveShaper();
    next.oversample = 'none';
    next.curve = crushCurve(bits);
    this.mainBus.connect(next).connect(this.lofi);
    try { this.mainBus.disconnect(this.crush); this.crush.disconnect(); } catch { /* noop */ }
    this.crush = next;
    this.crushBits = bits;
  }

  // BRK：ダブディレイの帰還を区間内で上げて下げる
  automateFeedback(P, E, t0, dur) {
    const prm = this.dfb.gain;
    prm.cancelScheduledValues(t0);
    prm.setValueAtTime(P.dfb, t0);
    if (E?.fbAuto) { prm.linearRampToValueAtTime(0.88, t0 + dur * 0.55); prm.linearRampToValueAtTime(P.dfb, t0 + dur); }
  }

  // ── スケジューラ ──
  // tracks：buildTracks() の結果。opts.onLoop(loopIndex, t) はループ境界ごとに呼ばれ、新しい tracks を返してよい
  start(P, tracks, { at = null, seed = 1, onLoop, onHit, onNote } = {}) {
    const t = at ?? this.ctx.currentTime + 0.06;
    this.P = P; this.tracks = tracks; this.onLoop = onLoop; this.onHit = onHit; this.onNote = onNote;
    this.t0 = t; this.bpm = P.bpm;
    this.next = [0, 0, 0, 0, 0, 0]; // トラックごとの次のステップ番号（開始からの通し番号）
    this.loopIdx = 0;
    this.R = rng(seed);
    reseedVoices(seed);
    this.running = true;
    this.applyFx(P);
    this.emit('state', { running: true });
  }
  stop() { this.running = false; this.applyFx(this.P); this.emit('state', { running: false }); }

  beatAt(time) { return ((time - this.t0) * this.bpm) / 60; }
  timeAt(beat) { return this.t0 + (beat * 60) / this.bpm; }
  setTempo(bpm) { if (!this.ctx) return; const now = this.ctx.currentTime, b = this.beatAt(now); this.bpm = bpm; this.t0 = now - (b * 60) / bpm; }

  // 時刻 tEnd までの打点を予約する（ループ境界をまたぐときは onLoop を呼ぶ）
  scheduleUntil(tEnd) {
    if (!this.running || !this.tracks) return;
    const P = this.P;
    const loopBeats = 4 * P.bars;
    for (;;) {
      const nextBoundaryBeat = (this.loopIdx + 1) * loopBeats;
      const tb = this.timeAt(nextBoundaryBeat);
      const until = Math.min(tEnd, tb);
      this.scheduleWindow(until, nextBoundaryBeat);
      if (tb > tEnd) break;
      this.loopIdx++;
      const r = this.onLoop?.(this.loopIdx, tb);
      if (r) this.tracks = r;
    }
  }

  scheduleWindow(tUntil, beatLimit) {
    const P = this.P, ctx = this.ctx;
    const st = STYLES[P.style];
    const style = this.activeStyle(P, this.E);
    const now = ctx.currentTime;
    for (const tr of this.tracks.tracks) {
      const v = tr.v, stepBeats = 4 / tr.div;
      if (!tr._byStep) {
        tr._byStep = new Map();
        for (const e of tr.events) { const a = tr._byStep.get(e.step); if (a) a.push(e); else tr._byStep.set(e.step, [e]); }
      }
      const byStep = tr._byStep;
      for (;;) {
        const k = this.next[v];
        const beat = k * stepBeats;
        if (beat >= beatLimit) break;
        let tk = this.timeAt(beat);
        if (tk > tUntil) break;
        this.next[v] = k + 1;
        // TWL：12分割のトラックはループごとに1ステップずつ回す（3:4 のヘミオラ）
        const hemi = st.hemiola && tr.div === 12 ? this.loopIdx : 0;
        const s = (((k - hemi) % tr.len) + tr.len) % tr.len;
        const evs = byStep.get(s);
        if (!evs) continue;
        const stepDur = (stepBeats * 60) / this.bpm;
        for (const e of evs) {
          let when = tk + e.micro * stepDur;
          // MPC スウィング：16分の裏を遅らせる
          if (tr.div === 16 && k % 2 === 1) when += (P.swg - 0.5) * 2 * stepDur;
          when += ((st.lay[v] + (this.R() * 2 - 1) * st.jit[v] * P.hum) / 1000);
          if (when < now - 0.005) continue;
          when = Math.max(when, now);
          this.play(v, e, when, style, stepDur);
        }
      }
    }
  }

  play(v, e, when, style, stepDur) {
    const P = this.P, ctx = this.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = STYLES[style].panHard && v !== 0 ? Math.sign(e.pan || 1) : clamp(e.pan, -1, 1);
    pan.connect(this.trackBus[v]);
    const model = this.E?.modelOverride?.[v] || P.vmodel[v];
    const o = { tun: 2 ** (P.vtun[v] / 12), dc: P.vdcy[v], m1: P.vm1[v], m2: P.vm2[v], f0: P.f0, scale: this.scale, stepDur };
    const vel = e.vel * (model === 'NAT' || !model ? STYLES[style].trim[v] * MODEL_TRIM.NAT : 1);
    if (model && model !== 'NAT') playModel(ctx, model, when, vel, pan, e, o);
    else playNative(ctx, style, v, when, vel, pan, e, o, { throwBus: this.throwBus });
    // サイドチェイン：キックで他のトラックを沈める
    if (v === 0 && P.sc > 0) { const d = this.duck.gain; d.cancelScheduledValues(when); d.setValueAtTime(1 - P.sc * 0.85, when); d.setTargetAtTime(1, when + 0.01, 0.06 + P.sc * 0.12); }
    setTimeout?.(() => { try { pan.disconnect(); } catch { /* noop */ } }, Math.max(0, (when - ctx.currentTime) * 1000 + 3000));
    this.onHit?.(v, e, when);
    this.onNote?.(v, e, when, stepDur);
  }

  // チリ（ランダムなインパルス）
  crackle(P, tFrom, tTo) {
    if (!(P.crkl > 0)) return;
    const ctx = this.ctx, n = Math.floor(P.crkl * (tTo - tFrom) + this.R());
    for (let i = 0; i < n; i++) {
      const t = tFrom + this.R() * (tTo - tFrom);
      const s = ctx.createBufferSource(); s.buffer = kit(ctx).imp;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500 + this.R() * 4000;
      const gg = ctx.createGain(); gg.gain.value = 0.5 + this.R() * 1.8;
      const p = ctx.createStereoPanner(); p.pan.value = this.R() * 1.4 - 0.7;
      s.connect(f).connect(gg).connect(p).connect(this.lofi); s.start(t);
    }
  }

  loopDuration() { return (4 * this.P.bars * 60) / this.bpm; }
  phaseNow() { if (!this.running) return 0; const b = this.beatAt(this.ctx.currentTime), L = 4 * this.P.bars; return (((b % L) + L) % L) / L; }
}

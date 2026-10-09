// 位相ダイヤル：1オクターブ=1周（1200¢）。外周に10¢刻みの目盛りと12平均律の基準線、
// 度数のコード、ピッチクラスへ折り畳んだスペクトル（20〜500Hzを強調）。内側の弧は 20〜500Hz の低域スコープ。
// 40Hz刺激は視覚的に点滅させない（光過敏への配慮）：スペクトルは強く平滑化し、Γ.hzに同期した描画はしない。

const TAU = Math.PI * 2;
const LO = 20, HI = 500;

export class PhaseDial {
  constructor(canvas, engine) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.eng = engine;
    this.bins = new Float32Array(360);
    this.scope = new Float32Array(96);
    this.freq = null;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = mq.matches;
    mq.addEventListener?.('change', (e) => { this.reduced = e.matches; });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.last = 0;
    const loop = (ts) => {
      // 動きを減らす設定では描画を約5fpsに落とす
      if (!this.reduced || ts - this.last > 200) { this.draw(); this.last = ts; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.cv.getBoundingClientRect();
    this.cv.width = Math.max(1, r.width * dpr);
    this.cv.height = Math.max(1, r.height * dpr);
    this.dpr = dpr;
  }

  colors() {
    const cs = getComputedStyle(this.cv);
    const v = (n) => cs.getPropertyValue(n).trim();
    return { fg: v('--fg'), mute: v('--mute'), line: v('--line'), brass: v('--brass'), cyan: v('--cyan'), bg: v('--bg'), face: v('--face') };
  }

  analyse() {
    const eng = this.eng;
    const tmp = new Float32Array(360);
    const sc = new Float32Array(this.scope.length);
    if (eng.analyser && eng.running) {
      const a = eng.analyser;
      if (!this.freq || this.freq.length !== a.frequencyBinCount) this.freq = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(this.freq);
      const sr = eng.ctx.sampleRate, base = eng.baseHz();
      for (let i = 1; i < this.freq.length; i++) {
        const f = (i * sr) / a.fftSize;
        if (f < LO || f > 6000) continue;
        const db = this.freq[i];
        if (db < -100) continue;
        const v = (db + 100) / 70;
        const w = f <= HI ? 1 : 0.35; // 低域を強調
        const cents = 1200 * Math.log2(f / base);
        const pc = ((cents % 1200) + 1200) % 1200;
        const k = Math.floor(pc / (1200 / 360)) % 360;
        tmp[k] = Math.max(tmp[k], v * w);
        if (f <= HI) {
          const j = Math.floor((Math.log(f / LO) / Math.log(HI / LO)) * sc.length);
          if (j >= 0 && j < sc.length) sc[j] = Math.max(sc[j], v);
        }
      }
    }
    const k1 = eng.running ? 0.12 : 0.06;
    for (let k = 0; k < 360; k++) this.bins[k] += (Math.min(1, tmp[k]) - this.bins[k]) * k1;
    for (let j = 0; j < sc.length; j++) this.scope[j] += (Math.min(1, sc[j]) - this.scope[j]) * k1;
  }

  draw() {
    const { g, cv, eng } = this;
    const W = cv.width, H = cv.height;
    const col = this.colors();
    const dpr = this.dpr;
    g.clearRect(0, 0, W, H);
    this.analyse();
    const cx = W / 2, cy = H / 2;
    const breath = eng.breathState();
    const bx = breath ? breath.x : 0.5;
    const R0 = Math.min(W, H) * 0.34;
    const R = R0 * (breath && !this.reduced ? 0.95 + 0.06 * bx : 1);
    const ang = (c) => (c / 1200) * TAU - Math.PI / 2;
    const mono = (px) => `${px * dpr}px "IBM Plex Mono", ui-monospace, monospace`;

    // 外周目盛り：10¢刻み、50¢中、100¢（12平均律）は長く
    for (let c = 0; c < 1200; c += 10) {
      const a = ang(c);
      const major = c % 100 === 0, mid = c % 50 === 0;
      const r1 = R + (major ? 4 : 8) * dpr, r2 = R + (major ? 20 : mid ? 14 : 11) * dpr;
      g.strokeStyle = major ? col.brass : col.line;
      g.globalAlpha = major ? 0.9 : 0.7;
      g.lineWidth = (major ? 1.4 : 1) * dpr;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.stroke();
    }
    g.globalAlpha = 1;
    // 12平均律の目盛り値（16進の100¢単位）
    g.fillStyle = col.mute;
    g.font = mono(8.5);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = ang(i * 100), r = R + 30 * dpr;
      g.fillText(`${(i * 100).toString(16).toUpperCase().padStart(3, '0')}`, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }

    // スペクトル環（ピッチクラスへ折り畳み）
    g.strokeStyle = col.cyan;
    g.lineWidth = 2 * dpr;
    for (let k = 0; k < 360; k++) {
      const v = this.bins[k];
      if (v < 0.04) continue;
      const a = (k / 360) * TAU - Math.PI / 2;
      const r1 = R + 36 * dpr, r2 = r1 + v * R0 * 0.32;
      g.globalAlpha = 0.25 + 0.6 * v;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.stroke();
    }
    g.globalAlpha = 1;

    // 基準円
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.strokeStyle = col.brass;
    g.globalAlpha = 0.6;
    g.lineWidth = 1.2 * dpr;
    g.stroke();
    g.globalAlpha = 1;

    // 低域スコープ（内側の弧：下側を左=20Hz → 右=500Hz、対数）
    const Rs = R * 0.62, aS = Math.PI + 0.15, aE = -0.15;
    const scopeAng = (x) => aS - x * (aS - aE);
    g.beginPath();
    g.arc(cx, cy, Rs, aE, aS, false);
    g.strokeStyle = col.line;
    g.lineWidth = 1 * dpr;
    g.stroke();
    const n = this.scope.length;
    for (let j = 0; j < n; j++) {
      const v = this.scope[j];
      const aa = scopeAng((j + 0.5) / n);
      const r1 = Rs, r2 = Rs - v * R0 * 0.22;
      g.strokeStyle = col.cyan;
      g.globalAlpha = 0.2 + 0.7 * v;
      g.lineWidth = 1.6 * dpr;
      g.beginPath();
      g.moveTo(cx + Math.cos(aa) * r1, cy + Math.sin(aa) * r1);
      g.lineTo(cx + Math.cos(aa) * r2, cy + Math.sin(aa) * r2);
      g.stroke();
    }
    g.globalAlpha = 1;
    // スコープの目盛り（20 / 50 / 100 / 200 / 500 Hz）
    g.font = mono(8);
    g.fillStyle = col.mute;
    for (const f of [20, 40, 100, 200, 500]) {
      const aa = scopeAng(Math.log(f / LO) / Math.log(HI / LO));
      const r = Rs + 9 * dpr;
      g.fillText(String(f), cx + Math.cos(aa) * r, cy + Math.sin(aa) * r);
    }
    // F₀ の位置
    const f0 = eng.baseHz();
    if (f0 >= LO && f0 <= HI) {
      const aa = scopeAng(Math.log(f0 / LO) / Math.log(HI / LO));
      g.strokeStyle = col.brass;
      g.lineWidth = 1.4 * dpr;
      g.beginPath();
      g.moveTo(cx + Math.cos(aa) * (Rs + 3 * dpr), cy + Math.sin(aa) * (Rs + 3 * dpr));
      g.lineTo(cx + Math.cos(aa) * (Rs - R0 * 0.24), cy + Math.sin(aa) * (Rs - R0 * 0.24));
      g.stroke();
    }

    // 度数
    const cents = eng.scaleCents();
    const active = new Set(eng.activeDegrees());
    const pts = [];
    cents.forEach((c, i) => {
      const a = ang(c);
      const on = active.has(i);
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      if (on) pts.push([x, y]);
      g.beginPath();
      if (on) g.rect(x - 5 * dpr, y - 5 * dpr, 10 * dpr, 10 * dpr);
      else g.arc(x, y, 3.2 * dpr, 0, TAU);
      g.fillStyle = on ? col.brass : col.face;
      g.strokeStyle = on ? col.brass : col.mute;
      g.lineWidth = 1.2 * dpr;
      g.fill();
      g.stroke();
      const lr = R - 20 * dpr;
      g.fillStyle = on ? col.fg : col.mute;
      g.font = mono(10);
      g.fillText(`°${i.toString(16).toUpperCase()}`, cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
    });
    if (pts.length > 1) {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.strokeStyle = col.brass;
      g.globalAlpha = 0.4;
      g.lineWidth = 1 * dpr;
      g.stroke();
      g.globalAlpha = 1;
    }

    // 中心：呼吸ガイド（平文）または経過時間
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (breath && eng.running) {
      const rr = R0 * (0.12 + 0.18 * bx);
      g.beginPath();
      g.arc(cx, cy - R0 * 0.12, rr, 0, TAU);
      g.strokeStyle = col.cyan;
      g.globalAlpha = 0.5 + 0.3 * bx;
      g.lineWidth = 1.5 * dpr;
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = col.fg;
      g.font = `${15 * dpr}px "Zen Kaku Gothic New", system-ui, sans-serif`;
      g.fillText(breath.phase === 'in' ? '吸う' : '吐く', cx, cy - R0 * 0.12);
      g.font = mono(9);
      g.fillStyle = col.mute;
      g.fillText(breath.phase === 'in' ? 'Φ.IN' : 'Φ.EX', cx, cy - R0 * 0.12 + 16 * dpr);
    } else {
      g.fillStyle = col.mute;
      g.font = mono(10);
      g.fillText(`F₀ ${f0.toExponential(2).toUpperCase()} Hz`, cx, cy - R0 * 0.12);
      if (eng.running) {
        const s = Math.floor(eng.ctx.currentTime - eng.startTime);
        g.fillStyle = col.cyan;
        g.font = mono(13);
        g.fillText(`T+${s.toString(16).toUpperCase().padStart(4, '0')}`, cx, cy - R0 * 0.12 + 18 * dpr);
      }
    }
  }
}

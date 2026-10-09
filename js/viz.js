// 音階円：1オクターブ=1周。スペクトルを基音基準のピッチクラスへ折り畳み、
// 倍音が音階のどこに落ちているかを見せる。40Hz刺激は視覚的に点滅させない（光過敏への配慮）。

const TAU = Math.PI * 2;

export class ScaleCircle {
  constructor(canvas, engine) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.eng = engine;
    this.bins = new Float32Array(360);
    this.freq = null;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
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
    return { fg: v('--fg'), mute: v('--mute'), line: v('--line'), accent: v('--accent'), sea: v('--sea'), bg: v('--bg') };
  }

  draw() {
    const { g, cv, eng } = this;
    const W = cv.width, H = cv.height;
    const col = this.colors();
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const breath = eng.breathState();
    const bx = breath ? breath.x : 0.5;
    const R0 = Math.min(W, H) * 0.3;
    const R = R0 * (breath ? 0.9 + 0.12 * bx : 1);
    const ang = (c) => (c / 1200) * TAU - Math.PI / 2;
    const dpr = this.dpr;

    // スペクトル → ピッチクラスへ折り畳み
    if (eng.analyser && eng.running) {
      const a = eng.analyser;
      if (!this.freq || this.freq.length !== a.frequencyBinCount) this.freq = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(this.freq);
      const sr = eng.ctx.sampleRate, base = eng.baseHz();
      const tmp = new Float32Array(360);
      for (let i = 2; i < this.freq.length; i++) {
        const f = (i * sr) / a.fftSize;
        if (f < 25 || f > 9000) continue;
        const db = this.freq[i];
        if (db < -100) continue;
        const cents = 1200 * Math.log2(f / base);
        const pc = ((cents % 1200) + 1200) % 1200;
        const k = Math.floor(pc / (1200 / 360)) % 360;
        tmp[k] = Math.max(tmp[k], (db + 100) / 70);
      }
      for (let k = 0; k < 360; k++) this.bins[k] += (Math.min(1, tmp[k]) - this.bins[k]) * 0.18;
    } else {
      for (let k = 0; k < 360; k++) this.bins[k] *= 0.94;
    }

    // 12平均律の目盛り（微分音のずれが見える基準線）
    g.strokeStyle = col.line;
    g.lineWidth = 1 * dpr;
    for (let i = 0; i < 12; i++) {
      const a = ang(i * 100);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 6 * dpr), cy + Math.sin(a) * (R - 6 * dpr));
      g.lineTo(cx + Math.cos(a) * (R + 6 * dpr), cy + Math.sin(a) * (R + 6 * dpr));
      g.stroke();
    }

    // スペクトル環
    g.strokeStyle = col.sea;
    g.globalAlpha = 0.85;
    g.lineWidth = 2 * dpr;
    for (let k = 0; k < 360; k++) {
      const v = this.bins[k];
      if (v < 0.04) continue;
      const a = (k / 360) * TAU - Math.PI / 2;
      const r1 = R + 10 * dpr, r2 = r1 + v * R0 * 0.55;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.stroke();
    }
    g.globalAlpha = 1;

    // 基準円
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.strokeStyle = col.mute;
    g.globalAlpha = 0.5;
    g.stroke();
    g.globalAlpha = 1;

    // 音階の度数
    const cents = eng.scaleCents();
    const active = new Set(eng.activeDegrees());
    const labels = eng.scaleLabels ? eng.scaleLabels() : [];
    const pts = [];
    cents.forEach((c, i) => {
      const a = ang(c);
      const on = active.has(i);
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      if (on) pts.push([x, y]);
      g.beginPath();
      g.arc(x, y, (on ? 7 : 4) * dpr, 0, TAU);
      g.fillStyle = on ? col.accent : col.bg;
      g.strokeStyle = on ? col.accent : col.mute;
      g.lineWidth = 1.5 * dpr;
      g.fill();
      g.stroke();
      const lr = R - 24 * dpr;
      g.fillStyle = on ? col.fg : col.mute;
      g.font = `${11 * dpr}px "IBM Plex Mono", ui-monospace, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(labels[i] ?? String(i + 1), cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
    });

    // 鳴っている度数を結ぶ多角形
    if (pts.length > 1) {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.strokeStyle = col.accent;
      g.globalAlpha = 0.45;
      g.lineWidth = 1.2 * dpr;
      g.stroke();
      g.globalAlpha = 0.07;
      g.fillStyle = col.accent;
      g.fill();
      g.globalAlpha = 1;
    }

    // 中心：呼吸ガイド or 経過時間
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (breath && eng.running) {
      const rr = R0 * (0.18 + 0.32 * bx);
      g.beginPath();
      g.arc(cx, cy, rr, 0, TAU);
      g.fillStyle = col.sea;
      g.globalAlpha = 0.12 + 0.12 * bx;
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = col.fg;
      g.font = `${18 * dpr}px "Shippori Mincho", serif`;
      g.fillText(breath.phase === 'in' ? '吸う' : '吐く', cx, cy);
    } else if (eng.running) {
      const s = Math.floor(eng.ctx.currentTime - eng.startTime);
      g.fillStyle = col.mute;
      g.font = `${14 * dpr}px "IBM Plex Mono", monospace`;
      g.fillText(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, cx, cy);
    }
  }
}

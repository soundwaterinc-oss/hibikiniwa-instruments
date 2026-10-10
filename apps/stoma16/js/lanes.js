// レーン図：トラックごとに、そのトラックのループ（ポリメトリックなら長さが違う）を横幅いっぱいに描く
// 操作：打点をドラッグ → 微小タイミング（±半ステップ）／クリック → 打点の追加・削除
// キーボード：←→ ステップ移動、↑↓ トラック移動、Enter 追加/削除、[ ] 微小タイミング、Delete 削除
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const PAD = 70;

export class Lanes {
  constructor(canvas, { onEdit, onCursor }) {
    this.cv = canvas; this.onEdit = onEdit; this.onCursor = onCursor;
    this.tracks = null; this.labels = []; this.cursor = { v: 0, step: 0 }; this.drag = null;
    this.colors = [0, 1, 2, 3, 4, 5].map((v) => css(`--v${v}`));
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('keydown', (e) => this.key(e));
    new ResizeObserver(() => this.fit()).observe(canvas);
  }
  fit() { const d = Math.min(2, devicePixelRatio || 1), r = this.cv.getBoundingClientRect(); this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d); }
  set(tracks, labels, muted) { this.tracks = tracks; this.labels = labels; this.muted = muted; }

  geom() {
    const d = this.cv.width / Math.max(1, this.cv.clientWidth);
    const x0 = PAD * d, w = this.cv.width - x0 - 8 * d, lh = this.cv.height / 6;
    return { d, x0, w, lh };
  }
  xOf(tr, step, micro = 0) { const { x0, w } = this.geom(); return x0 + ((step + micro) / tr.len) * w; }

  hitAt(px, py) {
    if (!this.tracks) return null;
    const { lh, w } = this.geom();
    const v = Math.max(0, Math.min(5, Math.floor(py / lh)));
    const tr = this.tracks.tracks[v];
    const cellW = w / tr.len;
    let best = null, bd = Math.max(7, cellW * 0.4);
    for (const e of tr.events) { const dx = Math.abs(this.xOf(tr, e.step, e.micro) - px); if (dx < bd) { bd = dx; best = e; } }
    return { v, tr, ev: best, step: Math.max(0, Math.min(tr.len - 1, Math.round(((px - this.geom().x0) / w) * tr.len))) };
  }
  local(e) { const r = this.cv.getBoundingClientRect(), d = this.cv.width / r.width; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d]; }

  down(e) {
    const [x, y] = this.local(e);
    const h = this.hitAt(x, y);
    if (!h) return;
    this.cv.setPointerCapture(e.pointerId);
    this.drag = { h, x0: x, moved: false };
    this.cursor = { v: h.v, step: h.ev ? h.ev.step : h.step };
  }
  move(e) {
    if (!this.drag?.h.ev) return;
    const [x] = this.local(e);
    const { w } = this.geom(), tr = this.drag.h.tr;
    const dx = x - this.drag.x0;
    if (Math.abs(dx) > 3) this.drag.moved = true;
    if (!this.drag.moved) return;
    const micro = Math.max(-0.5, Math.min(0.5, (this.drag.h.ev.micro || 0) + (dx / w) * tr.len));
    this.drag.h.ev.microPreview = micro;
  }
  up() {
    const dr = this.drag; this.drag = null;
    if (!dr) return;
    const { h } = dr;
    if (dr.moved && h.ev) { this.onEdit({ type: 'micro', v: h.v, step: h.ev.step, micro: +(h.ev.microPreview ?? 0).toFixed(3) }); delete h.ev.microPreview; }
    else this.onEdit({ type: 'toggle', v: h.v, step: h.ev ? h.ev.step : h.step, ev: h.ev || null });
  }
  key(e) {
    if (!this.tracks) return;
    const c = this.cursor, tr = this.tracks.tracks[c.v];
    const ev = tr.events.find((x) => x.step === c.step);
    let used = true;
    if (e.key === 'ArrowRight') c.step = (c.step + 1) % tr.len;
    else if (e.key === 'ArrowLeft') c.step = (c.step - 1 + tr.len) % tr.len;
    else if (e.key === 'ArrowDown') { c.v = Math.min(5, c.v + 1); c.step = Math.min(c.step, this.tracks.tracks[c.v].len - 1); }
    else if (e.key === 'ArrowUp') { c.v = Math.max(0, c.v - 1); c.step = Math.min(c.step, this.tracks.tracks[c.v].len - 1); }
    else if (e.key === 'Enter' || e.key === ' ') this.onEdit({ type: 'toggle', v: c.v, step: c.step, ev: ev || null });
    else if ((e.key === 'Delete' || e.key === 'Backspace') && ev) this.onEdit({ type: 'toggle', v: c.v, step: c.step, ev });
    else if ((e.key === '[' || e.key === ']') && ev) this.onEdit({ type: 'micro', v: c.v, step: c.step, micro: Math.max(-0.5, Math.min(0.5, +((ev.micro || 0) + (e.key === ']' ? 0.05 : -0.05)).toFixed(3))) });
    else used = false;
    if (used) { e.preventDefault(); this.onCursor?.(c, this.tracks.tracks[c.v].events.find((x) => x.step === c.step)); }
  }

  draw(pos) {
    const g = this.cv.getContext('2d'), W = this.cv.width, H = this.cv.height;
    g.clearRect(0, 0, W, H);
    if (!this.tracks) return;
    const { d, x0, w, lh } = this.geom();
    g.font = `${11 * d}px "IBM Plex Mono", monospace`; g.textBaseline = 'middle';
    for (const tr of this.tracks.tracks) {
      const v = tr.v, y = v * lh;
      g.fillStyle = v % 2 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.035)'; g.fillRect(x0, y, w, lh);
      g.fillStyle = this.muted?.[v] ? '#56625f' : this.colors[v];
      g.fillText(this.labels[v] || '', 6 * d, y + lh / 2 - 6 * d);
      g.fillStyle = '#8b949b'; g.fillText(`L=${tr.len}`, 6 * d, y + lh / 2 + 7 * d);
      // そのトラックの格子（拍の位置を強く）
      for (let s = 0; s < tr.len; s++) {
        const beat = (s * 4) / tr.div;
        g.fillStyle = Math.abs(beat - Math.round(beat)) < 1e-9 ? 'rgba(196,166,105,0.45)' : 'rgba(139,148,155,0.22)';
        g.fillRect(x0 + (s / tr.len) * w, y + lh - 5 * d, 1 * d, 5 * d);
      }
      for (const e of tr.events) {
        const x = this.xOf(tr, e.step, e.microPreview ?? e.micro);
        const hh = (lh - 12 * d) * e.vel;
        g.globalAlpha = this.muted?.[v] ? 0.25 : 0.95;
        g.fillStyle = this.colors[v];
        g.fillRect(x - 1.5 * d, y + (lh - hh) / 2, 3 * d, hh);
        if (e.anchor) { g.strokeStyle = '#c4a669'; g.lineWidth = 1 * d; g.strokeRect(x - 3 * d, y + 3 * d, 6 * d, lh - 6 * d); }
        g.globalAlpha = 1;
      }
      // 再生位置（トラックごとのループで）
      if (pos) { const p = ((pos.beat / (4 / tr.div)) % tr.len) / tr.len; g.fillStyle = '#d6d9d3'; g.fillRect(x0 + p * w, y, 1.5 * d, lh); }
      // キーボードのカーソル
      if (document.activeElement === this.cv && this.cursor.v === v) { g.strokeStyle = '#7db7bb'; g.lineWidth = 1.5 * d; g.strokeRect(x0 + (this.cursor.step / tr.len) * w - 4 * d, y + 1, 8 * d, lh - 2); }
    }
  }
}

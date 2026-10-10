// 写像：細胞 → トラックごとの打点
// 時間位置 t0（0..1）を走査方式で決め、細胞の形でトラック（K T S H C Z）へ振り分け、トラックごとのループ長に量子化する
// ループ長はトラックごとに独立（ポリメトリック）。打点は { step, micro, vel, cell, anchor, pan, tone }
import { STYLES } from './styles.js';
import { U } from './analysis/morph.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 形 → トラックの点数（試作版の考え方を引き継ぐ）
export function voiceScores(c) {
  const hex = Math.max(0, 1 - Math.abs(c.nb.length - 6) / 2.5);
  return [
    c.AQ ** 2 * (0.45 + 0.55 * c.circQ) * 1.25,       // K：大きく丸い
    c.AQ ** 1.5 * (0.4 + 0.6 * c.elongQ),              // T：大きく細長い
    hex * (1 - Math.abs(c.AQ - 0.55) * 1.5),           // S：六角形的・中くらい
    (1 - c.AQ) ** 2 * 0.95,                            // H：小さい（孔辺細胞など）
    c.elongQ ** 3 * (1 - c.AQ * 0.5),                  // C：極端に細長い
    (Math.abs(c.brQ - 0.5) * 2) ** 2 * 0.85 + (1 - c.convexQ) * 0.25, // Z：明暗の外れ・ジグソー状
  ];
}

// 使う細胞（背景を除き、EDGE=EXCL なら縁に触れるものも除く）
export const cellsFor = (A, P) => A.cells.filter((c) => !c.bg && (P.edge !== 1 || !c.border));

export function centerOf(A, P) {
  if (P.center) return { cx: P.center[0], cy: P.center[1] };
  if (A.center) return { cx: A.center.cx, cy: A.center.cy };
  const k = U / Math.max(A.W, A.H);
  return { cx: (A.W * k) / 2, cy: (A.H * k) / 2 };
}

// 時間位置 0..1
export function timePositions(A, P, cells) {
  const tpos = new Map();
  const { cx, cy } = centerOf(A, P);
  const k = U / Math.max(A.W, A.H), Wn = A.W * k, Hn = A.H * k;
  let walk = [];
  if (P.mode === 'WALK' && cells.length) {
    const byId = new Map(cells.map((c) => [c.id, c]));
    let cur = cells.reduce((b, c) => (Math.hypot(c.cx - cx, c.cy - cy) < Math.hypot(b.cx - cx, b.cy - cy) ? c : b));
    const seen = new Set([cur.id]);
    let dist = 0;
    tpos.set(cur.id, 0); walk.push(cur);
    while (seen.size < cells.length) {
      let next = null, dn = Infinity;
      for (const j of cur.nb) { const n = byId.get(j); if (n && !seen.has(j)) { const d = Math.hypot(n.cx - cur.cx, n.cy - cur.cy); if (d < dn) { dn = d; next = n; } } }
      if (!next) { for (const c of cells) if (!seen.has(c.id)) { const d = Math.hypot(c.cx - cur.cx, c.cy - cur.cy); if (d < dn) { dn = d; next = c; } } dn = Math.min(dn, 40); }
      dist += dn; tpos.set(next.id, dist); seen.add(next.id); walk.push(next); cur = next;
    }
    const total = dist + 20;
    for (const [id, v] of tpos) tpos.set(id, v / total);
  } else if (P.mode === 'RASTER') {
    for (const c of cells) {
      const band = Math.min(P.bars - 1, Math.floor((c.cy / Hn) * P.bars));
      tpos.set(c.id, (band + c.cx / Wn) / P.bars);
    }
  } else {
    // SWEEP：同心円構造があれば環で小節を分ける（外側の環から内側へ）。なければ中心からの距離で分ける
    const maxR = Math.max(...cells.map((c) => Math.hypot(c.cx - cx, c.cy - cy)), 1);
    const useRings = A.center && A.center.method !== 'none' && !P.center;
    for (const c of cells) {
      const a = (Math.atan2(c.cx - cx, -(c.cy - cy)) + 2 * Math.PI) % (2 * Math.PI);
      let bar;
      if (useRings && c.ring !== undefined) bar = Math.min(P.bars - 1, Math.floor((c.ring / A.center.nRings) * P.bars));
      else bar = Math.min(P.bars - 1, Math.floor((Math.hypot(c.cx - cx, c.cy - cy) / (maxR + 1e-6)) * P.bars));
      tpos.set(c.id, (bar + a / (2 * Math.PI)) / P.bars);
    }
  }
  return { tpos, walk };
}

// 組織クラスごとの「好むトラック」：クラスに属する細胞の点数の平均
function classProfiles(cells) {
  const prof = new Map();
  for (const c of cells) {
    if (c.cls === undefined) continue;
    const s = voiceScores(c);
    const e = prof.get(c.cls) || { n: 0, s: Array(6).fill(0) };
    e.n++; s.forEach((v, i) => { e.s[i] += v; });
    prof.set(c.cls, e);
  }
  for (const e of prof.values()) e.s = e.s.map((v) => v / e.n);
  return prof;
}

// トラックのループ長（ステップ数）。div：1小節の分割数
export function loopLength(P, v, div, perims) {
  const bar = div * P.bars;
  if (P.poly === 'MAN' && P.vlen[v] !== 'BAR') return Number(P.vlen[v]);
  if (P.poly === 'AUTO' && perims.length) {
    // 細胞の周長が長いトラックほど長いループ（16/12/10/7 から選ぶ）
    const mean = perims.reduce((s, x) => s + x, 0) / perims.length;
    return mean > 70 ? 16 : mean > 48 ? 12 : mean > 32 ? 10 : 7;
  }
  return bar;
}

// E：EVO の状態（mask・dens・rot・cellFilter）。null なら固定ループ
export function buildTracks(A, P, E = null) {
  const st = STYLES[P.style];
  const all = cellsFor(A, P);
  const cells = E?.cellFilter ? all.filter(E.cellFilter) : all;
  const { tpos, walk } = timePositions(A, P, all);
  const prof = classProfiles(all);
  const raw = Array.from({ length: 6 }, () => []);
  const muted = new Set(P.muted || []);
  for (const c of cells) {
    let sc = voiceScores(c);
    const cp = prof.get(c.cls);
    if (cp && P.clsw > 0) sc = sc.map((s, i) => (1 - P.clsw) * s + P.clsw * cp.s[i]);
    sc = sc.map((s, i) => s * P.vbias[i]);
    let v = 0; for (let i = 1; i < 6; i++) if (sc[i] > sc[v]) v = i;
    if (E && !E.mask[v]) continue;
    if (muted.has(`${c.id}:${v}`)) continue;
    raw[v].push({ c, t0: tpos.get(c.id) ?? 0, score: sc[v] });
  }
  const tracks = [];
  for (let v = 0; v < 6; v++) {
    const div = st.div[v];
    const len = loopLength(P, v, div, raw[v].map((e) => e.c.per));
    const dEff = clamp(E ? E.dens : P.dens, 0.05, 1);
    const cap = Math.max(1, Math.round(1 + dEff * (len * 0.75 - 1)));
    const list = raw[v].sort((a, b) => b.score - a.score).slice(0, cap);
    const maxS = Math.max(...list.map((e) => e.score), 1e-6);
    const used = new Set();
    const rot = E?.rot?.[v] || 0;
    const evs = [];
    for (const e of list) {
      const x = e.t0 * len;
      let step = ((Math.round(x) + rot) % len + len) % len;
      const micro = (x - Math.round(x)) * (1 - P.q);
      if (P.q > 0.97 && used.has(step)) continue;
      used.add(step);
      const vel = 0.45 + 0.55 * (e.score / maxS);
      const ang = e.c.angle;
      evs.push({
        step, micro, vel, cell: e.c.id, anchor: false,
        pan: P.ang === 'PAN' || P.ang === 'BOTH' ? Math.sin(2 * ang) * 0.8 : ((e.c.cx / U) * 2 - 1) * 0.75,
        tone: P.ang === 'TONE' || P.ang === 'BOTH' ? (ang + Math.PI / 2) / Math.PI : null,
        aQ: e.c.AQ, eQ: e.c.elongQ, per: e.c.per,
      });
    }
    tracks.push({ v, div, len, events: evs });
  }
  // アンカー：スタイルが定める拍の頭に必ず打点を置く
  if (P.anchor) {
    for (const an of st.anchor) {
      const t = tracks[an.v];
      if (E && !E.mask[an.v]) continue;
      const barSteps = t.div;
      const bars = Math.max(1, Math.floor(t.len / barSteps));
      for (let b = 0; b < bars; b++) for (const s of an.steps) {
        const step = (b * barSteps + s) % t.len;
        const hit = t.events.find((e) => e.step === step);
        if (hit) { hit.anchor = true; hit.micro = 0; hit.vel = Math.max(hit.vel, 0.9); }
        else t.events.push({ step, micro: 0, vel: 0.92, cell: -1, anchor: true, pan: 0, tone: null, aQ: 0.6, eQ: 0.5, per: 60 });
      }
    }
  }
  // 手で足した打点・微小タイミング
  for (const a of P.added || []) { const t = tracks[a.v]; if (t && (!E || E.mask[a.v]) && !t.events.some((e) => e.step === a.step % t.len)) t.events.push({ step: a.step % t.len, micro: 0, vel: 0.8, cell: -1, anchor: false, pan: 0, tone: null, aQ: 0.5, eQ: 0.5, per: 50 }); }
  for (const t of tracks) for (const e of t.events) { const m = P.micro?.[`${t.v}:${e.step}`]; if (m !== undefined) e.micro = m; }
  // IKD：高域トーン（T・H）の1小節あたりの総量を制限
  if (st.hiCap) {
    for (const v of [1, 3]) {
      const t = tracks[v];
      const perBar = t.events.reduce((s, e) => s + e.vel, 0) / Math.max(1, t.len / t.div);
      if (perBar > st.hiCap) { const k = st.hiCap / perBar; t.events.forEach((e) => { e.vel *= k; }); }
    }
  }
  // BDM：MPC の16段階ベロシティ（アンカー・手で足した打点も含めて最後にそろえる）
  if (st.vel16) for (const t of tracks) for (const e of t.events) e.vel = Math.max(1, Math.round(e.vel * 16)) / 16;
  for (const t of tracks) t.events.sort((a, b) => a.step - b.step);
  return { tracks, walk, tpos, count: tracks.reduce((s, t) => s + t.events.length, 0) };
}

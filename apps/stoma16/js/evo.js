// 自動展開（EVO）：ループが1周するたびに構成を進める。SEED を固定すると展開を再現できる
//   型：ARC / DUB / MIN / DRF / TISSUE（組織を外側から内側へ）
//   BUILD（§BLD）では密度とフィルターを区間内で指数的に上げ、BREAK（§BRK）ではダブディレイの帰還を自動で上げ下げする
//   STYLE CYCLE では区間が変わるたびに次のスタイルへ段階的に移す（morph 0→1）
import { rng } from './rng.js';
import { SECTION_CODES } from './codebook.js';
import { STYLE_IDS } from './styles.js';

// mask：鳴らすトラック（K T S H C Z）/ dens：密度 [始, 終] / lp：フィルターの開き [始, 終] / dly：残響送りの倍率
export const SECTIONS = {
  INT: { mask: [1, 0, 0, 1, 0, 0], dens: [0.35, 0.35], lp: [0.35, 0.55], dly: 0.6 },
  BLD: { mask: [1, 1, 1, 1, 0, 0], dens: [0.25, 0.85], lp: [0.3, 1], dly: 0.8, exp: true },
  PK: { mask: [1, 1, 1, 1, 1, 1], dens: [0.85, 0.85], lp: [1, 1], dly: 1 },
  BRK: { mask: [0, 1, 0, 0, 1, 1], dens: [0.5, 0.5], lp: [0.5, 0.5], dly: 1.6, fbAuto: true },
  DRP: { mask: [1, 1, 0, 0, 0, 0], dens: [0.6, 0.6], lp: [0.75, 0.75], dly: 0.4 },
  ECH: { mask: [0, 0, 1, 0, 0, 1], dens: [0.3, 0.3], lp: [0.6, 0.6], dly: 2.2 },
  OUT: { mask: [1, 0, 0, 1, 0, 1], dens: [0.3, 0.3], lp: [1, 0.3], dly: 1.2 },
  DRF: { mask: [1, 1, 1, 1, 1, 1], dens: [0.6, 0.6], lp: [0.85, 0.85], dly: 1 },
  ADD: { mask: [1, 1, 1, 1, 1, 1], dens: [0.6, 0.6], lp: [0.9, 0.9], dly: 1 },
  RNG: { mask: [1, 1, 1, 1, 1, 1], dens: [0.7, 0.7], lp: [0.9, 0.9], dly: 1 },
};
export const FORMS = {
  ARC: ['INT', 'BLD', 'PK', 'BRK', 'PK', 'OUT'],
  DUB: ['DRP', 'ECH', 'PK', 'ECH', 'DRP', 'BRK'],
  MIN: ['ADD'],
  DRF: ['DRF'],
  TISSUE: ['RNG'],
};

// 組織の色 → 区間で使う音色（TISSUE で組織ごとに音色が変わる）
const TISSUE_MODEL = { R: 'MBR', B: 'WOD', W: 'GLS', G: 'LEF', Y: 'KLM', V: 'VOX', N: 'IMP', K: 'BIT', C: 'DRP' };

const lerp = (a, b, x) => a + (b - a) * x;
const expo = (a, b, x) => a * Math.pow(b / Math.max(1e-6, a), x);

export function createEvo(P, A, { seed = P.seed || ((Math.random() * 1e9) >>> 0) } = {}) {
  const E = { seed, R: rng(seed), sec: 0, loop: 0, total: 0, addStep: 1, cell: -1, styleFrom: P.style, styleTo: P.style, morph: 1 };
  E.order = trackOrder(A);
  const cells = A.cells.filter((c) => !c.bg);
  const { cx, cy } = A.center || { cx: 128, cy: 128 };
  const near = cells.reduce((b, c) => (!b || Math.hypot(c.cx - cx, c.cy - cy) < Math.hypot(b.cx - cx, b.cy - cy) ? c : b), null);
  E.cell = near ? near.id : -1;
  apply(E, P, A);
  return E;
}

// MIN：打点の多いトラックから順に入る（K は常に先頭）
function trackOrder(A) {
  const cnt = [0, 0, 0, 0, 0, 0];
  for (const c of A.cells) if (!c.bg && c.cls !== undefined) cnt[c.cls % 6]++;
  return [0, 1, 2, 3, 4, 5].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : cnt[b] - cnt[a] || a - b));
}

export function sectionKey(E, P) { const seq = FORMS[P.form]; return seq[E.sec % seq.length]; }

// 区間の状態を P・A から計算して E に書き込む
export function apply(E, P, A) {
  const key = sectionKey(E, P), sec = SECTIONS[key];
  const prog = P.phr > 1 ? E.loop / (P.phr - 1) : 1;
  E.key = key;
  E.prog = prog;
  E.cellFilter = null;
  E.modelOverride = null;
  if (key === 'ADD') {
    const k = E.addStep, n = k <= 6 ? k : 12 - k;
    E.mask = [0, 0, 0, 0, 0, 0];
    E.order.slice(0, Math.max(1, n)).forEach((v) => { E.mask[v] = 1; });
  } else E.mask = sec.mask.slice();
  if (key === 'RNG') {
    // TISSUE：外側の環から内側へ。その環の細胞だけを鳴らし、環で多い組織の色で音色を選ぶ
    const nR = A.center?.nRings || 4;
    const ring = E.sec % nR;
    E.ring = ring;
    // c.ring は外側＝0、中心＝nR−1（concentric.js）
    E.cellFilter = (c) => (c.ring ?? 0) === ring;
    const counts = new Map();
    for (const c of A.cells) if (!c.bg && (c.ring ?? 0) === ring && c.cls !== undefined) counts.set(c.cls, (counts.get(c.cls) || 0) + 1);
    const dom = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const cl = A.classes?.list.find((x) => x.id === dom);
    E.tissue = cl ? cl.code : null;
    const model = cl ? TISSUE_MODEL[cl.color] || 'NAT' : 'NAT';
    E.modelOverride = [null, model, model, null, model, null]; // K・H は芯として残す
  }
  const wob = 1 + (E.R() * 2 - 1) * 0.25 * P.rate;
  const d = sec.exp ? expo(sec.dens[0], sec.dens[1], prog) : lerp(sec.dens[0], sec.dens[1], prog);
  E.dens = Math.min(1, Math.max(0.05, d * wob * (0.6 + P.dens * 0.8)));
  E.lp = sec.exp ? expo(sec.lp[0], sec.lp[1], prog) : lerp(sec.lp[0], sec.lp[1], prog);
  E.dly = sec.dly;
  E.fbAuto = !!sec.fbAuto;
  E.fill = P.phr > 1 && E.loop === P.phr - 1 && P.rate > 0.1;
  E.name = `${SECTION_CODES[key].code}${key === 'RNG' ? `${E.ring}` : ''} ${E.loop + 1}/${P.phr}`;
  // STYLE CYCLE：区間内で morph を 0→1 に進める
  E.morph = P.cyc ? Math.min(1, (E.loop + 1) / Math.max(1, P.phr)) : 1;
  return E;
}

// ループ境界ごとに呼ぶ。区間を進め、走査の中心を隣の細胞へ渡し、パターンを少しずらす
export function step(E, P, A) {
  E.total++; E.loop++;
  let changed = false;
  if (E.loop >= P.phr) {
    E.loop = 0; E.sec++; E.addStep = (E.addStep % 11) + 1; changed = true;
    if (P.cyc) { E.styleFrom = E.styleTo; E.styleTo = STYLE_IDS[(STYLE_IDS.indexOf(E.styleTo) + 1) % STYLE_IDS.length]; }
  }
  // 漂流：中心が隣の細胞へ（DRF は毎ループ）
  const cells = A.cells;
  const cur = cells[E.cell];
  E.center = null;
  if (cur && cur.nb.length && (P.form === 'DRF' || E.R() < P.rate * 0.7)) {
    const nx = cells[cur.nb[Math.floor(E.R() * cur.nb.length)]];
    if (nx && !nx.bg) { E.cell = nx.id; E.center = [nx.cx, nx.cy]; }
  }
  // 変異：あるトラックのパターンを数ステップ回す
  E.rot = E.rot || [0, 0, 0, 0, 0, 0];
  if (E.R() < P.rate * 0.35) { const v = Math.floor(E.R() * 6); E.rot[v] += (E.R() < 0.5 ? -1 : 1) * (1 + Math.floor(E.R() * 3)); }
  if (changed) E.rot = E.rot.map((r) => (E.R() < 0.5 ? 0 : r));
  apply(E, P, A);
  return { changed };
}

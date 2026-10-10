// STOMA//16 のパラメータ定義（共通基盤のスキーマ駆動UIで計器盤を作る）
import { GROUP_CODES, PARAM_CODES, OPTION_CODES } from './codebook.js';
import { STYLES } from './styles.js';

export const GROUPS = Object.entries(GROUP_CODES).map(([id, g]) => ({ id, ...g }));
const opts = (key) => Object.entries(OPTION_CODES[key]).map(([v, [c, p]]) => [isNaN(+v) ? v : +v, c, p]);

const RAW = [
  { key: 'ch', group: 'seg', type: 'select', def: 3, options: opts('ch'), seg: 1 },
  { key: 'inv', group: 'seg', type: 'select', def: 0, options: opts('inv'), seg: 1 },
  { key: 'res', group: 'seg', type: 'select', def: 384, options: opts('res'), seg: 1 },
  { key: 'sig', group: 'seg', min: 0.6, max: 3, step: 0.1, def: 1, seg: 1, unit: '×' },
  { key: 'hi', group: 'seg', min: 0.1, max: 0.8, step: 0.01, def: 0.36, seg: 1 },
  { key: 'lo', group: 'seg', min: 0.05, max: 0.6, step: 0.01, def: 0.2, seg: 1 },
  { key: 'gap', group: 'seg', min: 0, max: 16, step: 1, def: 6, seg: 1, unit: 'px' },
  { key: 'mina', group: 'seg', min: 4, max: 120, step: 1, def: 14, seg: 1, unit: 'px²' },
  { key: 'fill', group: 'seg', min: 0, max: 6, step: 0.1, def: 2.6, seg: 1, off: true },
  { key: 'merge', group: 'seg', min: 0, max: 0.9, step: 0.01, def: 0.55, seg: 1, off: true },
  { key: 'lin', group: 'seg', min: 0, max: 20, step: 1, def: 0, seg: 1, off: true, unit: 'px' },
  { key: 'edge', group: 'seg', type: 'select', def: 1, options: opts('edge'), seg: 1 },

  { key: 'mode', group: 'map', type: 'select', def: 'SWEEP', options: opts('mode') },
  { key: 'bars', group: 'map', type: 'select', def: 2, options: opts('bars') },
  { key: 'q', group: 'map', min: 0, max: 1, step: 0.01, def: 0.85 },
  { key: 'dens', group: 'map', min: 0.05, max: 1, step: 0.01, def: 0.55 },
  { key: 'anchor', group: 'map', type: 'select', def: 1, options: opts('anchor') },
  { key: 'poly', group: 'map', type: 'select', def: 'OFF', options: opts('poly') },
  { key: 'clsw', group: 'map', min: 0, max: 1, step: 0.01, def: 0.5 },
  { key: 'ang', group: 'map', type: 'select', def: 'OFF', options: opts('ang') },

  { key: 'bpm', group: 'clk', min: 60, max: 180, step: 1, def: 118, unit: 'BPM' },
  { key: 'f0', group: 'clk', min: 27.5, max: 110, step: 0.01, def: 41.2, unit: 'Hz', log: true },
  { key: 'swg', group: 'clk', min: 0.5, max: 0.75, step: 0.01, def: 0.5, unit: '%' },
  { key: 'hum', group: 'clk', min: 0, max: 2, step: 0.01, def: 1, unit: '×' },
  { key: 'vol', group: 'clk', min: 0, max: 1, step: 0.01, def: 0.7 },

  { key: 'evo', group: 'evo', type: 'select', def: 0, options: opts('evo') },
  { key: 'form', group: 'evo', type: 'select', def: 'ARC', options: opts('form') },
  { key: 'phr', group: 'evo', type: 'select', def: 2, options: opts('phr') },
  { key: 'rate', group: 'evo', min: 0, max: 1, step: 0.01, def: 0.5 },
  { key: 'seed', group: 'evo', min: 0, max: 9999, step: 1, def: 0, off: true, offLabel: 'RND' },
  { key: 'cyc', group: 'evo', type: 'select', def: 0, options: opts('cyc') },

  { key: 'dly', group: 'fx', min: 0, max: 0.8, step: 0.01, def: 0.42 },
  { key: 'dfb', group: 'fx', min: 0, max: 0.92, step: 0.01, def: 0.58 },
  { key: 'spr', group: 'fx', min: 0, max: 1, step: 0.01, def: 0.35, off: true },
  { key: 'sc', group: 'fx', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'wow', group: 'fx', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'crsh', group: 'fx', min: 0, max: 14, step: 1, def: 0, off: true, unit: 'bit' },
  { key: 'lofi', group: 'fx', min: 2000, max: 20000, step: 100, def: 14000, log: true, unit: 'Hz' },
  { key: 'crkl', group: 'fx', min: 0, max: 30, step: 0.5, def: 0, off: true, unit: '/s' },
  { key: 'hiss', group: 'fx', min: 0, max: 0.05, step: 0.001, def: 0.004, off: true },
];

export const PARAMS = RAW.map((p) => ({ ...p, ...PARAM_CODES[p.key] }));
export const PARAM_BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

const six = (v) => Array(6).fill(v);
export const DEFAULTS = {
  ...Object.fromEntries(PARAMS.map((p) => [p.key, p.def])),
  style: 'TWL', specimen: 'cork', specSeed: 1, center: null,
  // トラックごと（K T S H C Z）
  vmodel: six('NAT'), vlvl: [0.9, 0.8, 0.75, 0.6, 0.6, 0.55], vtun: six(0), vdcy: six(1), vbias: six(1), vmute: six(0),
  vlen: six('BAR'), vm1: six(0.5), vm2: six(0.5),
  micro: {}, // レーン図で動かした微小タイミング：{ "v:step": ずれ（ステップの割合 -0.5..0.5）}
  muted: [], added: [],
};

// スタイルを選んだときに入れる値
export function styleParams(id) {
  const s = STYLES[id];
  return { style: id, bpm: s.bpm, swg: s.swg, q: s.q, dly: s.fx.dly, dfb: s.fx.dfb, spr: s.fx.spr, sc: s.fx.sc, wow: s.fx.wow, crsh: s.fx.crsh, lofi: s.fx.lofi, crkl: s.fx.crkl, hiss: s.fx.hiss };
}

// 旧版（試作 TEST.0、version 1 相当）の設定を変換する
export function migrateV1(p = {}) {
  const out = { ...p };
  if ('thr' in p) { out.hi = Math.min(0.8, Math.max(0.1, 0.2 + p.thr * 4)); out.lo = out.hi * 0.55; delete out.thr; }
  if ('swg' in p && p.swg <= 0.5 && !('version2' in p)) out.swg = Math.min(0.75, 0.5 + p.swg * 0.5); // 16分の割合 → MPC %
  if ('specimen' in p && p.specimen === 'user') out.specimen = 'cork';
  for (const k of ['grow', 'blr', 'rotate', 'vrot']) delete out[k];
  if (out.center && !Array.isArray(out.center)) out.center = null;
  return out;
}

export function normalizeImport(obj) {
  const src = obj?.params || obj || {};
  const p = obj?.version === 2 ? src : migrateV1(src);
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (!(k in DEFAULTS)) continue;
    const s = PARAM_BY_KEY[k];
    if (!s) { out[k] = v; continue; }
    if (s.type === 'select') { const vals = s.options.map((o) => o[0]); out[k] = vals.find((x) => String(x) === String(v)) ?? s.def; }
    else { const n = Number(v); out[k] = Number.isFinite(n) ? Math.min(s.max, Math.max(s.min, n)) : s.def; }
  }
  if (out.style && !STYLES[out.style]) delete out.style;
  return out;
}

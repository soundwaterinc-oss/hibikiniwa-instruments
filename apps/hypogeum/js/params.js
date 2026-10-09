// パラメータ定義（UIはこのスキーマから自動生成される）
// 表示名は codebook.js から引く。log: 対数スライダー / off: 0を「オフ」と表示
import { GROUP_CODES, PARAM_CODES, LEGACY_KEYS } from './codebook.js';

export const GROUPS = Object.entries(GROUP_CODES).map(([id, g]) => ({ id, ...g }));

const ENGINE_IDS = ['add', 'sin', 'reese', 'fm2', 'fold', 'undr', 'ladder', 'pwm', 'organ', 'kargyraa', 'didj', 'bow', 'tape'];

const RAW = [
  // §0x1 TUN 調律（低域 20〜250Hz）
  { key: 'f0', group: 'tuning', min: 20, max: 250, step: 0.01, def: 41.2, unit: 'Hz', log: true },
  { key: 'dc', group: 'tuning', min: -100, max: 100, step: 1, def: 0, unit: '¢' },
  { key: 'subK', group: 'tuning', min: 0, max: 1, step: 0.01, def: 0.3 },
  { key: 'hiK', group: 'tuning', min: 0, max: 1, step: 0.01, def: 0.35 },

  // §0x2 EXC 駆動モード
  { key: 'exc', group: 'mode', type: 'select', def: 'sustain', options: ['sustain', 'tanpura', 'hybrid'] },
  { key: 'cyc', group: 'mode', min: 1.2, max: 10, step: 0.1, def: 3.6, unit: 's' },
  { key: 'tau', group: 'mode', min: 1, max: 12, step: 0.1, def: 5, unit: 's' },
  { key: 'jaw', group: 'mode', min: 0, max: 1, step: 0.01, def: 0.55 },

  // §0x3 GEN 音色エンジン
  { key: 'eng', group: 'gen', type: 'select', def: 'add', options: ENGINE_IDS },
  { key: 'ma', group: 'gen', min: 0, max: 1, step: 0.01, def: 0.35, macro: 0 },
  { key: 'mb', group: 'gen', min: 0, max: 1, step: 0.01, def: 0.35, macro: 1 },
  { key: 'mc', group: 'gen', min: 0, max: 1, step: 0.01, def: 0.35, macro: 2 },
  { key: 'hN', group: 'gen', min: 1, max: 48, step: 1, def: 10 },
  { key: 'rho', group: 'gen', min: 0.4, max: 3, step: 0.01, def: 1.4 },
  { key: 'oe', group: 'gen', min: -1, max: 1, step: 0.01, def: -0.2 },
  { key: 'uni', group: 'gen', min: 1, max: 5, step: 1, def: 3 },
  { key: 'dt', group: 'gen', min: 0, max: 30, step: 0.1, def: 5, unit: '¢' },
  { key: 'lpw', group: 'gen', min: 60, max: 8000, step: 1, def: 1200, unit: 'Hz', log: true },
  { key: 'lpq', group: 'gen', min: 0.1, max: 14, step: 0.01, def: 0.8 },

  // §0x4 DRF 有機的揺らぎ
  { key: 'dfc', group: 'drift', min: 0, max: 40, step: 0.1, def: 6, unit: '¢' },
  { key: 'dfr', group: 'drift', min: 0.003, max: 0.6, step: 0.001, def: 0.04, unit: 'Hz', log: true },
  { key: 'dfa', group: 'drift', min: 0, max: 1, step: 0.01, def: 0.35 },
  { key: 'wid', group: 'drift', min: 0, max: 1, step: 0.01, def: 0.7 },

  // §0x5 Γ40 療法レイヤー
  { key: 'ghz', group: 'therapy', min: 0.5, max: 60, step: 0.1, def: 40, unit: 'Hz', log: true },
  { key: 'amd', group: 'therapy', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'ams', group: 'therapy', type: 'select', def: 'sine', options: ['sine', 'pulse'] },
  { key: 'iso', group: 'therapy', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'bin', group: 'therapy', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'car', group: 'therapy', min: 120, max: 1000, step: 0.1, def: 220, unit: 'Hz', log: true },
  { key: 'carL', group: 'therapy', type: 'select', def: 'on', options: ['on', 'off'] },

  // §0x6 Φ.RSP 共鳴呼吸
  { key: 'pbpm', group: 'breath', min: 0, max: 12, step: 0.1, def: 0, unit: '/min', off: true },
  { key: 'pin', group: 'breath', min: 0.2, max: 0.6, step: 0.01, def: 0.4 },
  { key: 'pamp', group: 'breath', min: 0, max: 1, step: 0.01, def: 0.45 },
  { key: 'pflt', group: 'breath', min: 0, max: 1, step: 0.01, def: 0.5 },

  // §0x7 SPC 空間・低域マスター
  { key: 'rvb', group: 'space', min: 0, max: 1, step: 0.01, def: 0.3 },
  { key: 'rvt', group: 'space', min: 1, max: 20, step: 0.1, def: 9, unit: 's' },
  { key: 'dly', group: 'space', min: 0, max: 0.8, step: 0.01, def: 0.1 },
  { key: 'dlt', group: 'space', min: 0.05, max: 2, step: 0.01, def: 0.83, unit: 's' },
  { key: 'dlf', group: 'space', min: 0, max: 0.9, step: 0.01, def: 0.45 },
  { key: 'hpf', group: 'space', min: 18, max: 30, step: 0.1, def: 22, unit: 'Hz' },
  { key: 'monoX', group: 'space', min: 60, max: 250, step: 1, def: 120, unit: 'Hz', log: true },
  { key: 'psy', group: 'space', min: 0, max: 1, step: 0.01, def: 0.25, off: true },
  { key: 'drv', group: 'space', min: 0, max: 1, step: 0.01, def: 0, off: true },

  // §0x8 SES セッション
  { key: 'vol', group: 'session', min: 0, max: 1, step: 0.01, def: 0.55 },
  { key: 'fin', group: 'session', min: 0, max: 60, step: 1, def: 8, unit: 's' },
  { key: 'ses', group: 'session', min: 0, max: 120, step: 1, def: 0, unit: 'min', off: true, offLabel: '∞' },
  { key: 'fout', group: 'session', min: 2, max: 180, step: 1, def: 30, unit: 's' },
];

export const PARAMS = RAW.map((p) => ({ ...p, ...PARAM_CODES[p.key] }));

export const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));
DEFAULTS.scl = 'ryukyu-just';
DEFAULTS.deg = [0, 3];
DEFAULTS.cst = '';

export const PARAM_BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

// 値を範囲に収める。基音はオクターブ単位で 20〜250Hz に折り畳む（音名を保つ）
export function sanitize(key, v) {
  const p = PARAM_BY_KEY[key];
  if (!p) return v;
  if (p.type === 'select') return p.options.includes(v) ? v : p.def;
  let n = Number(v);
  if (!Number.isFinite(n)) return p.def;
  if (key === 'f0') {
    while (n > p.max) n /= 2;
    while (n < p.min) n *= 2;
    return +n.toFixed(2);
  }
  return Math.min(p.max, Math.max(p.min, n));
}

// v1（KUKURU, app:'kukuru-drone'）の params を v2 のキーへ変換
export function migrateV1(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    const nk = LEGACY_KEYS[k];
    if (nk) out[nk] = nk in PARAM_BY_KEY ? sanitize(nk, v) : v;
  }
  return out;
}

// 任意のJSON（v1 / v2 / 素のparams）を v2 の params へ
export function normalizeImport(obj) {
  const src = obj?.params || obj || {};
  const isV1 = obj?.app === 'kukuru-drone' || obj?.version === 1 || 'rootHz' in src || 'scaleId' in src;
  const p = isV1 ? migrateV1(src) : src;
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (!(k in DEFAULTS)) continue;
    out[k] = k in PARAM_BY_KEY ? sanitize(k, v) : v;
  }
  return out;
}

// シーン（プログラム）。指定されていない値はデフォルトに戻す。
export const SCENES = [
  { id: 'gamma40', desc: '琉球純正のドローンに40Hzの振幅変調とクリック音を重ねる',
    params: { scl: 'ryukyu-just', deg: [0, 3], f0: 55, amd: 0.55, ams: 'pulse', iso: 0.12, ghz: 40, car: 440, carL: 'off' } },
  { id: 'resonance6', desc: '0.1Hzの音の満ち引きで、吸う4秒・吐く6秒へ導く',
    params: { scl: 'yaman', deg: [0, 4], f0: 65.41, pbpm: 6, pin: 0.4, pamp: 0.55, pflt: 0.6, rvb: 0.45 } },
  { id: 'theta-rest', desc: '6Hzのバイノーラルビート。ヘッドホン必須',
    params: { scl: 'slendro', deg: [0, 3], f0: 73.42, bin: 0.3, ghz: 6, carL: 'off', car: 200, dfc: 10, rvb: 0.5 } },
  { id: 'delta-sleep', desc: '2Hzのゆるいうねりと長いフェードアウト付き30分',
    params: { scl: 'harmonic', deg: [0, 4], f0: 55, amd: 0.25, ghz: 2, lpw: 900, ses: 30, fout: 120, pbpm: 5, pamp: 0.35 } },
  { id: 'tanpura-yaman', desc: 'Pa–Sa–Sa–Saの撥弦循環。ラーガ練習の伴奏に',
    params: { scl: 'yaman', deg: [0, 4], f0: 69.3, exc: 'tanpura', subK: 0.6, hiK: 0, jaw: 0.65, rvb: 0.3 } },
  { id: 'maqam-rast', desc: '中立3度を含む和音をゆっくり揺らす',
    params: { scl: 'rast', deg: [0, 2, 4], f0: 98, dfc: 9, uni: 2, dt: 3, rvb: 0.4 } },
  { id: 'ombak', desc: 'スリシールの対楽器的デチューンで揺れる金属音',
    params: { scl: 'selisir', deg: [0, 2, 3], f0: 110, hN: 24, rho: 0.9, oe: 0.5, dt: 18, uni: 2, rvb: 0.5, lpw: 3000 } },
  { id: 'okinawa-dusk', desc: '琉球音階を三味線の1オクターブ下で、波のような呼吸ガイド付き',
    params: { scl: 'ryukyu', deg: [0, 1, 3], f0: 73.42, pbpm: 5.5, pamp: 0.4, amd: 0.15, ghz: 40, rvb: 0.5, rvt: 14 } },

  // 低域プリセット（各エンジン1つ以上）
  { id: 'b01', desc: 'E1の純正弦に2・3倍音を薄く。小型スピーカーでもPSY.hで基音が感じられる',
    params: { eng: 'sin', f0: 41.2, scl: 'ryukyu-just', deg: [0, 3], ma: 0.45, mb: 0.3, mc: 0.25, psy: 0.45, hiK: 0.2 } },
  { id: 'b02', desc: 'デチューンしたノコギリ3本。位相がゆっくりずれて地鳴りになる',
    params: { eng: 'reese', f0: 36.71, scl: 'kurd', deg: [0], ma: 0.45, mb: 0.5, mc: 0.3, subK: 0.15, hiK: 0.2, wid: 0.9 } },
  { id: 'b03', desc: '比率1:2のFM。指数を上げると鉄骨のような倍音',
    params: { eng: 'fm2', f0: 49, scl: 'hijaz', deg: [0, 4], ma: 0.35, mb: 0.4, mc: 0.25, hiK: 0.15 } },
  { id: 'b04', desc: '正弦を折り返す。対称性をずらすと偶数倍音が出る',
    params: { eng: 'fold', f0: 43.65, scl: 'bhairav', deg: [0, 4], ma: 0.45, mb: 0.3, mc: 0.35 } },
  { id: 'b05', desc: 'f/2・f/3の矩形を足すSubharmonicon的な分周の階段',
    params: { eng: 'undr', f0: 82.41, scl: 'harmonic', deg: [0], ma: 0.6, mb: 0.45, mc: 0.2, subK: 0, hiK: 0 } },
  { id: 'b06', desc: '4段ラダーの唸り。レゾナンスで声のようなピーク',
    params: { eng: 'ladder', f0: 41.2, scl: 'minyo', deg: [0, 3], ma: 0.3, mb: 0.55, mc: 0.4, hiK: 0.2 } },
  { id: 'b07', desc: '幅がゆっくり呼吸するパルス。0.1Hzの呼吸ガイドと合わせて',
    params: { eng: 'pwm', f0: 55, scl: 'yaman', deg: [0, 4], ma: 0.3, mb: 0.1, mc: 0.6, pbpm: 6, pamp: 0.3 } },
  { id: 'b08', desc: '16′と5⅓′を引き出したペダル。石室で鳴るオルガン',
    params: { eng: 'organ', f0: 32.7, scl: 'just-major', deg: [0, 4], ma: 0.9, mb: 0.45, mc: 0.3, rvb: 0.55, rvt: 14, subK: 0 } },
  { id: 'b09', desc: '周期倍化の唸りに母音uのフォルマント。トゥバの喉歌の低音',
    params: { eng: 'kargyraa', f0: 61.74, scl: 'harmonic', deg: [0], ma: 0.5, mb: 0.6, mc: 0.3, subK: 0, hiK: 0, dfc: 3 } },
  { id: 'b10', desc: '低いパルス列と口腔フォルマントの掃引',
    params: { eng: 'didj', f0: 73.42, scl: 'harmonic', deg: [0], ma: 0.55, mb: 0.3, mc: 0.45, subK: 0, hiK: 0 } },
  { id: 'b11', desc: '弓で擦り続けるコントラバス。胴鳴りで木の響き',
    params: { eng: 'bow', f0: 41.2, scl: 'bhupali', deg: [0, 3], ma: 0.45, mb: 0.5, mc: 0.3, hiK: 0, rvb: 0.4 } },
  { id: 'b12', desc: '低域ノイズを共鳴させ、テープのワウ・フラッターで揺らす',
    params: { eng: 'tape', f0: 55, scl: 'pelog', deg: [0, 3], ma: 0.6, mb: 0.35, mc: 0.4, hiK: 0, rvb: 0.45 } },
];

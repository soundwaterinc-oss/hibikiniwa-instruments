// KUKURU — UI。パラメータスキーマからコントロールを自動生成する。
import { DroneEngine } from './engine.js';
import { SCALES, ROOT_PRESETS, getScale, parseScl } from './scales.js';
import { GROUPS, PARAMS, PARAM_BY_KEY, SCENES, DEFAULTS } from './params.js';
import { ScaleCircle } from './viz.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((k) => k != null && el.append(k.nodeType ? k : document.createTextNode(k)));
  return el;
};

const STORE_KEY = 'kukuru-drone:v1';
const eng = new DroneEngine();
window.kukuru = eng; // コンソールからの操作・外部連携用

// 保存済みの状態を復元（使えない環境でも動作する）
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (saved) eng.applyParams(saved, { reset: true });
} catch { /* ストレージ不可 */ }
let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(eng.exportParams())); } catch { /* noop */ } }, 400);
};

// ── 値の表示・スライダー写像 ─────────────────
const toSlider = (p, v) => (p.log ? (Math.log(v / p.min) / Math.log(p.max / p.min)) * 1000 : v);
const fromSlider = (p, s) => {
  if (!p.log) return Number(s);
  const v = p.min * Math.pow(p.max / p.min, s / 1000);
  const dec = p.step < 1 ? Math.max(0, -Math.floor(Math.log10(p.step))) : 0;
  return Number(v.toFixed(dec));
};
const fmt = (p, v) => {
  if (p.off && Number(v) === 0) return p.offLabel || 'オフ';
  const n = Number(v);
  const s = Math.abs(n) >= 100 ? n.toFixed(p.step < 1 ? 1 : 0) : Math.abs(n) >= 10 ? n.toFixed(p.step < 0.1 ? 1 : p.step < 1 ? 1 : 0) : n.toFixed(p.step < 0.01 ? 3 : p.step < 1 ? 2 : 0);
  return p.unit ? `${s} ${p.unit}` : s;
};

const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function noteName(hz) {
  const m = 69 + 12 * Math.log2(hz / 440);
  const n = Math.round(m);
  const dev = Math.round((m - n) * 100);
  return `${NOTE[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1} ${dev >= 0 ? '+' : ''}${dev}c`;
}

// ── パラメータパネル ─────────────────────────
const controls = {};
function buildPanels() {
  const wrap = $('#panels');
  wrap.textContent = '';
  for (const grp of GROUPS) {
    const params = PARAMS.filter((p) => p.group === grp.id);
    const sec = h('section', { class: `panel panel-${grp.id}`, 'aria-labelledby': `g-${grp.id}` },
      h('header', { class: 'panel-head' },
        h('h3', { id: `g-${grp.id}` }, grp.label),
        h('span', { class: 'panel-en' }, grp.en)));
    if (grp.id === 'tuning') sec.append(rootRow());
    for (const p of params) sec.append(control(p));
    if (grp.id === 'therapy') sec.append(h('p', { class: 'hint' }, 'バイノーラルはヘッドホンで左右を分けたときだけ成立します。30Hzを超えると「うなり」として知覚されにくくなります。'));
    wrap.append(sec);
  }
}

function rootRow() {
  return h('div', { class: 'root-row' },
    h('output', { id: 'root-note', class: 'root-note', 'aria-live': 'polite' }, ''),
    h('div', { class: 'chips small' }, ROOT_PRESETS.map((r) =>
      h('button', { class: 'chip', type: 'button', onclick: () => { eng.set('rootHz', r.hz); syncAll(); } }, r.label))));
}

function control(p) {
  const id = `p-${p.key}`;
  if (p.type === 'select') {
    const sel = h('select', { id, onchange: (e) => { eng.set(p.key, e.target.value); persist(); } },
      p.options.map(([v, l]) => h('option', { value: v }, l)));
    controls[p.key] = { set: (v) => { sel.value = v; } };
    return h('div', { class: 'ctl ctl-select' }, h('label', { for: id }, p.label), sel);
  }
  const out = h('output', { for: id, class: 'val' });
  const input = h('input', {
    id, type: 'range',
    min: p.log ? 0 : p.min, max: p.log ? 1000 : p.max, step: p.log ? 1 : p.step,
    oninput: (e) => {
      const v = fromSlider(p, e.target.value);
      out.textContent = fmt(p, v);
      eng.set(p.key, v);
      if (p.key === 'rootHz' || p.key === 'fineCents') updateRootNote();
      persist();
    },
  });
  input.addEventListener('dblclick', () => { eng.set(p.key, p.def); syncAll(); persist(); });
  controls[p.key] = { set: (v) => { input.value = toSlider(p, v); out.textContent = fmt(p, v); } };
  return h('div', { class: 'ctl' }, h('label', { for: id }, p.label), input, out);
}

function updateRootNote() {
  const el = $('#root-note');
  if (el) el.textContent = `${eng.baseHz().toFixed(2)} Hz · ${noteName(eng.baseHz())}`;
}

// ── 音階と度数 ─────────────────────────────
function buildScaleSelect() {
  const sel = $('#scale');
  sel.textContent = '';
  const regions = [...new Set(SCALES.map((s) => s.region))];
  for (const reg of regions) {
    sel.append(h('optgroup', { label: reg }, SCALES.filter((s) => s.region === reg).map((s) => h('option', { value: s.id }, s.name))));
  }
  sel.append(h('optgroup', { label: '自作' }, h('option', { value: 'custom' }, 'カスタム（セント・比率・.scl）')));
  sel.addEventListener('change', (e) => { eng.set('scaleId', e.target.value); syncAll(); persist(); });
}

function renderScaleInfo() {
  const custom = eng.p.scaleId === 'custom';
  $('#custom-box').hidden = !custom;
  const s = custom ? null : getScale(eng.p.scaleId);
  $('#scale-meta').textContent = custom ? 'セント値か比率をカンマ区切りで（例: 0, 9/8, 5/4, 702, 11/8）' : `${s.region} · ${s.tuning}`;
  $('#scale-note').textContent = custom ? '' : (s.note || '');
  const cents = eng.scaleCents();
  const labels = eng.scaleLabels();
  const active = new Set(eng.activeDegrees());
  const box = $('#degrees');
  box.textContent = '';
  cents.forEach((c, i) => {
    box.append(h('button', {
      type: 'button', class: 'deg', 'aria-pressed': active.has(i) ? 'true' : 'false',
      onclick: () => {
        const set = new Set(eng.activeDegrees());
        set.has(i) ? set.delete(i) : set.add(i);
        if (!set.size) set.add(0);
        eng.set('degrees', [...set].sort((a, b) => a - b));
        renderScaleInfo(); persist();
      },
    }, h('span', { class: 'deg-l' }, labels[i]), h('span', { class: 'deg-c' }, `${c.toFixed(c % 1 ? 1 : 0)}c`)));
  });
}

function degreePreset(kind) {
  const n = eng.scaleCents().length;
  const d = kind === 'all' ? [...Array(n).keys()] : kind === 'root' ? [0] : eng.defaultDegrees();
  eng.set('degrees', d);
  renderScaleInfo(); persist();
}

// ── シーン ────────────────────────────────
function buildScenes() {
  const box = $('#scenes');
  SCENES.forEach((sc) => box.append(h('button', {
    type: 'button', class: 'scene', title: sc.desc,
    onclick: () => {
      eng.applyParams({ ...structuredClone(DEFAULTS), ...sc.params, volume: eng.p.volume }, { reset: true });
      syncAll(); persist();
      $('#scene-desc').textContent = `${sc.name}：${sc.desc}`;
    },
  }, sc.name)));
}

// ── 全体同期 ───────────────────────────────
function syncAll() {
  for (const p of PARAMS) controls[p.key]?.set(eng.p[p.key]);
  $('#scale').value = eng.p.scaleId;
  $('#custom-cents').value = eng.p.customCents || '';
  updateRootNote();
  renderScaleInfo();
}

// ── 再生 ─────────────────────────────────
let wakeLock = null;
async function toggle() {
  if (eng.running && !eng.stopping) { eng.stop(Math.min(eng.p.fadeOut, 6)); return; }
  if (eng.stopping) return;
  await eng.start();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

eng.on((type, d) => {
  if (type === 'state') {
    const btn = $('#play');
    const label = d.running ? (d.stopping ? 'フェードアウト中…' : '静かに止める') : '鳴らす';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', d.running && !d.stopping ? 'true' : 'false');
    document.body.classList.toggle('is-playing', d.running && !d.stopping);
    if (!d.running) { try { wakeLock?.release(); } catch { /* noop */ } }
  }
  if (type === 'tick') {
    const s = Math.floor(d.elapsed);
    const total = eng.p.sessionMin * 60;
    $('#clock').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}${total ? ` / ${eng.p.sessionMin}:00` : ''}`;
  }
  if (type === 'param' && (d.key === 'scaleId')) renderScaleInfo();
});

// ── 入出力 ───────────────────────────────
function wireIO() {
  $('#play').addEventListener('click', toggle);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) { e.preventDefault(); toggle(); }
  });
  $('#deg-fifth').addEventListener('click', () => degreePreset('fifth'));
  $('#deg-root').addEventListener('click', () => degreePreset('root'));
  $('#deg-all').addEventListener('click', () => degreePreset('all'));
  $('#custom-cents').addEventListener('change', (e) => { eng.set('customCents', e.target.value); eng.set('degrees', eng.defaultDegrees()); renderScaleInfo(); persist(); });
  $('#scl-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const scl = parseScl(await f.text());
      const txt = scl.cents.map((c) => c.toFixed(2)).join(', ');
      eng.set('scaleId', 'custom');
      eng.set('customCents', txt);
      eng.set('degrees', eng.defaultDegrees());
      $('#io-msg').textContent = `読み込みました：${scl.description || f.name}（${scl.cents.length}音）`;
      syncAll(); persist();
    } catch (err) { $('#io-msg').textContent = `.sclを読めませんでした：${err.message}`; }
    e.target.value = '';
  });
  $('#copy-json').addEventListener('click', async () => {
    const txt = JSON.stringify(eng.exportParams(), null, 2);
    const ta = $('#json');
    ta.value = txt;
    try { await navigator.clipboard.writeText(txt); $('#io-msg').textContent = '設定をクリップボードにコピーしました'; }
    catch { ta.select(); $('#io-msg').textContent = '下の欄を選択しました。手動でコピーしてください'; }
  });
  $('#load-json').addEventListener('click', () => {
    try {
      eng.applyParams(JSON.parse($('#json').value), { reset: true });
      syncAll(); persist();
      $('#io-msg').textContent = '設定を読み込みました';
    } catch { $('#io-msg').textContent = 'JSONとして読めませんでした。書き出した内容をそのまま貼り付けてください'; }
  });
  $('#reset').addEventListener('click', () => { eng.applyParams(DEFAULTS, { reset: true }); syncAll(); persist(); $('#io-msg').textContent = '初期値に戻しました'; });
  $('#midi').addEventListener('click', connectMidi);
}

// Web MIDI：ノート→基音、CC1/74→フィルター、CC7→音量、CC71→倍音減衰
async function connectMidi() {
  const msg = $('#io-msg');
  try {
    const access = await navigator.requestMIDIAccess();
    let n = 0;
    access.inputs.forEach((inp) => { n++; inp.onmidimessage = onMidi; });
    msg.textContent = n ? `MIDI入力 ${n} 台を接続しました` : 'MIDI入力が見つかりません';
  } catch { msg.textContent = 'この環境ではMIDIを使えません（ブラウザ設定・埋め込み表示を確認）'; }
}
function onMidi({ data: [st, a, b] }) {
  const cmd = st & 0xf0;
  const cc = (key, v01) => { const p = PARAM_BY_KEY[key]; const v = p.log ? fromSlider(p, v01 * 1000) : p.min + v01 * (p.max - p.min); eng.set(key, v); controls[key].set(v); };
  if (cmd === 0x90 && b > 0) { eng.set('rootHz', +(440 * Math.pow(2, (a - 69) / 12)).toFixed(2)); controls.rootHz.set(eng.p.rootHz); updateRootNote(); }
  if (cmd === 0xb0) {
    if (a === 1 || a === 74) cc('cutoff', b / 127);
    if (a === 7) cc('volume', b / 127);
    if (a === 71) cc('rolloff', b / 127);
    if (a === 91) cc('reverbMix', b / 127);
  }
}

// ── 起動 ─────────────────────────────────
buildPanels();
buildScaleSelect();
buildScenes();
wireIO();
syncAll();
new ScaleCircle($('#circle'), eng);

// HYPOGEUM // KKR-40 — UI。パラメータスキーマとコードブックから計器盤を自動生成する。
import { DroneEngine } from './engine.js';
import { SCALES, ROOT_PRESETS, getScale, parseScl } from './scales.js';
import { GROUPS, PARAMS, PARAM_BY_KEY, SCENES, DEFAULTS } from './params.js';
import { ENGINE_CODES, OPTION_CODES, SCENE_CODES, REGION_CODES, TUNING_CODES, SCALE_CODE_PARTS, STORE_KEY, LEGACY_STORE_KEY, scaleCode, registerOf } from './codebook.js';
import { PhaseDial } from './viz.js';

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
// コード＋平文（平文は [DECODE] のときだけ見える）
const cb = (code, plain) => [h('span', { class: 'c' }, code), h('span', { class: 'pl' }, plain)];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ストレージ不可 */ } },
};

const eng = new DroneEngine();
window.hypogeum = eng; // コンソールからの操作・外部連携用（例: hypogeum.set('ghz', 40)）
window.kukuru = eng;   // 旧名の互換

// 保存済みの状態を復元。新キーがなければ旧 KUKURU の保存を変換して引き継ぐ
try {
  const saved = JSON.parse(store.get(STORE_KEY) || 'null');
  const legacy = saved ? null : JSON.parse(store.get(LEGACY_STORE_KEY) || 'null');
  if (saved) eng.applyParams(saved, { reset: true });
  else if (legacy) { eng.applyParams(legacy, { reset: true }); store.set(STORE_KEY, JSON.stringify(eng.exportParams())); }
} catch { /* 壊れた保存は無視 */ }
let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set(STORE_KEY, JSON.stringify(eng.exportParams())), 400);
};

let decode = store.get('hypogeum:decode') === '1';

// ── 値の表示・スライダー写像 ─────────────────
const toSlider = (p, v) => (p.log ? (Math.log(v / p.min) / Math.log(p.max / p.min)) * 1000 : v);
const fromSlider = (p, s) => {
  if (!p.log) return Number(s);
  const v = p.min * Math.pow(p.max / p.min, s / 1000);
  const dec = p.step < 1 ? Math.max(0, -Math.floor(Math.log10(p.step))) : 0;
  return Number(v.toFixed(dec));
};
const sci = (n, d = 2) => n.toExponential(d).toUpperCase(); // 41.2 → "4.12E+1"
// 計器表示：Hz・秒は指数、整数は16進、セントは符号付き。実単位は必ず併記
const fmt = (p, v) => {
  const n = Number(v);
  if (p.off && n === 0) return p.offLabel || 'OFF';
  if (p.unit === 'Hz' || p.unit === 's') return `${sci(n)} ${p.unit}`;
  if (p.unit === '¢') return `${n >= 0 ? '+' : ''}${n.toFixed(p.step < 1 ? 1 : 0)} ¢`;
  if (p.unit) return `${n.toFixed(p.step < 1 ? 1 : 0)} ${p.unit}`;
  if (p.step >= 1) return `0x${Math.round(n).toString(16).toUpperCase().padStart(2, '0')}`;
  return n.toFixed(p.min < 0 ? 2 : 3);
};
// 読み上げ用の平文
const plainVal = (p, v) => {
  const n = Number(v);
  if (p.off && n === 0) return p.offLabel === '∞' ? '無制限' : 'オフ';
  return `${+n.toFixed(3)}${p.unit ? ` ${p.unit === '¢' ? 'セント' : p.unit}` : ''}`;
};

const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function noteName(hz) {
  const m = 69 + 12 * Math.log2(hz / 440);
  const n = Math.round(m);
  const dev = Math.round((m - n) * 100);
  return `${NOTE[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1} ${dev >= 0 ? '+' : ''}${dev}¢`;
}

// マクロ（Α Β Γ）の現在の意味
const MACRO_SYM = ['Α', 'Β', 'Γ'];
const macroOf = (p) => (ENGINE_CODES[eng.p.eng] || ENGINE_CODES.add).macros[p.macro];
const labelParts = (p) => {
  if (p.macro !== undefined) { const [c, pl] = macroOf(p); return { code: `${MACRO_SYM[p.macro]}·${c}`, plain: pl }; }
  return { code: p.code, plain: p.plain };
};
const optionText = (key, v) => {
  if (key === 'eng') { const e = ENGINE_CODES[v]; return decode ? `${e.code} — ${e.plain}` : e.code; }
  const o = OPTION_CODES[key]?.[v];
  return o ? (decode ? `${o.code} — ${o.plain}` : o.code) : v;
};
const optionPlain = (key, v) => (key === 'eng' ? ENGINE_CODES[v]?.plain : OPTION_CODES[key]?.[v]?.plain) || v;

// ── パラメータパネル ─────────────────────────
const controls = {};
function buildPanels() {
  const wrap = $('#panels');
  wrap.textContent = '';
  let reg = 0;
  for (const grp of GROUPS) {
    const params = PARAMS.filter((p) => p.group === grp.id);
    const sec = h('section', { class: `panel panel-${grp.id}`, 'aria-labelledby': `g-${grp.id}` },
      h('header', { class: 'panel-head' },
        h('h3', { id: `g-${grp.id}`, class: 'cb', title: grp.plain, 'aria-label': `${grp.code}：${grp.plain}` }, cb(grp.code, grp.plain))));
    if (grp.id === 'tuning') sec.append(rootRow());
    for (const p of params) sec.append(control(p, registerOf(reg++)));
    if (grp.id === 'gen') sec.append(h('p', { id: 'voice-info', class: 'readout small' }));
    if (grp.id === 'therapy') sec.append(h('p', { class: 'hint' }, 'バイノーラルはヘッドホンで左右を分けたときだけ成立します。30Hzを超えると「うなり」として知覚されにくくなります。低域では差が知覚しにくいので、キャリアは120Hz以上に固定しています。'));
    if (grp.id === 'space') sec.append(h('p', { class: 'hint' }, 'HPF.ω より下（地響き・直流）を切り、MONO.x より下は左右を足してモノにします。PSY.h は低域の2・3倍音を足して、小型スピーカーでも基音を感じさせます。'));
    wrap.append(sec);
  }
}

function rootRow() {
  return h('div', { class: 'root-row' },
    h('output', { id: 'root-note', class: 'readout', 'aria-live': 'polite' }, ''),
    h('div', { class: 'chips small' }, ROOT_PRESETS.map((r) =>
      h('button', { class: 'chip', type: 'button', title: r.title || `${r.hz} Hz`, 'aria-label': `基音を ${r.label}（${r.hz}Hz）に`,
        onclick: () => { eng.set('f0', r.hz); syncAll(); persist(); } }, r.label))));
}

function control(p, reg) {
  const id = `p-${p.key}`;
  const lab = labelParts(p);
  const labelEl = h('label', { for: id, class: 'cb' }, h('span', { class: 'reg' }, reg), ' ', cb(lab.code, lab.plain));
  if (p.type === 'select') {
    const sel = h('select', { id, title: `${lab.code} = ${lab.plain}`, 'aria-label': lab.plain,
      onchange: (e) => { eng.set(p.key, e.target.value); if (p.key === 'eng') refreshMacros(); afterChange(p.key); persist(); } },
    p.options.map((v) => h('option', { value: v, title: optionPlain(p.key, v) }, optionText(p.key, v))));
    controls[p.key] = { set: (v) => { sel.value = v; }, label: labelEl, sel, wrap: null };
    const wrap = h('div', { class: 'ctl ctl-select', 'data-key': p.key }, labelEl, sel);
    controls[p.key].wrap = wrap;
    return wrap;
  }
  const out = h('output', { for: id, class: 'val' });
  const input = h('input', {
    id, type: 'range', title: `${lab.code} = ${lab.plain}（ダブルクリックで初期値）`, 'aria-label': lab.plain,
    min: p.log ? 0 : p.min, max: p.log ? 1000 : p.max, step: p.log ? 1 : p.step,
    oninput: (e) => {
      const v = fromSlider(p, e.target.value);
      eng.set(p.key, v);
      show(eng.p[p.key]);
      afterChange(p.key);
      persist();
    },
  });
  const show = (v) => { out.textContent = fmt(p, v); input.setAttribute('aria-valuetext', plainVal(p, v)); };
  input.addEventListener('dblclick', () => { eng.set(p.key, p.def); syncAll(); persist(); });
  controls[p.key] = { set: (v) => { input.value = toSlider(p, v); show(v); }, label: labelEl, input };
  const wrap = h('div', { class: 'ctl', 'data-key': p.key }, labelEl, h('div', { class: 'fader' }, input), out);
  controls[p.key].wrap = wrap;
  return wrap;
}

function afterChange(key) {
  if (key === 'f0' || key === 'dc') updateRootNote();
  if (['f0', 'dc', 'ghz', 'amd', 'iso'].includes(key)) renderWarn();
  if (['eng', 'exc', 'uni', 'deg', 'scl', 'subK', 'hiK'].includes(key)) renderVoiceInfo();
  if (key === 'eng' || key === 'exc') renderInert();
}

// マクロのラベルをエンジンに合わせて差し替える
function refreshMacros() {
  for (const p of PARAMS.filter((x) => x.macro !== undefined)) {
    const c = controls[p.key];
    const lab = labelParts(p);
    const reg = c.label.querySelector('.reg').textContent;
    c.label.textContent = '';
    c.label.append(h('span', { class: 'reg' }, reg), ' ', ...cb(lab.code, lab.plain));
    c.input.title = `${lab.code} = ${lab.plain}（ダブルクリックで初期値）`;
    c.input.setAttribute('aria-label', lab.plain);
  }
}

// ADD.H 専用の項目は、他のエンジンの持続音では効かないので薄く表示
function renderInert() {
  const addOnly = ['hN', 'rho', 'oe', 'uni', 'dt'];
  const live = eng.p.eng === 'add' || eng.p.exc !== 'sustain';
  addOnly.forEach((k) => controls[k]?.wrap.classList.toggle('inert', !live || (k === 'uni' || k === 'dt') && eng.p.eng !== 'add'));
}

function renderVoiceInfo() {
  const el = $('#voice-info'); if (!el) return;
  eng.voiceSpecs(); // voiceInfo（使用数／要求数）を更新
  const { used, wanted } = eng.voiceInfo;
  el.textContent = '';
  el.append(`VOICES ${used.toString(16).toUpperCase().padStart(2, '0')}/${wanted.toString(16).toUpperCase().padStart(2, '0')} · COST ${eng.voiceCost()}/v`);
  if (used < wanted) el.append(h('span', { class: 'warn-inline' }, ` CPU上限のため上オクターブ等 ${wanted - used} ボイスを省略`));
}

function updateRootNote() {
  const el = $('#root-note');
  if (el) el.textContent = `F₀ ${sci(eng.baseHz(), 3)} Hz · ${noteName(eng.baseHz())}`;
}

function renderWarn() {
  const w = eng.warnings();
  const el = $('#warn');
  el.hidden = !w.length;
  el.textContent = w.length ? `⚠ 注意：${w.join(' ')}` : '';
}

// ── 音階と度数 ─────────────────────────────
function buildScaleSelect() {
  const sel = $('#scale');
  sel.textContent = '';
  const regions = [...new Set(SCALES.map((s) => s.region))];
  for (const reg of regions) {
    const rc = REGION_CODES[reg] || reg;
    sel.append(h('optgroup', { label: decode ? `${rc} — ${reg}` : rc }, SCALES.filter((s) => s.region === reg).map((s) => {
      const code = scaleCode(s.id, s.cents.length);
      return h('option', { value: s.id, title: s.name }, decode ? `${code} — ${s.name}` : code);
    })));
  }
  sel.append(h('optgroup', { label: decode ? 'USR — 自作' : 'USR' }, h('option', { value: 'custom', title: 'カスタム（セント・比率・.scl）' }, decode ? 'USR-n/X — カスタム（セント・比率・.scl）' : 'USR-n/X')));
  sel.value = eng.p.scl;
}

function renderScaleInfo() {
  const custom = eng.p.scl === 'custom';
  $('#custom-box').hidden = !custom;
  const s = custom ? null : getScale(eng.p.scl);
  const cents = eng.scaleCents();
  const code = scaleCode(custom ? 'custom' : s.id, cents.length);
  const sym = custom ? 'X' : SCALE_CODE_PARTS[s.id]?.[1];
  const meta = $('#scale-meta');
  meta.textContent = '';
  meta.append(h('span', { class: 'c' }, `${code} · TUN.${sym} · N=0x${cents.length.toString(16).toUpperCase()}`),
    h('span', { class: 'pl' }, custom ? 'セント値か比率をカンマ区切りで（例: 0, 9/8, 5/4, 702, 11/8）' : `${s.name}（${s.region} · ${TUNING_CODES[sym] || s.tuning}）`));
  $('#scale').title = custom ? 'カスタム音階' : s.name;
  $('#scale-note').textContent = decode && !custom ? (s.note || '') : '';
  const labels = eng.scaleLabels();
  const active = new Set(eng.activeDegrees());
  const box = $('#degrees');
  box.textContent = '';
  cents.forEach((c, i) => {
    box.append(h('button', {
      type: 'button', class: 'deg', 'aria-pressed': active.has(i) ? 'true' : 'false',
      title: `${labels[i]} · ${c.toFixed(1)}セント`, 'aria-label': `度数 ${labels[i]}（${c.toFixed(1)}セント）`,
      onclick: () => {
        const set = new Set(eng.activeDegrees());
        set.has(i) ? set.delete(i) : set.add(i);
        if (!set.size) set.add(0);
        eng.set('deg', [...set].sort((a, b) => a - b));
        renderScaleInfo(); renderVoiceInfo(); persist();
      },
    }, h('span', { class: 'deg-l' }, decode ? labels[i] : `°${i.toString(16).toUpperCase()}`), h('span', { class: 'deg-c' }, `${c.toFixed(c % 1 ? 1 : 0)}¢`)));
  });
}

function degreePreset(kind) {
  const n = eng.scaleCents().length;
  const d = kind === 'all' ? [...Array(n).keys()] : kind === 'root' ? [0] : eng.defaultDegrees();
  eng.set('deg', d);
  renderScaleInfo(); renderVoiceInfo(); persist();
}

// ── シーン（プログラム） ─────────────────────
function buildScenes() {
  const a = $('#scenes'), b = $('#scenes-b');
  a.textContent = ''; b.textContent = '';
  SCENES.forEach((sc) => {
    const c = SCENE_CODES[sc.id];
    const btn = h('button', {
      type: 'button', class: 'scene', title: `${c.plain}：${sc.desc}`, 'aria-label': `${c.plain}（${c.code}）`,
      onclick: () => {
        eng.applyParams({ ...structuredClone(DEFAULTS), ...sc.params, vol: eng.p.vol }, { reset: true });
        syncAll(); persist();
        const d = $('#scene-desc');
        d.textContent = '';
        d.append(h('span', { class: 'c' }, `${c.code} LOADED`), h('span', { class: 'pl' }, `${c.plain}：${sc.desc}`));
      },
    }, cb(c.code, c.plain));
    (sc.id.startsWith('b') && /^b\d\d$/.test(sc.id) ? b : a).append(btn);
  });
}

// ── 全体同期 ───────────────────────────────
function syncAll() {
  refreshMacros();
  for (const p of PARAMS) controls[p.key]?.set(eng.p[p.key]);
  $('#scale').value = eng.p.scl;
  $('#custom-cents').value = eng.p.cst || '';
  updateRootNote();
  renderScaleInfo();
  renderWarn();
  renderVoiceInfo();
  renderInert();
}

// ── DECODE ───────────────────────────────
function applyDecode() {
  document.body.classList.toggle('decode', decode);
  const btn = $('#decode');
  btn.setAttribute('aria-pressed', decode ? 'true' : 'false');
  btn.textContent = decode ? '[DECODE:ON]' : '[DECODE]';
  buildScaleSelect();
  for (const p of PARAMS.filter((x) => x.type === 'select')) {
    [...controls[p.key].sel.options].forEach((o) => { o.textContent = optionText(p.key, o.value); });
  }
  renderScaleInfo();
}

// ── 再生 ─────────────────────────────────
let wakeLock = null;
async function toggle() {
  if (eng.running && !eng.stopping) { eng.stop(Math.min(eng.p.fout, 6)); return; }
  if (eng.stopping) return;
  await eng.start();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

eng.on((type, d) => {
  if (type === 'state') {
    const btn = $('#play');
    const [label, plain] = d.running ? (d.stopping ? ['… FADE', 'フェードアウト中'] : ['■ HALT', '静かに止める']) : ['▶ EXEC', '鳴らす'];
    btn.textContent = label;
    btn.setAttribute('aria-label', plain);
    btn.title = `${plain}（スペースキー）`;
    btn.setAttribute('aria-pressed', d.running && !d.stopping ? 'true' : 'false');
    document.body.classList.toggle('is-playing', d.running && !d.stopping);
    if (!d.running) { try { wakeLock?.release(); } catch { /* noop */ } }
  }
  if (type === 'tick') {
    const s = Math.floor(d.elapsed);
    const total = eng.p.ses * 60;
    const clock = $('#clock');
    clock.textContent = `T+${s.toString(16).toUpperCase().padStart(4, '0')}${total ? `/${total.toString(16).toUpperCase().padStart(4, '0')}` : ''}`;
    clock.title = `経過 ${Math.floor(s / 60)}分${s % 60}秒${total ? ` / ${eng.p.ses}分` : ''}`;
  }
  if (type === 'param' && d.key === 'scl') renderScaleInfo();
  if (type === 'warn') renderWarn();
  if (type === 'voices') renderVoiceInfo();
});

// ── 入出力 ───────────────────────────────
function wireIO() {
  $('#play').addEventListener('click', toggle);
  $('#decode').addEventListener('click', () => { decode = !decode; store.set('hypogeum:decode', decode ? '1' : '0'); applyDecode(); });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) { e.preventDefault(); toggle(); }
  });
  $('#scale').addEventListener('change', (e) => { eng.set('scl', e.target.value); renderScaleInfo(); renderVoiceInfo(); persist(); });
  $('#deg-fifth').addEventListener('click', () => degreePreset('fifth'));
  $('#deg-root').addEventListener('click', () => degreePreset('root'));
  $('#deg-all').addEventListener('click', () => degreePreset('all'));
  $('#custom-cents').addEventListener('change', (e) => { eng.set('cst', e.target.value); eng.set('deg', eng.defaultDegrees()); renderScaleInfo(); persist(); });
  $('#scl-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const scl = parseScl(await f.text());
      const txt = scl.cents.map((c) => c.toFixed(2)).join(', ');
      eng.set('scl', 'custom');
      eng.set('cst', txt);
      eng.set('deg', eng.defaultDegrees());
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
      const obj = JSON.parse($('#json').value);
      eng.applyParams(obj, { reset: true });
      syncAll(); persist();
      $('#io-msg').textContent = obj?.app === 'kukuru-drone' || obj?.version === 1 ? 'KUKURU v1 の設定を変換して読み込みました' : '設定を読み込みました';
    } catch { $('#io-msg').textContent = 'JSONとして読めませんでした。書き出した内容をそのまま貼り付けてください'; }
  });
  $('#reset').addEventListener('click', () => { eng.applyParams(DEFAULTS, { reset: true }); syncAll(); persist(); $('#io-msg').textContent = '初期値に戻しました'; });
  $('#midi').addEventListener('click', connectMidi);

  // 安全注意：初回は開いた状態。閉じたら次回からは閉じて表示
  const safety = $('#safety');
  safety.open = store.get('hypogeum:safety-seen') !== '1';
  safety.addEventListener('toggle', () => { if (!safety.open) store.set('hypogeum:safety-seen', '1'); });
}

// Web MIDI：ノート→F₀（20〜250Hzへオクターブ折り畳み）、CC1/74→LP.ω、CC7→VOL、CC71→ρ、CC91→RV.k、CC16/17/18→Α/Β/Γ
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
  const cc = (key, v01) => { const p = PARAM_BY_KEY[key]; const v = p.log ? fromSlider(p, v01 * 1000) : p.min + v01 * (p.max - p.min); eng.set(key, v); controls[key].set(eng.p[key]); };
  if (cmd === 0x90 && b > 0) { eng.set('f0', +(440 * Math.pow(2, (a - 69) / 12)).toFixed(2)); controls.f0.set(eng.p.f0); updateRootNote(); renderWarn(); }
  if (cmd === 0xb0) {
    const map = { 1: 'lpw', 74: 'lpw', 7: 'vol', 71: 'rho', 91: 'rvb', 16: 'ma', 17: 'mb', 18: 'mc' };
    if (map[a]) cc(map[a], b / 127);
  }
}

// ── 起動 ─────────────────────────────────
buildPanels();
buildScaleSelect();
buildScenes();
wireIO();
applyDecode();
syncAll();
new PhaseDial($('#dial'), eng);

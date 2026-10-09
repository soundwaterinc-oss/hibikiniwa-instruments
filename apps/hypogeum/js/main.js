// HYPOGEUM // KKR-40 — UI。共通基盤（packages/core）のスキーマ駆動UIで計器盤を組む
import { DroneEngine } from './engine.js';
import { SCALES, ROOT_PRESETS, getScale, parseScl } from './scales.js';
import { GROUPS, PARAMS, PARAM_BY_KEY, SCENES, DEFAULTS } from './params.js';
import { ENGINE_CODES, OPTION_CODES, SCENE_CODES, REGION_CODES, TUNING_CODES, SCALE_CODE_PARTS, STORE_KEY, LEGACY_STORE_KEY, scaleCode } from './codebook.js';
import { PhaseDial } from './viz.js';
import { $, h, cb, panels } from '../../../packages/core/ui.js';
import { sci, registerOf, fromSlider } from '../../../packages/core/format.js';
import { store, createUndo, debounced } from '../../../packages/core/store.js';
import { setupDecode, setupSafety, isDecoded } from '../../../packages/core/decode.js';
import { startMeter, setupRecord, setupUndo, setupMidiLearn, setupBusRole } from '../../../packages/core/shell.js';
import { createMidi, noteToHz } from '../../../packages/core/midi.js';
import { createBus } from '../../../packages/core/bus.js';
import { setupGarden } from './garden.js';

const eng = new DroneEngine();
window.hypogeum = eng; // コンソールからの操作・外部連携用（例: hypogeum.set('ghz', 40)）
window.kukuru = eng;   // 旧名の互換

// 保存済みの状態を復元。新キーがなければ旧 KUKURU の保存を変換して引き継ぐ
{
  const saved = store.getJSON(STORE_KEY);
  const legacy = saved ? null : store.getJSON(LEGACY_STORE_KEY);
  try {
    if (saved) eng.applyParams(saved, { reset: true });
    else if (legacy) { eng.applyParams(legacy, { reset: true }); store.setJSON(STORE_KEY, eng.exportParams()); }
  } catch { /* 壊れた保存は無視 */ }
}
const persist = debounced(() => store.setJSON(STORE_KEY, eng.exportParams()));
const undo = createUndo(20);
let paintUndo = () => {};
const msg = (t) => { $('#io-msg').textContent = t; };

// 変更の入口：undo に積んでから反映
function change(key, value) {
  undo.push(eng.p, key);
  eng.set(key, value);
  afterChange(key);
  persist();
  paintUndo();
}

// ── 表示の補助 ─────────────────────────────
const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function noteName(hz) {
  const m = 69 + 12 * Math.log2(hz / 440);
  const n = Math.round(m);
  const dev = Math.round((m - n) * 100);
  return `${NOTE[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1} ${dev >= 0 ? '+' : ''}${dev}¢`;
}
const MACRO_SYM = ['Α', 'Β', 'Γ'];
const labelOf = (p) => {
  if (p.macro === undefined) return { code: p.code, plain: p.plain };
  const [c, pl] = (ENGINE_CODES[eng.p.eng] || ENGINE_CODES.add).macros[p.macro];
  return { code: `${MACRO_SYM[p.macro]}·${c}`, plain: pl };
};
const optionText = (p, v) => {
  const o = p.key === 'eng' ? ENGINE_CODES[v] : OPTION_CODES[p.key]?.[v];
  return o ? (isDecoded() ? `${o.code} — ${o.plain}` : o.code) : String(v);
};
const optionPlain = (p, v) => (p.key === 'eng' ? ENGINE_CODES[v]?.plain : OPTION_CODES[p.key]?.[v]?.plain) || String(v);

// ── パラメータパネル ─────────────────────────
let P;
function buildPanels() {
  P = panels(GROUPS, PARAMS, {
    get: (k) => eng.p[k],
    set: change,
    label: labelOf,
    optionText, optionPlain,
    registerOf: (i) => registerOf(i),
    before: { tuning: (sec) => sec.append(rootRow()) },
    extra: {
      gen: (sec) => sec.append(h('p', { id: 'voice-info', class: 'readout small' })),
      therapy: (sec) => sec.append(h('p', { class: 'hint' }, 'バイノーラルはヘッドホンで左右を分けたときだけ成立します。30Hzを超えると「うなり」として知覚されにくくなります。低域では差が知覚しにくいので、キャリアは120Hz以上に固定しています。')),
      space: (sec) => sec.append(h('p', { class: 'hint' }, 'HPF.ω より下（地響き・直流）を切り、MONO.x より下は左右を足してモノにします。PSY.h は低域の2・3倍音を足して、小型スピーカーでも基音を感じさせます。DRV は共通マスター段のソフトクリップです。')),
    },
  });
  const wrap = $('#panels');
  wrap.textContent = '';
  wrap.append(...P.el.children);
}

function rootRow() {
  return h('div', { class: 'root-row' },
    h('output', { id: 'root-note', class: 'readout', 'aria-live': 'polite' }, ''),
    h('div', { class: 'chips small' }, ROOT_PRESETS.map((r) =>
      h('button', { class: 'chip', type: 'button', title: r.title || `${r.hz} Hz`, 'aria-label': `基音を ${r.label}（${r.hz}Hz）に`,
        onclick: () => { change('f0', r.hz); P.controls.f0.sync(); } }, r.label))));
}

function afterChange(key) {
  if (key === 'f0' || key === 'dc') updateRootNote();
  if (['f0', 'dc', 'ghz', 'amd', 'iso'].includes(key)) renderWarn();
  if (['eng', 'exc', 'uni', 'deg', 'scl', 'subK', 'hiK'].includes(key)) renderVoiceInfo();
  if (key === 'eng') ['ma', 'mb', 'mc'].forEach((k) => P.controls[k].relabel());
  if (key === 'eng' || key === 'exc') renderInert();
  if (key === 'scl' || key === 'deg' || key === 'cst') renderScaleInfo();
  garden?.changed(key);
}

// ADD.H 専用の項目は、他のエンジンの持続音では効かないので薄く表示
function renderInert() {
  const live = eng.p.eng === 'add' || eng.p.exc !== 'sustain';
  ['hN', 'rho', 'oe', 'uni', 'dt'].forEach((k) => P.controls[k]?.el.classList.toggle('inert', !live || ((k === 'uni' || k === 'dt') && eng.p.eng !== 'add')));
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
  const dec = isDecoded();
  sel.textContent = '';
  const regions = [...new Set(SCALES.map((s) => s.region))];
  for (const reg of regions) {
    const rc = REGION_CODES[reg] || reg;
    sel.append(h('optgroup', { label: dec ? `${rc} — ${reg}` : rc }, SCALES.filter((s) => s.region === reg).map((s) => {
      const code = scaleCode(s.id, s.cents.length);
      return h('option', { value: s.id, title: s.name }, dec ? `${code} — ${s.name}` : code);
    })));
  }
  sel.append(h('optgroup', { label: dec ? 'USR — 自作' : 'USR' }, h('option', { value: 'custom', title: 'カスタム（セント・比率・.scl）' }, dec ? 'USR-n/X — カスタム（セント・比率・.scl）' : 'USR-n/X')));
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
  $('#scale').value = eng.p.scl;
  $('#scale').title = custom ? 'カスタム音階' : s.name;
  $('#scale-note').textContent = isDecoded() && !custom ? (s.note || '') : '';
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
        change('deg', [...set].sort((a, b) => a - b));
      },
    }, h('span', { class: 'deg-l' }, isDecoded() ? labels[i] : `°${i.toString(16).toUpperCase()}`), h('span', { class: 'deg-c' }, `${c.toFixed(c % 1 ? 1 : 0)}¢`)));
  });
}

function degreePreset(kind) {
  const n = eng.scaleCents().length;
  change('deg', kind === 'all' ? [...Array(n).keys()] : kind === 'root' ? [0] : eng.defaultDegrees());
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
        undo.push(eng.p, `scene:${sc.id}`);
        eng.applyParams({ ...structuredClone(DEFAULTS), ...sc.params, vol: eng.p.vol }, { reset: true });
        syncAll(); persist(); paintUndo();
        const d = $('#scene-desc');
        d.textContent = '';
        d.append(h('span', { class: 'c' }, `${c.code} LOADED`), h('span', { class: 'pl' }, `${c.plain}：${sc.desc}`));
      },
    }, cb(c.code, c.plain));
    (/^b\d\d$/.test(sc.id) ? b : a).append(btn);
  });
}

// ── 全体同期 ───────────────────────────────
function syncAll() {
  P.relabelAll();
  P.syncAll();
  $('#custom-cents').value = eng.p.cst || '';
  updateRootNote();
  renderScaleInfo();
  renderWarn();
  renderVoiceInfo();
  renderInert();
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
  if (type === 'warn') renderWarn();
  if (type === 'voices') renderVoiceInfo();
});

// ── MIDI：ノート→F₀、CCは MIDI learn（既定の割り当てつき） ──
const midi = createMidi({
  mapKey: 'hypogeum:midi-map',
  defaults: { 1: 'lpw', 74: 'lpw', 7: 'vol', 71: 'rho', 91: 'rvb', 16: 'ma', 17: 'mb', 18: 'mc' },
  onCC: (key, v01) => {
    const p = PARAM_BY_KEY[key]; if (!p || p.type === 'select') return;
    const v = p.log ? fromSlider(p, v01 * 1000) : p.min + v01 * (p.max - p.min);
    change(key, v); P.controls[key]?.sync();
  },
  onNote: (note) => { change('f0', +noteToHz(note).toFixed(2)); P.controls.f0.sync(); },
});

// ── 入出力 ───────────────────────────────
let garden = null;
function wireIO() {
  $('#play').addEventListener('click', toggle);
  setupDecode($('#decode'), () => { if (P) { P.relabelAll(); buildScaleSelect(); renderScaleInfo(); } });
  setupSafety($('#safety'), 'hypogeum:safety-seen');
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) { e.preventDefault(); toggle(); }
  });
  $('#scale').addEventListener('change', (e) => change('scl', e.target.value));
  $('#deg-fifth').addEventListener('click', () => degreePreset('fifth'));
  $('#deg-root').addEventListener('click', () => degreePreset('root'));
  $('#deg-all').addEventListener('click', () => degreePreset('all'));
  $('#custom-cents').addEventListener('change', (e) => { change('cst', e.target.value); eng.set('deg', eng.defaultDegrees()); renderScaleInfo(); });
  $('#scl-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const scl = parseScl(await f.text());
      undo.push(eng.p, 'scl-file');
      eng.set('scl', 'custom');
      eng.set('cst', scl.cents.map((c) => c.toFixed(2)).join(', '));
      eng.set('deg', eng.defaultDegrees());
      msg(`読み込みました：${scl.description || f.name}（${scl.cents.length}音）`);
      syncAll(); persist(); paintUndo();
    } catch (err) { msg(`.sclを読めませんでした：${err.message}`); }
    e.target.value = '';
  });
  $('#copy-json').addEventListener('click', async () => {
    const txt = JSON.stringify(eng.exportParams(), null, 2);
    const ta = $('#json');
    ta.value = txt;
    try { await navigator.clipboard.writeText(txt); msg('設定をクリップボードにコピーしました'); }
    catch { ta.select(); msg('下の欄を選択しました。手動でコピーしてください'); }
  });
  $('#load-json').addEventListener('click', () => {
    try {
      const obj = JSON.parse($('#json').value);
      undo.push(eng.p, 'import');
      eng.applyParams(obj, { reset: true });
      syncAll(); persist(); paintUndo();
      msg(obj?.app === 'kukuru-drone' || obj?.version === 1 ? 'KUKURU v1 の設定を変換して読み込みました' : '設定を読み込みました');
    } catch { msg('JSONとして読めませんでした。書き出した内容をそのまま貼り付けてください'); }
  });
  $('#reset').addEventListener('click', () => { undo.push(eng.p, 'reset'); eng.applyParams(DEFAULTS, { reset: true }); syncAll(); persist(); paintUndo(); msg('初期値に戻しました'); });
  $('#midi').addEventListener('click', async () => {
    try { const r = await midi.connect(); msg(`MIDI 入力 ${r.inputs} 台・出力 ${r.outputs} 台を接続しました。ノート→F₀、CCは LEARN で割り当て`); }
    catch (e) { msg(e.message || 'この環境ではMIDIを使えません'); }
  });
  setupMidiLearn($('#learn'), $('#panels'), midi, msg);
  paintUndo = setupUndo($('#undo'), $('#redo'), undo, () => eng.p, (s) => { eng.applyParams({ params: s }, { reset: true }); syncAll(); persist(); });
  setupRecord($('#rec'), () => (eng.ctx ? { ctx: eng.ctx, node: eng.master.output } : null), 'hypogeum', msg);
  startMeter($('#meter'), () => (eng.running ? eng.master : null));

  const bus = createBus('hypogeum');
  garden = setupGarden(eng, bus, { onFollow: () => syncAll(), msg });
  setupBusRole($('#bus'), bus, () => garden.roleChanged());
}

// ── 起動 ─────────────────────────────────
buildPanels();
buildScaleSelect();
buildScenes();
wireIO();
syncAll();
new PhaseDial($('#dial'), eng);

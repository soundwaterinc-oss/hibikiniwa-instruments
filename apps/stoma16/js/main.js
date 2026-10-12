// STOMA//16 — UI。解析はすべて Worker、表示と音だけを UI スレッドで行う
import { $, h, cb, panels } from '../../../packages/core/ui.js';
import { registerOf, fromSlider } from '../../../packages/core/format.js';
import { store, createUndo, debounced } from '../../../packages/core/store.js';
import { setupDecode, setupSafety } from '../../../packages/core/decode.js';
import { startMeter, setupRecord, setupUndo, setupMidiLearn, setupBusRole } from '../../../packages/core/shell.js';
import { createMidi, noteToHz, hzToNote } from '../../../packages/core/midi.js';
import { createBus } from '../../../packages/core/bus.js';
import { encodeWav, saveBytes, audioBufferToWav } from '../../../packages/core/wav.js';
import { GROUPS, PARAMS, PARAM_BY_KEY, DEFAULTS, styleParams, normalizeImport } from './params.js';
import { STYLES, STYLE_IDS, LOOP_LENGTHS } from './styles.js';
import { MODEL_CODES, SPECIMEN_CODES, STAT_CODES, TRACK_CODES, SECTION_CODES, STORE_KEY } from './codebook.js';
import { SPECIMENS } from './specimens.js';
import { createAnalysisPool } from './analysis-client.js';
import { StomaAudio } from './audio.js';
import { createSession, renderBars } from './session.js';
import { buildTracks } from './map.js';
import { Scope, drawIkd } from './scope.js';
import { Lanes } from './lanes.js';
import { tracksToMidi, GM_NOTES } from './export.js';
import { setupGarden } from './garden.js';
import { U } from './analysis/morph.js';

void encodeWav;
const P = { ...structuredClone(DEFAULTS), ...styleParams('TWL') };
try { Object.assign(P, normalizeImport(store.getJSON(STORE_KEY) || {})); } catch { /* 壊れた保存は無視 */ }
const persist = debounced(() => store.setJSON(STORE_KEY, { app: 'stoma16', version: 2, params: P }));
const undo = createUndo(20);
let paintUndo = () => {};
const msg = (t) => { $('#io-msg').textContent = t; };
const status = (t, warn = false) => { const el = $('#seg-status'); el.textContent = t; el.classList.toggle('warn', warn); };

const pool = createAnalysisPool();
const audio = new StomaAudio();
const scope = new Scope($('#scope'), $('#cv-img'), $('#cv-ovl'));
let A = null, S = null, tracks = null, img = null, pendingA = null;
window.stoma = { P, audio, get A() { return A; } };

// ── 解析 ─────────────────────────────────
const SEG_KEYS = PARAMS.filter((p) => p.seg).map((p) => p.key);
const segParams = () => Object.fromEntries(SEG_KEYS.map((k) => [k, P[k]]));
let anSeq = 0;
async function runAnalysis() {
  if (!img) return;
  const my = ++anSeq;
  status('ANALYZING …');
  const t0 = performance.now();
  const res = await pool.analyze(segParams());
  if (my !== anSeq) return;
  applyAnalysis(res, performance.now() - t0);
}
const reanalyze = debounced(runAnalysis, 120);

function applyAnalysis(res, ms) {
  if (audio.running && live) { pendingA = res; return; } // ライブ入力はループ境界でクロスフェード
  const t0 = performance.now();
  A = res;
  rebuild();
  performance.measure('stoma:apply', { start: t0 });
  const n = A.cells.filter((c) => !c.bg && (P.edge !== 1 || !c.border)).length;
  if (n < 4) status(`NO CELLS — 細胞を検出できませんでした（${n}個）。AUTO を押すか、CH・INV・THR を変えてください`, true);
  else status(`OK ${n} cells · ${['LUMA', 'CHL', 'WALL', 'RIDGE'][P.ch]}${P.inv ? '/INV' : ''} · σ×${P.sig} · ${A.W}×${A.H} · ${ms.toFixed(0)}ms`);
  renderStats();
}

function rebuild() {
  if (!A) return;
  if (audio.running && S) { S = createSession(audio, A, P, { seed: P.seed || 1, onSection }); tracks = S.tracks; audio.tracks = tracks; audio.onLoop = loopHook; }
  else tracks = buildTracks(A, P, null);
  scope.setAnalysis(A, tracks);
  lanes.set(tracks, STYLES[P.style].voices.map((v) => v[0]), P.vmute);
  renderStats();
}

async function auto() {
  if (!img) return;
  const prog = $('#progress'), bar = $('#progress-bar');
  prog.hidden = false;
  const r = await pool.auto((done, total, best) => {
    bar.style.width = `${(done / total) * 100}%`;
    status(`AUTO ${String(done).padStart(2, '0')}/${total} — 最良：細胞 ${best.n}・⟨n⟩ ${best.meanN.toFixed(2)}・evidence ${best.evidence.toFixed(2)}`);
  });
  prog.hidden = true;
  if (r.cancelled || !r.best) return;
  if (r.best.score <= 0) { status('NO CELLS — どの設定でも細胞を4個以上検出できませんでした。別の写真か LOAD を試してください', true); return; }
  undo.push(P, 'auto'); paintUndo();
  Object.assign(P, r.best.params);
  P.ch = r.best.params.ch; P.inv = r.best.params.inv;
  Pn.syncAll();
  const res = await pool.analyze(segParams());
  applyAnalysis(res, r.ms);
  msg(`AUTO（${(r.ms / 1000).toFixed(1)}秒、Worker ${pool.size}本）：${r.reason}`);
  persist();
}

// ── 標本 ─────────────────────────────────
async function loadSpecimen(kind, seed = 1) {
  P.specimen = kind; P.specSeed = seed;
  markSlides();
  const im = await pool.specimen(kind, seed);
  setImg(im);
  await runAnalysis();
}
function setImg(im, bmp = null) { const t0 = performance.now(); img = im; pool.setImage(im); scope.setImage(im, bmp); performance.measure('stoma:setImg', { start: t0 }); }

// 画像の縮小はブラウザに任せる（createImageBitmap は UI スレッドの外でデコード・縮小する）。
// 解析は長辺512まで、表示も長辺768あれば足りるので、それ以上は持たない
const MAX_SIDE = 768;
async function toImageData(source) {
  const bmp0 = await createImageBitmap(source);
  const s = Math.min(1, MAX_SIDE / Math.max(bmp0.width, bmp0.height));
  const w = Math.round(bmp0.width * s), hh = Math.round(bmp0.height * s);
  const bmp = s < 1 ? await createImageBitmap(bmp0, { resizeWidth: w, resizeHeight: hh, resizeQuality: 'high' }) : bmp0;
  const c = new OffscreenCanvas(w, hh), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, w, hh);
  return { img: { width: w, height: hh, data: d.data }, bmp };
}
async function loadBlob(blob, kind) {
  const { img: im, bmp } = await toImageData(blob);
  P.specimen = kind; markSlides();
  setImg(im, bmp);
  P.center = null;
  await auto();
}
async function loadUrl(url, kind) { loadBlob(await (await fetch(url)).blob(), kind); }
function loadFile(f) { if (f?.type?.startsWith('image/')) loadBlob(f, 'user'); }

const LOCAL = [];
// fixtures/ はリポジトリに含めない実写真なので、ローカルサーバーで開いたときだけ探す（公開版で 404 を出さない）
async function probeLocal() {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) { buildSlides(); return; }
  for (const [id, file] of [['local-root', 'root_xs.jpg'], ['local-moss', 'moss_leaf.jpg']]) {
    try { const r = await fetch(`../../fixtures/${file}`, { method: 'HEAD' }); if (r.ok) LOCAL.push({ id, file }); } catch { /* 公開版には無い */ }
  }
  buildSlides();
}
function buildSlides() {
  const box = $('#slides');
  box.textContent = '';
  const items = [...SPECIMENS.map((s) => ({ id: s.id })), ...LOCAL];
  for (const it of items) {
    const c = SPECIMEN_CODES[it.id];
    box.append(h('button', { class: 'chip cb', type: 'button', 'data-id': it.id, title: c.plain, 'aria-label': c.plain,
      onclick: () => (it.file ? loadUrl(`../../fixtures/${it.file}`, it.id) : loadSpecimen(it.id, 1)) }, cb(c.code, c.plain)));
  }
  markSlides();
}
function markSlides() { document.querySelectorAll('#slides [data-id]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === P.specimen ? 'true' : 'false')); }

// ── ライブ入力（カメラ・USB顕微鏡）──
let live = null;
async function toggleCam() {
  const btn = $('#cam');
  if (live) { clearInterval(live.timer); live.stream.getTracks().forEach((t) => t.stop()); live = null; btn.setAttribute('aria-pressed', 'false'); msg('ライブ入力を止めました'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 } }, audio: false });
    const v = document.createElement('video'); v.srcObject = stream; v.muted = true; v.playsInline = true; await v.play();
    const grab = async () => {
      const { img: im, bmp } = await toImageData(v);
      setImg(im, bmp);
      const res = await pool.analyze(segParams());
      applyAnalysis(res, 0);
    };
    live = { stream, timer: setInterval(grab, 4000) };
    P.specimen = 'live'; markSlides();
    btn.setAttribute('aria-pressed', 'true');
    msg('ライブ入力：4秒ごとに再解析し、ループの切れ目でパターンをクロスフェードします（映像は端末の外へ送りません）');
    await grab();
    if (!A || A.cells.length < 4) await auto();
  } catch (e) { msg(`カメラを使えません：${e.message}`); }
}

// ── 再生 ─────────────────────────────────
let timer = null, midiOut = false, beatIdx = -1;
function onSection(E) { renderEvo(E); }
function loopHook(idx, t) {
  let r = S.onLoop(idx, t);
  if (pendingA) {
    // ライブ入力：新しいパターンを半分の強さで重ね、次のループで入れ替える（クロスフェード）
    const oldT = audio.tracks;
    A = pendingA; pendingA = null;
    S = createSession(audio, A, P, { seed: P.seed || 1, onSection });
    const fresh = S.tracks;
    r = { ...fresh, tracks: fresh.tracks.map((t, v) => ({ ...t, events: [...t.events.map((e) => ({ ...e, vel: e.vel * 0.6 })), ...(oldT?.tracks[v]?.len === t.len ? oldT.tracks[v].events.map((e) => ({ ...e, vel: e.vel * 0.4 })) : [])], _byStep: null })) };
    scope.setAnalysis(A, fresh); renderStats();
  }
  if (r) { tracks = r; scope.setAnalysis(A, r); lanes.set(r, STYLES[audio.activeStyle(P, S.E)].voices.map((v) => v[0]), P.vmute); }
  renderEvo(S.E);
  return r;
}
async function toggleRun() {
  if (!A) return;
  if (audio.running) { audio.stop(); clearInterval(timer); setRunBtn(false); return; }
  audio.init();
  await audio.ctx.resume();
  S = createSession(audio, A, P, { seed: P.seed || ((Math.random() * 1e9) >>> 0), onSection });
  tracks = S.tracks;
  audio.start(P, tracks, {
    seed: P.seed || 1, onLoop: loopHook,
    onHit: (v, e, when) => scope.hit(v, e, when),
    onNote: (v, e, when, stepDur) => {
      if (!midiOut) return;
      const ms = performance.now() + (when - audio.ctx.currentTime) * 1000;
      const note = GM_NOTES[v] ?? Math.round(hzToNote(P.f0 * 2) + (1 - (e.aQ ?? 0.5)) * 12);
      midi.sendNote(note, e.vel, ms, stepDur * 900, GM_NOTES[v] === null ? 0 : 9);
    },
  });
  audio.applyFx(P, S.E);
  timer = setInterval(() => { const now = audio.ctx.currentTime; audio.scheduleUntil(now + 0.14); audio.crackle(P, now + 0.14, now + 0.165); }, 25);
  renderEvo(S.E);
  setRunBtn(true);
}
function setRunBtn(on) {
  const b = $('#run');
  b.textContent = on ? '■ HALT' : '▶ RUN';
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.setAttribute('aria-label', on ? '止める' : '鳴らす');
}
function renderEvo(E) {
  const el = $('#evo-state');
  el.textContent = '';
  if (!P.evo || !E) { el.append(h('span', { class: 'c' }, 'EVO OFF — 固定ループ'), h('span', { class: 'pl' }, '')); return; }
  const seq = { ARC: ['INT', 'BLD', 'PK', 'BRK', 'PK', 'OUT'], DUB: ['DRP', 'ECH', 'PK', 'ECH', 'DRP', 'BRK'], MIN: ['ADD'], DRF: ['DRF'], TISSUE: ['RNG'] }[P.form];
  const strip = seq.map((k, i) => (i === E.sec % seq.length ? `[${SECTION_CODES[k].code}]` : SECTION_CODES[k].code)).join(' ');
  el.append(h('span', { class: 'c' }, `${E.name} · LOOP ${E.total + 1} · SEED ${E.seed} · ${strip}${E.tissue ? ` · ${E.tissue}` : ''}${P.cyc ? ` · ${E.styleFrom}→${E.styleTo} ${(E.morph * 100).toFixed(0)}%` : ''}`),
    h('span', { class: 'pl' }, ` — ${SECTION_CODES[E.key].plain}${E.fill ? '（フィル）' : ''}`));
}

// ── 統計 ─────────────────────────────────
function renderStats() {
  if (!A) return;
  const s = A.stats;
  const rows = [
    ['N', s.n], ['meanN', s.meanN.toFixed(2)], ['hex', `${(s.hex * 100).toFixed(0)}%`], ['lewis', s.lewisR.toFixed(2)],
    ['aboav', s.aboavA.toFixed(2)], ['meanA', s.meanA.toFixed(0)], ['convex', s.meanConvex.toFixed(2)], ['evidence', A.evidence.toFixed(2)],
    ['evt', tracks ? tracks.count : 0],
  ];
  const box = $('#stats');
  box.textContent = '';
  for (const [k, v] of rows) box.append(h('div', { class: 'stat', title: STAT_CODES[k].plain }, h('span', { class: 'k cb' }, cb(STAT_CODES[k].code, STAT_CODES[k].plain)), h('span', { class: 'v' }, String(v))));
  const t = $('#tissue');
  t.textContent = '';
  for (const cl of A.classes?.list || []) {
    const rgb = cl.rgb.map((x) => Math.round(x * 255)).join(',');
    t.append(h('span', { class: 'tis cb', title: `${cl.plain}：${cl.count}個（${(cl.frac * 100).toFixed(0)}%）` }, h('i', { style: { background: `rgb(${rgb})` } }), h('span', { class: 'c' }, `${cl.code} ${(cl.frac * 100).toFixed(0)}%`), h('span', { class: 'pl' }, cl.plain)));
  }
  if (A.center) t.append(h('span', { class: 'tis cb', title: '同心円構造の中心の推定方法' }, h('span', { class: 'c' }, `CTR.${A.center.method.toUpperCase()} ${A.center.score.toFixed(2)}`), h('span', { class: 'pl' }, { ring: '環状の組織に円をフィット', gradient: '大きさの放射状勾配', none: '画像の中心' }[A.center.method])));
}

// ── パラメータ ─────────────────────────────
function change(key, v) {
  undo.push(P, key); paintUndo();
  P[key] = v;
  persist();
  const p = PARAM_BY_KEY[key];
  if (p?.seg) { reanalyze(); return; }
  if (key === 'bpm' && audio.ctx) audio.setTempo(v);
  if (['mode', 'bars', 'q', 'dens', 'anchor', 'poly', 'clsw', 'ang', 'evo', 'form', 'phr', 'seed'].includes(key)) rebuild();
  if (audio.ctx) audio.applyFx(P, S?.E);
  if (key === 'style') { buildVox(); markStyles(); }
  garden?.publish(true);
}
const optionText = null;
const Pn = panels(GROUPS, PARAMS, { get: (k) => P[k], set: change, registerOf: (i) => registerOf(i), optionText });
$('#panels').append(...Pn.el.children);

function applyStyle(id) {
  undo.push(P, 'style'); paintUndo();
  Object.assign(P, styleParams(id));
  Pn.syncAll(); buildVox(); markStyles();
  if (audio.ctx) { audio.setTempo(P.bpm); audio.applyFx(P, S?.E); }
  rebuild(); persist();
  $('#ikd').hidden = id !== 'IKD';
}
function buildStyles() {
  const box = $('#styles');
  for (const id of STYLE_IDS) {
    const s = STYLES[id];
    box.append(h('button', { type: 'button', class: 'style', 'data-id': id, 'aria-label': `${s.name}：${s.plain}`, onclick: () => applyStyle(id) },
      h('b', {}, s.code), h('span', { class: 'nm' }, s.name), h('span', { class: 'pl' }, s.plain)));
  }
  markStyles();
}
function markStyles() { document.querySelectorAll('.style').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === P.style ? 'true' : 'false')); }

// ── トラック表（VOX）──
function buildVox() {
  const st = STYLES[P.style], vox = $('#vox');
  vox.textContent = '';
  vox.append(h('div', { class: 'vrow head', 'aria-hidden': 'true' }, 'M', 'TRK', 'SRC', 'LEN', 'LVL', 'TUN', 'DCY', 'BIAS', 'M1', 'M2'));
  st.voices.forEach(([code, plain], v) => {
    const role = TRACK_CODES[v].role;
    const row = h('div', { class: 'vrow', style: { '--vc': `var(--v${v})` } });
    const mute = h('button', { class: 'mute', type: 'button', 'aria-pressed': P.vmute[v] ? 'true' : 'false', 'aria-label': `${plain}をミュート`, title: `${plain}をミュート` });
    mute.addEventListener('click', () => { undo.push(P, `mute${v}`); P.vmute[v] = P.vmute[v] ? 0 : 1; mute.setAttribute('aria-pressed', P.vmute[v] ? 'true' : 'false'); if (audio.ctx) audio.applyFx(P, S?.E); lanes.set(tracks, st.voices.map((x) => x[0]), P.vmute); persist(); });
    const model = h('select', { 'aria-label': `${plain}の音色`, title: MODEL_CODES[P.vmodel[v]].plain }, Object.keys(MODEL_CODES).map((m) => h('option', { value: m, title: MODEL_CODES[m].plain }, m === 'NAT' ? `NAT·${code.split('.')[1]}` : m)));
    model.value = P.vmodel[v];
    const len = h('select', { 'aria-label': `${plain}のループ長（POLY=MAN のとき）`, title: 'ループ長（ステップ数）。POLY=MAN のとき有効' }, LOOP_LENGTHS.map((l) => h('option', { value: String(l) }, String(l))));
    len.value = String(P.vlen[v]);
    len.addEventListener('change', () => { undo.push(P, `len${v}`); P.vlen[v] = len.value === 'BAR' ? 'BAR' : Number(len.value); rebuild(); persist(); });
    const sliders = [];
    const macroLbl = (i) => MODEL_CODES[P.vmodel[v]].macros[i];
    for (const [key, min, max, step, name] of [['vlvl', 0, 1.2, 0.01, '音量'], ['vtun', -12, 12, 1, '音程（半音）'], ['vdcy', 0.3, 3, 0.01, '減衰の長さ'], ['vbias', 0, 2.5, 0.01, 'この形の細胞を引き寄せる強さ'], ['vm1', 0, 1, 0.01, 'M1'], ['vm2', 0, 1, 0.01, 'M2']]) {
      const r = h('input', { type: 'range', min, max, step, value: P[key][v] });
      const label = () => (key === 'vm1' ? `${plain}：${macroLbl(0)[0]} ${macroLbl(0)[1]}` : key === 'vm2' ? `${plain}：${macroLbl(1)[0]} ${macroLbl(1)[1]}` : `${plain}の${name}`);
      r.setAttribute('aria-label', label()); r.title = label();
      r.addEventListener('input', () => { undo.push(P, `${key}${v}`); P[key][v] = +r.value; if (key === 'vbias') rebuild(); if (key === 'vlvl' && audio.ctx) audio.applyFx(P, S?.E); persist(); });
      r.addEventListener('dblclick', () => { P[key][v] = DEFAULTS[key][v]; r.value = P[key][v]; persist(); });
      sliders.push([r, label]);
    }
    model.addEventListener('change', () => { undo.push(P, `model${v}`); P.vmodel[v] = model.value; model.title = MODEL_CODES[model.value].plain; for (const [r, l] of sliders) { r.title = l(); r.setAttribute('aria-label', l()); } persist(); });
    row.append(mute, h('span', { class: 'vname cb', title: `${plain}｜${role}` }, h('span', { class: 'c' }, code), h('span', { class: 'pl' }, `${plain}｜${role}`)), model, len, ...sliders.map((s) => s[0]));
    vox.append(row);
  });
}

// ── レーン図 ─────────────────────────────
const lanes = new Lanes($('#lanes'), {
  onEdit: (e) => {
    undo.push(P, 'lane'); paintUndo();
    if (e.type === 'micro') P.micro = { ...P.micro, [`${e.v}:${e.step}`]: e.micro };
    else if (e.ev && e.ev.anchor) { msg('アンカー（スタイルが拍の頭に置く打点）は消せません。§0x2 MAP の ANC を OFF にしてください'); return; }
    else if (e.ev && e.ev.cell >= 0) P.muted = [...P.muted, `${e.ev.cell}:${e.v}`];
    else if (e.ev) P.added = P.added.filter((a) => !(a.v === e.v && a.step === e.step));
    else P.added = [...P.added, { v: e.v, step: e.step }];
    rebuild(); persist();
  },
  onCursor: (c, ev) => { $('#lane-cursor').textContent = `TRK ${c.v} · STEP ${c.step}${ev ? ` · VEL ${ev.vel.toFixed(2)} · μ ${(ev.micro || 0).toFixed(2)}${ev.anchor ? ' · ANCHOR' : ''}` : ' · （空き）'}`; },
});

// ── 描画ループ ─────────────────────────────
function frame() {
  requestAnimationFrame(frame);
  const running = audio.running;
  const now = audio.ctx ? audio.ctx.currentTime : 0;
  const beat = running ? audio.beatAt(now) : 0;
  const phase = running ? audio.phaseNow() : 0;
  scope.draw({ phase, running, now, mode: P.mode, bars: P.bars, center: S?.E?.center || P.center, walk: tracks?.walk || [] });
  lanes.draw(running ? { beat } : null);
  if (running) { const b = beat / 4; $('#clock').textContent = `BAR ${Math.floor(b % P.bars) + 1} · ${(b % 1).toFixed(3)}`; }
  // IKD の数値行列・バーコードは拍ごとにだけ更新（8Hz 未満）
  const bi = Math.floor(beat);
  if (P.style === 'IKD' && bi !== beatIdx) { beatIdx = bi; drawIkd($('#ikd'), A, tracks, bi); }
}

// ── MIDI ─────────────────────────────────
const midi = createMidi({
  mapKey: 'stoma16:midi-map',
  defaults: { 1: 'dens', 7: 'vol', 71: 'q', 74: 'lofi', 91: 'dly' },
  onCC: (key, v01) => { const p = PARAM_BY_KEY[key]; if (!p || p.type === 'select') return; change(key, p.log ? fromSlider(p, v01 * 1000) : p.min + v01 * (p.max - p.min)); Pn.controls[key]?.sync(); },
  onNote: (n) => { let f = noteToHz(n); while (f > 110) f /= 2; while (f < 27.5) f *= 2; change('f0', +f.toFixed(2)); Pn.controls.f0?.sync(); },
});

// ── 入出力 ───────────────────────────────
let garden = null;
function wire() {
  setupDecode($('#decode'), () => Pn.relabelAll());
  setupSafety($('#safety'), 'stoma16:safety-seen');
  $('#run').addEventListener('click', toggleRun);
  $('#auto').addEventListener('click', auto);
  $('#reseed').addEventListener('click', () => { if (SPECIMEN_CODES[P.specimen] && SPECIMENS.some((s) => s.id === P.specimen)) loadSpecimen(P.specimen, (P.specSeed || 1) + 1); });
  $('#file').addEventListener('change', (e) => { loadFile(e.target.files?.[0]); e.target.value = ''; });
  $('#cam').addEventListener('click', toggleCam);
  $('#view').addEventListener('click', () => { scope.colorMode = scope.colorMode === 'track' ? 'class' : 'track'; $('#view').textContent = scope.colorMode === 'track' ? 'VIEW·TRK' : 'VIEW·TIS'; scope.setAnalysis(A, tracks); });
  const sc = $('#scope');
  sc.addEventListener('dragover', (e) => { e.preventDefault(); sc.classList.add('drag'); });
  sc.addEventListener('dragleave', () => sc.classList.remove('drag'));
  sc.addEventListener('drop', (e) => { e.preventDefault(); sc.classList.remove('drag'); loadFile(e.dataTransfer.files?.[0]); });
  document.addEventListener('paste', (e) => { const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/')); if (it) loadFile(it.getAsFile()); });
  sc.addEventListener('click', (e) => { if (!A) return; undo.push(P, 'center'); P.center = scope.toUnit(e.clientX, e.clientY); rebuild(); persist(); });
  sc.addEventListener('dblclick', () => { P.center = null; rebuild(); persist(); msg('走査の中心を自動推定に戻しました'); });
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'CANVAS'].includes(document.activeElement?.tagName)) { e.preventDefault(); toggleRun(); } });
  $('#exp-mid').addEventListener('click', () => { if (!tracks) return; saveBytes(tracksToMidi(tracks, P, { bars: 4 }), `stoma16-${P.style}.mid`, 'audio/midi'); msg('.mid を書き出しました（4小節）'); });
  $('#exp-wav').addEventListener('click', async () => {
    if (!A) return;
    msg('4小節をオフライン描画しています…');
    const { buf } = await renderBars(globalThis.OfflineAudioContext, A, P, { bars: 4, sampleRate: 48000, seed: P.seed || 1 });
    saveBytes(audioBufferToWav(buf), `stoma16-${P.style}-4bars.wav`, 'audio/wav');
    msg('4小節の WAV を書き出しました');
  });
  $('#copy-json').addEventListener('click', async () => {
    const txt = JSON.stringify({ app: 'stoma16', version: 2, params: P }, null, 2);
    $('#json').value = txt;
    try { await navigator.clipboard.writeText(txt); msg('設定をクリップボードにコピーしました'); } catch { $('#json').select(); msg('下の欄を選択しました。手動でコピーしてください'); }
  });
  $('#load-json').addEventListener('click', () => {
    try { undo.push(P, 'import'); Object.assign(P, normalizeImport(JSON.parse($('#json').value))); Pn.syncAll(); buildVox(); markStyles(); reanalyze(); persist(); msg('設定を読み込みました'); }
    catch { msg('JSONとして読めませんでした'); }
  });
  $('#midi').addEventListener('click', async () => {
    try { const r = await midi.connect(); midiOut = r.outputs > 0; msg(`MIDI 入力 ${r.inputs} 台・出力 ${r.outputs} 台。出力には各トラックをノート（GM ドラム／T は ch1 の音程）で送ります`); }
    catch (e) { msg(e.message); }
  });
  setupMidiLearn($('#learn'), $('#panels'), midi, msg);
  paintUndo = setupUndo($('#undo'), $('#redo'), undo, () => P, (s) => { Object.assign(P, s); Pn.syncAll(); buildVox(); markStyles(); reanalyze(); rebuild(); if (audio.ctx) audio.applyFx(P, S?.E); persist(); });
  setupRecord($('#rec'), () => (audio.ctx ? { ctx: audio.ctx, node: audio.master.output } : null), 'stoma16', msg);
  startMeter($('#meter'), () => (audio.running ? audio.master : null));
  const bus = createBus('stoma16');
  garden = setupGarden({ bus, audio, getP: () => P, setP: (k, v) => { P[k] = v; Pn.controls[k]?.sync(); if (k === 'bpm' && audio.ctx) audio.setTempo(v); if (audio.ctx) audio.applyFx(P, S?.E); } , msg });
  setupBusRole($('#bus'), bus, () => garden.roleChanged());
}

// ── 起動 ─────────────────────────────────
buildStyles();
buildVox();
wire();
$('#ikd').hidden = P.style !== 'IKD';
probeLocal();
loadSpecimen(SPECIMENS.some((s) => s.id === P.specimen) ? P.specimen : 'cork', P.specSeed || 1);
requestAnimationFrame(frame);
void U;

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSpecimen } from '../apps/stoma16/js/specimens.js';
import { analyze } from '../apps/stoma16/js/analysis/index.js';
import { DEFAULTS, styleParams, normalizeImport, PARAMS } from '../apps/stoma16/js/params.js';
import { STYLES, STYLE_IDS } from '../apps/stoma16/js/styles.js';
import { buildTracks } from '../apps/stoma16/js/map.js';
import { createEvo, step, FORMS } from '../apps/stoma16/js/evo.js';
import { tracksToMidi } from '../apps/stoma16/js/export.js';
import { readSmfHeader } from '../packages/core/smf.js';

const cork = analyze(renderSpecimen('cork', 1));
const P0 = (over = {}) => ({ ...structuredClone(DEFAULTS), ...styleParams('TWL'), ...over });

test('アンカー：TWL・BDM はキックが各小節の1拍目に必ずある（細胞がなくても）', () => {
  for (const style of ['TWL', 'BDM']) for (const bars of [1, 2, 4]) {
    const P = P0({ ...styleParams(style), bars, dens: 0.05 });
    const { tracks } = buildTracks(cork, P);
    const K = tracks[0];
    for (let b = 0; b < bars; b++) assert.ok(K.events.some((e) => e.step === b * K.div && e.anchor), `${style} bars=${bars} 小節${b + 1}`);
  }
  // BDM はスネアの 2・4 拍
  const { tracks } = buildTracks(cork, P0({ ...styleParams('BDM'), bars: 1 }));
  for (const s of [4, 12]) assert.ok(tracks[2].events.some((e) => e.step === s && e.anchor), `BDM スネア ${s}`);
  // ANC=OFF ではアンカーを足さない
  const off = buildTracks(cork, P0({ anchor: 0, dens: 0.05 })).tracks[0];
  assert.ok(!off.events.some((e) => e.anchor));
});

test('ポリメトリック：トラックごとのループ長（16/12/10/7）と AUTO', () => {
  const P = P0({ poly: 'MAN', vlen: [16, 12, 10, 7, 'BAR', 16] });
  const { tracks } = buildTracks(cork, P);
  assert.deepEqual(tracks.map((t) => t.len), [16, 12, 10, 7, STYLES.TWL.div[4] * P.bars, 16]);
  for (const t of tracks) for (const e of t.events) assert.ok(e.step >= 0 && e.step < t.len, `v${t.v} step ${e.step} < ${t.len}`);
  const auto = buildTracks(cork, P0({ poly: 'AUTO' })).tracks;
  for (const t of auto) assert.ok([16, 12, 10, 7].includes(t.len), `AUTO v${t.v} len ${t.len}`);
});

test('BDM：16段階のベロシティ、IKD：高域トーンの総量の上限', () => {
  const bdm = buildTracks(cork, P0(styleParams('BDM'))).tracks;
  for (const t of bdm) for (const e of t.events) assert.ok(Math.abs(e.vel * 16 - Math.round(e.vel * 16)) < 1e-9, `vel ${e.vel}`);
  const ikd = buildTracks(cork, P0({ ...styleParams('IKD'), dens: 1 })).tracks;
  for (const v of [1, 3]) {
    const t = ikd[v];
    const perBar = t.events.reduce((s, e) => s + e.vel, 0) / (t.len / t.div);
    assert.ok(perBar <= STYLES.IKD.hiCap + 1e-9, `IKD v${v} ${perBar}`);
  }
});

test('EVO：5つの型が12ループで想定どおり進み、SEED で再現できる', () => {
  const root = analyze(renderSpecimen('cork', 3));
  const expect = {
    ARC: ['INT', 'INT', 'BLD', 'BLD', 'PK', 'PK', 'BRK', 'BRK', 'PK', 'PK', 'OUT', 'OUT'],
    DUB: ['DRP', 'DRP', 'ECH', 'ECH', 'PK', 'PK', 'ECH', 'ECH', 'DRP', 'DRP', 'BRK', 'BRK'],
    MIN: Array(12).fill('ADD'),
    DRF: Array(12).fill('DRF'),
    TISSUE: Array(12).fill('RNG'),
  };
  assert.deepEqual(Object.keys(FORMS).sort(), Object.keys(expect).sort());
  for (const form of Object.keys(expect)) {
    const P = P0({ evo: 1, form, phr: 2, seed: 42, rate: 0.5 });
    const run = () => {
      const E = createEvo(P, root, { seed: 42 });
      const keys = [E.key], extra = [form === 'MIN' ? E.mask.reduce((s, x) => s + x, 0) : form === 'TISSUE' ? E.ring : E.dens.toFixed(4)];
      for (let i = 1; i < 12; i++) { step(E, P, root); keys.push(E.key); extra.push(form === 'MIN' ? E.mask.reduce((s, x) => s + x, 0) : form === 'TISSUE' ? E.ring : E.dens.toFixed(4)); }
      return { keys, extra };
    };
    const a = run(), b = run();
    assert.deepEqual(a.keys, expect[form], form);
    assert.deepEqual(a, b, `${form} は SEED で再現できる`);
    if (form === 'MIN') assert.deepEqual(a.extra, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6], 'MIN は1トラックずつ入る');
    if (form === 'TISSUE') assert.deepEqual(a.extra, [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1], 'TISSUE は外側の環から内側へ');
  }
  // BUILD は区間内で密度が指数的に上がる
  const P = P0({ evo: 1, form: 'ARC', phr: 4, seed: 1, rate: 0 });
  const E = createEvo(P, root, { seed: 1 });
  const dens = [];
  for (let i = 0; i < 8; i++) { if (E.key === 'BLD') dens.push(E.dens); step(E, P, root); }
  assert.equal(dens.length, 4);
  for (let i = 1; i < dens.length; i++) assert.ok(dens[i] > dens[i - 1], 'BUILD で密度が上がる');
  assert.ok(dens[3] / dens[2] > dens[1] / dens[0] - 1e-9, '指数的（比が一定以上）');
});

test('MIDI 書き出し：ヘッダー・トラック数・テンポ', () => {
  const P = P0({ bars: 2 });
  const tr = buildTracks(cork, P);
  const bytes = tracksToMidi(tr, P, { bars: 4 });
  const h = readSmfHeader(bytes);
  assert.equal(h.magic, 'MThd');
  assert.equal(h.format, 1);
  assert.equal(h.tracks, 7); // テンポ＋6トラック
  assert.equal(h.division, 480);
});

test('設定：v2 の書き出しは読み戻せ、旧版（試作）の設定も変換して読める', () => {
  const v2 = normalizeImport({ app: 'stoma16', version: 2, params: { ...DEFAULTS, style: 'IKD', bpm: 140, form: 'TISSUE' } });
  assert.equal(v2.style, 'IKD'); assert.equal(v2.bpm, 140); assert.equal(v2.form, 'TISSUE');
  const v1 = normalizeImport({ style: 'BDM', thr: 0.04, swg: 0.2, grow: 4, blr: 1, bpm: 88, ch: 3, inv: 1 });
  assert.equal(v1.style, 'BDM');
  assert.ok(v1.hi > 0.3 && v1.hi < 0.4, `thr → hi ${v1.hi}`);
  assert.ok(Math.abs(v1.swg - 0.6) < 1e-9, '16分の割合 0.2 → MPC 60%');
  assert.ok(!('grow' in v1) && !('blr' in v1));
  for (const p of PARAMS) if (p.type !== 'select') assert.ok(p.def >= p.min && p.def <= p.max, p.key);
  for (const s of STYLE_IDS) assert.ok(STYLES[s].anchor.length >= 1, `${s} のアンカー`);
});

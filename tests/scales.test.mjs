import test from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, parsePitchList, parseScl, nearestFifthIndex } from '../js/scales.js';
import { PARAMS, SCENES, DEFAULTS } from '../js/params.js';

test('全音階：0cから始まり、昇順で、1200c未満', () => {
  const ids = new Set();
  for (const s of SCALES) {
    assert.ok(!ids.has(s.id), `ID重複: ${s.id}`);
    ids.add(s.id);
    assert.equal(s.cents[0], 0, `${s.id} は0cで始まる`);
    for (let i = 1; i < s.cents.length; i++) assert.ok(s.cents[i] > s.cents[i - 1], `${s.id} は昇順`);
    assert.ok(s.cents.at(-1) < 1200, `${s.id} は1オクターブ内`);
    if (s.labels) assert.equal(s.labels.length, s.cents.length, `${s.id} のラベル数`);
  }
});

test('純正比とコンマの換算', () => {
  const yaman = SCALES.find((s) => s.id === 'yaman');
  assert.ok(Math.abs(yaman.cents[4] - 701.96) < 0.1); // 3/2
  const ussak = SCALES.find((s) => s.id === 'ussak');
  assert.ok(Math.abs(ussak.cents[3] - 498.1) < 0.2); // 22コンマ ≒ 完全4度
});

test('ピッチ一覧の解析（セント・比率混在、重複除去、オクターブ還元）', () => {
  assert.deepEqual(parsePitchList('0, 3/2, 1200, 386.31'), [0, 386.31, 701.96]);
});

test('Scala .scl の解析', () => {
  const scl = '! test.scl\n!\nPentatonic test\n 5\n!\n 200.0\n 5/4\n 3/2\n 1800/1000\n 2/1\n';
  const r = parseScl(scl);
  assert.equal(r.description, 'Pentatonic test');
  assert.equal(r.period, 1200);
  assert.equal(r.cents.length, 5);
  assert.throws(() => parseScl('x\n 3\n 100.0\n'));
});

test('5度探索', () => {
  assert.equal(nearestFifthIndex([0, 200, 400, 700, 900]), 3);
  assert.equal(nearestFifthIndex([0, 240, 480, 960]), -1);
});

test('シーンは既知のパラメータだけを使う', () => {
  for (const sc of SCENES) for (const k of Object.keys(sc.params)) assert.ok(k in DEFAULTS, `${sc.id}: ${k}`);
  for (const sc of SCENES) {
    const s = SCALES.find((x) => x.id === sc.params.scaleId);
    assert.ok(s, `${sc.id} の音階`);
    for (const d of sc.params.degrees) assert.ok(d < s.cents.length, `${sc.id} の度数 ${d}`);
  }
  for (const p of PARAMS) if (p.type !== 'select') assert.ok(p.def >= p.min && p.def <= p.max, p.key);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, sci, hex, toSlider, fromSlider, sanitizeBy, registerOf } from '../packages/core/format.js';
import { createUndo, exportOf } from '../packages/core/store.js';
import { writeSmf, readSmfHeader } from '../packages/core/smf.js';
import { encodeWav } from '../packages/core/wav.js';
import { createBus, projectPosition } from '../packages/core/bus.js';
import { duplicates, mdTable } from '../packages/core/codebook.js';

test('計器表示：指数・16進・単位の併記', () => {
  assert.equal(sci(41.2), '4.12E+1');
  assert.equal(hex(3), '0x03');
  assert.equal(fmt({ unit: 'Hz', step: 0.01 }, 41.2), '4.12E+1 Hz');
  assert.equal(fmt({ unit: '¢', step: 1 }, 5), '+5 ¢');
  assert.equal(fmt({ step: 1, min: 1 }, 10), '0x0A');
  assert.equal(fmt({ off: true, step: 0.01, min: 0 }, 0), 'OFF');
  assert.equal(registerOf(0), 'R0x10');
});

test('対数スライダーの往復', () => {
  const p = { min: 20, max: 250, log: true, step: 0.01 };
  for (const v of [20, 41.2, 110, 250]) assert.ok(Math.abs(fromSlider(p, toSlider(p, v)) - v) < 0.05, String(v));
});

test('スキーマに従った値の補正', () => {
  assert.equal(sanitizeBy({ min: 0, max: 1, def: 0.5 }, 9), 1);
  assert.equal(sanitizeBy({ min: 0, max: 1, def: 0.5 }, 'x'), 0.5);
  assert.equal(sanitizeBy({ type: 'select', options: [['a', 'A'], ['b', 'B']], def: 'a' }, 'b'), 'b');
  assert.equal(sanitizeBy({ type: 'select', options: [[1, 'A'], [2, 'B']], def: 1 }, '2'), 2);
  assert.equal(sanitizeBy({ type: 'select', options: ['a'], def: 'a' }, 'z'), 'a');
});

test('undo：直近20操作、同じキーの連続操作は1つにまとめる', () => {
  const u = createUndo(20);
  for (let i = 0; i < 30; i++) u.push({ v: i }, `k${i}`, i * 1000);
  assert.equal(u.size, 20);
  let cur = { v: 30 };
  cur = u.undo(cur);
  assert.deepEqual(cur, { v: 29 });
  assert.deepEqual(u.redo(cur), { v: 30 });
  const w = createUndo();
  w.push({ v: 0 }, 'f', 0); w.push({ v: 1 }, 'f', 100); w.push({ v: 2 }, 'f', 200);
  assert.equal(w.size, 1, 'ドラッグ中は1操作');
  assert.deepEqual(exportOf('x', 2, { a: 1 }), { app: 'x', version: 2, params: { a: 1 } });
});

test('MIDIファイル：ヘッダーとトラック数', () => {
  const bytes = writeSmf({ ppq: 480, bpm: 120, tracks: [{ name: 'K', ch: 9, notes: [{ tick: 0, dur: 120, note: 36, vel: 100 }] }, { name: 'T', notes: [] }] });
  const hd = readSmfHeader(bytes);
  assert.deepEqual(hd, { magic: 'MThd', length: 6, format: 1, tracks: 3, division: 480 });
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), 'MTrk');
  // テンポ 120BPM = 500000µs
  const i = bytes.findIndex((b, k) => b === 0xff && bytes[k + 1] === 0x51);
  assert.deepEqual([...bytes.slice(i + 3, i + 6)], [0x07, 0xa1, 0x20]);
});

test('WAV：RIFFヘッダーとPCM 16bit', () => {
  const w = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0.5, 0, 0])], 48000);
  const dv = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...w.slice(8, 12)), 'WAVE');
  assert.equal(dv.getUint16(22, true), 2);
  assert.equal(dv.getUint32(24, true), 48000);
  assert.equal(dv.getUint32(40, true), 12);
  assert.equal(dv.getInt16(48, true), 32767);
  assert.equal(dv.getInt16(52, true), -32768);
});

test('GARDEN BUS：master の状態が follow 側に届き、位置を推定できる', () => {
  // メモリ上の擬似 BroadcastChannel
  const hub = new Set();
  const mk = () => { const ch = { onmessage: null, postMessage: (d) => hub.forEach((o) => o !== ch && o.onmessage?.({ data: structuredClone(d) })), close() { hub.delete(ch); } }; hub.add(ch); return ch; };
  const a = createBus('stoma16', { channel: mk() });
  const b = createBus('hypogeum', { channel: mk() });
  a.role = 'master';
  const got = [];
  b.on((m) => got.push(m));
  a.publish({ bpm: 120, bar: 3, phase: 0.5, f0: 41.2, scale: { code: 'RYK-5/J', cents: [0, 386.3] }, running: false }, true);
  assert.equal(got.at(-1).bpm, 120);
  assert.equal(b.master().app, 'stoma16');
  const pos = projectPosition(b.master());
  assert.equal(pos.bar, 3);
  assert.equal(pos.barDur, 2);
});

test('コード表の補助', () => {
  assert.deepEqual(duplicates(['A', 'B', 'A']), ['A']);
  assert.match(mdTable(['a', 'b'], [['x|y', 1]]), /x\\\|y/);
});

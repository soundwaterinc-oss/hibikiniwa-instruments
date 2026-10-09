import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_KEYS, LEGACY_STORE_KEY, STORE_KEY } from '../apps/hypogeum/js/codebook.js';
import { DEFAULTS, migrateV1, normalizeImport } from '../apps/hypogeum/js/params.js';

// KUKURU v1 が保存していた全キー
const V1_KEYS = [
  'rootHz', 'fineCents', 'subLevel', 'upperLevel', 'harmonics', 'rolloff', 'oddEven', 'unison', 'detune', 'cutoff', 'resonance',
  'driftCents', 'driftRate', 'ampDrift', 'spread', 'mode', 'tanpuraCycle', 'pluckDecay', 'jawari',
  'beatHz', 'amDepth', 'amShape', 'isoLevel', 'binauralLevel', 'carrierHz', 'carrierLock',
  'breathBpm', 'inhaleRatio', 'breathDepth', 'breathFilter',
  'reverbMix', 'reverbDecay', 'delayMix', 'delayTime', 'delayFb',
  'volume', 'fadeIn', 'sessionMin', 'fadeOut', 'scaleId', 'degrees', 'customCents',
];

test('旧キー対応表が v1 の全キーを v2 の既存キーへ写す', () => {
  assert.equal(STORE_KEY, 'hypogeum:v2');
  assert.equal(LEGACY_STORE_KEY, 'kukuru-drone:v1');
  for (const k of V1_KEYS) {
    assert.ok(LEGACY_KEYS[k], `対応なし: ${k}`);
    assert.ok(LEGACY_KEYS[k] in DEFAULTS, `${k} → ${LEGACY_KEYS[k]} は v2 に存在しない`);
  }
  assert.equal(new Set(Object.values(LEGACY_KEYS)).size, Object.keys(LEGACY_KEYS).length, '写像は単射');
});

test('v1 → v2 の変換（キー名・基音の折り畳み・キャリア下限・未知キーの除去）', () => {
  const v1 = {
    app: 'kukuru-drone', version: 1,
    params: {
      rootHz: 600, fineCents: -12, beatHz: 40, amDepth: 0.55, amShape: 'pulse', carrierHz: 80, carrierLock: 'off',
      mode: 'tanpura', scaleId: 'yaman', degrees: [0, 4], customCents: '', breathBpm: 6, volume: 0.4, mystery: 1,
    },
  };
  const p = normalizeImport(v1);
  assert.equal(p.f0, 150, '600Hz → 2オクターブ下の150Hz');
  assert.equal(p.dc, -12);
  assert.equal(p.ghz, 40);
  assert.equal(p.amd, 0.55);
  assert.equal(p.ams, 'pulse');
  assert.equal(p.car, 120, 'キャリアは120Hz以上');
  assert.equal(p.carL, 'off');
  assert.equal(p.exc, 'tanpura');
  assert.equal(p.scl, 'yaman');
  assert.deepEqual(p.deg, [0, 4]);
  assert.equal(p.pbpm, 6);
  assert.equal(p.vol, 0.4);
  assert.ok(!('mystery' in p) && !('rootHz' in p));
});

test('v1 の基音110Hzはそのまま、30Hz未満にはならない', () => {
  assert.equal(migrateV1({ rootHz: 110 }).f0, 110);
  assert.equal(migrateV1({ rootHz: 30 }).f0, 30);
  assert.equal(migrateV1({ rootHz: 520 }).f0, 130);
});

test('v2 の書き出しはそのまま読み戻せる', () => {
  const v2 = { app: 'hypogeum-kkr40', version: 2, params: { ...DEFAULTS, eng: 'reese', ma: 0.7, f0: 36.71 } };
  const p = normalizeImport(v2);
  assert.equal(p.eng, 'reese');
  assert.equal(p.ma, 0.7);
  assert.equal(p.f0, 36.71);
  assert.deepEqual(Object.keys(p).sort(), Object.keys(DEFAULTS).sort());
});

test('範囲外・不正な値は安全側へ', () => {
  const p = normalizeImport({ app: 'hypogeum-kkr40', version: 2, params: { eng: 'nope', amd: 9, f0: 'x' } });
  assert.equal(p.eng, 'add');
  assert.equal(p.amd, 1);
  assert.equal(p.f0, DEFAULTS.f0);
});

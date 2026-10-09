import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PRODUCT, GROUP_CODES, PARAM_CODES, STATE_CODES, OPTION_CODES, ENGINE_CODES, REGION_CODES, TUNING_CODES,
  SCALE_CODE_PARTS, SCENE_CODES, scaleCode,
} from '../js/codebook.js';
import { GROUPS, PARAMS, SCENES, PARAM_BY_KEY } from '../js/params.js';
import { SCALES } from '../js/scales.js';
import { ENGINE_IDS, ENGINES } from '../js/engines/index.js';
import { renderCodebook } from '../scripts/codebook-md.mjs';

const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

test('全パラメータ・グループにコードと平文がある', () => {
  for (const g of GROUPS) assert.ok(nonEmpty(g.code) && nonEmpty(g.plain), g.id);
  for (const p of PARAMS) assert.ok(nonEmpty(p.code) && nonEmpty(p.plain), p.key);
  assert.deepEqual(Object.keys(PARAM_CODES).sort(), PARAMS.map((p) => p.key).sort(), 'codebook とスキーマのキーが一致');
  for (const s of Object.values(STATE_CODES)) assert.ok(nonEmpty(s.code) && nonEmpty(s.plain));
});

test('全音階・地域・調律記号にコードと平文がある', () => {
  for (const s of SCALES) {
    assert.ok(SCALE_CODE_PARTS[s.id], `音階コードなし: ${s.id}`);
    assert.ok(nonEmpty(s.name), s.id);
    assert.ok(REGION_CODES[s.region], `地域コードなし: ${s.region}`);
    assert.ok(TUNING_CODES[SCALE_CODE_PARTS[s.id][1]], `調律記号なし: ${s.id}`);
    assert.match(scaleCode(s.id, s.cents.length), new RegExp(`-${s.cents.length}/`), `${s.id} の音数`);
  }
  assert.deepEqual(Object.keys(SCALE_CODE_PARTS).sort(), SCALES.map((s) => s.id).sort());
});

test('全シーン・全エンジンにコードと平文がある', () => {
  for (const sc of SCENES) {
    assert.ok(SCENE_CODES[sc.id], `シーンコードなし: ${sc.id}`);
    assert.ok(nonEmpty(SCENE_CODES[sc.id].code) && nonEmpty(SCENE_CODES[sc.id].plain) && nonEmpty(sc.desc));
  }
  assert.deepEqual(Object.keys(SCENE_CODES).sort(), SCENES.map((s) => s.id).sort());
  assert.deepEqual([...ENGINE_IDS].sort(), Object.keys(ENGINE_CODES).sort(), '登録エンジンと codebook が一致');
  assert.deepEqual([...PARAM_BY_KEY.eng.options].sort(), [...ENGINE_IDS].sort(), 'ENGセレクタの選択肢が一致');
  for (const [id, e] of Object.entries(ENGINE_CODES)) {
    assert.ok(nonEmpty(e.code) && nonEmpty(e.plain), id);
    assert.equal(e.macros.length, 3, `${id} のマクロは3つ`);
    for (const [c, p] of e.macros) assert.ok(nonEmpty(c) && nonEmpty(p), `${id} のマクロ`);
    assert.equal(typeof ENGINES[id].create, 'function', `${id}.create`);
    assert.equal(typeof ENGINES[id].cost, 'function', `${id}.cost`);
  }
  for (const [key, opts] of Object.entries(OPTION_CODES)) {
    assert.deepEqual(Object.keys(opts).sort(), [...PARAM_BY_KEY[key].options].sort(), `${key} の選択肢`);
  }
});

test('全コードが一意（グループ・パラメータ・状態・選択肢・エンジン・地域・音階・シーン）', () => {
  const all = [
    PRODUCT.code,
    ...Object.values(GROUP_CODES).map((x) => x.code),
    ...Object.values(PARAM_CODES).map((x) => x.code),
    ...Object.values(STATE_CODES).map((x) => x.code),
    ...Object.values(OPTION_CODES).flatMap((o) => Object.values(o).map((x) => x.code)),
    ...Object.values(ENGINE_CODES).map((x) => x.code),
    ...Object.values(REGION_CODES),
    ...SCALES.map((s) => scaleCode(s.id, s.cents.length)),
    ...Object.values(SCENE_CODES).map((x) => x.code),
  ];
  const seen = new Map();
  for (const c of all) {
    assert.ok(!seen.has(c), `コード重複: ${c}`);
    seen.set(c, true);
  }
  // エンジン内のマクロ短縮名も一意
  for (const [id, e] of Object.entries(ENGINE_CODES)) assert.equal(new Set(e.macros.map((m) => m[0])).size, 3, id);
});

test('docs/CODEBOOK.md が最新（node scripts/codebook.mjs で再生成）', () => {
  const file = readFileSync(fileURLToPath(new URL('../docs/CODEBOOK.md', import.meta.url)), 'utf8');
  assert.equal(file, renderCodebook());
});

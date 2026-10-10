import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderAll } from '../scripts/codebook.mjs';
import { stomaCodes } from '../scripts/codebook-stoma.mjs';
import { duplicates } from '../packages/core/codebook.js';
import { PARAMS, GROUPS } from '../apps/stoma16/js/params.js';
import { MODEL_CODES, SECTION_CODES, STYLE_TRACKS, TRACK_CODES, SPECIMEN_CODES, OPTION_CODES, PARAM_CODES } from '../apps/stoma16/js/codebook.js';
import { SECTIONS } from '../apps/stoma16/js/evo.js';
import { SPECIMENS } from '../apps/stoma16/js/specimens.js';

const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

test('STOMA：全コードが一意で、パラメータ・グループ・音色・区間・トラック・標本に平文がある', () => {
  assert.deepEqual(duplicates(stomaCodes()), []);
  for (const p of PARAMS) assert.ok(nonEmpty(p.code) && nonEmpty(p.plain), p.key);
  assert.deepEqual(Object.keys(PARAM_CODES).sort(), PARAMS.map((p) => p.key).sort());
  for (const g of GROUPS) assert.ok(nonEmpty(g.plain), g.id);
  assert.equal(Object.keys(MODEL_CODES).length, 16);
  for (const [m, d] of Object.entries(MODEL_CODES)) { assert.ok(nonEmpty(d.plain), m); assert.equal(d.macros.length, 2, `${m} のマクロ`); for (const [c, p] of d.macros) assert.ok(nonEmpty(c) && nonEmpty(p)); }
  for (const k of Object.keys(SECTIONS)) assert.ok(SECTION_CODES[k] && nonEmpty(SECTION_CODES[k].plain), `区間 ${k}`);
  for (const s of Object.values(STYLE_TRACKS)) { assert.equal(s.length, TRACK_CODES.length); for (const [c, p] of s) assert.ok(nonEmpty(c) && nonEmpty(p)); }
  for (const s of SPECIMENS) assert.ok(SPECIMEN_CODES[s.id], s.id);
  for (const p of PARAMS.filter((x) => x.type === 'select')) for (const o of p.options) assert.ok(nonEmpty(o[1]) && nonEmpty(o[2]), `${p.key}=${o[0]}`);
  assert.ok(Object.keys(OPTION_CODES).length > 0);
});

test('docs/CODEBOOK.md が最新（node scripts/codebook.mjs で再生成）', () => {
  const file = readFileSync(fileURLToPath(new URL('../docs/CODEBOOK.md', import.meta.url)), 'utf8');
  assert.equal(file, renderAll());
});

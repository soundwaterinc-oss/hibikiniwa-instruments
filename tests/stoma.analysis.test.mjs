import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderSpecimen, SPECIMENS } from '../apps/stoma16/js/specimens.js';
import { analyze, usableCells, U } from '../apps/stoma16/js/analysis/index.js';
import { autoTune } from '../apps/stoma16/js/analysis/auto.js';
import { fitCircle } from '../apps/stoma16/js/analysis/concentric.js';
import { hasFixture, loadFixture } from './fixtures.mjs';

const hash = (img) => createHash('sha1').update(img.data).digest('hex');

// 細胞数の基準は試作版の実測（画像中央の正方形に切り抜いて解析）に基づく。
// v1 は長方形のまま解析するので、面積比（長方形 ÷ 中央の正方形）で範囲を広げて比べる
const cropRatio = (img) => (img.width * img.height) / Math.min(img.width, img.height) ** 2;

test('標本の決定性：同じ種なら同じ画素、種が違えば別の標本', () => {
  for (const s of SPECIMENS) {
    const a = renderSpecimen(s.id, 1), b = renderSpecimen(s.id, 1), c = renderSpecimen(s.id, 2);
    assert.equal(hash(a), hash(b), `${s.id} は再現できる`);
    assert.notEqual(hash(a), hash(c), `${s.id} は種で変わる`);
    assert.equal(a.data.length, a.width * a.height * 4);
  }
});

test('生成コルク：平均隣接数 ⟨n⟩ が 5.8〜6.2（蜂の巣状）', () => {
  const A = analyze(renderSpecimen('cork', 1));
  assert.ok(A.stats.meanN >= 5.8 && A.stats.meanN <= 6.2, `⟨n⟩=${A.stats.meanN.toFixed(2)}`);
  assert.ok(usableCells(A).length >= 100);
});

test('タマネギ：核で細胞が割れない（核あり／なしの細胞数が ±10% 以内）', () => {
  for (const seed of [1, 2]) {
    const withN = analyze(renderSpecimen('onion', seed)).cells.filter((c) => !c.bg).length;
    const without = analyze(renderSpecimen('onion', seed, { contents: false })).cells.filter((c) => !c.bg).length;
    assert.ok(Math.abs(withN - without) <= Math.ceil(without * 0.1), `seed ${seed}: 核あり ${withN} / 核なし ${without}`);
  }
});

test('細胞が4個未満の画像は AUTO でも NO CELLS（0点）になる', () => {
  const W = 64, H = 48, data = new Uint8ClampedArray(W * H * 4).fill(200);
  const r = autoTune({ width: W, height: H, data });
  assert.equal(r.best.score, 0);
  assert.ok(r.best.n < 4);
});

test('苔（fixtures/moss_leaf.jpg）：AUTO が断片化を選ばない', { skip: !hasFixture('moss_leaf.jpg') && 'fixtures/moss_leaf.jpg がありません' }, async () => {
  const img = await loadFixture('moss_leaf.jpg');
  const t0 = performance.now();
  const { best, tried } = autoTune(img);
  const ms = performance.now() - t0;
  const A = analyze(img, best.params);
  const n = usableCells(A).length, k = cropRatio(img);
  assert.ok(n >= 45 * k && n <= 80 * k, `細胞数 ${n}（基準 45〜80 × 面積比 ${k.toFixed(2)}）`);
  assert.ok(A.stats.meanN >= 5.3 && A.stats.meanN <= 6.5, `⟨n⟩=${A.stats.meanN.toFixed(2)}`);
  assert.ok(A.evidence >= 1.6, `evidence=${A.evidence.toFixed(2)}`);
  // 断片化した候補（細胞が多すぎる）は選ばれていない
  const frag = tried.filter((r) => r.n > 150);
  assert.ok(frag.length > 0, '比較対象の断片化候補が探索に含まれている');
  assert.ok(frag.every((r) => r.score < best.score), '断片化候補の方が低い');
  assert.ok(ms < 15000, `AUTO ${ms.toFixed(0)}ms`);
});

test('根の横断面（fixtures/root_xs.jpg）：細胞数・⟨n⟩・赤い環のクラス・同心円の中心', { skip: !hasFixture('root_xs.jpg') && 'fixtures/root_xs.jpg がありません' }, async () => {
  const img = await loadFixture('root_xs.jpg');
  const { best } = autoTune(img);
  const A = analyze(img, best.params);
  const n = usableCells(A).length, k = cropRatio(img);
  assert.ok(n >= 350 * k && n <= 550 * k, `細胞数 ${n}（基準 350〜550 × 面積比 ${k.toFixed(2)}）`);
  assert.ok(A.stats.meanN >= 5.7 && A.stats.meanN <= 6.3, `⟨n⟩=${A.stats.meanN.toFixed(2)}`);
  // 赤い環（内皮）のクラス
  const red = A.classes.list.find((c) => c.color === 'R');
  assert.ok(red, `赤のクラスがない：${A.classes.list.map((c) => c.code).join(' ')}`);
  assert.equal(A.center.method, 'ring', '環状クラスへの円フィットで中心を推定');
  assert.equal(A.center.ringClass, red.id, '環は赤のクラス');
  // 正解の中心：赤い画素（サフラニン染色の内皮）に円をフィット（解析とは独立に求める）
  const pts = [];
  for (let y = 0; y < img.height; y += 2) for (let x = 0; x < img.width; x += 2) {
    const o = (y * img.width + x) * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    if (r > 170 && r - g > 70 && r - b > 20) pts.push([x, y]);
  }
  const truth = fitCircle(pts);
  const px = Math.max(img.width, img.height) / U; // 基準座標 → 画素
  const d = Math.hypot(A.center.cx * px - truth.cx, A.center.cy * px - truth.cy);
  assert.ok(d <= img.width * 0.05, `中心のずれ ${d.toFixed(1)}px（許容 ${(img.width * 0.05).toFixed(1)}px）`);
});

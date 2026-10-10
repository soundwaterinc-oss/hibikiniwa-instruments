// 解析 Worker：UIスレッドを止めないよう、切り分け・形態量・分類・同心円はすべてここで行う
// メッセージ：
//   { type:'image', key, img }                画像を受け取り、以後この Worker で使い回す（下ごしらえをキャッシュ）
//   { type:'analyze', id, key, params, opts } → { type:'result', id, A }
//   { type:'score', id, key, params }         → { type:'scored', id, r }（AUTO の候補1つ）
import { analyze, usableCells } from './analysis/index.js';
import { quality } from './analysis/auto.js';
import { renderSpecimen } from './specimens.js';

const images = new Map(); // key → { img, cache }

function pack(A) {
  // 送り返す前に、転送できない／不要なものを落とす
  const cells = A.cells.map((c) => ({ ...c }));
  return { ...A, cells, lab: A.lab };
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'specimen') {
      // 標本の生成も Worker で（100ms 以上かかることがあるため）
      const img = renderSpecimen(m.kind, m.seed);
      self.postMessage({ type: 'specimen', id: m.id, A: { width: img.width, height: img.height, data: img.data } }, [img.data.buffer]);
      return;
    }
    if (m.type === 'image') {
      images.set(m.key, { img: m.img, cache: new Map() });
      // 古い画像は捨てる（ライブ入力で増え続けないように）
      while (images.size > 3) images.delete(images.keys().next().value);
      return;
    }
    const slot = images.get(m.key);
    if (!slot) throw new Error('画像がまだ届いていません');
    if (m.type === 'analyze') {
      const t0 = performance.now();
      const A = analyze(slot.img, m.params, { cache: slot.cache, ...(m.opts || {}) });
      A.ms = performance.now() - t0;
      const out = pack(A);
      self.postMessage({ type: 'result', id: m.id, A: out }, [out.lab.buffer]);
    } else if (m.type === 'score') {
      const A = analyze(slot.img, m.params, { cache: slot.cache, classes: false, rings: false });
      self.postMessage({ type: 'scored', id: m.id, r: { params: m.params, score: quality(A), n: usableCells(A).length, meanN: A.stats.meanN, evidence: A.evidence, excess: A.excess } });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: err.message });
  }
};

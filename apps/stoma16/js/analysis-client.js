// 解析 Worker の束ね役（UIスレッド側）。AUTO の候補は複数の Worker に配って並列に採点する
import { stage1Candidates, stage2Candidates, reason } from './analysis/auto.js';

export function createAnalysisPool(size = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))) {
  const url = new URL('./worker.js', import.meta.url);
  const workers = Array.from({ length: size }, () => new Worker(url, { type: 'module' }));
  const pending = new Map();
  let seq = 0, imgKey = null, imgSeq = 0;
  for (const w of workers) {
    w.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if (data.type === 'error') p.reject(new Error(data.message));
      else p.resolve(data.A || data.r);
    };
    w.onerror = (e) => { for (const [, p] of pending) p.reject(new Error(e.message || 'Worker error')); pending.clear(); };
  }
  let rr = 0;
  const call = (w, msg) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); w.postMessage({ ...msg, id }); });

  return {
    size,
    // 画像を全 Worker に配る（各 Worker で下ごしらえをキャッシュ）
    setImage(img) {
      imgKey = `img${++imgSeq}`;
      for (const w of workers) w.postMessage({ type: 'image', key: imgKey, img: { width: img.width, height: img.height, data: img.data } });
      return imgKey;
    },
    analyze(params, opts) {
      const w = workers[rr++ % workers.length];
      return call(w, { type: 'analyze', key: imgKey, params, opts });
    },
    // AUTO：①特徴を粗く探索 → ②上位3つの閾値を詰める。onProgress(done, total, best)
    async auto(onProgress, { top = 3 } = {}) {
      const key = imgKey;
      const t0 = performance.now();
      let done = 0, best = null;
      const total = stage1Candidates().length + top * stage2Candidates({}).length;
      const runAll = async (cands) => {
        const q = cands.slice();
        const out = [];
        await Promise.all(workers.map(async (w) => {
          while (q.length) {
            const c = q.shift();
            if (key !== imgKey) return; // 画像が差し替わったら中断
            const r = await call(w, { type: 'score', key, params: c });
            out.push(r);
            done++;
            if (!best || r.score > best.score) best = r;
            onProgress?.(done, total, best);
          }
        }));
        return out.sort((a, b) => b.score - a.score);
      };
      const r1 = await runAll(stage1Candidates());
      const r2 = await runAll(r1.slice(0, top).flatMap((r) => stage2Candidates(r.params)));
      void r2;
      return { best, ms: performance.now() - t0, reason: best ? reason(best) : '', cancelled: key !== imgKey };
    },
    terminate() { workers.forEach((w) => w.terminate()); },
  };
}

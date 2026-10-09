// AUTO：切り分け設定の自動探索
// 採点 ＝ excess（境界が本当の壁の上にある量）× 平均隣接数の妥当さ
//   ・excess は「境界上の壁らしさ − 画像の85%分位点」の総和。本当の壁を境界にすると増え、壁でない所
//     （葉緑体の塊の縁など）を切ると減るので、細かく切るほど得にはならず、断片化を選ばない
//   ・⟨n⟩ は平面分割ではどう切っても6付近に寄るので、補助的に使う（⟨n⟩ だけで採点しない）
//   ・細胞が4個未満なら0点（NO CELLS）
import { analyze, usableCells } from './index.js';

export function quality(A) {
  const n = usableCells(A).length;
  if (n < 4) return 0;
  // 5.3〜6.5 は減点しない（台形）。外側だけ急に下げる
  const mN = A.stats.meanN, out = mN < 5.3 ? 5.3 - mN : mN > 6.5 ? mN - 6.5 : 0;
  const gN = Math.exp(-((out / 0.4) ** 2));
  return Math.max(0, A.excess) * gN;
}

// 探索する候補。2段階：①特徴（CH・INV・σ）を粗く ②上位の特徴で閾値・最小面積を詰める
// 最小面積 MIN.A は探索しない（大きくすると篩部のような小さな本物の細胞が隣に吸収される）
export function stage1Candidates(res = 384) {
  const out = [];
  for (const [ch, inv] of [[0, 0], [0, 1], [1, 0], [2, 0], [3, 0], [3, 1]]) for (const sig of [1, 2]) out.push({ ch, inv, sig, res, hi: 0.36, lo: 0.2, mina: 14 });
  return out;
}
export function stage2Candidates(base) {
  // hi を 0.5 まで上げると、内皮のような薄く小さな細胞の壁が落ちて組織の層が消えるので 0.42 までにする
  return [[0.3, 0.14], [0.42, 0.26]].map(([hi, lo]) => ({ ...base, hi, lo }));
}

// 同期版（Node のテスト・Worker の中で使う）。onProgress(i, total, cand, score)
export function autoTune(img, { cache = new Map(), onProgress, top = 3, res = 384 } = {}) {
  const tried = [];
  const run = (c) => {
    const A = analyze(img, c, { cache, classes: false, rings: false });
    const r = { params: c, score: quality(A), n: usableCells(A).length, meanN: A.stats.meanN, evidence: A.evidence, excess: A.excess };
    tried.push(r);
    onProgress?.(tried.length, total, r);
    return r;
  };
  const s1 = stage1Candidates(res);
  const total = s1.length + top * stage2Candidates({}).length;
  const r1 = s1.map(run).sort((a, b) => b.score - a.score);
  const r2 = r1.slice(0, top).flatMap((r) => stage2Candidates(r.params).map(run));
  const best = [...r1, ...r2].sort((a, b) => b.score - a.score)[0];
  return { best, tried };
}

// 選んだ理由の文章（平文）
export function reason(r) {
  return `細胞 ${r.n} 個・平均隣接数 ${r.meanN.toFixed(2)}・evidence ${r.evidence.toFixed(2)}（境界が壁の上にあるほど大きい）が最も良い組み合わせ`;
}

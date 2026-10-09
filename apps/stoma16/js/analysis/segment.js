// 切り分け：壁らしさ地図 Wm（0..1、壁で大きい）から細胞のラベル画像を作る
//   1) ヒステリシス二値化  2) 細線化（Zhang–Suen）  3) 短い孤立線分・小さな閉じた輪（核・葉緑体の縁）の除去
//   4) 端点の延長による途切れの補修  5) マーカー（壁に囲まれた内部）  6) Wm 上のウォーターシェッド（境界＝壁の中央）
//   7) 壁らしさの弱い境界でつながった断片の併合  8) 背景（巨大な領域）の判定

// ── 1) ヒステリシス：hi 以上を種に、lo 以上へ8近傍で広げる ──
export function hysteresis(Wm, W, H, hi, lo) {
  const L = W * H, out = new Uint8Array(L), q = new Int32Array(L);
  let t = 0;
  for (let i = 0; i < L; i++) if (Wm[i] >= hi) { out[i] = 1; q[t++] = i; }
  let h = 0;
  while (h < t) {
    const p = q[h++], y = (p / W) | 0, x = p - y * W;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const n = Y * W + X;
      if (!out[n] && Wm[n] >= lo) { out[n] = 1; q[t++] = n; }
    }
  }
  return out;
}

// ── 2) 細線化（Zhang–Suen）──
export function thin(mask, W, H) {
  const m = Uint8Array.from(mask);
  for (let x = 0; x < W; x++) { m[x] = 0; m[(H - 1) * W + x] = 0; }
  for (let y = 0; y < H; y++) { m[y * W] = 0; m[y * W + W - 1] = 0; }
  const del = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!m[i]) continue;
        const p2 = m[i - W], p3 = m[i - W + 1], p4 = m[i + 1], p5 = m[i + W + 1], p6 = m[i + W], p7 = m[i + W - 1], p8 = m[i - 1], p9 = m[i - W - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(i);
      }
      for (const i of del) m[i] = 0;
      if (del.length) changed = true;
    }
  }
  return m;
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
function nb8count(m, W, H, x, y) {
  let c = 0;
  for (const [dx, dy] of N8) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X]) c++; }
  return c;
}

// ── 3) 骨格の連結成分ごとの除去：短い線分・画像の縁に触れない小さな塊 ──
export function pruneComponents(sk, W, H, { minLen, blobArea }) {
  const L = W * H, lab = new Int32Array(L).fill(-1), q = new Int32Array(L);
  const out = Uint8Array.from(sk);
  let id = 0, removed = 0;
  for (let i = 0; i < L; i++) {
    if (!sk[i] || lab[i] >= 0) continue;
    let h = 0, t = 0;
    q[t++] = i; lab[i] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, border = false, ends = 0;
    while (h < t) {
      const p = q[h++], y = (p / W) | 0, x = p - y * W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) border = true;
      let deg = 0;
      for (const [dx, dy] of N8) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const n = Y * W + X;
        if (sk[n]) deg++;
        if (sk[n] && lab[n] < 0) { lab[n] = id; q[t++] = n; }
      }
      if (deg <= 1) ends++;
    }
    const len = t, bbox = (x1 - x0 + 1) * (y1 - y0 + 1);
    // 短い線分は消す。閉じた小さな輪（端点がほとんどない＝核や葉緑体の縁取り）も消す。開いた線分は壁の断片として残す
    const ring = ends <= 1 && !border && bbox < blobArea;
    if (len < minLen || ring) { for (let k = 0; k < t; k++) out[q[k]] = 0; removed++; }
    id++;
  }
  return { mask: out, removed };
}

// 端の小枝（ひげ）を短く刈る
export function spur(sk, W, H, iters) {
  const m = Uint8Array.from(sk);
  for (let it = 0; it < iters; it++) {
    const ends = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (m[y * W + x] && nb8count(m, W, H, x, y) <= 1) ends.push(y * W + x);
    if (!ends.length) break;
    for (const i of ends) m[i] = 0;
  }
  return m;
}

// ── 4) 端点の延長：端点から骨格の向きに伸ばし、別の壁に届いたらつなぐ ──
export function bridgeGaps(sk, W, H, maxGap) {
  const m = Uint8Array.from(sk);
  if (maxGap <= 0) return { mask: m, bridged: 0 };
  let bridged = 0;
  const ends = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (sk[y * W + x] && nb8count(sk, W, H, x, y) === 1) ends.push([x, y]);
  for (const [ex, ey] of ends) {
    // 骨格を最大8画素たどって向きを求める
    const trail = new Set([ey * W + ex]);
    let cx = ex, cy = ey;
    for (let k = 0; k < 8; k++) {
      let next = null;
      for (const [dx, dy] of N8) { const X = cx + dx, Y = cy + dy; const n = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < H && sk[n] && !trail.has(n)) { next = [X, Y]; break; } }
      if (!next) break;
      [cx, cy] = next; trail.add(cy * W + cx);
    }
    let dx = ex - cx, dy = ey - cy;
    const d = Math.hypot(dx, dy);
    if (d < 2) continue;
    dx /= d; dy /= d;
    // 自分の近傍（尾の周り）は当たり判定から外す
    const near = new Set();
    for (const p of trail) { const y = (p / W) | 0, x = p - y * W; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) near.add((y + oy) * W + (x + ox)); }
    const path = [];
    let hit = false;
    for (let s = 1; s <= maxGap; s++) {
      const X = Math.round(ex + dx * s), Y = Math.round(ey + dy * s);
      if (X < 0 || Y < 0 || X >= W || Y >= H) break;
      const n = Y * W + X;
      if (sk[n] && !near.has(n)) { hit = true; break; }
      // 斜め隣に壁があっても到達とみなす
      let side = false;
      for (const [ox, oy] of N8) { const XX = X + ox, YY = Y + oy; const nn = YY * W + XX; if (XX >= 0 && YY >= 0 && XX < W && YY < H && sk[nn] && !near.has(nn)) { side = true; break; } }
      path.push(n);
      if (side) { hit = true; break; }
    }
    if (hit) { for (const n of path) m[n] = 1; bridged++; }
  }
  return { mask: m, bridged };
}

// ── 5) マーカー：壁（骨格を1画素太らせたもの）の補集合の連結成分のうち、十分な面積のもの ──
export function markers(wall, W, H, minA) {
  const L = W * H, lab = new Int32Array(L).fill(-1), q = new Int32Array(L);
  const thick = new Uint8Array(L);
  for (let i = 0; i < L; i++) if (wall[i]) { thick[i] = 1; const y = (i / W) | 0, x = i - y * W; if (x > 0) thick[i - 1] = 1; if (x < W - 1) thick[i + 1] = 1; if (y > 0) thick[i - W] = 1; if (y < H - 1) thick[i + W] = 1; }
  let n = 0;
  for (let i = 0; i < L; i++) {
    if (thick[i] || lab[i] !== -1) continue;
    let h = 0, t = 0;
    q[t++] = i; lab[i] = -2;
    while (h < t) {
      const p = q[h++], y = (p / W) | 0, x = p - y * W;
      if (x > 0 && !thick[p - 1] && lab[p - 1] === -1) { lab[p - 1] = -2; q[t++] = p - 1; }
      if (x < W - 1 && !thick[p + 1] && lab[p + 1] === -1) { lab[p + 1] = -2; q[t++] = p + 1; }
      if (y > 0 && !thick[p - W] && lab[p - W] === -1) { lab[p - W] = -2; q[t++] = p - W; }
      if (y < H - 1 && !thick[p + W] && lab[p + W] === -1) { lab[p + W] = -2; q[t++] = p + W; }
    }
    if (t >= minA) { for (let k = 0; k < t; k++) lab[q[k]] = n; n++; }
    else for (let k = 0; k < t; k++) lab[q[k]] = -3; // 小さすぎる断片は浸水で埋める
  }
  for (let i = 0; i < L; i++) if (lab[i] < 0) lab[i] = -1;
  return { lab, count: n };
}

// ── 6) ウォーターシェッド：Wm の低いところから水を満たす（256段のバケット待ち行列）──
export function watershed(Wm, lab, W, H) {
  const L = W * H, out = Int32Array.from(lab);
  const level = new Uint8Array(L);
  for (let i = 0; i < L; i++) level[i] = Math.min(255, Math.max(0, Math.round(Wm[i] * 255)));
  const buckets = Array.from({ length: 256 }, () => []);
  const queued = new Uint8Array(L);
  const push = (p, lv) => { if (!queued[p]) { queued[p] = 1; buckets[lv].push(p); } };
  for (let i = 0; i < L; i++) {
    if (out[i] < 0) continue;
    const y = (i / W) | 0, x = i - y * W;
    if (x > 0 && out[i - 1] < 0) push(i - 1, level[i - 1]);
    if (x < W - 1 && out[i + 1] < 0) push(i + 1, level[i + 1]);
    if (y > 0 && out[i - W] < 0) push(i - W, level[i - W]);
    if (y < H - 1 && out[i + W] < 0) push(i + W, level[i + W]);
  }
  for (let lv = 0; lv < 256; lv++) {
    const b = buckets[lv];
    for (let k = 0; k < b.length; k++) {
      const p = b[k];
      if (out[p] >= 0) continue;
      const y = (p / W) | 0, x = p - y * W;
      // 隣のラベルを採る（最初に見つかったもの）
      let l = -1;
      if (x > 0 && out[p - 1] >= 0) l = out[p - 1];
      else if (x < W - 1 && out[p + 1] >= 0) l = out[p + 1];
      else if (y > 0 && out[p - W] >= 0) l = out[p - W];
      else if (y < H - 1 && out[p + W] >= 0) l = out[p + W];
      if (l < 0) continue;
      out[p] = l;
      const add = (n) => { if (out[n] < 0 && !queued[n]) { queued[n] = 1; buckets[Math.max(lv, level[n])].push(n); } };
      if (x > 0) add(p - 1);
      if (x < W - 1) add(p + 1);
      if (y > 0) add(p - W);
      if (y < H - 1) add(p + W);
    }
  }
  return out;
}

// 境界のペアごとの統計（隣接4近傍の画素対）
export function boundaryPairs(lab, Wm, W, H) {
  const pairs = new Map();
  const add = (a, b, w) => {
    if (a < 0 || b < 0 || a === b) return;
    const k = a < b ? a * 1048576 + b : b * 1048576 + a;
    const e = pairs.get(k);
    if (e) { e.n++; e.s += w; } else pairs.set(k, { a: Math.min(a, b), b: Math.max(a, b), n: 1, s: w });
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, l = lab[i];
    if (x < W - 1) add(l, lab[i + 1], Wm ? (Wm[i] + Wm[i + 1]) / 2 : 0);
    if (y < H - 1) add(l, lab[i + W], Wm ? (Wm[i] + Wm[i + W]) / 2 : 0);
  }
  return [...pairs.values()];
}

// ── 7) 弱い境界の併合（union-find）。併合後の面積が上限を超える場合はしない ──
export function mergeWeak(lab, Wm, W, H, { ratio, maxArea, minPairs = 3 }) {
  if (ratio <= 0) return { lab, merged: 0 };
  let cur = lab, merged = 0;
  for (let pass = 0; pass < 3; pass++) {
    let n = 0;
    for (const l of cur) if (l + 1 > n) n = l + 1;
    const area = new Float64Array(n);
    for (const l of cur) if (l >= 0) area[l]++;
    const pairs = boundaryPairs(cur, Wm, W, H).filter((p) => p.n >= minPairs).map((p) => ({ ...p, m: p.s / p.n }));
    if (!pairs.length) break;
    const strengths = pairs.map((p) => p.m).sort((a, b) => a - b);
    const med = strengths[Math.floor(strengths.length / 2)];
    const thr = med * ratio;
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const sz = Float64Array.from(area);
    let did = 0;
    pairs.sort((a, b) => a.m - b.m);
    for (const p of pairs) {
      if (p.m >= thr) break;
      const ra = find(p.a), rb = find(p.b);
      if (ra === rb || sz[ra] + sz[rb] > maxArea) continue;
      parent[rb] = ra; sz[ra] += sz[rb]; did++;
    }
    if (!did) break;
    merged += did;
    const remap = new Int32Array(n).fill(-1);
    let k = 0;
    const next = new Int32Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      if (cur[i] < 0) { next[i] = -1; continue; }
      const r = find(cur[i]);
      if (remap[r] < 0) remap[r] = k++;
      next[i] = remap[r];
    }
    cur = next;
  }
  return { lab: cur, merged };
}

// ラベルを 0..n-1 に詰め直す
export function compact(lab) {
  const map = new Map();
  const out = new Int32Array(lab.length);
  for (let i = 0; i < lab.length; i++) {
    const l = lab[i];
    if (l < 0) { out[i] = -1; continue; }
    let m = map.get(l);
    if (m === undefined) { m = map.size; map.set(l, m); }
    out[i] = m;
  }
  return { lab: out, count: map.size };
}

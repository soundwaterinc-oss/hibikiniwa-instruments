// 保存・復元・undo。localStorage はすべて try/catch（プライベートウィンドウ等で使えないことがある）

export const store = {
  get(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k, v) { try { globalThis.localStorage?.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { globalThis.localStorage?.removeItem(k); } catch { /* noop */ } },
  getJSON(k) { try { return JSON.parse(this.get(k) || 'null'); } catch { return null; } },
  setJSON(k, v) { return this.set(k, JSON.stringify(v)); },
};

// 書き出し形式 { app, version, params }
export const exportOf = (app, version, params) => ({ app, version, params: structuredClone(params) });

// 簡易 undo：直近 limit 操作のスナップショット
export function createUndo(limit = 20) {
  const past = [];
  const future = [];
  let lastKey = null, lastAt = 0;
  return {
    // 同じキーの連続操作（フェーダーのドラッグ）は 600ms 以内なら1操作にまとめる
    push(snapshot, key = null, now = Date.now()) {
      if (key && key === lastKey && now - lastAt < 600 && past.length) { lastAt = now; return; }
      past.push(structuredClone(snapshot));
      if (past.length > limit) past.shift();
      future.length = 0;
      lastKey = key; lastAt = now;
    },
    undo(current) {
      if (!past.length) return null;
      future.push(structuredClone(current));
      lastKey = null;
      return past.pop();
    },
    redo(current) {
      if (!future.length) return null;
      past.push(structuredClone(current));
      return future.pop();
    },
    get size() { return past.length; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
  };
}

// 少し遅らせて保存（フェーダー操作のたびに書かない）
export function debounced(fn, ms = 400) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

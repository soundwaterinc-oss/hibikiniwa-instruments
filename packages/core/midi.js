// Web MIDI：入力（MIDI learn・ノートで基音）と出力（トラックをノートとして送る）
import { store } from './store.js';

export const noteToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
export const hzToNote = (hz) => 69 + 12 * Math.log2(hz / 440);

// mapKey：learn した割り当て（CC番号 → コントロールのキー）を保存する localStorage キー
export function createMidi({ mapKey, defaults = {}, onCC, onNote }) {
  let access = null;
  let learnKey = null;
  let onLearned = null;
  const map = { ...defaults, ...(store.getJSON(mapKey) || {}) };
  const outputs = () => (access ? [...access.outputs.values()] : []);

  function onMessage({ data }) {
    const [st, a, b] = data;
    const cmd = st & 0xf0;
    if (cmd === 0xb0) {
      if (learnKey) {
        for (const [cc, k] of Object.entries(map)) if (k === learnKey) delete map[cc];
        map[a] = learnKey;
        store.setJSON(mapKey, map);
        const k = learnKey; learnKey = null;
        onLearned?.(k, a);
        return;
      }
      if (map[a]) onCC?.(map[a], b / 127, a);
    }
    if (cmd === 0x90 && b > 0) onNote?.(a, b / 127);
  }

  return {
    get connected() { return !!access; },
    get map() { return { ...map }; },
    async connect() {
      if (!navigator.requestMIDIAccess) throw new Error('この環境ではWeb MIDIを使えません');
      access = await navigator.requestMIDIAccess();
      const bind = () => access.inputs.forEach((inp) => { inp.onmidimessage = onMessage; });
      bind();
      access.onstatechange = bind;
      return { inputs: access.inputs.size, outputs: access.outputs.size };
    },
    // 次に動かしたCCを key に割り当てる
    learn(key, done) { learnKey = key; onLearned = done; },
    cancelLearn() { learnKey = null; },
    forget(key) { for (const [cc, k] of Object.entries(map)) if (k === key) delete map[cc]; store.setJSON(mapKey, map); },
    // 出力：when は performance.now() 基準の ms
    sendNote(note, vel01, when, durMs, ch = 0) {
      const n = Math.max(0, Math.min(127, Math.round(note)));
      const v = Math.max(1, Math.min(127, Math.round(vel01 * 127)));
      for (const o of outputs()) {
        o.send([0x90 | (ch & 15), n, v], when);
        o.send([0x80 | (ch & 15), n, 0], when + Math.max(5, durMs));
      }
    },
    handle: onMessage, // テスト・内部用
  };
}

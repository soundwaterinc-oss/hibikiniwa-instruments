// GARDEN BUS：同じブラウザのタブ間で、テンポ・小節位置・基音・音階を共有する（BroadcastChannel）
// 役割：'off'（共有しない）/ 'master'（自分の状態を流す）/ 'follow'（master に従う）
import { store } from './store.js';

export const BUS_NAME = 'hibikiniwa:garden';
export const ROLES = ['off', 'master', 'follow'];

// 時刻はタブ間で共通の epoch ms（performance.timeOrigin + now）で送る
export const epochNow = () => (globalThis.performance ? performance.timeOrigin + performance.now() : Date.now());

export function createBus(app, { channel = globalThis.BroadcastChannel ? new BroadcastChannel(BUS_NAME) : null } = {}) {
  const listeners = new Set();
  const peers = new Map(); // app → 最新の状態
  let role = store.get(`${BUS_NAME}:role:${app}`) || 'off';
  let lastSent = 0;
  let state = {};

  const emit = (msg) => listeners.forEach((fn) => fn(msg));
  if (channel) {
    channel.onmessage = ({ data }) => {
      if (!data || data.app === app) return;
      if (data.type === 'hello') { if (role === 'master' || data.app === 'monitor') send(true); return; }
      if (data.type === 'state') {
        peers.set(data.app, { ...data, seen: Date.now() });
        emit(data);
      }
      if (data.type === 'bye') { peers.delete(data.app); emit(data); }
    };
    globalThis.addEventListener?.('pagehide', () => channel.postMessage({ type: 'bye', app }));
  }

  function send(force = false) {
    if (!channel) return;
    const now = Date.now();
    if (!force && now - lastSent < 100) return; // 最大10回/秒
    lastSent = now;
    channel.postMessage({ type: 'state', app, role, at: epochNow(), ...state });
  }

  return {
    get role() { return role; },
    set role(r) {
      role = ROLES.includes(r) ? r : 'off';
      store.set(`${BUS_NAME}:role:${app}`, role);
      send(true);
    },
    // state: { bpm, bar, phase(0..1 小節内), barsPerLoop, f0, scale:{ code, cents }, running }
    publish(s, force = false) { state = { ...state, ...s }; if (role !== 'off' || force) send(force); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    hello() { channel?.postMessage({ type: 'hello', app }); },
    peers,
    // 追従先：master を名乗る他アプリのうち最新のもの
    master() {
      let best = null;
      for (const p of peers.values()) if (p.role === 'master' && Date.now() - p.seen < 3000 && (!best || p.seen > best.seen)) best = p;
      return best;
    },
    close() { channel?.postMessage({ type: 'bye', app }); channel?.close(); },
  };
}

// master の状態から、いまの小節位置を推定する（送信からの経過時間で進める）
export function projectPosition(m, now = epochNow()) {
  if (!m || !m.bpm) return null;
  const barDur = (4 * 60) / m.bpm;
  const elapsed = m.running ? (now - m.at) / 1000 : 0;
  const pos = (m.bar || 0) + (m.phase || 0) + elapsed / barDur;
  return { bar: Math.floor(pos), phase: pos - Math.floor(pos), barDur };
}

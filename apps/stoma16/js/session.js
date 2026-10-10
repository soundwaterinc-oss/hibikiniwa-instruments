// 演奏のまとめ役：解析結果 A と設定 P から打点を作り、ループ境界ごとに EVO を進めて打点を作り直す
// ブラウザの再生とオフライン描画（WAV 書き出し・スモークテスト）で同じ流れを使う
import { buildTracks } from './map.js';
import { createEvo, step as evoStep } from './evo.js';
import { StomaAudio } from './audio.js';

// E.center（EVO の漂流で動く走査の中心）を P に重ねる
const withCenter = (P, E) => (E?.center ? { ...P, center: E.center } : P);

export function createSession(audio, A, P, { seed = P.seed || 1, onSection } = {}) {
  const E = P.evo ? createEvo(P, A, { seed }) : null;
  audio.E = E;
  let tracks = buildTracks(A, withCenter(P, E), E);
  const onLoop = (idx, t) => {
    if (!E) return null;
    const { changed } = evoStep(E, P, A);
    audio.E = E;
    audio.applyFx(P, E);
    audio.automateFeedback(P, E, t, audio.loopDuration());
    if (changed) onSection?.(E);
    tracks = buildTracks(A, withCenter(P, E), E);
    return tracks;
  };
  return { E, get tracks() { return tracks; }, onLoop, rebuild() { tracks = buildTracks(A, withCenter(P, E), E); return tracks; } };
}

// オフライン描画：bars 小節を描いて AudioBuffer を返す
export async function renderBars(OfflineAudioContext, A, P, { bars = 2, sampleRate = 48000, seed = 1, tail = 0.6 } = {}) {
  const dur = (bars * 4 * 60) / P.bpm + tail;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
  const audio = new StomaAudio();
  audio.init(ctx);
  const S = createSession(audio, A, P, { seed });
  audio.start(P, S.tracks, { at: 0.02, seed, onLoop: S.onLoop });
  audio.applyFx(P, S.E);
  audio.scheduleUntil((bars * 4 * 60) / P.bpm + 0.02 - 1e-6);
  audio.crackle(P, 0, dur - tail);
  const buf = await ctx.startRendering();
  return { buf, session: S, audio };
}

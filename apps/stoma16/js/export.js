// 書き出し：.mid（トラックごとの打点）・設定 JSON。WAV は session.renderBars でオフライン描画して作る
import { writeSmf } from '../../../packages/core/smf.js';
import { STYLES } from './styles.js';
import { hzToNote } from '../../../packages/core/midi.js';

// GM ドラムの割り当て（K T S H C Z）。T は基音からの音程を持つので ch1 の音程として出す
export const GM_NOTES = [36, null, 38, 42, 37, 39];
const PPQ = 480;

// tracks: buildTracks() の結果。bars 小節ぶんを書き出す（ポリメトリックはループを繰り返して埋める）
export function tracksToMidi(tracks, P, { bars = 4 } = {}) {
  const st = STYLES[P.style];
  const ticksPerBar = PPQ * 4;
  const out = [];
  for (const tr of tracks.tracks) {
    const stepTicks = ticksPerBar / tr.div;
    const total = Math.round(bars * tr.div);
    const notes = [];
    for (let k = 0; k < total; k++) {
      const s = k % tr.len;
      for (const e of tr.events) {
        if (e.step !== s) continue;
        let tick = (k + e.micro) * stepTicks;
        if (tr.div === 16 && k % 2 === 1) tick += (P.swg - 0.5) * 2 * stepTicks;
        const note = GM_NOTES[tr.v] ?? Math.round(hzToNote(P.f0 * 2) + (1 - (e.aQ ?? 0.5)) * 12);
        notes.push({ tick: Math.max(0, tick), dur: stepTicks * 0.9, note, vel: Math.max(1, Math.round(e.vel * 127)) });
      }
    }
    out.push({ name: st.voices[tr.v][0], ch: GM_NOTES[tr.v] === null ? 0 : 9, notes });
  }
  return writeSmf({ ppq: PPQ, bpm: P.bpm, tracks: out });
}

// GARDEN BUS 連携（STOMA 側）
//   master のとき：テンポ・小節位置・基音を流す
//   follow のとき：master が HYPOGEUM なら、ベース系（T トラック・SUB 音色）を HYPOGEUM の音階の度数に量子化し、基音も合わせる
//                  master が別の STOMA ならテンポと小節位置を合わせる
import { projectPosition, epochNow } from '../../../packages/core/bus.js';

const fold = (f, lo = 27.5, hi = 110) => { while (f > hi) f /= 2; while (f < lo) f *= 2; return +f.toFixed(2); };

export function setupGarden({ bus, audio, getP, setP, msg }) {
  let last = null;

  // 役割に関係なく状態を渡す（送るかどうかは bus が決める。入口のページが同期状態を表示するため）
  const publish = (force = false) => {
    const P = getP();
    const running = audio.running;
    let bar = 0, phase = 0;
    if (running) { const b = audio.beatAt(audio.ctx.currentTime); bar = Math.floor(b / 4); phase = b / 4 - bar; }
    bus.publish({ bpm: P.bpm, bar, phase, barsPerLoop: P.bars, f0: P.f0, running }, force);
  };

  function follow(m) {
    if (bus.role !== 'follow' || !m) return;
    const P = getP();
    if (m.app === 'hypogeum') {
      // 音階の度数に量子化（voices.degreeHz が audio.scale を使う）
      const cents = m.scale?.cents;
      const changed = JSON.stringify(cents) !== JSON.stringify(audio.scale);
      audio.scale = cents && cents.length ? cents : null;
      const f0 = m.f0 ? fold(m.f0) : P.f0;
      if (Math.abs(f0 - P.f0) > 0.01) setP('f0', f0);
      if (changed) msg?.(`GARDEN BUS：HYPOGEUM の音階 ${m.scale?.code || ''} に T・SUB を量子化（F₀ ${f0}Hz）`);
    } else if (m.bpm) {
      if (Math.abs(m.bpm - P.bpm) > 0.01) setP('bpm', m.bpm);
      if (audio.running && m.running) {
        const pos = projectPosition(m, epochNow());
        const beat = (pos.bar + pos.phase) * 4;
        const now = audio.ctx.currentTime;
        const cur = audio.beatAt(now);
        // 1/32 拍以上ずれていたら合わせ直す
        if (Math.abs(((cur - beat) % 4 + 6) % 4 - 2) > 0.03) audio.t0 = now - (beat * 60) / audio.bpm;
      }
    }
  }

  bus.on((m) => { if (m.type === 'state' && m.role === 'master') { last = m; follow(m); } });
  bus.hello();
  setInterval(() => publish(), 500);
  return {
    publish,
    roleChanged() { if (bus.role !== 'follow') audio.scale = null; publish(true); if (bus.role === 'follow') follow(bus.master() || last); },
  };
}

// GARDEN BUS 連携（HYPOGEUM 側）
//   master のとき：基音と音階（コード・セント・鳴らしている度数）を流す。テンポは持たない
//   follow のとき：master（STOMA）のテンポに合わせて、呼吸ガイドとドリフトの周期を小節の整数倍にそろえ、
//                  呼吸の吸い始めを小節の頭に合わせる。基音は master の基音に追従する（20〜250Hzへ折り畳み）
import { projectPosition, epochNow } from '../../../packages/core/bus.js';
import { scaleCode } from './codebook.js';

// 周期 sec を小節長 bar の整数倍（1以上）に丸める
export const lockToBars = (sec, bar) => Math.max(1, Math.round(sec / bar)) * bar;

export function setupGarden(eng, bus, { onFollow, msg } = {}) {
  let lastMaster = null;
  let lastLock = '';

  // 役割に関係なく状態を渡す（送るかどうかは bus が決める。入口のページが同期状態を表示するため）
  const publish = (force = false) => {
    const cents = eng.scaleCents();
    bus.publish({
      f0: eng.baseHz(),
      scale: { code: scaleCode(eng.p.scl, cents.length), cents, degrees: eng.activeDegrees() },
      running: eng.running,
    }, force);
  };

  function follow(m) {
    if (bus.role !== 'follow' || !m) return;
    let changed = false;
    // 基音に追従
    if (m.f0 && Math.abs(Math.log2(m.f0 / eng.p.f0)) > 0.001) { eng.set('f0', m.f0); changed = true; }
    // テンポに同期
    const pos = projectPosition(m);
    if (pos) {
      const bar = pos.barDur;
      const key = `${m.bpm}|${eng.p.pbpm}|${eng.p.dfr}`;
      if (key !== lastLock) {
        lastLock = key;
        if (eng.p.pbpm > 0) {
          const period = lockToBars(60 / eng.p.pbpm, bar);
          const bpm = +(60 / period).toFixed(3);
          if (bpm >= 0.5 && bpm <= 12 && Math.abs(bpm - eng.p.pbpm) > 1e-3) { eng.set('pbpm', bpm); changed = true; }
        }
        const dPeriod = lockToBars(1 / eng.p.dfr, bar);
        const dfr = +(1 / dPeriod).toFixed(4);
        if (dfr >= 0.003 && dfr <= 0.6 && Math.abs(dfr - eng.p.dfr) > 1e-4) { eng.set('dfr', dfr); changed = true; }
        lastLock = `${m.bpm}|${eng.p.pbpm}|${eng.p.dfr}`;
      }
      // 吸い始めを次の小節の頭へ
      if (eng.ctx && eng.running && eng.p.pbpm > 0 && m.running) {
        const untilNext = (1 - pos.phase) * bar;
        eng.alignBreath(eng.ctx.currentTime + untilNext);
      }
    }
    if (changed) { onFollow?.(); msg?.(`GARDEN BUS：${m.app} に追従（${m.bpm ? `${m.bpm} BPM · ` : ''}F₀ ${eng.baseHz().toFixed(2)}Hz）`); }
  }

  bus.on((m) => {
    if (m.type === 'state' && m.role === 'master') { lastMaster = m; follow(m); }
  });
  bus.hello();
  const timer = setInterval(() => publish(), 1000);
  void timer;

  return {
    changed(key) { if (['f0', 'dc', 'scl', 'deg', 'cst'].includes(key)) publish(true); },
    roleChanged() { lastLock = ''; publish(true); if (bus.role === 'follow') follow(bus.master() || lastMaster); },
    get master() { return lastMaster; },
    now: epochNow,
  };
}

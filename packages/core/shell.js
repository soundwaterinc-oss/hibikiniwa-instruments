// 両アプリ共通の操作部品：メーター、録音、undo、MIDI learn、GARDEN BUS の役割切替
import { drawMeter } from './master.js';
import { createRecorder, saveBytes } from './wav.js';
import { ROLES } from './bus.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

// メーター：約30fpsで描く（値は平滑化・ピークは保持してゆっくり戻すので明滅しない）
export function startMeter(canvas, getMaster) {
  const colors = { slot: css('--slot'), cyan: css('--cyan'), brass: css('--brass'), amber: css('--amber'), fg: css('--fg'), line: css('--line') };
  let last = 0, sm = { peak: -90, rms: -90, hold: -90 };
  canvas.setAttribute('role', 'img');
  const loop = (ts) => {
    requestAnimationFrame(loop);
    if (ts - last < 33) return;
    last = ts;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), hgt = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
    const m = getMaster();
    const v = m ? m.read() : { peak: -90, rms: -90, hold: -90 };
    sm = { peak: Math.max(v.peak, sm.peak - 1.5), rms: sm.rms + (v.rms - sm.rms) * 0.3, hold: v.hold };
    drawMeter(canvas, sm, colors);
    canvas.setAttribute('aria-label', `出力レベル：ピーク ${Number.isFinite(sm.hold) ? sm.hold.toFixed(1) : '−∞'} dBFS`);
  };
  requestAnimationFrame(loop);
}

// 録音ボタン（マスター出力 → WAV）
export function setupRecord(button, getCtxAndNode, app, onMsg) {
  let rec = null;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', async () => {
    const x = getCtxAndNode();
    if (!x) { onMsg?.('先に再生してください'); return; }
    if (!rec) rec = createRecorder(x.ctx, x.node);
    if (!rec.recording) {
      if (!rec.start()) { onMsg?.('この環境では録音できません（MediaRecorder 非対応）'); return; }
      button.setAttribute('aria-pressed', 'true'); button.textContent = '● REC'; button.title = '録音中。もう一度押すと停止してWAVで保存';
      onMsg?.('録音中…');
    } else {
      button.setAttribute('aria-pressed', 'false'); button.textContent = 'REC'; button.title = 'マスター出力を録音（WAVで保存）';
      try {
        const wav = await rec.stop();
        if (wav) { saveBytes(wav, `${app}-${stamp()}.wav`, 'audio/wav'); onMsg?.('WAVを保存しました'); }
      } catch (e) { onMsg?.(`録音を保存できませんでした：${e.message}`); }
    }
  });
}

// undo / redo（ボタンと Ctrl+Z / Ctrl+Shift+Z）
export function setupUndo(undoBtn, redoBtn, undo, getState, applyState) {
  const paint = () => { undoBtn.disabled = !undo.canUndo; redoBtn.disabled = !undo.canRedo; undoBtn.title = `元に戻す（残り ${undo.size}）`; };
  const doUndo = () => { const s = undo.undo(getState()); if (s) { applyState(s); paint(); } };
  const doRedo = () => { const s = undo.redo(getState()); if (s) { applyState(s); paint(); } };
  undoBtn.addEventListener('click', doUndo);
  redoBtn.addEventListener('click', doRedo);
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.type !== 'range') return;
    e.preventDefault();
    e.shiftKey ? doRedo() : doUndo();
  });
  paint();
  return paint;
}

// MIDI learn：LEARN を押してからコントロールをクリック → 次に動かしたCCを割り当てる
export function setupMidiLearn(learnBtn, root, midi, onMsg) {
  let on = false;
  const set = (v) => { on = v; learnBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); document.body.classList.toggle('midi-learn', v); };
  learnBtn.addEventListener('click', async () => {
    if (!midi.connected) { try { await midi.connect(); } catch (e) { onMsg?.(e.message); return; } }
    set(!on);
    onMsg?.(on ? 'MIDI LEARN：割り当てたいコントロールをクリックし、MIDI機器のつまみを動かしてください' : 'MIDI LEARN を終了しました');
  });
  root.addEventListener('click', (e) => {
    if (!on) return;
    const ctl = e.target.closest('.ctl[data-key]');
    if (!ctl) return;
    e.preventDefault();
    root.querySelectorAll('.ctl.learning').forEach((x) => x.classList.remove('learning'));
    ctl.classList.add('learning');
    midi.learn(ctl.dataset.key, (key, cc) => { ctl.classList.remove('learning'); onMsg?.(`CC${cc} → ${key} を割り当てました`); });
  }, true);
}

// GARDEN BUS の役割切替（OFF → MASTER → FOLLOW）
export function setupBusRole(button, bus, onChange) {
  const label = { off: 'BUS·OFF', master: 'BUS·MST', follow: 'BUS·FLW' };
  const plain = { off: 'GARDEN BUS：共有しない', master: 'GARDEN BUS：この楽器が master（テンポ・基音を流す）', follow: 'GARDEN BUS：master に追従する' };
  const paint = () => { button.textContent = label[bus.role]; button.title = plain[bus.role]; button.setAttribute('aria-label', plain[bus.role]); button.setAttribute('aria-pressed', bus.role === 'off' ? 'false' : 'true'); };
  button.addEventListener('click', () => { bus.role = ROLES[(ROLES.indexOf(bus.role) + 1) % ROLES.length]; paint(); onChange?.(bus.role); });
  paint();
  return paint;
}

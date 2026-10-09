// [DECODE] トグル：コード表示 ⇄ コード＋平文表示。状態は全アプリ共通で保存する
// 安全注意の文章はこの仕組みの外（常に平文）に置くこと
import { store } from './store.js';

const KEY = 'hibikiniwa:decode';

export function isDecoded() { return document.body.classList.contains('decode'); }

export function setupDecode(button, onChange) {
  const apply = (on) => {
    document.body.classList.toggle('decode', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.textContent = on ? '[DECODE:ON]' : '[DECODE]';
    onChange?.(on);
  };
  button.title = 'ラベルに平文の意味を併記する';
  button.setAttribute('aria-label', 'DECODE：平文の意味を表示');
  button.addEventListener('click', () => { const on = !isDecoded(); store.set(KEY, on ? '1' : '0'); apply(on); });
  apply(store.get(KEY) === '1');
  return apply;
}

// 安全注意：初回は開いた状態。閉じたら以降は閉じて表示
export function setupSafety(details, key) {
  details.open = store.get(key) !== '1';
  details.addEventListener('toggle', () => { if (!details.open) store.set(key, '1'); });
}

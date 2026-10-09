// スキーマ駆動UI：パラメータ定義からフェーダー・セレクタ・表示を作る
// 各コントロールには平文の aria-label / title を付け、表示はコード（[DECODE] で平文を併記）
import { fmt, plainVal, toSlider, fromSlider } from './format.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach((k) => k != null && k !== false && el.append(k.nodeType ? k : document.createTextNode(String(k))));
  return el;
}

// コード＋平文（平文は body.decode のときだけ見える）
export const cb = (code, plain) => [h('span', { class: 'c' }, code), h('span', { class: 'pl' }, plain)];

// 1つのコントロール。opts: { reg, get, set(key, value), label?: () => ({code, plain}), optionText?(v) }
// 戻り値：{ el, sync(), relabel() }
export function control(p, opts) {
  const id = `p-${opts.prefix || ''}${p.key}`;
  const lab = () => (opts.label ? opts.label(p) : { code: p.code, plain: p.plain });
  const labelEl = h('label', { for: id, class: 'cb' });
  const paint = () => {
    const { code, plain } = lab();
    labelEl.textContent = '';
    labelEl.append(...(opts.reg ? [h('span', { class: 'reg' }, opts.reg), ' '] : []), ...cb(code, plain));
    return { code, plain };
  };
  let api;
  if (p.type === 'select') {
    const sel = h('select', { id, onchange: (e) => { const raw = e.target.value; const v = p.options.map(optVal).find((x) => String(x) === raw); opts.set(p.key, v ?? raw); } });
    const fill = () => {
      sel.textContent = '';
      for (const o of p.options) {
        const v = optVal(o);
        sel.append(h('option', { value: String(v), title: optPlain(p, o, opts) }, optText(p, o, opts)));
      }
    };
    fill();
    const relabel = () => { const { code, plain } = paint(); sel.title = `${code} = ${plain}`; sel.setAttribute('aria-label', plain); fill(); sel.value = String(opts.get(p.key)); };
    relabel();
    const el = h('div', { class: 'ctl ctl-select', 'data-key': p.key }, labelEl, sel);
    api = { el, input: sel, sync: () => { sel.value = String(opts.get(p.key)); }, relabel };
  } else {
    const out = h('output', { for: id, class: 'val' });
    const input = h('input', {
      id, type: 'range', min: p.log ? 0 : p.min, max: p.log ? 1000 : p.max, step: p.log ? 1 : p.step,
      oninput: (e) => { opts.set(p.key, fromSlider(p, e.target.value)); show(opts.get(p.key)); },
    });
    const show = (v) => { out.textContent = fmt(p, v); input.setAttribute('aria-valuetext', plainVal(p, v)); };
    // ダブルクリックで初期値
    input.addEventListener('dblclick', () => { opts.set(p.key, p.def); api.sync(); });
    const relabel = () => { const { code, plain } = paint(); input.title = `${code} = ${plain}（ダブルクリックで初期値）`; input.setAttribute('aria-label', plain); };
    relabel();
    const el = h('div', { class: 'ctl', 'data-key': p.key }, labelEl, h('div', { class: 'fader' }, input), out);
    api = { el, input, sync: () => { const v = opts.get(p.key); input.value = toSlider(p, v); show(v); }, relabel };
  }
  api.sync();
  return api;
}

const optVal = (o) => (Array.isArray(o) ? o[0] : o);
function optText(p, o, opts) {
  const v = optVal(o);
  const t = opts.optionText?.(p, v);
  if (t) return t;
  if (Array.isArray(o)) return document.body.classList.contains('decode') && o[2] ? `${o[1]} — ${o[2]}` : o[1];
  return String(v);
}
function optPlain(p, o, opts) { return opts.optionPlain?.(p, optVal(o)) || (Array.isArray(o) ? o[2] || o[1] : String(o)); }

// グループ単位のパネル。groups: [{id, code, plain}], params: [...]
// 戻り値：{ el, controls: {key: api}, syncAll(), relabelAll() }
export function panels(groups, params, opts) {
  const wrap = h('div', { class: 'panels' });
  const controls = {};
  let reg = opts.regStart || 0;
  for (const g of groups) {
    const ps = params.filter((p) => p.group === g.id && !p.hidden);
    if (!ps.length && !opts.extra?.[g.id]) continue;
    const sec = h('section', { class: `panel panel-${g.id}`, 'aria-labelledby': `g-${opts.prefix || ''}${g.id}` },
      h('header', { class: 'panel-head' }, h('h3', { id: `g-${opts.prefix || ''}${g.id}`, class: 'cb', title: g.plain, 'aria-label': `${g.code}：${g.plain}` }, cb(g.code, g.plain))));
    opts.before?.[g.id]?.(sec);
    for (const p of ps) {
      const c = control(p, { ...opts, reg: opts.registerOf ? opts.registerOf(reg) : undefined });
      reg++;
      controls[p.key] = c;
      sec.append(c.el);
    }
    opts.extra?.[g.id]?.(sec);
    wrap.append(sec);
  }
  return {
    el: wrap, controls,
    syncAll: () => Object.values(controls).forEach((c) => c.sync()),
    relabelAll: () => Object.values(controls).forEach((c) => c.relabel()),
  };
}

// 計器表示の書式と、スライダー位置⇄値の写像（DOMに依存しない）
// パラメータ定義：{ key, code, plain, min, max, step, log, unit, group, def, off, offLabel, type, options }

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 41.2 → "4.12E+1"
export const sci = (n, d = 2) => Number(n).toExponential(d).toUpperCase();
export const hex = (n, w = 2) => `0x${Math.round(n).toString(16).toUpperCase().padStart(w, '0')}`;

// 対数スライダーは 0..1000 の整数位置で持つ
export const toSlider = (p, v) => (p.log ? (Math.log(v / p.min) / Math.log(p.max / p.min)) * 1000 : v);
export function fromSlider(p, s) {
  if (!p.log) return Number(s);
  const v = p.min * Math.pow(p.max / p.min, s / 1000);
  const dec = p.step < 1 ? Math.max(0, -Math.floor(Math.log10(p.step))) : 0;
  return Number(v.toFixed(dec));
}

// 計器表示：Hz・秒は指数、整数は16進、セントは符号付き。実単位は必ず併記
export function fmt(p, v) {
  const n = Number(v);
  if (p.off && n === 0) return p.offLabel || 'OFF';
  if (p.fmt) return p.fmt(n);
  if (p.unit === 'Hz' || p.unit === 's') return `${sci(n)} ${p.unit}`;
  if (p.unit === '¢') return `${n >= 0 ? '+' : ''}${n.toFixed(p.step < 1 ? 1 : 0)} ¢`;
  if (p.unit === 'dB') return `${n >= 0 ? '+' : ''}${n.toFixed(1)} dB`;
  if (p.unit === '%') return `${(n * 100).toFixed(0)} %`;
  if (p.unit) return `${n.toFixed(p.step < 1 ? (p.step < 0.1 ? 2 : 1) : 0)} ${p.unit}`;
  if (p.step >= 1) return hex(n);
  return n.toFixed(p.min < 0 ? 2 : 3);
}

// 読み上げ用の平文
export function plainVal(p, v) {
  const n = Number(v);
  if (p.off && n === 0) return p.offLabel === '∞' ? '無制限' : 'オフ';
  const u = { '¢': 'セント', '%': 'パーセント' }[p.unit] ?? p.unit;
  return `${p.unit === '%' ? +(n * 100).toFixed(1) : +n.toFixed(3)}${u ? ` ${u}` : ''}`;
}

// スキーマに従って値を範囲に収める
export function sanitizeBy(p, v) {
  if (!p) return v;
  if (p.type === 'select') {
    const vals = p.options.map((o) => (Array.isArray(o) ? o[0] : o));
    return vals.includes(v) ? v : vals.find((x) => String(x) === String(v)) ?? p.def;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return p.def;
  return clamp(n, p.min, p.max);
}

// レジスタ番号（UIの刻印用）
export const registerOf = (index, base = 0x10) => `R0x${(base + index).toString(16).toUpperCase()}`;

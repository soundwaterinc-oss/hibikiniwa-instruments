// 画像の下ごしらえ：縮小（縦横比を保つ）、特徴チャンネル、Lab、ぼかし、分位点
// 入力 img: { width, height, data: RGBA(Uint8ClampedArray) }

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 長辺を long 画素にした面積平均の縮小（長方形のまま）
export function resample(img, long) {
  const s = Math.min(1, long / Math.max(img.width, img.height));
  const W = Math.max(8, Math.round(img.width * s)), H = Math.max(8, Math.round(img.height * s));
  const rgb = new Float32Array(W * H * 3);
  const fx = img.width / W, fy = img.height / H;
  const src = img.data, sw = img.width;
  for (let y = 0; y < H; y++) {
    const y0 = y * fy, y1 = y0 + fy;
    for (let x = 0; x < W; x++) {
      const x0 = x * fx, x1 = x0 + fx;
      let r = 0, g = 0, b = 0, wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        if (wy <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const w = (Math.min(xx + 1, x1) - Math.max(xx, x0)) * wy;
          if (w <= 0) continue;
          const o = (yy * sw + xx) * 4;
          r += src[o] * w; g += src[o + 1] * w; b += src[o + 2] * w; wsum += w;
        }
      }
      const o = (y * W + x) * 3;
      rgb[o] = r / wsum / 255; rgb[o + 1] = g / wsum / 255; rgb[o + 2] = b / wsum / 255;
    }
  }
  return { W, H, rgb, scale: W / img.width };
}

export function channels({ W, H, rgb }) {
  const L = W * H;
  const lum = new Float32Array(L), sat = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return { lum, sat };
}

// sRGB(0..1) → CIE Lab（D65）
export function rgbToLab(r, g, b) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function gauss(src, W, H, sig) {
  if (sig <= 0) return Float32Array.from(src);
  const r = Math.ceil(sig * 3), k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sig * sig)); k[i + r] = v; sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) { const xx = x + i < 0 ? 0 : x + i >= W ? W - 1 : x + i; a += src[row + xx] * k[i + r]; }
      t[row + x] = a;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) { const yy = y + i < 0 ? 0 : y + i >= H ? H - 1 : y + i; a += t[yy * W + x] * k[i + r]; }
    o[y * W + x] = a;
  }
  return o;
}

// 分位点（大きな配列は間引いて推定）
export function quantile(arr, q) {
  const step = Math.max(1, Math.floor(arr.length / 20000));
  const s = [];
  for (let i = 0; i < arr.length; i += step) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
}

export function normalize01(arr, lo = 0.02, hi = 0.98) {
  const a = quantile(arr, lo), b = quantile(arr, hi);
  const o = new Float32Array(arr.length);
  const d = Math.max(1e-6, b - a);
  for (let i = 0; i < arr.length; i++) o[i] = clamp((arr[i] - a) / d, 0, 1);
  return o;
}

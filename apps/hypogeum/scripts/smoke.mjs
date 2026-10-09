// 音響スモークテスト： node scripts/smoke.mjs
// node-web-audio-api（devDependency）の OfflineAudioContext で、全エンジン × 基音3種を各2秒鳴らして測る。
//   合格条件：NaNなし / ピーク ≤ 0.95 / DC成分 < 0.01 / スペクトル重心 < 500Hz
// あわせて 40Hz AM の変調深さ（深さ1.0で包絡の最小値がほぼ0）と、タンプーラ（撥弦）モードの発音を確認する。
import { OfflineAudioContext } from 'node-web-audio-api';
import { DroneEngine } from '../js/engine.js';
import { DEFAULTS } from '../js/params.js';
import { ENGINE_IDS } from '../js/engines/index.js';
import { ENGINE_CODES } from '../js/codebook.js';

const SR = 48000;
const DUR = 2;
const ROOTS = [27.5, 41.2, 82.4];
const LIMIT = { peak: 0.95, dc: 0.01, centroid: 500 };

async function render(params, { dur = DUR, prepare } = {}) {
  const ctx = new OfflineAudioContext(2, Math.round(SR * dur), SR);
  const eng = new DroneEngine();
  eng.applyParams({ ...structuredClone(DEFAULTS), fin: 0, ...params }, { reset: true });
  eng.init(ctx, { scheduler: false });
  prepare?.(eng, ctx);
  eng.begin();
  if (eng.p.exc !== 'sustain') eng.tick(); // 撥弦を先読みでスケジュール
  const buf = await ctx.startRendering();
  eng.dispose();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}

// 実数FFT（基数2、インプレース）
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}

function measure([L, R]) {
  const n = L.length;
  let nan = false, peak = 0, sumL = 0, sumR = 0, sq = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) { nan = true; continue; }
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sumL += l; sumR += r; sq += l * l + r * r;
  }
  const dc = Math.max(Math.abs(sumL / n), Math.abs(sumR / n));
  const rms = Math.sqrt(sq / (2 * n));
  // スペクトル重心：後半 32768 サンプル（約0.68秒）、モノ和、Hann窓、振幅スペクトル
  const N = 32768;
  const re = new Float64Array(N), im = new Float64Array(N);
  const off = n - N;
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    const v = (L[off + i] + R[off + i]) * 0.5;
    re[i] = Number.isFinite(v) ? v * w : 0;
  }
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    const mag = Math.hypot(re[k], im[k]);
    num += ((k * SR) / N) * mag; den += mag;
  }
  const centroid = den > 0 ? num / den : 0;
  return { nan, peak, dc, rms, centroid };
}

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
let failures = 0;
const rows = [];

console.log('\nHYPOGEUM // KKR-40 smoke — 全エンジン × 基音 3 種 × 2 秒\n');
console.log(`| ${pad('エンジン', 8)} | ${lpad('基音', 7)} | ${lpad('RMS', 7)} | ${lpad('ピーク', 6)} | ${lpad('重心', 8)} | 判定 |`);
console.log(`|${'-'.repeat(10)}|${'-'.repeat(9)}|${'-'.repeat(9)}|${'-'.repeat(8)}|${'-'.repeat(10)}|------|`);
for (const id of ENGINE_IDS) {
  for (const f0 of ROOTS) {
    const m = measure(await render({ eng: id, f0 }));
    const bad = [];
    if (m.nan) bad.push('NaN');
    if (m.peak > LIMIT.peak) bad.push('peak');
    if (m.dc >= LIMIT.dc) bad.push(`dc=${m.dc.toFixed(4)}`);
    if (m.centroid >= LIMIT.centroid) bad.push('centroid');
    if (m.rms < 0.005) bad.push('silent');
    if (bad.length) failures++;
    rows.push({ id, f0, ...m, bad });
    console.log(`| ${pad(ENGINE_CODES[id].code, 8)} | ${lpad(f0.toFixed(1), 7)} | ${lpad(m.rms.toFixed(4), 7)} | ${lpad(m.peak.toFixed(3), 6)} | ${lpad(m.centroid.toFixed(1), 6)}Hz | ${bad.length ? `NG ${bad.join(',')}` : 'OK'} |`);
  }
}

// ── 40Hz AM の変調深さ：ドローンを外し、AM段に直流1を入れてゲートそのものを測る ──
console.log('\nΓ40 AM depth（深さ1.0、40Hz）');
for (const ams of ['sine', 'pulse']) {
  const [L] = await render({ amd: 1, ghz: 40, ams, rvb: 0, dly: 0 }, {
    dur: 1.2,
    prepare(eng, ctx) {
      eng.filter.disconnect();       // ドローンを AM 段から外す
      eng.analyser.disconnect();     // 通常出力を外す
      const probe = ctx.createConstantSource();
      probe.connect(eng.amGain);
      eng.amGain.connect(ctx.destination);
      probe.start();
    },
  });
  let mn = Infinity, mx = -Infinity;
  for (let i = Math.round(SR * 0.4); i < L.length; i++) { mn = Math.min(mn, L[i]); mx = Math.max(mx, L[i]); }
  const ok = mn < 0.02 && mx > 0.97 && mx < 1.03;
  if (!ok) failures++;
  console.log(`  AM.w=${pad(ams, 5)} 包絡 min=${mn.toFixed(4)} max=${mx.toFixed(4)} → ${ok ? 'OK' : 'NG'}`);
}

// ── タンプーラ（撥弦）モード：全エンジンで発音し、NaN・ピーク超過がないこと ──
console.log('\nEXC.m=TNP（撥弦）F₀=41.2Hz');
const tnp = [];
for (const id of ENGINE_IDS) {
  const m = measure(await render({ eng: id, f0: 41.2, exc: 'tanpura' }));
  const ok = !m.nan && m.peak <= LIMIT.peak && m.rms > 0.002;
  if (!ok) failures++;
  tnp.push(`${ENGINE_CODES[id].code}:${ok ? 'OK' : `NG(rms=${m.rms.toFixed(4)},peak=${m.peak.toFixed(3)})`}`);
}
console.log(`  ${tnp.join('  ')}`);

console.log(failures ? `\n✗ ${failures} 件が条件を満たしていません` : `\n✓ 全条件を満たしました（${rows.length} 条件 + AM 2 + 撥弦 ${ENGINE_IDS.length}）`);
process.exit(failures ? 1 : 0);

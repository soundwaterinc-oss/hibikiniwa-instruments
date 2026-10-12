// STOMA//16 の音響スモークテスト（node-web-audio-api の OfflineAudioContext）
//   4標本＋fixtures × 4スタイル × EVO ON/OFF：解析して2小節を描画 → NaN なし・ピーク ≤ 0.95
//   16音色の単発：音色ごとのピーク 0.15〜0.4
import { OfflineAudioContext } from 'node-web-audio-api';
import { existsSync } from 'node:fs';
import { renderSpecimen, SPECIMENS } from '../apps/stoma16/js/specimens.js';
import { analyze } from '../apps/stoma16/js/analysis/index.js';
import { autoTune } from '../apps/stoma16/js/analysis/auto.js';
import { DEFAULTS, styleParams } from '../apps/stoma16/js/params.js';
import { STYLE_IDS } from '../apps/stoma16/js/styles.js';
import { renderBars } from '../apps/stoma16/js/session.js';
import { playModel, playNative, MODEL_TRIM, reseedVoices } from '../apps/stoma16/js/voices.js';
import { MODEL_CODES } from '../apps/stoma16/js/codebook.js';

const SR = 48000;
let failures = 0;
const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);

function measure(buf) {
  let nan = false, peak = 0, sq = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { nan = true; continue; } peak = Math.max(peak, Math.abs(v)); sq += v * v; n++; }
  }
  return { nan, peak, rms: Math.sqrt(sq / Math.max(1, n)) };
}

async function loadFixture(name) {
  const p = `fixtures/${name}`;
  if (!existsSync(p)) return null;
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');
  const im = await loadImage(p);
  const c = createCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0);
  return { width: im.width, height: im.height, data: c.getContext('2d').getImageData(0, 0, im.width, im.height).data };
}

export async function smokeStoma() {
  console.log('\nSTOMA//16 smoke — 標本 × スタイル × EVO（2小節）\n');
  const inputs = SPECIMENS.map((s) => ({ id: s.code, img: renderSpecimen(s.id, 1), auto: false }));
  for (const [name, code] of [['root_xs.jpg', 'LOC.ROOT'], ['moss_leaf.jpg', 'LOC.MOSS']]) {
    const img = await loadFixture(name);
    if (img) inputs.push({ id: code, img, auto: true });
  }
  console.log(`| ${pad('標本', 9)} | 細胞 | ${pad('スタイル', 8)} | EVO | 打点 | ${lpad('RMS', 6)} | ${lpad('ピーク', 6)} | 判定 |`);
  console.log(`|-----------|------|----------|-----|------|--------|--------|------|`);
  for (const inp of inputs) {
    const seg = inp.auto ? autoTune(inp.img).best.params : {};
    const A = analyze(inp.img, seg);
    for (const style of STYLE_IDS) for (const evo of [0, 1]) {
      const P = { ...structuredClone(DEFAULTS), ...seg, ...styleParams(style), evo, form: 'ARC', phr: 1, seed: 7 };
      const { buf, session } = await renderBars(OfflineAudioContext, A, P, { bars: 2, sampleRate: SR, seed: 7 });
      const m = measure(buf);
      const bad = [];
      if (m.nan) bad.push('NaN');
      if (m.peak > 0.95) bad.push('peak');
      if (m.rms < 0.003) bad.push('silent');
      if (bad.length) failures++;
      console.log(`| ${pad(inp.id, 9)} | ${lpad(A.cells.filter((c) => !c.bg).length, 4)} | ${pad(style, 8)} | ${evo ? 'ON ' : 'OFF'} | ${lpad(session.tracks.count, 4)} | ${lpad(m.rms.toFixed(3), 6)} | ${lpad(m.peak.toFixed(3), 6)} | ${bad.length ? `NG ${bad.join(',')}` : 'OK'} |`);
    }
  }

  console.log('\n16音色の単発（ベロシティ1、マクロ0.5、大きさ・細長さ0.5）ピーク 0.15〜0.4\n');
  const row = [];
  for (const m of Object.keys(MODEL_CODES)) {
    const ctx = new OfflineAudioContext(1, SR * 2, SR);
    const out = ctx.createGain(); out.connect(ctx.destination);
    reseedVoices(7); // 粒の位置などの乱数を毎回同じ状態から始める（実行環境で結果が変わらないように）
    const ev = { aQ: 0.5, eQ: 0.5, per: 50, tone: null };
    const o = { tun: 1, dc: 1, m1: 0.5, m2: 0.5, f0: 41.2, scale: null, stepDur: 0.03 };
    if (m === 'NAT') playNative(ctx, 'TWL', 0, 0.01, MODEL_TRIM.NAT, out, ev, o, { throwBus: ctx.createGain() });
    else playModel(ctx, m, 0.01, 1, out, ev, o);
    const r = measure(await ctx.startRendering());
    const ok = !r.nan && r.peak >= 0.15 && r.peak <= 0.4;
    if (!ok) failures++;
    row.push(`${pad(m, 4)} ${r.peak.toFixed(3)}${ok ? '' : '✗'} (trim ${MODEL_TRIM[m]})`);
  }
  for (let i = 0; i < row.length; i += 4) console.log(`  ${row.slice(i, i + 4).join('   ')}`);
  return failures;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('smoke-stoma.mjs')) {
  const f = await smokeStoma();
  console.log(f ? `\n✗ ${f} 件が条件を満たしていません` : '\n✓ STOMA の全条件を満たしました');
  process.exit(f ? 1 : 0);
}

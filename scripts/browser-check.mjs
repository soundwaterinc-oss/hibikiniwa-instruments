// ブラウザ検証（Edge/Chrome をヘッドレスで起動し、DevTools Protocol で操作する）
//   ・各ページを開いてコンソールエラー・例外がないこと
//   ・STOMA：AUTO（Worker 並列）の間、UI スレッドのフレーム間隔が大きく空かないこと
//   ・GARDEN BUS：2タブ（STOMA=master、HYPOGEUM=follow）が同期すること
// 使い方： node scripts/serve.mjs 8090 を起動しておき、 node scripts/browser-check.mjs http://localhost:8090 [出力フォルダ]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = (process.argv[2] || 'http://localhost:8090').replace(/\/$/, '');
const outDir = process.argv[3] || tmpdir();
const candidates = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const exe = candidates.find((p) => existsSync(p));
if (!exe) { console.log('ブラウザが見つからないため省略'); process.exit(0); }
const port = 9335;
const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'hbk-'))}`, '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--window-size=1280,1600', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTab(url) {
  for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(250); } }
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map(), problems = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') problems.push(`EXCEPTION ${url}: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(`console.${m.params.type} ${url}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (m.method === 'Log.entryAdded' && ['error'].includes(m.params.entry.level)) problems.push(`LOG ${url}: ${m.params.entry.text} ${m.params.entry.url || ''}`);
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) problems.push(`EVAL ${expr.slice(0, 50)}: ${r.result.exceptionDetails.exception?.description}`); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(2500);
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(s.result.data, 'base64')); };
  return { ev, send, problems, shot, close: () => ws.close() };
}

const report = {};
// 入口
const root = await newTab(`${base}/`);
report.root = await root.ev('({ title: document.title, apps: document.querySelectorAll(".app").length })');

// STOMA
const st = await newTab(`${base}/apps/stoma16/`);
await sleep(2500);
report.stoma = await st.ev('({ title: document.title, panels: document.querySelectorAll("#panels .panel").length, slides: [...document.querySelectorAll("#slides [data-id]")].map(b=>b.dataset.id), status: document.querySelector("#seg-status").textContent, cells: window.stoma.A?.cells.length })');
// AUTO 中のフレーム間隔（UI スレッドが止まっていないか）
const frameCheck = (sel) => `new Promise(async (res) => {
  const long = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch {}
  performance.clearMeasures();
  let last = performance.now(), max = 0, n = 0, run = true;
  const loop = (t) => { max = Math.max(max, t - last); last = t; n++; if (run) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const before = document.querySelector('#io-msg').textContent;
  document.querySelector('${sel}').click();
  const t0 = performance.now();
  // AUTO の結果（io-msg に「AUTO（…）」が出る）と、その後の解析の反映を待つ
  await new Promise((r) => { const iv = setInterval(() => { const m = document.querySelector('#io-msg').textContent; if ((m !== before && m.startsWith('AUTO')) || performance.now() - t0 > 15000) { clearInterval(iv); setTimeout(r, 400); } }, 50); });
  run = false;
  res({ ms: Math.round(performance.now() - t0), maxFrameGap: Math.round(max), frames: n, longTasks: long, measures: performance.getEntriesByType('measure').filter((m) => m.name.startsWith('stoma:')).map((m) => m.name + '=' + Math.round(m.duration)), status: document.querySelector('#seg-status').textContent, msg: document.querySelector('#io-msg').textContent });
})`;
if (report.stoma.slides.includes('local-root')) {
  report.autoRoot = await st.ev(frameCheck('#slides [data-id="local-root"]'));
  await st.shot('stoma_root.png');
}
if (report.stoma.slides.includes('local-moss')) report.autoMoss = await st.ev(frameCheck('#slides [data-id="local-moss"]'));
// 再生・スタイル・EVO
await st.ev('document.querySelector("#run").click()');
await sleep(1500);
for (const s of ['IKD', 'BDM', 'JLN', 'TWL']) { await st.ev(`document.querySelector('.style[data-id="${s}"]').click()`); await sleep(700); }
await st.ev('(() => { const s = document.querySelector("#p-evo"); s.value = "1"; s.dispatchEvent(new Event("change")); const f = document.querySelector("#p-form"); f.value = "TISSUE"; f.dispatchEvent(new Event("change")); })()');
await sleep(4000);
report.stomaRun = await st.ev('({ running: window.stoma.audio.running, evo: document.querySelector("#evo-state").textContent, events: window.stoma.audio.tracks?.count })');
await st.ev('document.querySelector("#decode").click()');
await st.shot('stoma_desktop.png');
// GARDEN BUS：STOMA を master に
await st.ev('(() => { const b = document.querySelector("#bus"); while (b.textContent !== "BUS·MST") b.click(); })()');
const hy = await newTab(`${base}/apps/hypogeum/`);
await hy.ev('(() => { window.hypogeum.set("pbpm", 6); const b = document.querySelector("#bus"); while (b.textContent !== "BUS·FLW") b.click(); })()');
await hy.ev('document.querySelector("#play").click()');
await sleep(3000);
report.bus = await hy.ev('({ pbpm: window.hypogeum.p.pbpm, f0: window.hypogeum.p.f0, dfr: window.hypogeum.p.dfr, msg: document.querySelector("#io-msg").textContent })');
report.busStoma = await st.ev('({ bpm: window.stoma.P.bpm, f0: window.stoma.P.f0 })');
await sleep(1500);
report.rootRows = await root.ev('[...document.querySelectorAll("#bus-rows tr")].map(tr => tr.textContent)');
// スマホ幅
await st.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 900, deviceScaleFactor: 2, mobile: true });
await sleep(800);
report.stomaMobileOverflow = await st.ev('document.documentElement.scrollWidth - document.documentElement.clientWidth');
await st.shot('stoma_mobile.png');
await root.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 900, deviceScaleFactor: 2, mobile: true });
await sleep(500);
report.rootMobileOverflow = await root.ev('document.documentElement.scrollWidth - document.documentElement.clientWidth');

console.log(JSON.stringify(report, null, 2));
const problems = [...root.problems, ...st.problems, ...hy.problems];
console.log(problems.length ? `PROBLEMS (${problems.length}):\n${problems.join('\n')}` : 'PROBLEMS: none');
[root, st, hy].forEach((t) => t.close());
proc.kill();
process.exit(problems.length ? 1 : 0);

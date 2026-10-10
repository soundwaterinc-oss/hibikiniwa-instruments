// 音響スモークテスト（両アプリ）： node scripts/smoke.mjs
//   devDependency：node-web-audio-api（オフライン描画）、@napi-rs/canvas（fixtures の写真の読み込み）
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
let fail = 0;
for (const s of ['smoke-hypogeum.mjs', 'smoke-stoma.mjs']) {
  const r = spawnSync(process.execPath, [join(here, s)], { stdio: 'inherit' });
  if (r.status !== 0) fail++;
}
console.log(fail ? `\n✗ ${fail} 本のスモークテストが失敗しました` : '\n✓ 両アプリのスモークテストがすべて通りました');
process.exit(fail ? 1 : 0);

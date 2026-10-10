// docs/CODEBOOK.md を両アプリのコードブックから生成する： node scripts/codebook.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderCodebook as renderHypogeum } from './codebook-hypogeum.mjs';
import { renderStoma } from './codebook-stoma.mjs';

export function renderAll() {
  return [
    '# CODEBOOK — 響庭（Hibikiniwa）楽器群',
    '',
    '> このファイルは `node scripts/codebook.mjs` で各アプリの `js/codebook.js` から自動生成しています。手で編集しないでください。',
    '',
    'UIでは [DECODE] を押すと、すべてのラベルにここの平文が併記されます。各コントロールの `title` と `aria-label` には常に平文が入っています。安全注意の文章だけは暗号化していません。',
    '',
    renderHypogeum().replace(/^# /m, '## '),
    renderStoma().replace(/^## (?=STOMA)/m, '## '),
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'CODEBOOK.md'), renderAll(), 'utf8');
  console.log('wrote docs/CODEBOOK.md');
}

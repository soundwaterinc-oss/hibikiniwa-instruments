// docs/CODEBOOK.md を js/codebook.js から生成する： node scripts/codebook.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderCodebook } from './codebook-md.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'docs'), { recursive: true });
const out = join(root, 'docs', 'CODEBOOK.md');
writeFileSync(out, renderCodebook(), 'utf8');
console.log(`wrote ${out}`);

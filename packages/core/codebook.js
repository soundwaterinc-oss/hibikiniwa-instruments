// コードブックの共通処理：重複検査と Markdown 表の生成（各アプリのコード表は apps/*/js/codebook.js）

export function duplicates(codes) {
  const seen = new Set(), dup = new Set();
  for (const c of codes) { if (seen.has(c)) dup.add(c); seen.add(c); }
  return [...dup];
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
export function mdTable(headers, rows) {
  return [
    `| ${headers.map(esc).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ].join('\n');
}

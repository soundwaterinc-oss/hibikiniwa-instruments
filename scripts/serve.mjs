// 依存ゼロのローカル静的サーバー： node scripts/serve.mjs [port]
// ES Modules は file:// では読み込めないため、ローカルでは http://localhost から開く
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.scl': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403).end(); return; }
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');
    if (path.includes(`${sep}node_modules${sep}`) || path.includes(`${sep}.git${sep}`)) { res.writeHead(404).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`ポート ${port} は使用中です。別のポートを指定してください： node scripts/serve.mjs ${port + 1}`);
  else console.error(e);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`HYPOGEUM // KKR-40 → http://localhost:${port}/`);
  console.log('止めるときはこのウィンドウで Ctrl+C');
});

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createAccounts } from './accounts.mjs';

const root = resolve(process.env.AUTHNJS_WEB_ROOT ?? '/web');
const accounts = createAccounts({
  origin: process.env.AUTHNJS_ACCOUNT_ORIGIN,
  database: join(process.env.AUTHNJS_DATA_DIR, 'accounts.sqlite'),
});
const types = new Map(Object.entries({
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  webmanifest: 'application/manifest+json', json: 'application/json', png: 'image/png',
  svg: 'image/svg+xml', ttf: 'font/ttf', txt: 'text/plain',
}));

createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/account/')) {
    void accounts(req, res, path);
    return;
  }
  const relative = path === '/' ? 'index.html' : path.slice(1);
  const valid = /^(?:index\.html|revision\.txt|manifest\.webmanifest|service-worker\.js|authnjs-[\w-]+\.(?:svg|png)|(?:_expo|assets)\/[\w@./-]+)$/.test(relative);
  if (!valid || relative.split('/').some((part) => part === '.' || part === '..') ||
      (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404).end();
    return;
  }
  const file = join(root, relative);
  const stat = statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, {
    'Content-Type': types.get(file.split('.').at(-1)) ?? 'application/octet-stream',
    'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': /^(?:assets|_expo)\//.test(relative) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}).listen(8080, '0.0.0.0');

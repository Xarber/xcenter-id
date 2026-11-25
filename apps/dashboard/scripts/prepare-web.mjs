import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const paths = (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name).slice(root.length).replace(/^\/?/, '/'));
const assets = paths.filter((path) => path.startsWith('/_expo/') || path.startsWith('/assets/') ||
  path === '/manifest.webmanifest' || path === '/offline.html' || /^\/authnjs-[\w-]+\.(svg|png)$/.test(path)).sort();
const htmlPath = join(root, 'index.html');
const original = await readFile(htmlPath, 'utf8');
const head = '<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/authnjs-icon.svg"><link rel="apple-touch-icon" href="/authnjs-192.png"><meta name="theme-color" content="#264eb5">';
const registration = "<script>if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));</script>";
if (!original.includes('</head>') || !original.includes('</body>')) throw new Error('Expo HTML template is missing');
const html = original
  .replace(/<style id="expo-reset">[\s\S]*?<\/style>/, '')
  .replace('initial-scale=1, shrink-to-fit=no', 'initial-scale=1, viewport-fit=cover')
  .replace('</head>', head + '</head>').replace('</body>', registration + '</body>');
await writeFile(htmlPath, html);
const digest = createHash('sha256').update(html);
for (const path of assets) digest.update(await readFile(join(root, path.slice(1))));
const cache = 'authnjs-static-' + digest.digest('hex').slice(0, 16);
await writeFile(join(root, 'service-worker.js'), `
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(['/', ...assets])};
const ACCOUNT_PAGE = /^\\/(?:dashboard|profile|devices|security|apps|permissions|storage|files|friends|mail|mail-clients|settings|developer|admin|support|signin|signup)(?:\\/|$)/;
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('authnjs-static-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && (url.pathname === '/changelog' || url.pathname.startsWith('/changelog/') || url.pathname === '/docs' || url.pathname.startsWith('/docs/'))) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match('/') ?? Response.error();
    }));
    return;
  }
  if (event.request.mode === 'navigate' && ACCOUNT_PAGE.test(url.pathname)) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match('/offline.html') ?? Response.error();
    }));
    return;
  }
  if (url.search || !ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(hit => hit || fetch(event.request)));
});
`);

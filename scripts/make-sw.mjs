/* Baut sw.js mit aktueller Dateiliste und einer Version aus dem Inhalt.
   Nach Änderungen an App oder Karten erneut ausführen: npm run build */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'scripts', 'tests', '.netlify']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(html|css|js|json|webmanifest|png|svg)$/.test(name) && name !== 'sw.js') {
      files.push('./' + p.replace(/^\.\//, ''));
    }
  }
})('.');
files.sort();

const hash = createHash('sha256');
for (const f of files) hash.update(readFileSync(f));
const version = hash.digest('hex').slice(0, 10);

const sw = `/* Automatisch erzeugt von scripts/make-sw.mjs – nicht von Hand ändern. */
const VERSION = 'wissenswerk-${version}';
const ASSETS = ${JSON.stringify(files, null, 2)};

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Bewusst nicht cache.addAll: das laeuft durch den HTTP-Cache und koennte
    // veraltete Module dauerhaft in den Offline-Bestand uebernehmen.
    await Promise.all(ASSETS.map(async (url) => {
      const res = await fetch(url, { cache: 'reload' });
      if (res.ok) await cache.put(url, res);
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Netz zuerst für das Grundgerüst (damit Updates ankommen),
   Cache zuerst für alles andere (damit die App offline sofort startet). */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isShell = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isShell) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, net.clone());
        return net;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      if (net.ok) (await caches.open(VERSION)).put(req, net.clone());
      return net;
    } catch (err) {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
`;
writeFileSync('sw.js', sw);
console.log(`sw.js geschrieben – Version ${version}, ${files.length} Dateien im Cache.`);

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

/* Holt die genannten Dateien am HTTP-Cache vorbei in den Bestand.
   Einzelne Ausfaelle kippen nichts - zurueck kommt, was noch fehlt. */
async function vorladen(cache, liste) {
  const ergebnisse = await Promise.all(liste.map(async (url) => {
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) return url;
      await cache.put(url, res);
      return null;
    } catch (e) { return url; }
  }));
  return ergebnisse.filter(Boolean);
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Bewusst nicht cache.addAll: das laeuft durch den HTTP-Cache und koennte
    // veraltete Module dauerhaft in den Offline-Bestand uebernehmen.
    const fehlend = await vorladen(cache, ASSETS);
    if (fehlend.length) console.warn('[sw] ' + fehlend.length + ' von ' + ASSETS.length + ' Dateien nicht vorgeladen');
    // Kein skipWaiting: die laufende Seite haelt ihre alte Fassung, bis sie
    // geschlossen wird oder der Nutzer das Update ausdruecklich annimmt.
    // Sonst mischten sich nach einer Veroeffentlichung neues Grundgeruest und
    // alte Module - genau der Zustand, in dem nichts mehr zusammenpasst.
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'jetzt-uebernehmen') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Was beim Installieren nicht durchkam, jetzt nachholen.
    const da = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
    const luecken = ASSETS.filter(u => !da.has(new URL(u, self.location.href).pathname));
    const fehlend = luecken.length ? await vorladen(cache, luecken) : [];
    // Den alten Bestand erst wegwerfen, wenn der neue vollstaendig ist. Sonst
    // steht die App nach einem Update ohne Netz mit halbem Bestand da.
    if (!fehlend.length) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    } else {
      console.warn('[sw] alter Bestand bleibt als Rueckfall: ' + fehlend.length + ' Dateien fehlen');
    }
    await self.clients.claim();
  })());
});

/* Alles aus einem Guss: Grundgeruest und Module kommen aus demselben
   Bestand, damit index.html nie auf Module einer anderen Fassung trifft.
   Neue Fassungen kommen ueber den Lebenszyklus des Service Workers an,
   nicht ueber einzelne Dateien. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const istGeruest = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const eigen = await cache.match(istGeruest ? './index.html' : req);
    if (eigen) return eigen;
    try {
      const net = await fetch(req);
      // Nur gueltige Antworten aufnehmen, sonst ersetzte eine 404-Seite
      // dauerhaft die App.
      if (net.ok) cache.put(req, net.clone());
      return net;
    } catch (err) {
      // Letzter Rueckfall: ein aelterer Bestand, falls das Update unvollstaendig blieb.
      const alt = await caches.match(istGeruest ? './index.html' : req);
      if (alt) return alt;
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
`;
writeFileSync('sw.js', sw);
console.log(`sw.js geschrieben – Version ${version}, ${files.length} Dateien im Cache.`);

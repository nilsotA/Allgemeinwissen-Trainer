/* Automatisch erzeugt von scripts/make-sw.mjs – nicht von Hand ändern. */
const VERSION = 'wissenswerk-d35d3a6b30';
const ASSETS = [
  "./assets/css/app.css",
  "./assets/js/app.js",
  "./assets/js/quiz.js",
  "./assets/js/session.js",
  "./assets/js/srs.js",
  "./assets/js/store.js",
  "./data/all.js",
  "./data/cats.js",
  "./data/facts.js",
  "./data/geo.js",
  "./data/ges.js",
  "./data/index.js",
  "./data/kul.js",
  "./data/mat.js",
  "./data/nat.js",
  "./data/pol.js",
  "./data/spo.js",
  "./data/spr.js",
  "./icons/favicon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./index.html",
  "./manifest.webmanifest"
];

/* Holt die genannten Dateien am HTTP-Cache vorbei in den Bestand.
   Einzelne Ausfaelle kippen nichts - zurueck kommt, was noch fehlt. */
async function vorladen(cache, liste) {
  const ergebnisse = await Promise.all(liste.map(async (url) => {
    try {
      // 'no-cache' statt 'reload': beides fragt den Server, aber 'reload' laedt
      // jede Datei voll herunter - beim ersten Besuch also ein zweites Mal,
      // direkt nachdem die Seite sie geladen hat. 'no-cache' fragt nur nach,
      // ob sie sich geaendert hat, und begnuegt sich sonst mit einer 304.
      // Veraltete Module koennen so trotzdem nicht in den Bestand geraten.
      const res = await fetch(url, { cache: 'no-cache' });
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
    // Bewusst nicht cache.addAll: das nimmt Antworten ungeprueft aus dem
    // HTTP-Cache und koennte veraltete Module dauerhaft uebernehmen.
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

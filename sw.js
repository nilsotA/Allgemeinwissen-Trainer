/* Automatisch erzeugt von scripts/make-sw.mjs – nicht von Hand ändern. */
const VERSION = 'wissenswerk-02d590e2ab';
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
  "./icons/icon-512-maskable.png",
  "./icons/icon-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./package.json"
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Bewusst nicht cache.addAll: das laeuft durch den HTTP-Cache und koennte
    // veraltete Module dauerhaft in den Offline-Bestand uebernehmen.
    // Einzelne Ausfaelle duerfen die Installation nicht kippen - was fehlt, holt
    // der fetch-Handler spaeter nach. Ein Totalausfall wird gemeldet.
    const ergebnisse = await Promise.all(ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (!res.ok) return false;
        await cache.put(url, res);
        return true;
      } catch (e) { return false; }
    }));
    const fehlend = ergebnisse.filter(x => !x).length;
    if (fehlend) console.warn('[sw] ' + fehlend + ' von ' + ASSETS.length + ' Dateien nicht vorgeladen');
    if (fehlend === ASSETS.length) throw new Error('Vorladen vollstaendig fehlgeschlagen');
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
        // Nur gueltige Antworten als Offline-Rueckfall speichern, sonst wuerde
        // eine 404-Seite dauerhaft die App ersetzen.
        if (net.ok) {
          const cache = await caches.open(VERSION);
          cache.put(req, net.clone());
        }
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

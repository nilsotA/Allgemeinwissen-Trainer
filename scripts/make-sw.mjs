/* Baut sw.js mit aktueller Dateiliste und einer Version aus dem Inhalt.
   Nach Änderungen an App oder Karten erneut ausführen: npm run build */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'scripts', 'tests', '.netlify']);
let files = [];
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

/* Nicht alles, was im Ordner liegt, gehoert zur App. package.json ist eine
   Bau-Datei, data/kennungen.json ist der Bestandsnachweis fuer die
   Inhaltspruefung – die App importiert beide nirgends. Ausgeliefert kosteten sie
   26 KB beim ersten Besuch und, schlimmer, sie gingen in die Versionskennung
   ein: Eine neue Zeile in package.json haette jedem Nutzer ein Update
   angeboten, das nichts aendert. kennungen.json wird ausserdem von
   „npm run check --kennungen" neu geschrieben, sodass die Reihenfolge der
   Bauschritte ueber die Versionskennung entschied. */
const NUR_FUER_DIE_WERKSTATT = new Set(['./package.json', './data/kennungen.json']);
const uebrig = files.filter(f => NUR_FUER_DIE_WERKSTATT.has(f));
if (uebrig.length !== NUR_FUER_DIE_WERKSTATT.size) {
  console.error('FEHLER  Werkstatt-Datei nicht gefunden – Liste in make-sw.mjs veraltet:'
    + ` erwartet ${[...NUR_FUER_DIE_WERKSTATT].join(', ')}, gefunden ${uebrig.join(', ') || 'keine'}`);
  process.exit(1);
}
files = files.filter(f => !NUR_FUER_DIE_WERKSTATT.has(f));

/* Die beiden 512er-Icons sind zusammen 230 KB gross und werden von der App nie
   angezeigt - sie gehen ans Betriebssystem, wenn der Nutzer die App auf den
   Startbildschirm legt, und an den Startbildschirm-Splash. Sie im Voraus zu
   laden verdoppelte beinahe die Datenmenge des ersten Besuchs. Wer sie doch
   anfordert, bekommt sie ueber den fetch-Handler und danach aus dem Bestand. */
const NUR_BEI_BEDARF = /icon-512/;
const vorab = files.filter(f => !NUR_BEI_BEDARF.test(f));

/* index.html ruft die Kartendateien vorab ab, damit der Browser sie nicht erst
   nach drei Runden Nachladen entdeckt. Diese Liste steht dort von Hand - also
   hier pruefen, ob sie noch zum Ordner passt. Ein vergessener Eintrag kostet
   auf langsamem Mobilfunk eine ganze Runde Wartezeit und faellt sonst nie auf. */
const html = readFileSync('index.html', 'utf8');
const vorgemerkt = new Set([...html.matchAll(/rel="modulepreload"\s+href="\.\/([^"]+)"/g)].map(m => m[1]));
const module = files.filter(f => /^\.\/(data|assets\/js)\/.*\.js$/.test(f)).map(f => f.slice(2));
const fehlen = module.filter(f => !vorgemerkt.has(f) && !/^assets\/js\/(?!app\.js)/.test(f));
const zuviel = [...vorgemerkt].filter(f => !module.includes(f));
if (fehlen.length || zuviel.length) {
  console.error('FEHLER  Vorabruf in index.html passt nicht zum Ordner:'
    + (fehlen.length ? `\n  fehlt:  ${fehlen.join(', ')}` : '')
    + (zuviel.length ? `\n  zuviel: ${zuviel.join(', ')}` : ''));
  process.exit(1);
}

/* Die Fassungskennung gehoert auch IN die App, nicht nur in den Service Worker.
   Sonst kann die App nur ueber ihn beantworten, welche Fassung laeuft - und
   genau dort, wo man es am dringendsten wissen will, gibt es ihn nicht: im
   privaten Tab, beim allerersten Aufruf, bei abgeschaltetem Worker. Nachgestellt
   stand in den Einstellungen dann „wird eingerichtet" statt einer Auskunft.

   Diese eine Datei bleibt deshalb aus der Kennung heraus: Sie enthaelt die
   Kennung, sie kann sie nicht mitbestimmen. Ausgeliefert und zwischengespeichert
   wird sie trotzdem, sie steht ja in files. */
const STEMPEL = './assets/js/fassung.js';
if (!files.includes(STEMPEL)) {
  console.error(`FEHLER  ${STEMPEL} fehlt – die App koennte ihre Fassung nicht nennen.`);
  process.exit(1);
}

const hash = createHash('sha256');
for (const f of files) if (f !== STEMPEL) hash.update(readFileSync(f));
const version = hash.digest('hex').slice(0, 10);

writeFileSync(STEMPEL,
  '/* Automatisch erzeugt von scripts/make-sw.mjs \u2013 nicht von Hand \u00e4ndern. */\n'
  + `export const FASSUNG = 'wissenswerk-${version}';\n`);

const sw = `/* Automatisch erzeugt von scripts/make-sw.mjs – nicht von Hand ändern. */
const VERSION = 'wissenswerk-${version}';
const ASSETS = ${JSON.stringify(vorab, null, 2)};

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
  /* Gelesen und geschrieben wird unter demselben Namen. Vorher las der Handler
     das Geruest unter './index.html', legte die Antwort aber unter der
     Anfrage-URL ab - bei einem Aufruf von '/' also unter '/'. Eine Luecke beim
     Geruest heilte damit nie: Jeder Aufruf mit Netz gelang, jeder ohne Netz
     endete bei der nackten Zeile „Offline" statt bei der App. */
  const schluessel = istGeruest ? './index.html' : req;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const eigen = await cache.match(schluessel);
    if (eigen) return eigen;
    try {
      const net = await fetch(req);
      // Nur gueltige Antworten aufnehmen, sonst ersetzte eine 404-Seite
      // dauerhaft die App.
      if (net.ok) cache.put(schluessel, net.clone());
      return net;
    } catch (err) {
      // Letzter Rueckfall: ein aelterer Bestand, falls das Update unvollstaendig blieb.
      const alt = await caches.match(schluessel);
      if (alt) return alt;
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
`;
writeFileSync('sw.js', sw);
console.log(`sw.js geschrieben – Version ${version}, ${vorab.length} Dateien vorgeladen`
  + `, ${files.length - vorab.length} erst bei Bedarf.`);

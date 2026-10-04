/* Abgleich zwischen Geraeten ueber ein privates GitHub-Gist.

   Die App hat keinen eigenen Server, und sie soll auch keinen bekommen. Ein
   Gist ist ein kleines Git-Archiv im GitHub-Konto des Nutzers; die App spricht
   es mit einem persoenlichen Zugangsschluessel an, der nur das Recht „gist"
   traegt. Der Schluessel liegt im Speicher des Geraets, NICHT im Lernstand -
   eine Sicherungsdatei, die man weitergibt, enthaelt ihn also nie.

   Aufbau des Gists: je Geraet eine Datei „geraet-<kennung>.json" mit dem
   ganzen Stand. Jedes Geraet schreibt nur seine eigene Datei und liest die der
   anderen. Damit gibt es keinen Schreibkonflikt, den man aufloesen muesste:
   Laden zwei Geraete gleichzeitig hoch, aendert jedes nur seine Datei. Das
   Mischen selbst macht store.js mit derselben Regel wie zwischen zwei Tabs.

   Ablauf eines Abgleichs: Gist lesen -> fremde Staende einmischen (nicht
   waehrend einer Einheit) -> eigenen Stand hochladen, wenn er sich seit dem
   letzten Hochladen geaendert hat. Beim allerersten Abgleich eines Geraets wird
   NICHTS hochgeladen, bevor gemischt ist - sonst koennte ein noch unvereinigter
   Stand die anderen Geraete ersetzen (siehe geraeteStaendeEinmischen). */
import * as store from './store.js';

const KONF = 'wissenswerk.sync';
const KENNUNG = 'wissenswerk.geraet';
/* Welche Geraetedateien dieses Geraet schon einmal eingemischt hat - je Gist.
   Eine unbekannte Datei wird vereinigt, eine bekannte folgt der
   Generationsregel (siehe geraeteStaendeEinmischen). Liegt getrennt von der
   Verbindung, damit ein neuer Schluessel nach einem Zuruecksetzen die alten
   Staende nicht als „neu" wieder hereinholt. */
const BEKANNT = 'wissenswerk.sync.bekannt';
const API = 'https://api.github.com';
export const BESCHREIBUNG = 'Wissenswerk – Lernstand-Abgleich (nicht von Hand ändern)';
const DATEI = /^geraet-([a-z0-9]{4,32})\.json$/;
const FORMAT = 1;

/* Austauschbar fuer die Tests. */
let netz = (...a) => fetch(...a);
export const setzeNetz = (fn) => { netz = fn; };
let jetzt = () => Date.now();
export const setzeUhr = (fn) => { jetzt = fn; };

function lies(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
}
function schreib(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
}

export const konfiguration = () => {
  const k = lies(KONF);
  return k && typeof k === 'object' && typeof k.token === 'string' && k.token ? k : null;
};
const bekannteDateien = (gist) => {
  const b = lies(BEKANNT);
  return b && b.gist === gist && Array.isArray(b.dateien) ? b.dateien.filter(x => typeof x === 'string') : [];
};
const merke = (aenderung) => {
  const k = konfiguration();
  if (!k) return null;
  const neu = { ...k, ...aenderung };
  schreib(KONF, neu);
  return neu;
};

/* Die Kennung ueberlebt ein Trennen und Neuverbinden - sonst laege nach jedem
   Wiederverbinden eine weitere Datei desselben Geraets im Gist. Ein geleerter
   Websitespeicher nimmt sie mit; die alte Datei bleibt dann als fremde liegen
   und schadet nicht (siehe store.js). */
export function geraeteKennung() {
  let k = null;
  try { k = localStorage.getItem(KENNUNG); } catch (e) { /* gesperrt */ }
  if (k && /^[a-z0-9]{4,32}$/.test(k)) return k;
  k = (Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)).replace(/[^a-z0-9]/g, '');
  try { localStorage.setItem(KENNUNG, k); } catch (e) { /* gesperrt */ }
  return k;
}

export function geraeteName() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows-PC';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Gerät';
}

/* ---- GitHub ---- */
class AbgleichFehler extends Error {
  constructor(art, text) { super(text); this.art = art; }
}

async function anfrage(token, pfad, { methode = 'GET', inhalt, wachHalten = false, koepfe = {}, mitKopf = false } = {}) {
  let res;
  const body = inhalt ? JSON.stringify(inhalt) : undefined;
  try {
    res = await netz(API + pfad, {
      method: methode,
      cache: 'no-store',
      /* keepalive laesst eine Anfrage das Schliessen der Seite ueberleben, aber
         nur bis 64 KB - darueber wirft der Browser sofort. */
      keepalive: wachHalten && (body || '').length < 60000,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(inhalt ? { 'Content-Type': 'application/json' } : {}),
        ...koepfe,
      },
      body,
    });
  } catch (e) {
    throw new AbgleichFehler('netz', 'Keine Verbindung zu GitHub');
  }
  /* 304: Seit dem mitgeschickten ETag hat sich nichts geaendert. GitHub rechnet
     diese Antwort nicht auf die Anfragegrenze an, und sie hat keinen Inhalt. */
  if (res.status === 304 && mitKopf) return { unveraendert: true };
  if (res.status === 401) throw new AbgleichFehler('schluessel', 'Der Zugangsschlüssel ist ungültig oder abgelaufen');
  if (res.status === 403 || res.status === 429) {
    const kopf = (n) => (res.headers && res.headers.get ? res.headers.get(n) : null);
    /* Auch die „sekundaere" Bremse antwortet mit 403 - erkennbar an retry-after.
       Als Schluesselfehler gedeutet, hielte sie den Abgleich bis zum naechsten
       Handgriff an. */
    if (kopf('x-ratelimit-remaining') === '0' || kopf('retry-after') || res.status === 429) throw new AbgleichFehler('grenze', 'GitHub bremst gerade – später geht es weiter');
    throw new AbgleichFehler('schluessel', 'Der Zugangsschlüssel darf keine Gists schreiben (Recht „gist“ fehlt)');
  }
  if (res.status === 404) throw new AbgleichFehler('fehlt', 'Nicht gefunden');
  if (!res.ok) throw new AbgleichFehler('server', `GitHub antwortet mit ${res.status}`);
  let daten;
  try { daten = await res.json(); } catch (e) { throw new AbgleichFehler('server', 'GitHub-Antwort unlesbar'); }
  if (!mitKopf) return daten;
  const etag = res.headers && res.headers.get ? res.headers.get('etag') : null;
  return { daten, etag };
}

/* Kurzer Fingerabdruck eines Dateiinhalts (FNV-1a), um zu erkennen, ob eine
   fremde Geraetedatei seit dem letzten Einmischen dieselbe geblieben ist. */
function fingerabdruck(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + text.length;
}

/* Das Gist wird an seiner Beschreibung erkannt, damit ein zweites Geraet nur
   den Schluessel braucht und nicht auch noch eine Gist-Adresse. Gibt es (etwa
   nach gleichzeitiger Ersteinrichtung) mehrere, gilt das aelteste - alle
   Geraete kommen so auf dasselbe. */
async function findeGist(token) {
  const gefunden = [];
  for (let seite = 1; seite <= 10; seite++) {
    const liste = await anfrage(token, `/gists?per_page=100&page=${seite}`);
    if (!Array.isArray(liste)) break;
    gefunden.push(...liste.filter(g => g && g.description === BESCHREIBUNG && g.id));
    if (liste.length < 100) break;
  }
  gefunden.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  return gefunden.length ? gefunden[0].id : null;
}

async function findeOderLegeAn(token) {
  const vorhanden = await findeGist(token);
  if (vorhanden) return vorhanden;
  /* Ohne das Recht „gist" antwortet GitHub auf das Anlegen mit 404 statt 403. */
  const neu = await anfrage(token, '/gists', {
    methode: 'POST',
    inhalt: {
      description: BESCHREIBUNG,
      public: false,
      files: { 'liesmich.md': { content: '# Wissenswerk\n\nHier gleicht die App Wissenswerk deinen Lernstand zwischen deinen Geräten ab. Jede Datei `geraet-….json` gehört zu einem Gerät.\n\nBitte nicht von Hand ändern. Löschst du dieses Gist, legt die App beim nächsten Abgleich ein neues an – der Lernstand auf den Geräten bleibt erhalten.\n' } },
    },
  }).catch((e) => {
    if (e.art === 'fehlt') throw new AbgleichFehler('schluessel', 'Der Zugangsschlüssel darf keine Gists schreiben (Recht „gist“ fehlt)');
    throw e;
  });
  if (!neu || !neu.id) throw new AbgleichFehler('server', 'Gist ließ sich nicht anlegen');
  return neu.id;
}

/* Grosse Dateien kuerzt die Gist-API auf 1 MB und setzt truncated - der
   vollstaendige Inhalt liegt dann unter raw_url. */
async function dateiInhalt(token, datei) {
  if (!datei.truncated && typeof datei.content === 'string') return datei.content;
  if (!datei.raw_url) throw new AbgleichFehler('server', 'Gist-Datei unvollständig');
  let res;
  try { res = await netz(datei.raw_url, { cache: 'no-store' }); }
  catch (e) { throw new AbgleichFehler('netz', 'Keine Verbindung zu GitHub'); }
  if (!res.ok) throw new AbgleichFehler('server', `GitHub antwortet mit ${res.status}`);
  return res.text();
}

/* ---- Abgleich ---- */
let laeuft = null;
let hochLaeuft = null;
/* Was zuletzt wirklich eingemischt wurde - je Gist. Der ETag spart den ganzen
   Abruf (304), die Signatur das Auspacken und Mischen, wenn der Abruf nur
   wegen des eigenen Hochladens neu war. Beides gilt erst, nachdem gemischt
   wurde: Lief gerade eine Einheit, bleibt es beim alten Stand, und der naechste
   Lauf holt alles. Nur im Arbeitsspeicher - nach einem Neustart wird einmal
   vollstaendig gemischt, was ohnehin nichts kaputt machen kann. */
let gemischt = { gist: null, etag: null, signatur: null };
let gistGeprueft = false;
let fehlversuche = 0;
let naechsterVersuch = 0;

const ohneNetz = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/* Der Stand wird gepackt hochgeladen: Ein Jahr Lernen mit allen Karten sind
   rund 600 KB JSON, und ab 1 MB liefert die Gist-API eine Datei nur noch
   gekuerzt aus. Gepackt sind es um die 60 KB - auch fuer das Datenvolumen
   unterwegs der bessere Weg. Ohne CompressionStream (sehr alte Browser) geht
   der Stand ungepackt hinaus; lesen koennen beide Formen alle Geraete. */
const packbar = () => typeof CompressionStream !== 'undefined' && typeof Blob !== 'undefined';

async function packe(text) {
  if (!packbar()) return null;
  const strom = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(strom).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function entpacke(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const strom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(strom).text();
}

/** Die Huelle einer Geraetedatei auspacken. Null, wenn sie keinen Stand traegt. */
export async function standAus(huelle) {
  if (!huelle || typeof huelle !== 'object') return null;
  if (huelle.stand && typeof huelle.stand === 'object') return huelle.stand;
  if (huelle.gzip && typeof huelle.gzip === 'string') {
    /* Kann dieser Browser nicht entpacken (Safari vor iOS 16.4), darf die Datei
       nicht still als leer gelten: Das Geraet hielte sich sonst fuer das
       einzige, und nach dem naechsten iOS-Update ersetzte die Gruppe seinen
       Stand. Lieber ehrlich anhalten. */
    if (typeof DecompressionStream === 'undefined') {
      throw new AbgleichFehler('alt', 'Dieser Browser ist für den Abgleich zu alt (nötig ist iOS 16.4 oder neuer)');
    }
    try { return JSON.parse(await entpacke(huelle.gzip)); } catch (e) { return null; }
  }
  return null;
}

async function paket() {
  const st = store.S();
  const rev = store.standMarke();
  const roh = JSON.stringify(st);
  const kopf = { format: FORMAT, geraet: geraeteKennung(), name: geraeteName(), zeit: jetzt() };
  let gzip = null;
  try { gzip = await packe(roh); } catch (e) { gzip = null; }
  return { rev, text: gzip ? JSON.stringify({ ...kopf, gzip }) : `{"format":${FORMAT},"geraet":${JSON.stringify(kopf.geraet)},"name":${JSON.stringify(kopf.name)},"zeit":${kopf.zeit},"stand":${roh}}` };
}

async function hochladen(k, { wachHalten = false } = {}) {
  const { rev, text } = await paket();
  const name = `geraet-${geraeteKennung()}.json`;
  await anfrage(k.token, `/gists/${k.gist}`, {
    methode: 'PATCH',
    inhalt: { files: { [name]: { content: text } } },
    wachHalten,
  });
  merke({ geschoben: rev });
}

/* Ein Lauf zur Zeit: Start, Sichtbarwerden und Zeitgeber koennen
   zusammenfallen, und zwei gleichzeitige Laeufe luden denselben Stand doppelt
   hoch. Ein zweiter Aufruf bekommt das Ergebnis des laufenden. */
export function abgleichen(opts = {}) {
  if (laeuft) return laeuft;
  laeuft = (hochLaeuft || Promise.resolve()).then(() => mitSperre(() => lauf(opts))).finally(() => { laeuft = null; });
  return laeuft;
}

/* Zwei offene Tabs desselben Geraets (am Mac ganz normal) glichen beide ab und
   luden beide dieselbe Geraetedatei hoch. Mit der Web-Locks-Sperre laeuft
   geraeteweit nur ein Abgleich zur Zeit; ein zweiter Tab laesst seinen Lauf
   aus, statt zu warten - sein Stand kommt ueber den gemeinsamen Speicher
   ohnehin beim ersten an. Ohne Web Locks (aeltere Browser, die Tests) wie
   bisher. */
function mitSperre(fn) {
  const locks = typeof navigator !== 'undefined' && navigator.locks;
  if (!locks || typeof locks.request !== 'function') return fn();
  /* Verwirft der Sperrenmanager selbst (opake Origin, nicht mehr aktives
     Dokument, gesperrte Websitedaten), ohne Sperre laufen wie in Browsern
     ohne Web Locks - lauf() wirft nie, und seine Aufrufer fangen nichts.
     Nur wenn der Rueckruf noch nicht betreten war: Eine Verwerfung aus ihm
     selbst darf lauf() nicht ein zweites Mal starten. */
  let betreten = false;
  let p;
  try {
    p = locks.request('wissenswerk-abgleich', { ifAvailable: true }, (sperre) => {
      betreten = true;
      return sperre ? fn() : { ok: false, art: 'anderer-tab', text: 'Ein anderer Tab gleicht gerade ab – der Stand kommt gleich von selbst an' };
    });
  } catch (e) { return fn(); }
  return Promise.resolve(p).catch((e) => (betreten ? Promise.reject(e) : fn()));
}

async function lauf({ grund = 'hand' } = {}) {
  let k = konfiguration();
  if (!k) return { ok: false, art: 'aus' };
  if (k.pausiert && grund !== 'hand') return { ok: false, art: 'schluessel', text: k.fehler };
  if (grund !== 'hand' && jetzt() < naechsterVersuch) return { ok: false, art: 'warten' };
  if (ohneNetz()) return melde(k, new AbgleichFehler('netz', 'Kein Netz'));
  try {
    if (!k.gist) k = merke({ gist: await findeOderLegeAn(k.token) });
    /* Richten zwei Geraete sich fast gleichzeitig ein, sieht das zweite das
       frisch angelegte Gist in der Liste womoeglich noch nicht und legt ein
       eigenes an - danach glichen beide fuer immer mit sich selbst ab. Einmal je
       App-Start wird deshalb nachgesehen, ob es ein aelteres gibt, und dorthin
       gewechselt. Der Stand geht dabei nicht verloren: Er liegt auf jedem
       Geraet vollstaendig und wird ins richtige Gist neu hochgeladen. */
    /* Am ersten Tag nach dem Verbinden bei jedem App-Start, danach einmal am
       Tag: Die Liste kann bei vielen Gists bis zu zehn Anfragen kosten, und der
       Doppelfall entsteht nur bei der Einrichtung. */
    const TAG = 86400000;
    if (!gistGeprueft && (jetzt() - (k.verbundenAm || 0) < TAG || jetzt() - (k.gistGeprueftAm || 0) > TAG)) {
      const aeltestes = await findeGist(k.token);
      gistGeprueft = true;
      k = merke({ gistGeprueftAm: jetzt() });
      if (aeltestes && aeltestes !== k.gist) k = merke({ gist: aeltestes, geschoben: null });
    }
    if (gemischt.gist !== k.gist) gemischt = { gist: k.gist, etag: null, signatur: null };
    const holen = () => anfrage(k.token, `/gists/${k.gist}`, {
      mitKopf: true,
      koepfe: gemischt.etag && k.verbunden ? { 'If-None-Match': gemischt.etag } : {},
    });
    let antwort;
    try { antwort = await holen(); }
    catch (e) {
      if (e.art !== 'fehlt') throw e;
      /* Das Gist ist weg (von Hand geloescht). Neu suchen oder anlegen; der
         Stand liegt ja auf den Geraeten und kommt mit dem naechsten Hochladen
         wieder hinein. */
      k = merke({ gist: await findeOderLegeAn(k.token), geschoben: null });
      gemischt = { gist: k.gist, etag: null, signatur: null };
      antwort = await holen();
    }
    const eigen = `geraet-${geraeteKennung()}.json`;
    let ergebnis = null, eigeneDa = true, geraete = k.geraete || [];
    if (antwort.unveraendert) {
      ergebnis = { uebernommen: false, sichtbar: false, geaendert: false, unveraendert: true };
    } else {
      const gist = antwort.daten;
      const roh = [];
      for (const [name, datei] of Object.entries((gist && gist.files) || {})) {
        if (!DATEI.test(name) || name === eigen || !datei) continue;
        roh.push({ name, text: await dateiInhalt(k.token, datei) });
      }
      const signatur = roh.map(d => d.name + '=' + fingerabdruck(d.text)).sort().join('|');
      eigeneDa = !!(gist && gist.files && gist.files[eigen]);
      const fremde = [];
      geraete = [];
      for (const { name, text } of roh) {
        let huelle;
        try { huelle = JSON.parse(text); } catch (e) { continue; }   // kaputte Datei: uebergehen
        if (!huelle || typeof huelle !== 'object') continue;
        geraete.push({ name: String(huelle.name || 'Gerät').slice(0, 30), zeit: Number(huelle.zeit) || 0 });
        /* Dieselben fremden Dateien wie beim letzten Einmischen: nichts
           auspacken, nichts mischen. Das ist der Normalfall nach dem eigenen
           Hochladen, das den ETag aendert, ohne dass ein anderes Geraet etwas
           Neues gebracht hat. */
        if (k.verbunden && signatur === gemischt.signatur) continue;
        const stand = await standAus(huelle);
        if (stand) fremde.push({ name, stand });
      }
      if (k.verbunden && signatur === gemischt.signatur) {
        ergebnis = { uebernommen: false, sichtbar: false, geaendert: false, unveraendert: true };
        gemischt.etag = antwort.etag || null;
      } else if (!store.beschaeftigt()) {
        ergebnis = store.geraeteStaendeEinmischen(fremde, bekannteDateien(k.gist));
        if (ergebnis) gemischt = { gist: k.gist, etag: antwort.etag || null, signatur };
      }
      if (ergebnis && !ergebnis.unveraendert) {
        schreib(BEKANNT, { gist: k.gist, dateien: ergebnis.bekannt });
        k = merke({ verbunden: true });
      }
    }
    if (k.verbunden && (!eigeneDa || store.standMarke() !== k.geschoben)) {
      /* Hat das Verlassen der App waehrend des Abrufs schon hochgeladen
         (nurHochladen), erst darauf warten und neu nachsehen - sonst ginge
         derselbe Stand zweimal hinaus. Das eigene Hochladen laeuft unter
         derselben Marke, damit umgekehrt nurHochladen es nicht verdoppelt;
         so ist weiterhin hoechstens ein Hochladen in Flug. */
      if (hochLaeuft) await hochLaeuft;
      k = konfiguration() || k;   // geschoben kann sich waehrend des Abrufs geaendert haben
      if (!eigeneDa || store.standMarke() !== k.geschoben) {
        /* Nach einer Runde mit keepalive: Genau dann legt man das Handy weg
           oder schliesst den Tab, und ein gewoehnlicher PATCH wuerde mit der
           Seite abgebrochen. */
        hochLaeuft = hochladen(k, { wachHalten: grund === 'einheit' }).finally(() => { hochLaeuft = null; });
        await hochLaeuft;
      }
    }
    fehlversuche = 0; naechsterVersuch = 0;
    merke({ zuletzt: jetzt(), fehler: null, art: null, pausiert: false, geraete });
    const meldung = { ok: true, ...(ergebnis || {}), geraete: geraete.length };
    delete meldung.bekannt;
    return meldung;
  } catch (e) {
    return melde(k, e);
  }
}

function melde(k, e) {
  const art = e && e.art ? e.art : 'server';
  const text = e && e.message ? e.message : 'Unbekannter Fehler';
  fehlversuche++;
  /* Bei Netzproblemen wird es spaeter von selbst wieder versucht, mit wachsendem
     Abstand bis hoechstens eine Viertelstunde. Ein ungueltiger Schluessel wird
     davon nicht besser - dann ruht der Abgleich, bis der Nutzer handelt. */
  naechsterVersuch = jetzt() + Math.min(15 * 60000, 15000 * 2 ** Math.min(fehlversuche - 1, 6));
  merke({ fehler: text, art, pausiert: art === 'schluessel' || art === 'alt' });
  if (art !== 'netz' && art !== 'warten') console.warn('Abgleich fehlgeschlagen:', text);
  return { ok: false, art, text };
}

/** Nur hochladen - beim Verlassen der App, wenn keine Zeit fuer einen ganzen Abgleich bleibt. */
/* Beim Verlassen feuern visibilitychange und pagehide kurz nacheinander - ein
   zweites Hochladen desselben Stands waere doppelte Arbeit und sprengte mit
   keepalive das gemeinsame 64-KB-Kontingent. Deshalb auch hier nur einer zur
   Zeit, und die Wartezeit nach einem Fehler gilt auch hier. Ein LAUFENDER
   Abgleich haelt das Hochladen dagegen nicht auf: Nach jeder Runde laeuft
   einer (nachEinheit), also genau dann, wenn man die App verlaesst - solange
   er noch beim Abruf ist, ginge sonst nichts hinaus, und sein eigener PATCH
   stuerbe mit der Seite. Ist er selbst schon beim Hochladen, steht hochLaeuft. */
export function nurHochladen() {
  const k = konfiguration();
  if (!k || !k.gist || !k.verbunden || k.pausiert || hochLaeuft || ohneNetz()) return Promise.resolve(false);
  if (store.standMarke() === k.geschoben || jetzt() < naechsterVersuch) return Promise.resolve(false);
  hochLaeuft = hochladen(k, { wachHalten: true }).then(() => true, () => false)
    .finally(() => { hochLaeuft = null; });
  return hochLaeuft;
}

/** Mit einem Schluessel verbinden. Prueft ihn, findet oder legt das Gist an und gleicht ab. */
export async function verbinden(token) {
  token = String(token || '').trim();
  if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) return { ok: false, art: 'schluessel', text: 'Das sieht nicht nach einem GitHub-Schlüssel aus' };
  try {
    const gist = await findeOderLegeAn(token);
    schreib(KONF, { token, gist, verbunden: false, geschoben: null, zuletzt: 0, fehler: null, verbundenAm: jetzt() });
    fehlversuche = 0; naechsterVersuch = 0; gistGeprueft = true;
    gemischt = { gist: null, etag: null, signatur: null };
  } catch (e) {
    return { ok: false, art: e.art || 'server', text: e.message };
  }
  return abgleichen({ grund: 'hand' });
}

/** Auf diesem Geraet trennen. Der Lernstand bleibt, das Gist auch. */
export function trennen() {
  try { localStorage.removeItem(KONF); } catch (e) { /* gesperrt */ }
  gemischt = { gist: null, etag: null, signatur: null };
}

/* Gleich nach einer Lernrunde hochladen. Bisher wartete der Abgleich bis zum
   naechsten Minutentakt - wer die Runde beendet und das Handy weglegt, war
   dann auf das Hochladen beim Verlassen angewiesen, das iOS bei einem halben
   Hundert Kilobyte nicht immer zu Ende laufen laesst. Kurz gewartet wird nur,
   damit die gebuendelte Speicherung (250 ms) vorher ankommt. */
let nachEinheitTimer = null;
export function nachEinheit(fertig = () => {}) {
  if (!konfiguration()) return;
  clearTimeout(nachEinheitTimer);
  nachEinheitTimer = setTimeout(async () => {
    const k = konfiguration();
    if (!k || store.beschaeftigt()) return;
    fertig(await abgleichen({ grund: 'einheit' }));
  }, 1200);
}

/* ---- Takt ----
   Beim Start und beim Zurueckkehren in die App wird abgeglichen, waehrend der
   Benutzung jede Minute, sofern sich etwas geaendert hat (sonst alle zwei
   Minuten, um fremde Aenderungen zu sehen - dank ETag meist nur eine leere
   304-Antwort), nach jeder Lernrunde sofort, und beim Verlassen nur
   hochgeladen. iOS beendet eine Web-App im Hintergrund ohne Vorwarnung - der
   Minutentakt sorgt dafuer, dass dabei hoechstens eine Minute fehlt, und auch
   die holt das naechste Oeffnen nach. */
let gestartet = false;
export function starte({ nachAbgleich = () => {} } = {}) {
  if (gestartet || typeof document === 'undefined') return;
  gestartet = true;
  let letzterLauf = 0;
  const los = async (grund) => {
    if (!konfiguration()) return;
    letzterLauf = jetzt();
    const r = await abgleichen({ grund });
    nachAbgleich(r);
  };
  setTimeout(() => los('start'), 800);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { nurHochladen(); return; }
    if (jetzt() - letzterLauf > 10000) los('sichtbar');
  });
  window.addEventListener('pagehide', () => { nurHochladen(); });
  window.addEventListener('online', () => { naechsterVersuch = 0; los('online'); });
  setInterval(() => {
    /* Waehrend einer Einheit wird nicht hochgeladen: Der Stand waere nach der
       naechsten Antwort ohnehin wieder alt, und ein halber Megabyte je Minute
       kostet unterwegs Datenvolumen. Verloren geht dabei nichts - die
       Antworten liegen im Geraet, und hochgeladen wird nach der Einheit. */
    if (document.visibilityState !== 'visible' || store.beschaeftigt()) return;
    const k = konfiguration();
    if (!k) return;
    const geaendert = store.standMarke() !== k.geschoben;
    if (geaendert || jetzt() - letzterLauf > 2 * 60000) los('takt');
  }, 60000);
}

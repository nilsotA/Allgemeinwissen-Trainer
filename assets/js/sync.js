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

async function anfrage(token, pfad, { methode = 'GET', inhalt, wachHalten = false } = {}) {
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
      },
      body,
    });
  } catch (e) {
    throw new AbgleichFehler('netz', 'Keine Verbindung zu GitHub');
  }
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
  try { return await res.json(); } catch (e) { throw new AbgleichFehler('server', 'GitHub-Antwort unlesbar'); }
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
  const rev = st.rev;
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
  laeuft = (hochLaeuft || Promise.resolve()).then(() => lauf(opts)).finally(() => { laeuft = null; });
  return laeuft;
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
    if (!gistGeprueft) {
      const aeltestes = await findeGist(k.token);
      gistGeprueft = true;
      if (aeltestes && aeltestes !== k.gist) k = merke({ gist: aeltestes, geschoben: null });
    }
    let gist;
    try { gist = await anfrage(k.token, `/gists/${k.gist}`); }
    catch (e) {
      if (e.art !== 'fehlt') throw e;
      /* Das Gist ist weg (von Hand geloescht). Neu suchen oder anlegen; der
         Stand liegt ja auf den Geraeten und kommt mit dem naechsten Hochladen
         wieder hinein. */
      k = merke({ gist: await findeOderLegeAn(k.token), geschoben: null });
      gist = await anfrage(k.token, `/gists/${k.gist}`);
    }
    const eigen = `geraet-${geraeteKennung()}.json`;
    const fremde = [], geraete = [];
    for (const [name, datei] of Object.entries((gist && gist.files) || {})) {
      if (!DATEI.test(name) || name === eigen || !datei) continue;
      let huelle;
      try { huelle = JSON.parse(await dateiInhalt(k.token, datei)); }
      catch (e) { if (e instanceof AbgleichFehler) throw e; continue; }   // kaputte Datei: uebergehen
      const stand = await standAus(huelle);
      if (!stand) continue;
      fremde.push({ name, stand });
      geraete.push({ name: String(huelle.name || 'Gerät').slice(0, 30), zeit: Number(huelle.zeit) || 0 });
    }
    const eigeneDa = !!(gist && gist.files && gist.files[eigen]);
    let ergebnis = null;
    if (!store.beschaeftigt()) {
      ergebnis = store.geraeteStaendeEinmischen(fremde, bekannteDateien(k.gist));
    }
    if (ergebnis) {
      schreib(BEKANNT, { gist: k.gist, dateien: ergebnis.bekannt });
      k = merke({ verbunden: true });
    }
    if (k.verbunden && (!eigeneDa || store.S().rev !== k.geschoben)) await hochladen(k);
    fehlversuche = 0; naechsterVersuch = 0;
    merke({ zuletzt: jetzt(), fehler: null, art: null, pausiert: false, geraete });
    const antwort = { ok: true, ...(ergebnis || {}), geraete: geraete.length };
    delete antwort.bekannt;
    return antwort;
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
   Zeit, und die Wartezeit nach einem Fehler gilt auch hier. */
export function nurHochladen() {
  const k = konfiguration();
  if (!k || !k.gist || !k.verbunden || k.pausiert || laeuft || hochLaeuft || ohneNetz()) return Promise.resolve(false);
  if (store.S().rev === k.geschoben || jetzt() < naechsterVersuch) return Promise.resolve(false);
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
    schreib(KONF, { token, gist, verbunden: false, geschoben: null, zuletzt: 0, fehler: null });
    fehlversuche = 0; naechsterVersuch = 0; gistGeprueft = true;
  } catch (e) {
    return { ok: false, art: e.art || 'server', text: e.message };
  }
  return abgleichen({ grund: 'hand' });
}

/** Auf diesem Geraet trennen. Der Lernstand bleibt, das Gist auch. */
export function trennen() {
  try { localStorage.removeItem(KONF); } catch (e) { /* gesperrt */ }
}

/* ---- Takt ----
   Beim Start und beim Zurueckkehren in die App wird abgeglichen, waehrend der
   Benutzung jede Minute, sofern sich etwas geaendert hat (sonst alle fuenf
   Minuten, um fremde Aenderungen zu sehen), und beim Verlassen nur
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
    const geaendert = store.S().rev !== k.geschoben;
    if (geaendert || jetzt() - letzterLauf > 5 * 60000) los('takt');
  }, 60000);
}

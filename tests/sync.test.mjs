/* Abgleich zwischen Geraeten (sync.js + geraeteStaendeEinmischen in store.js).

   Jedes Geraet ist eine eigene Kopie von store.js und sync.js mit eigenem
   localStorage und sessionStorage - so verschieden, wie iPhone und Mac es sind.
   GitHub ist ein nachgebautes Gist-Archiv im Speicher, das dieselben Antworten
   gibt wie die echte API (401, 404, truncated/raw_url, PATCH je Datei) und sich
   auf Wunsch Fehler einbauen laesst. Die Geraete laufen nacheinander; vor jedem
   Schritt wird der Speicher des handelnden Geraets eingehaengt. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const JS = new URL('../assets/js/', import.meta.url).pathname;
const TOKEN = 'ghp_' + 'a'.repeat(36);
const KEY = 'wissenswerk.v1';

let aktiv = null;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => aktiv.local });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => aktiv.session });
const speicher = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

/* ---- nachgebautes GitHub ---- */
function github({ kuerzenAb = Infinity } = {}) {
  const gists = new Map();
  let zaehler = 0;
  const g = { gists, anfragen: [], stoerung: null, kuerzenAb };
  const antwort = (status, body, headers = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
  g.fetch = async (url, opt = {}) => {
    const methode = opt.method || 'GET';
    const u = new URL(url);
    g.anfragen.push(`${methode} ${u.pathname}`);
    if (g.stoerung) { const s = g.stoerung; if (s.mal-- <= 1) g.stoerung = null; if (s.art === 'netz') throw new TypeError('Failed to fetch'); return antwort(s.status, { message: 'x' }, s.headers); }
    if (u.host === 'gist.githubusercontent.com') {
      const [id, name] = u.pathname.split('/').filter(Boolean);
      const d = gists.get(id)?.files[name];
      return d ? antwort(200, d) : antwort(404, 'Not Found');
    }
    if ((opt.headers || {}).Authorization !== `Bearer ${TOKEN}`) return antwort(401, { message: 'Bad credentials' });
    const body = opt.body ? JSON.parse(opt.body) : null;
    const teile = u.pathname.split('/').filter(Boolean);
    if (teile[0] !== 'gists') return antwort(404, {});
    if (teile.length === 1 && methode === 'GET') {
      const alle = [...gists.values()].map(x => ({ id: x.id, description: x.description, created_at: x.created_at }));
      const seite = Number(u.searchParams.get('page') || 1);
      return antwort(200, alle.slice((seite - 1) * 100, seite * 100));
    }
    if (teile.length === 1 && methode === 'POST') {
      const id = 'g' + (++zaehler);
      const files = {};
      for (const [n, f] of Object.entries(body.files)) files[n] = f.content;
      gists.set(id, { id, description: body.description, created_at: `2026-01-0${zaehler}T00:00:00Z`, files });
      return antwort(201, { id });
    }
    const gist = gists.get(teile[1]);
    if (!gist) return antwort(404, { message: 'Not Found' });
    if (methode === 'GET') {
      // ETag wie bei GitHub: aendert sich mit jedem Inhalt, 304 bei If-None-Match.
      let h = 0; const roh = JSON.stringify(gist.files);
      for (let i = 0; i < roh.length; i++) h = (h * 31 + roh.charCodeAt(i)) | 0;
      const etag = `W/"${(h >>> 0).toString(16)}"`;
      if ((opt.headers || {})['If-None-Match'] === etag) { g.anfragen.push('304'); return new Response(null, { status: 304 }); }
      const files = {};
      for (const [n, c] of Object.entries(gist.files)) {
        const zuLang = c.length > g.kuerzenAb;
        files[n] = { filename: n, content: zuLang ? c.slice(0, g.kuerzenAb) : c, truncated: zuLang,
                     raw_url: `https://gist.githubusercontent.com/${gist.id}/${n}` };
      }
      return antwort(200, { id: gist.id, files }, { ETag: etag });
    }
    if (methode === 'PATCH') {
      for (const [n, f] of Object.entries(body.files)) {
        if (f === null) delete gist.files[n]; else gist.files[n] = f.content;
      }
      return antwort(200, { id: gist.id });
    }
    return antwort(405, {});
  };
  return g;
}

/* ---- ein Geraet ---- */

async function geraet(gh, vorhanden = null) {
  const dir = mkdtempSync(join(tmpdir(), 'ww-geraet-'));
  copyFileSync(join(JS, 'store.js'), join(dir, 'store.js'));
  copyFileSync(join(JS, 'sync.js'), join(dir, 'sync.js'));
  const g = { local: vorhanden ? vorhanden.local : speicher(), session: speicher(), busy: false };
  aktiv = g;
  g.store = await import(join(dir, 'store.js'));
  g.sync = await import(join(dir, 'sync.js'));
  g.store.setBusyCheck(() => g.busy);
  g.sync.setzeNetz(gh.fetch);
  const mit = (fn) => async (...a) => { aktiv = g; const r = await fn(...a); aktiv = g; return r; };
  g.verbinden = mit((t = TOKEN) => g.sync.verbinden(t));
  g.abgleichen = mit(() => g.sync.abgleichen({ grund: 'hand' }));
  g.tu = (fn) => { aktiv = g; const r = fn(g.store); g.store.save(true); return r; };
  /* Eine Antwort so verbuchen, wie app.js es tut (commit): Karte, Tagesbeitrag, Gesamtzahl. */
  g.lerne = (id, ok = true, zeit = Date.now()) => g.tu((s) => {
    const alt = s.cardState(id);
    s.putCard(id, { ef: 2.5, iv: 1, due: s.todayNum() + 1, reps: (alt?.reps || 0) + 1, lapses: 0,
                    seen: (alt?.seen || 0) + 1, ok: (alt?.ok || 0) + (ok ? 1 : 0), last: zeit });
    s.zaehle('done'); if (ok) s.zaehle('correct');
    s.S().totalAnswers++; if (ok) s.S().totalCorrect++;
    s.touchStreak();
  });
  g.S = () => { aktiv = g; return g.store.S(); };
  return g;
}

const karten = (g) => Object.keys(g.S().cards).sort();

test('zweites Geraet bekommt den Stand des ersten', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.lerne('k1'); A.lerne('k2', false);
  const ra = await A.verbinden();
  assert.equal(ra.ok, true, ra.text);
  assert.equal(gh.gists.size, 1, 'genau ein Gist angelegt');
  const rb = await B.verbinden();
  assert.equal(rb.ok, true, rb.text);
  assert.equal(gh.gists.size, 1, 'B muss das Gist von A finden, nicht ein zweites anlegen');
  assert.deepEqual(karten(B), ['k1', 'k2']);
  assert.equal(B.S().totalAnswers, 2);
  assert.equal(B.S().totalCorrect, 1);
  assert.equal(Object.keys(gh.gists.get('g1').files).filter(n => n.startsWith('geraet-')).length, 2);
});

test('unabhaengig gelernt: beide Seiten bekommen die Summe, nichts geht verloren', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.lerne('a1'); A.lerne('a2'); A.lerne('gemeinsam', true, 1000);
  B.lerne('b1', false); B.lerne('gemeinsam', false, 2000);
  await A.abgleichen(); await B.abgleichen(); await A.abgleichen();
  for (const g of [A, B]) {
    assert.deepEqual(karten(g), ['a1', 'a2', 'b1', 'gemeinsam']);
    assert.equal(g.S().totalAnswers, 5, 'Gesamtzahl ist die Summe beider Geraete');
    assert.equal(g.S().totalCorrect, 3);
    assert.equal(g.store.today().done, 5, 'Tageszahl ist die Summe beider Geraete');
    assert.equal(g.S().cards.gemeinsam.last, 2000, 'der juengere Kartenstand gewinnt');
  }
  // Nochmal abgleichen aendert nichts mehr und laedt nichts hoch.
  const vorher = gh.anfragen.length;
  await A.abgleichen(); await B.abgleichen();
  const neu = gh.anfragen.slice(vorher);
  assert.ok(!neu.some(a => a.startsWith('PATCH')), `unnoetig hochgeladen: ${neu.join(', ')}`);
  assert.equal(A.S().totalAnswers, 5);
});

test('Einstellungen bleiben je Geraet', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.tu(s => s.setSetting('theme', 'dark'));
  B.tu(s => s.setSetting('theme', 'light'));
  await A.verbinden(); await B.verbinden(); await A.abgleichen();
  assert.equal(A.S().settings.theme, 'dark');
  assert.equal(B.S().settings.theme, 'light');
});

test('Zuruecksetzen auf einem Geraet erreicht das andere – mit Netz darunter', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.lerne('x1'); A.lerne('x2');
  await A.abgleichen(); await B.abgleichen();
  assert.deepEqual(karten(B), ['x1', 'x2']);
  A.tu(s => s.resetAll());
  await A.abgleichen();
  const r = await B.abgleichen();
  assert.equal(r.uebernommen, true);
  assert.deepEqual(karten(B), [], 'B muss den geleerten Stand uebernehmen');
  assert.equal(B.S().totalAnswers, 0);
  aktiv = B;
  assert.equal(B.store.sicherungKennzahlen()?.karten, 2, 'der alte Stand muss auf B im Netz liegen');
  // Und A bekommt den alten Stand von B nicht zurueck.
  await A.abgleichen();
  assert.deepEqual(karten(A), []);
});

test('eine liegengebliebene Datei holt den geleerten Stand nicht zurueck', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh), Alt = await geraet(gh);
  await A.verbinden(); Alt.lerne('uralt'); await Alt.verbinden(); await A.abgleichen();
  assert.deepEqual(karten(A), ['uralt']);
  A.tu(s => s.resetAll());
  await A.abgleichen();
  // Das alte Geraet meldet sich nie wieder; seine Datei bleibt liegen.
  await B.verbinden();
  assert.deepEqual(karten(B), [], 'die Datei des alten Geraets traegt eine aeltere Generation');
  await A.abgleichen();
  assert.deepEqual(karten(A), []);
});

test('erster Abgleich vereinigt, auch wenn die Generationen verschieden sind', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  // A hat dreimal ersetzt (Generation 3), B nie - beide haben gelernt.
  A.tu(s => { s.resetAll(); s.resetAll(); s.resetAll(); });
  A.lerne('vonA');
  B.lerne('vonB');
  await A.verbinden(); await B.verbinden(); await A.abgleichen();
  assert.deepEqual(karten(A), ['vonA', 'vonB']);
  assert.deepEqual(karten(B), ['vonA', 'vonB']);
  // B hat die Generation der Gruppe uebernommen: kein spaeteres Ersetzen.
  B.lerne('spaeter');
  await B.abgleichen(); await A.abgleichen();
  assert.deepEqual(karten(A), ['spaeter', 'vonA', 'vonB']);
  assert.equal(A.S().gen, B.S().gen);
});

test('ein frisch verbundenes Geraet mit hoeherer Generation ersetzt die anderen nicht', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.lerne('a'); await A.verbinden();
  B.tu(s => { s.resetAll(); s.resetAll(); });
  B.lerne('b');
  await B.verbinden();
  A.lerne('a2');
  await A.abgleichen();
  assert.deepEqual(karten(A), ['a', 'a2', 'b'], 'A darf nichts verlieren');
});

test('grosse Dateien werden ueber raw_url vollstaendig gelesen', async () => {
  const gh = github({ kuerzenAb: 200 });
  const A = await geraet(gh), B = await geraet(gh);
  for (let i = 0; i < 60; i++) A.lerne('lang-' + i);
  await A.verbinden();
  const r = await B.verbinden();
  assert.equal(r.ok, true, r.text);
  assert.equal(karten(B).length, 60);
  assert.ok(gh.anfragen.some(a => a.startsWith('GET /g1/')), 'raw_url wurde nicht abgerufen');
});

test('falscher Schluessel: klare Meldung, kein Stand geaendert, kein Dauerfeuer', async () => {
  const gh = github();
  const A = await geraet(gh);
  A.lerne('bleibt');
  const r = await A.verbinden('ghp_' + 'b'.repeat(36));
  assert.equal(r.ok, false);
  assert.equal(r.art, 'schluessel');
  assert.match(r.text, /ungültig/);
  assert.deepEqual(karten(A), ['bleibt']);
  assert.equal(A.sync.konfiguration(), null, 'ein abgelehnter Schluessel wird nicht gespeichert');
  const kaputt = await A.verbinden('kein schluessel');
  assert.equal(kaputt.ok, false);
});

test('Schluessel laeuft spaeter ab: Abgleich ruht, bis von Hand neu versucht wird', async () => {
  const gh = github();
  const A = await geraet(gh);
  await A.verbinden();
  gh.stoerung = { status: 401, mal: 1 };
  const r = await A.abgleichen();
  assert.equal(r.art, 'schluessel');
  aktiv = A;
  assert.equal(A.sync.konfiguration().pausiert, true);
  const auto = await A.sync.abgleichen({ grund: 'takt' });
  assert.equal(auto.ok, false, 'automatisch wird nicht weiter angefragt');
  const hand = await A.abgleichen();
  assert.equal(hand.ok, true, 'von Hand geht es wieder, sobald GitHub annimmt');
});

test('Netzabbruch beim Hochladen: nichts verloren, der naechste Lauf holt es nach', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.lerne('unterwegs');
  // GET gelingt, PATCH bricht ab
  const echt = gh.fetch;
  let patchFaellt = true;
  A.sync.setzeNetz(async (url, opt = {}) => {
    if ((opt.method || 'GET') === 'PATCH' && patchFaellt) { patchFaellt = false; throw new TypeError('Load failed'); }
    return echt(url, opt);
  });
  const r = await A.abgleichen();
  assert.equal(r.ok, false); assert.equal(r.art, 'netz');
  assert.deepEqual(karten(A), ['unterwegs']);
  const auto = await A.sync.abgleichen({ grund: 'takt' });
  assert.equal(auto.art, 'warten', 'automatische Versuche halten Abstand');
  assert.equal((await A.abgleichen()).ok, true);
  await B.abgleichen();
  assert.deepEqual(karten(B), ['unterwegs']);
});

test('geloeschtes Gist wird neu angelegt, der Stand kommt wieder hinein', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.lerne('k'); await A.verbinden(); await B.verbinden();
  gh.gists.clear();
  const r = await A.abgleichen();
  assert.equal(r.ok, true, r.text);
  assert.equal(gh.gists.size, 1);
  await B.abgleichen();
  assert.deepEqual(karten(B), ['k']);
  assert.equal(Object.keys([...gh.gists.values()][0].files).filter(n => n.startsWith('geraet-')).length, 2);
});

test('waehrend einer Einheit wird nicht gemischt, aber auch nichts verloren', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  B.lerne('vonB'); await B.abgleichen();
  A.busy = true;
  A.lerne('inDerEinheit');
  await A.abgleichen();
  assert.deepEqual(karten(A), ['inDerEinheit'], 'mitten in der Einheit darf der Stand nicht getauscht werden');
  A.busy = false;
  await A.abgleichen(); await B.abgleichen();
  assert.deepEqual(karten(A), ['inDerEinheit', 'vonB']);
  assert.deepEqual(karten(B), ['inDerEinheit', 'vonB']);
});

test('kaputte oder fremde Dateien im Gist werden uebergangen', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.lerne('gut'); await A.verbinden();
  const files = gh.gists.get('g1').files;
  files['geraet-kaputt1.json'] = '{"stand": {"cards": ';
  files['geraet-fremd12.json'] = JSON.stringify({ stand: { cards: 'nein' } });
  files['notiz.txt'] = 'hallo';
  files['geraet-boese12.json'] = JSON.stringify({ stand: { cards: { boese: { ef: 'x', last: 1e300, seen: -5 } }, totalAnswers: 1e99 } });
  const r = await B.verbinden();
  assert.equal(r.ok, true, r.text);
  assert.ok(karten(B).includes('gut'));
  assert.ok(B.S().totalAnswers <= 1e8 + 1, `Fremdwerte werden gedeckelt: ${B.S().totalAnswers}`);
  assert.equal(B.S().cards.boese.ef, 2.5);
});

test('gleichzeitige Aufrufe teilen sich einen Lauf', async () => {
  const gh = github();
  const A = await geraet(gh);
  await A.verbinden();
  A.lerne('eins');
  aktiv = A;
  const vorher = gh.anfragen.length;
  const [r1, r2, r3] = await Promise.all([A.sync.abgleichen(), A.sync.abgleichen(), A.sync.abgleichen()]);
  assert.equal(r1, r2); assert.equal(r2, r3);
  assert.equal(gh.anfragen.slice(vorher).filter(a => a.startsWith('PATCH')).length, 1);
});

test('der Schluessel steht nie in der Sicherungsdatei', async () => {
  const gh = github();
  const A = await geraet(gh);
  await A.verbinden();
  aktiv = A;
  assert.ok(!A.store.exportJSON().includes(TOKEN));
  assert.ok(!(A.local.getItem(KEY) || '').includes(TOKEN));
  const datei = Object.values(gh.gists.get('g1').files).join('\n');
  assert.ok(!datei.includes(TOKEN), 'der Schluessel darf nicht ins Gist');
});

test('Trennen behaelt Lernstand und Geraetekennung', async () => {
  const gh = github();
  const A = await geraet(gh);
  A.lerne('k'); await A.verbinden();
  aktiv = A;
  const kennung = A.sync.geraeteKennung();
  A.sync.trennen();
  assert.equal(A.sync.konfiguration(), null);
  assert.deepEqual(karten(A), ['k']);
  await A.verbinden();
  aktiv = A;
  assert.equal(A.sync.geraeteKennung(), kennung);
  assert.equal(Object.keys(gh.gists.get('g1').files).filter(n => n.startsWith('geraet-')).length, 1,
    'Wiederverbinden darf keine zweite Datei desselben Geraets anlegen');
});

test('Markierungen und ihre Loeschung wandern mit', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.tu(s => s.toggleFlag('stern'));
  await A.abgleichen(); await B.abgleichen();
  aktiv = B; assert.equal(B.store.isFlagged('stern'), true);
  B.tu(s => s.toggleFlag('stern'));
  await B.abgleichen(); await A.abgleichen();
  aktiv = A; assert.equal(A.store.isFlagged('stern'), false, 'der geloeschte Stern kommt nicht zurueck');
});

test('drei Geraete, durcheinander gelernt und abgeglichen, enden gleich', async () => {
  const gh = github();
  const G = [await geraet(gh), await geraet(gh), await geraet(gh)];
  for (const g of G) await g.verbinden();
  let t = 1;
  for (let runde = 0; runde < 6; runde++) {
    for (const [i, g] of G.entries()) {
      for (let j = 0; j < 3; j++) g.lerne(`k${(runde * 7 + i * 3 + j) % 11}`, j !== 1, t++);
      if ((runde + i) % 2) await g.abgleichen();
    }
  }
  for (let i = 0; i < 2; i++) for (const g of G) await g.abgleichen();
  const erwartet = 6 * 3 * 3;
  for (const g of G) {
    assert.equal(g.S().totalAnswers, erwartet, 'jede Antwort genau einmal gezaehlt');
    assert.equal(g.S().totalCorrect, 6 * 3 * 2);
  }
  const bild = (g) => JSON.stringify(Object.entries(g.S().cards).sort());
  assert.equal(bild(G[0]), bild(G[1]));
  assert.equal(bild(G[1]), bild(G[2]));
});

test('gepackt und ungepackt verstehen sich', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  const echt = globalThis.CompressionStream;
  A.lerne('alt');
  try {
    globalThis.CompressionStream = undefined;          // A: Browser ohne Packen
    await A.verbinden();
  } finally { globalThis.CompressionStream = echt; }
  const datei = Object.entries(gh.gists.get('g1').files).find(([n]) => n.startsWith('geraet-'))[1];
  assert.ok(JSON.parse(datei).stand, 'ohne CompressionStream muss der Stand lesbar im Klartext liegen');
  B.lerne('neu');
  await B.verbinden(); await A.abgleichen();
  assert.deepEqual(karten(A), ['alt', 'neu']);
  assert.deepEqual(karten(B), ['alt', 'neu']);
  const dateiB = Object.entries(gh.gists.get('g1').files).filter(([n]) => n.startsWith('geraet-')).map(([, c]) => JSON.parse(c));
  assert.ok(dateiB.some(h => typeof h.gzip === 'string'), 'B packt');
});

test('ein voller Stand bleibt gepackt weit unter der Gist-Grenze von 1 MB', async () => {
  const gh = github();
  const A = await geraet(gh);
  A.tu((s) => {
    const st = s.S();
    for (let i = 0; i < 6000; i++) {
      st.cards[`kat-${(1e6 + i * 7919).toString(36)}`] = { ef: 2.36 + (i % 7) / 100, iv: i % 200, due: 20800 + (i % 90),
        reps: i % 12, lapses: i % 3, seen: i % 15, ok: i % 13, last: 1790000000000 + i * 61733 };
    }
    for (let d = 0; d < 730; d++) {
      const k = s.numToKey(20000 + d);
      st.days[k] = { done: 60, correct: 50, newC: 12, sec: 900,
        je: { [`t${d}a`]: { done: 30, correct: 25, newC: 6, sec: 450, n: 30 }, [`t${d}b`]: { done: 30, correct: 25, newC: 6, sec: 450, n: 30 } } };
    }
  });
  await A.verbinden();
  const datei = Object.entries(gh.gists.get('g1').files).find(([n]) => n.startsWith('geraet-'))[1];
  assert.ok(datei.length < 400000, `gepackt ${datei.length} Zeichen`);
  const B = await geraet(gh);
  await B.verbinden();
  assert.equal(karten(B).length, 6000);
});

test('zwei gleichzeitig angelegte Gists: alle wechseln ins aeltere', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.lerne('a'); await A.verbinden();
  // B sieht das Gist von A (noch) nicht und legt ein eigenes an.
  const echt = gh.fetch;
  B.sync.setzeNetz(async (url, opt = {}) => {
    const u = new URL(url);
    if (u.pathname === '/gists' && (opt.method || 'GET') === 'GET') return new Response('[]', { status: 200 });
    return echt(url, opt);
  });
  B.lerne('b'); await B.verbinden();
  assert.equal(gh.gists.size, 2);
  // Neuer App-Start auf B: frische Module, derselbe Speicher.
  const B2 = await geraet(gh, B);
  assert.deepEqual(karten(B2), ['b'], 'der neue Start liest den abgelegten Stand');
  await B2.abgleichen();
  assert.equal(B2.sync.konfiguration().gist, 'g1', 'B muss ins aeltere Gist wechseln');
  assert.deepEqual(karten(B2), ['a', 'b']);
  await A.abgleichen();
  assert.deepEqual(karten(A), ['a', 'b']);
});

/* ---- Befunde der Gegenpruefung: jeder Fall schlug gegen die erste Fassung fehl ---- */

test('viele Kaltstarts an einem Tag: die Tageszahl bleibt die Summe und steigt nicht weiter', async () => {
  // Jeder Kaltstart der Home-Bildschirm-App ist eine neue Tab-Kennung. Ueber
  // dem Deckel von 64 landeten Beitraege doppelt im gemeinsamen Sammelblock.
  const gh = github();
  const G = [await geraet(gh), await geraet(gh), await geraet(gh)];
  for (const g of G) await g.verbinden();
  for (let i = 0; i < 22; i++) {
    for (let j = 0; j < G.length; j++) { G[j] = await geraet(gh, G[j]); G[j].lerne(`s${j}-${i}`); }
  }
  for (let runde = 0; runde < 4; runde++) for (const g of G) await g.abgleichen();
  for (const g of G) assert.equal(g.store.today().done, 66);
  const vorher = gh.anfragen.length;
  for (const g of G) await g.abgleichen();
  assert.ok(!gh.anfragen.slice(vorher).some(a => a.startsWith('PATCH')), 'der Stand muss zur Ruhe kommen');
});

test('eine zurueckgenommene Antwort verschwindet auch auf dem anderen Geraet', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.lerne('k1');
  await A.abgleichen(); await B.abgleichen();
  assert.equal(B.store.today().done, 1);
  A.tu((s) => {                                     // wie undoLast() in app.js
    const st = s.S(), k = s.dayKey();
    delete st.cards.k1; delete st.days[k];
    s.beitragZurueck(k);
    st.totalAnswers = 0; st.totalCorrect = 0;
  });
  await A.abgleichen(); await B.abgleichen();
  assert.equal(B.store.today().done, 0, 'der leere Block mit hoeherer Fassung muss ankommen');
  assert.equal(B.S().totalAnswers, 0);
});

test('Sicherung eingelesen, dann verbunden: der naechste Start ersetzt die anderen nicht', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  for (let i = 0; i < 5; i++) A.lerne('a' + i);
  aktiv = A; const datei = A.store.exportJSON();
  B.tu(s => s.importJSON(datei));                   // klassische Uebertragung: B hat Generation 1
  await A.verbinden(); await B.verbinden();
  const B2 = await geraet(gh, B);                   // naechster Start auf B
  A.lerne('neuAufA'); await A.abgleichen();
  B2.lerne('neuAufB'); await B2.abgleichen();
  A.lerne('neuAufA2');
  const r = await A.abgleichen();
  assert.equal(r.uebernommen, false);
  assert.ok(['neuAufA', 'neuAufA2', 'neuAufB'].every(k => karten(A).includes(k)), karten(A).join(','));
});

test('ein zweiter offener Tab bringt keine Generation zurueck, die die anderen ersetzt', async () => {
  const gh = github();
  const A = await geraet(gh);
  for (let i = 0; i < 5; i++) A.lerne('a' + i);
  await A.verbinden();
  const B1 = await geraet(gh);
  B1.tu(s => s.importJSON(JSON.stringify({ cards: { imp: { last: 5, seen: 1 } } })));
  B1.lerne('b');
  const B2 = await geraet(gh, B1);                  // zweiter Tab, gleicher Speicher
  await B1.verbinden();
  B2.lerne('inTab2');
  A.lerne('neu1'); await A.abgleichen();
  await B1.abgleichen();
  A.lerne('neu2');
  const r = await A.abgleichen();
  assert.equal(r.uebernommen, false);
  assert.ok(['neu1', 'neu2', 'imp', 'b'].every(k => karten(A).includes(k)), karten(A).join(','));
});

test('Wechsel ins aeltere Gist vereinigt, auch bei verschiedenen Generationen', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.tu(s => s.importJSON(JSON.stringify({ cards: { ausBackup: { last: 5, seen: 1 } } })));
  A.lerne('a'); await A.verbinden();
  const echt = gh.fetch;
  B.sync.setzeNetz(async (url, opt = {}) => {
    if (new URL(url).pathname === '/gists' && (opt.method || 'GET') === 'GET') return new Response('[]', { status: 200 });
    return echt(url, opt);
  });
  for (let i = 0; i < 30; i++) B.lerne('b' + i);
  await B.verbinden();
  const B2 = await geraet(gh, B);
  await B2.abgleichen();
  assert.equal(karten(B2).length, 32, 'die 30 Karten von B muessen bleiben');
  await A.abgleichen();
  assert.equal(karten(A).length, 32);
});

test('ein Browser ohne Entpacken haelt ehrlich an, statt sich fuer allein zu halten', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.tu(s => s.resetAll());
  A.lerne('a'); await A.verbinden();
  const CS = globalThis.CompressionStream, DS = globalThis.DecompressionStream;
  let r;
  try {
    globalThis.CompressionStream = undefined; globalThis.DecompressionStream = undefined;
    B.lerne('b');
    r = await B.verbinden();
  } finally { globalThis.CompressionStream = CS; globalThis.DecompressionStream = DS; }
  assert.equal(r.ok, false); assert.equal(r.art, 'alt');
  aktiv = B; assert.equal(B.sync.konfiguration().verbunden, false, 'nichts hochladen, solange nicht gemischt ist');
  B.lerne('b2');                                     // spaeter: iOS aktualisiert
  assert.equal((await B.abgleichen()).ok, true);
  await A.abgleichen();
  assert.deepEqual(karten(A), ['a', 'b', 'b2']);
});

test('neuer Schluessel nach einem Zuruecksetzen holt die alten Staende nicht zurueck', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.lerne('alt1'); A.lerne('alt2'); await A.abgleichen(); await B.abgleichen();
  gh.stoerung = { status: 401, mal: 1 }; await A.abgleichen();
  A.tu(s => s.resetAll());
  await A.verbinden();
  assert.deepEqual(karten(A), [], 'das Zuruecksetzen muss gelten');
  await B.abgleichen();
  assert.deepEqual(karten(B), [], 'und auch das andere Geraet erreichen');
  aktiv = A; A.sync.trennen();
  await A.verbinden();
  assert.deepEqual(karten(A), [], 'auch nach Trennen und Wiederverbinden');
});

test('die sekundaere Bremse von GitHub haelt den Abgleich nicht an', async () => {
  const gh = github();
  const A = await geraet(gh);
  await A.verbinden();
  gh.stoerung = { status: 403, mal: 1, headers: { 'retry-after': '60' } };
  const r = await A.abgleichen();
  assert.equal(r.art, 'grenze');
  aktiv = A; assert.equal(A.sync.konfiguration().pausiert, false);
});

test('Verlassen der App laedt genau einmal hoch', async () => {
  const gh = github();
  const A = await geraet(gh);
  await A.verbinden();
  A.lerne('x');
  aktiv = A;
  const vorher = gh.anfragen.length;
  const [a, b] = await Promise.all([A.sync.nurHochladen(), A.sync.nurHochladen()]);
  assert.equal(a, true); assert.equal(b, false);
  assert.equal(gh.anfragen.slice(vorher).filter(x => x.startsWith('PATCH')).length, 1);
});

test('voller Speicher: der Abgleich laedt die neuen Antworten trotzdem hoch', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  const echt = A.local.setItem;
  A.local.setItem = (k, v) => { if (k === KEY) { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; } return echt(k, v); };
  try {
    A.lerne('nurImSpeicher');
    const r = await A.abgleichen();
    assert.equal(r.ok, true, r.text);
  } finally { A.local.setItem = echt; }
  await B.abgleichen();
  assert.ok(karten(B).includes('nurImSpeicher'), 'die Antwort muss das andere Geraet erreichen');
});

test('die Gist-Liste wird nicht bei jedem Start abgefragt', async () => {
  const gh = github();
  const A = await geraet(gh);
  let jetzt = Date.now();
  aktiv = A; A.sync.setzeUhr(() => jetzt);
  await A.verbinden();
  jetzt += 3 * 86400000;                              // drei Tage spaeter
  const listen = () => gh.anfragen.filter(a => a === 'GET /gists').length;
  const B1 = await geraet(gh, A); B1.sync.setzeUhr(() => jetzt);
  await B1.abgleichen();
  const nachErstemStart = listen();
  const B2 = await geraet(gh, A); B2.sync.setzeUhr(() => jetzt + 60000);
  await B2.abgleichen();
  assert.equal(listen(), nachErstemStart, 'am selben Tag kein zweites Mal');
});


/* ---- Optimierungen: ETag, Signatur, Einstellungen, nach der Runde, Tab-Sperre ---- */

test('nichts Neues im Gist: der Abruf endet mit 304, ohne Download und ohne Hochladen', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.lerne('a'); await A.verbinden(); B.lerne('b'); await B.verbinden();
  await A.abgleichen();                 // A mischt B ein und laedt hoch
  await A.abgleichen();                 // eigenes Hochladen hat den ETag geaendert: einmal voll, dann gemerkt
  const vorher = gh.anfragen.length;
  const r = await A.abgleichen();
  const neu = gh.anfragen.slice(vorher);
  assert.equal(r.ok, true);
  assert.deepEqual(neu, ['GET /gists/g1', '304'], neu.join(', '));
});

test('nach dem eigenen Hochladen wird nichts neu eingemischt, was schon da war', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  B.lerne('b'); await B.verbinden(); await A.verbinden();
  A.lerne('a2');
  const r1 = await A.abgleichen();      // laedt hoch
  assert.equal(r1.ok, true);
  const r2 = await A.abgleichen();      // voller Abruf wegen eigenem Upload, Datei von B unveraendert
  assert.equal(r2.unveraendert, true, JSON.stringify(r2));
  B.lerne('b2'); await B.abgleichen();
  const r3 = await A.abgleichen();      // jetzt hat B etwas Neues gebracht
  assert.ok(!r3.unveraendert);
  assert.ok(karten(A).includes('b2'));
});

test('nach einem 304 kommt eine spaetere fremde Aenderung trotzdem an', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden(); await A.abgleichen(); await A.abgleichen(); await A.abgleichen();
  assert.equal(gh.anfragen.at(-1), '304');
  B.lerne('spaet'); await B.abgleichen();
  await A.abgleichen();
  assert.ok(karten(A).includes('spaet'));
});

test('ETag gilt erst nach dem Einmischen: lief eine Einheit, wird beim naechsten Mal voll geholt', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden(); await A.abgleichen(); await A.abgleichen();
  B.lerne('waehrend'); await B.abgleichen();
  A.busy = true; await A.abgleichen(); A.busy = false;
  assert.ok(!karten(A).includes('waehrend'));
  await A.abgleichen();
  assert.ok(karten(A).includes('waehrend'), 'der verpasste Stand muss beim naechsten Lauf kommen');
});

test('Lerneinstellungen wandern mit, Farbschema und Ton nicht', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.tu(s => { s.setSetting('newPerDay', 25); s.setSetting('focus', ['spo', 'mat']); s.setSetting('theme', 'dark'); s.setSetting('sound', false); });
  B.tu(s => s.setSetting('theme', 'light'));
  await A.abgleichen();
  const r = await B.abgleichen();
  assert.equal(r.einstellungen, true);
  assert.equal(r.sichtbar, true);
  assert.equal(B.S().settings.newPerDay, 25);
  assert.deepEqual(B.S().settings.focus, ['spo', 'mat']);
  assert.equal(B.S().settings.theme, 'light', 'das Farbschema bleibt je Geraet');
  assert.equal(B.S().settings.sound, true, 'der Ton bleibt je Geraet');
});

test('bei Einstellungen gewinnt die zuletzt gemachte Aenderung, auf beiden Seiten', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.tu(s => s.setSetting('newPerDay', 8));
  await new Promise(r => setTimeout(r, 5));
  B.tu(s => s.setSetting('newPerDay', 20));
  await A.abgleichen(); await B.abgleichen(); await A.abgleichen();
  assert.equal(A.S().settings.newPerDay, 20);
  assert.equal(B.S().settings.newPerDay, 20);
});

test('ein frisches Geraet uebernimmt die Lerneinstellungen der Gruppe', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  A.tu(s => s.setSetting('cats', ['spo', 'mat', 'geo'])); await A.verbinden();
  await B.verbinden();
  assert.deepEqual(B.S().settings.cats, ['spo', 'mat', 'geo']);
});

test('zwei Tabs: der andere Tab schreibt eine neuere Einstellung nicht zurueck', async () => {
  const gh = github();
  const A = await geraet(gh);
  A.tu(s => s.setSetting('newPerDay', 12));
  const A2 = await geraet(gh, A);       // zweiter Tab, gleicher Speicher, eigener Arbeitsstand
  A.tu(s => s.setSetting('newPerDay', 30));
  A2.lerne('im zweiten Tab');           // speichert und mischt dabei den abgelegten Stand ein
  assert.equal(A2.S().settings.newPerDay, 30);
  assert.equal(JSON.parse(A.local.getItem(KEY)).settings.newPerDay, 30);
});

test('nach einer Lernrunde wird gleich hochgeladen, nicht erst im Minutentakt', async () => {
  const gh = github();
  const A = await geraet(gh), B = await geraet(gh);
  await A.verbinden(); await B.verbinden();
  A.lerne('frisch');
  aktiv = A;
  let fertig = null;
  A.sync.nachEinheit((r) => { fertig = r; });
  await new Promise(r => setTimeout(r, 1600));
  assert.equal(fertig && fertig.ok, true);
  await B.abgleichen();
  assert.ok(karten(B).includes('frisch'));
});

test('ein zweiter Tab laesst seinen Lauf aus, solange der erste abgleicht', async () => {
  const gh = github();
  const A = await geraet(gh);
  await A.verbinden();
  aktiv = A;
  const vorher = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (n, o, fn) => Promise.resolve(fn(null)) } });
  try {
    const r = await A.sync.abgleichen();
    assert.equal(r.art, 'anderer-tab');
    assert.equal(A.sync.konfiguration().fehler, null, 'kein Fehler, nur ausgelassen');
  } finally {
    if (vorher) Object.defineProperty(navigator, 'locks', vorher); else delete navigator.locks;
  }
  const frei = await A.abgleichen();
  assert.equal(frei.ok, true);
});

/* Tests fuer den Quizmodus: Ziehung, Punkte, Auswertung, Speicherform.
   Reine Funktionen mit festem Zufall - nichts hier braucht einen Browser. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const speicher = new Map();
globalThis.localStorage = {
  getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k),
};

const store = await import('../assets/js/store.js');
const { CARDS, CATS } = await import('../data/index.js');
const { fresh } = await import('../assets/js/srs.js');
const q = await import('../assets/js/quizmodus.js');

/* Ein kleiner linearer Kongruenzgenerator: derselbe Startwert, dieselbe Folge.
   Damit laesst sich eine Ziehung wiederholen und vergleichen. */
const festerZufall = (saat) => () => {
  saat = (saat * 1664525 + 1013904223) % 4294967296;
  return saat / 4294967296;
};

beforeEach(() => store.resetAll());

test('die Punkteformel: zehn fuer den Treffer, fuenf dazu fuer Tempo', () => {
  assert.equal(q.punkte(true, 0), 15);
  assert.equal(q.punkte(true, q.BLITZ_MS), 15, 'die Grenze zaehlt noch als Blitz');
  assert.equal(q.punkte(true, q.BLITZ_MS + 1), 10);
  assert.equal(q.punkte(true, q.FRIST_MS), 10);
  assert.equal(q.punkte(false, 100), 0, 'schnell danebengreifen bringt nichts');
  assert.equal(q.MAX_JE_FRAGE, 15);
});

test('eine Runde fragt jedes Thema, ohne eine Karte doppelt zu ziehen', () => {
  const runde = q.ziehung(CARDS, { zufall: festerZufall(7) });
  assert.equal(runde.length, q.FRAGEN_JE_RUNDE);
  assert.equal(new Set(runde.map(x => x.card.id)).size, runde.length, 'doppelte Karte');
  const themen = new Set(runde.map(x => x.card.cat));
  assert.equal(themen.size, CATS.length, `nur ${themen.size} von ${CATS.length} Themen`);
  assert.ok(runde.every(x => x.fresh === false), 'die Form muss zu startRun passen');
});

test('die Schwierigkeit steigt wie im Quiz: erst Basis, zuletzt Profi', () => {
  const runde = q.ziehung(CARDS, { zufall: festerZufall(11) });
  const stufen = runde.map(x => x.card.d);
  assert.deepEqual(stufen.slice(0, 4), [1, 1, 1, 1], `Anfang: ${stufen}`);
  assert.deepEqual(stufen.slice(-4), [3, 3, 3, 3], `Ende: ${stufen}`);
  for (let i = 1; i < stufen.length; i++) assert.ok(stufen[i] >= stufen[i - 1], `faellt bei ${i}: ${stufen}`);
});

test('derselbe Zufall ergibt dieselbe Runde, ein anderer eine andere', () => {
  const a = q.ziehung(CARDS, { zufall: festerZufall(3) }).map(x => x.card.id);
  const b = q.ziehung(CARDS, { zufall: festerZufall(3) }).map(x => x.card.id);
  const c = q.ziehung(CARDS, { zufall: festerZufall(4) }).map(x => x.card.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('die Ziehung bleibt im uebergebenen Pool', () => {
  const pool = CARDS.filter(c => c.cat === 'spo' || c.cat === 'geo');
  const runde = q.ziehung(pool, { zufall: festerZufall(5) });
  assert.equal(runde.length, q.FRAGEN_JE_RUNDE);
  assert.ok(runde.every(x => x.card.cat === 'spo' || x.card.cat === 'geo'));
  assert.ok(runde.some(x => x.card.cat === 'spo') && runde.some(x => x.card.cat === 'geo'));
});

test('auch nie gesehene Karten werden gezogen - ein Quiz fragt alles', () => {
  // Ohne jeden Kartenstand darf die Ziehung nicht leer ausgehen (das Duell wuerde hier duenn).
  const runde = q.ziehung(CARDS, { zufall: festerZufall(9), stand: () => null });
  assert.equal(runde.length, q.FRAGEN_JE_RUNDE);
});

test('die Zusatzplaetze holen Wackelkandidaten unter Zeitdruck zurueck', () => {
  /* Ein Pool aus einem einzigen Thema: Nach dem ersten Platz ist jeder weitere
     ein Zusatzplatz. Fuenf Karten wackeln - sie muessen alle in der Runde sein. */
  const pool = CARDS.filter(c => c.cat === 'nat' && c.d === 3).slice(0, 40);
  assert.ok(pool.length >= 20, 'der Test braucht genug Profi-Karten');
  const wackler = new Set(pool.slice(10, 15).map(c => c.id));
  const stand = (id) => wackler.has(id)
    ? { ...fresh(), seen: 6, ok: 2, reps: 1, iv: 1, lapses: 4 }     // isLeech: lapses >= 4, strength < 0.45
    : { ...fresh(), seen: 8, ok: 8, reps: 6, iv: 120 };              // sitzt fest
  const runde = q.ziehung(pool, { zufall: festerZufall(2), stand });
  const gezogen = new Set(runde.map(x => x.card.id));
  for (const id of wackler) assert.ok(gezogen.has(id), `Wackelkandidat ${id} fehlt in der Runde`);
});

test('die Auswertung sagt, wo die Punkte verloren gingen', () => {
  const k = (cat) => ({ cat, id: 'x-' + cat + Math.random() });
  const antworten = [
    { card: k('geo'), ok: true, abgelaufen: false, punkte: 15 },
    { card: k('geo'), ok: false, abgelaufen: true, punkte: 0 },     // zu langsam
    { card: k('ges'), ok: true, abgelaufen: false, punkte: 10 },     // ohne Blitz
    { card: k('spo'), ok: false, abgelaufen: false, punkte: 0 },    // falsch
    { card: k('spo'), ok: false, abgelaufen: false, punkte: 0 },
  ];
  const aw = q.auswertung(antworten, ['ges', 'geo', 'spo']);
  assert.equal(aw.punkte, 25);
  assert.equal(aw.max, 75);
  assert.deepEqual([aw.richtig, aw.falsch, aw.langsam, aw.blitzVerpasst], [2, 2, 1, 1]);
  assert.deepEqual([aw.verlorenFalsch, aw.verlorenLangsam, aw.verlorenBlitz], [30, 15, 5]);
  assert.deepEqual(aw.felder.map(f => f.cat), ['spo', 'geo', 'ges'], 'groesster Verlust zuerst');
  const geo = aw.felder.find(f => f.cat === 'geo');
  assert.deepEqual([geo.richtig, geo.falsch, geo.langsam, geo.punkte, geo.max, geo.verloren], [1, 0, 1, 15, 30, 15]);
});

test('bei gleichem Verlust entscheidet die Themenreihenfolge, nicht der Zufall', () => {
  const antworten = [
    { card: { cat: 'spo' }, ok: false, abgelaufen: false, punkte: 0 },
    { card: { cat: 'geo' }, ok: false, abgelaufen: false, punkte: 0 },
  ];
  assert.deepEqual(q.auswertung(antworten, ['geo', 'spo']).felder.map(f => f.cat), ['geo', 'spo']);
  assert.deepEqual(q.auswertung(antworten, ['spo', 'geo']).felder.map(f => f.cat), ['spo', 'geo']);
});

test('der Speichereintrag ist knapp und traegt je Thema Punkte und Maximum', () => {
  const aw = q.auswertung([
    { card: { cat: 'geo' }, ok: true, abgelaufen: false, punkte: 15 },
    { card: { cat: 'spo' }, ok: false, abgelaufen: true, punkte: 0 },
  ], ['geo', 'spo']);
  const e = q.rundenEintrag(aw, 1234);
  assert.deepEqual(e, { t: 1234, p: 15, m: 30, r: 1, f: 0, l: 1, k: { spo: [0, 15], geo: [15, 15] } });
});

test('das schwaechste Feld ist das mit den meisten verlorenen Punkten', () => {
  const runden = [
    { t: 1, k: { geo: [15, 30], spo: [20, 30] } },
    { t: 2, k: { geo: [30, 30], spo: [0, 15], ges: [10, 15] } },
  ];
  assert.deepEqual(q.schwaechstesFeld(runden), { cat: 'spo', verloren: 25 }, 'ueber die Runden summiert');
  assert.equal(q.schwaechstesFeld([]), null);
  assert.equal(q.schwaechstesFeld([{ t: 3, k: { geo: [30, 30] } }]), null, 'nichts verloren, nichts zu sagen');
});

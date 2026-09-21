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
const { fresh, strength, isLeech } = await import('../assets/js/srs.js');
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

/* Ein Lernstand wie nach zwei Wochen: ein Teil der Karten gesehen, ein Fuenftel
   davon wacklig. Die Ziehung bekommt ihn als stand() herein. */
function lernstand(pool, anteil, saat) {
  const r = festerZufall(saat);
  const stand = new Map();
  for (const c of pool.slice().sort(() => r() - 0.5).slice(0, Math.round(pool.length * anteil))) {
    stand.set(c.id, r() < 0.2
      ? { ...fresh(), seen: 6, ok: 2, reps: 1, iv: 1, lapses: 4 }    // isLeech: lapses >= 4, strength < 0.45
      : { ...fresh(), seen: 8, ok: 8, reps: 6, iv: 120 });           // sitzt fest
  }
  return stand;
}
const wackeltNach = (stand) => (c) => {
  const s = stand.get(c.id);
  return !!s && s.seen > 0 && (isLeech(s) || strength(s) < 0.6);
};

test('die Wackelplaetze holen Fehlgriffe zurueck - aber reihum, nicht immer dieselben', () => {
  /* Zwei Plaetze je Runde sind fuer Wackler reserviert. Beide ziehen quer durch
     den ganzen Bestand: Wer 94 wacklige Karten hat, darf nicht in jeder dritten
     Runde dieselbe sehen, waehrend neunzig andere warten. */
  const pool = CARDS.filter(c => c.cat === 'nat' || c.cat === 'ges' || c.cat === 'geo');
  const stand = lernstand(pool, 0.24, 13);
  const wackelt = wackeltNach(stand);
  const wackler = pool.filter(wackelt);
  assert.ok(wackler.length >= 30, `der Test braucht viele Wackler, hat ${wackler.length}`);

  const RUNDEN = 200;
  const zaehler = new Map();
  let rundenMitWackel = 0;
  for (let i = 0; i < RUNDEN; i++) {
    const runde = q.ziehung(pool, { zufall: festerZufall(100 + i), stand: (id) => stand.get(id) || null });
    let w = 0;
    for (const { card } of runde) {
      zaehler.set(card.id, (zaehler.get(card.id) || 0) + 1);
      if (wackelt(card)) w++;
    }
    if (w > 0) rundenMitWackel++;
  }
  assert.ok(rundenMitWackel / RUNDEN >= 0.9,
    `nur ${rundenMitWackel} von ${RUNDEN} Runden hatten einen Wackler`);

  /* Gemessen wird der ANTEIL an den Wacklerzuegen, nicht der Anteil an den
     Runden. Der Unterschied ist nicht kosmetisch: Ein Wackler wird auch von den
     gewoehnlichen Plaetzen gezogen, und wie oft das passiert, haengt daran, wie
     viele Karten in seinem Fach und seiner Stufe liegen. Die alte Schranke
     („hoechstens 20 % der Runden") mass deshalb beides zusammen und reagierte
     auf jede Karte, die irgendwo im Bestand dazukam: 50 neue Karten in nat, geo
     und spr reichten, um sie zu reissen – bei unveraenderter Ziehung. Die
     Wacklerplaetze selbst waren in beiden Faellen gesund.

     Zwei Groessen sagen, was der Test meint, und beide haengen nicht an der
     Bestandsgroesse: Jeder Wackler kommt ueberhaupt einmal dran, und keiner
     nimmt ein Vielfaches seines gleichen Anteils. Gemessen 39 von 39 Wacklern
     und Faktor 3,0 (vor den neuen Karten: 36 von 36 und Faktor 1,4).

     Gegengeprobt, indem die Wacklerplaetze wieder auf eine Stufe eingeengt
     wurden – so, wie es vor der Korrektur war: Dann bleiben 2 von 39 Wacklern
     in 200 Runden ueberhaupt liegen, und die Pruefung faellt durch. */
  const zuege = wackler.map(c => zaehler.get(c.id) || 0);
  const nieGezogen = zuege.filter(n => n === 0).length;
  assert.equal(nieGezogen, 0,
    `${nieGezogen} von ${wackler.length} Wacklern kamen in ${RUNDEN} Runden nie dran`);
  const summe = zuege.reduce((a, b) => a + b, 0);
  const faktor = Math.max(...zuege) / (summe / wackler.length);
  assert.ok(faktor <= 5,
    `ein Wackler nahm das ${faktor.toFixed(1)}-Fache seines gleichen Anteils - vor der Korrektur war es das Zwoelffache`);
});

test('keine Karte bleibt liegen, auch nicht bei nur zwei aktiven Themen', () => {
  /* Der Fall aus dem Alltag: zwei Themen eingeschaltet, zwei Wochen gelernt.
     Vor der Korrektur blieben 87 von 222 Karten ungezogen, und eine kam in
     jeder Runde vor. Der Test haelt beide Zahlen fest. */
  const pool = CARDS.filter(c => c.cat === 'mat' || c.cat === 'spo');
  const stand = lernstand(pool, 0.24, 7);
  /* Genug Runden, damit "nie gezogen" etwas ueber die Ziehung sagt und nicht
     ueber den Zufall: 800 Runden sind 9.600 Zuege auf 699 Karten, im Schnitt
     knapp vierzehn je Karte. Wer da fehlt, wird ausgeschlossen, nicht uebersehen. */
  const RUNDEN = 800;
  const zaehler = new Map();
  for (let i = 0; i < RUNDEN; i++)
    for (const { card } of q.ziehung(pool, { zufall: festerZufall(500 + i), stand: (id) => stand.get(id) || null }))
      zaehler.set(card.id, (zaehler.get(card.id) || 0) + 1);

  const nie = pool.filter(c => !zaehler.has(c.id));
  assert.equal(nie.length, 0, `${nie.length} von ${pool.length} Karten wurden nie gezogen`);
  const schnitt = q.FRAGEN_JE_RUNDE / pool.length;
  const faktor = Math.max(...pool.map(c => (zaehler.get(c.id) || 0) / RUNDEN)) / schnitt;
  assert.ok(faktor <= 9, `die haeufigste Karte kam ${faktor.toFixed(1)}-mal so oft wie der Schnitt (vorher 18,5)`);
});

test('eine duenne Stufe zieht die Nachbarstufe hinzu, statt sich zu wiederholen', () => {
  /* Ein gebauter Pool, damit der Test die Regel prueft und nicht den Bestand:
     Thema A hat nur vier Basiskarten, dafuer reichlich Solide. Ohne die
     Verbreiterung sind es genau diese vier in jeder zweiten Runde - genau der
     Grund, warum im Alltagsfall oben Karten liegenblieben. */
  const pool = [];
  const bauen = (cat, d, n) => { for (let k = 0; k < n; k++) pool.push({ id: `${cat}${d}-${k}`, cat, d, q: 'x', a: 'y' }); };
  bauen('a', 1, 4); bauen('a', 2, 60); bauen('a', 3, 60);
  bauen('b', 1, 60); bauen('b', 2, 60); bauen('b', 3, 60);
  const duenn = pool.filter(c => c.cat === 'a' && c.d === 1);
  const zaehler = new Map();
  const RUNDEN = 300;
  for (let i = 0; i < RUNDEN; i++)
    for (const { card } of q.ziehung(pool, { zufall: festerZufall(900 + i) }))
      zaehler.set(card.id, (zaehler.get(card.id) || 0) + 1);
  const haeufigster = Math.max(...duenn.map(c => (zaehler.get(c.id) || 0) / RUNDEN));
  assert.ok(haeufigster <= 0.15,
    `eine der vier Basiskarten kam in ${(haeufigster * 100).toFixed(0)} % der Runden - ohne Verbreiterung sind es 50 %`);
  const nachbar = pool.filter(c => c.cat === 'a' && c.d === 2 && zaehler.has(c.id)).length;
  assert.ok(nachbar >= 40, `nur ${nachbar} Karten der Nachbarstufe kamen ueberhaupt vor`);
});

test('die Runde steigt auch mit Wackelplaetzen von Basis nach Profi', () => {
  /* Die Wackelplaetze ziehen quer durch alle Stufen. Damit die Runde sich
     trotzdem wie ein Quiz anfuehlt, wird sie am Ende sortiert. */
  const pool = CARDS.filter(c => c.cat === 'nat' || c.cat === 'ges' || c.cat === 'geo');
  const stand = lernstand(pool, 0.4, 21);
  for (let i = 0; i < 50; i++) {
    const stufen = q.ziehung(pool, { zufall: festerZufall(700 + i), stand: (id) => stand.get(id) || null })
      .map(x => x.card.d);
    for (let k = 1; k < stufen.length; k++)
      assert.ok(stufen[k] >= stufen[k - 1], `Runde ${i} faellt bei ${k}: ${stufen}`);
  }
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

test('eine abgebrochene Runde ist an ihrer Antwortzahl erkennbar', () => {
  /* Die Gegnerpruefung fand: endRun legte JEDE Runde mit mindestens einer
     Antwort ab. Nach einer Frage abgebrochen ergab das den Eintrag {p:15,m:15} -
     der Rueckblick lobte „Fehlerfrei und schnell", der Balkenverlauf zeigte sie
     voll ausgeschlagen neben einer echten 145/180, und der Schnitt mittelte
     rohe Punkte ueber Runden mit verschiedenem Maximum. Die Unterscheidung
     haengt allein daran, dass max proportional zur Antwortzahl waechst. */
  const eine = q.auswertung([{ card: { cat: 'geo' }, ok: true, abgelaufen: false, punkte: 15 }], ['geo']);
  assert.equal(eine.max, q.MAX_JE_FRAGE, 'eine Antwort ergibt ein Maximum von 15');
  assert.notEqual(eine.max, q.FRAGEN_JE_RUNDE * q.MAX_JE_FRAGE,
    'eine abgebrochene Runde darf nicht wie eine volle aussehen');
  const voll = q.auswertung(Array.from({ length: q.FRAGEN_JE_RUNDE },
    () => ({ card: { cat: 'geo' }, ok: true, abgelaufen: false, punkte: 15 })), ['geo']);
  assert.equal(voll.max, 180);
  assert.equal(q.rundenEintrag(eine, 1).m, 15);
  assert.equal(q.rundenEintrag(voll, 1).m, 180);
});

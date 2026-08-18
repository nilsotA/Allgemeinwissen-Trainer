/* Tests für die Zusammenstellung der Lernwarteschlangen.
   Braucht einen beschreibbaren Speicher, deshalb ein eigener Stub. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const speicher = new Map();
globalThis.localStorage = {
  getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k),
};

const store = await import('../assets/js/store.js');
const sess = await import('../assets/js/session.js');
const { CARDS } = await import('../data/index.js');
const { fresh, schedule, GOOD } = await import('../assets/js/srs.js');

beforeEach(() => { store.resetAll(); });

test('Tagesplan enthält keine Karte doppelt', () => {
  const q = sess.buildDaily();
  const ids = q.map(x => x.card.id);
  assert.equal(new Set(ids).size, ids.length, 'doppelte Karten in der Warteschlange');
});

test('eine Karte mit Zustand, aber ohne Abfrage zählt nur als neu', () => {
  // Genau der Zustand, den ein Duell-Fehler auf einer unberührten Karte erzeugen könnte
  const id = CARDS[0].id;
  store.putCard(id, { ...fresh(), due: store.todayNum() });
  const faellig = sess.dueCards().map(c => c.id);
  const neu = sess.newCards().map(c => c.id);
  assert.ok(!faellig.includes(id), 'darf nicht als fällig gelten');
  assert.ok(neu.includes(id), 'muss als neu gelten');
  const ids = sess.buildDaily().map(x => x.card.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('fällige und neue Karten überschneiden sich nie', () => {
  // Ein paar Karten lernen, ein paar nur mit Zustand versehen
  CARDS.slice(0, 30).forEach((c, i) => {
    store.putCard(c.id, i % 3 === 0
      ? { ...fresh(), due: store.todayNum() }            // Zustand ohne Abfrage
      : { ...schedule(fresh(), GOOD), due: store.todayNum() });
  });
  const faellig = new Set(sess.dueCards().map(c => c.id));
  const neu = new Set(sess.newCards().map(c => c.id));
  const beides = [...faellig].filter(id => neu.has(id));
  assert.deepEqual(beides, [], 'diese Karten stehen in beiden Listen');
});

test('das Tagesbudget für neue Karten wird eingehalten', () => {
  store.setSetting('newPerDay', 5);
  const q = sess.buildDaily();
  assert.ok(q.filter(x => x.fresh).length <= 5, `${q.filter(x => x.fresh).length} neue Karten trotz Budget 5`);
});

test('abgeschaltete Themen tauchen im Tagesplan nicht auf', () => {
  store.setSetting('cats', ['mat']);
  const q = sess.buildDaily();
  assert.ok(q.length > 0);
  assert.ok(q.every(x => x.card.cat === 'mat'), 'fremde Kategorie im Plan');
});

test('Themen-Training liefert nur Karten des gewählten Themas', () => {
  for (const cat of ['spo', 'mat', 'ges']) {
    const q = sess.buildTopic(cat, 20);
    assert.ok(q.length > 0, `${cat}: leer`);
    assert.ok(q.every(x => x.card.cat === cat));
    const ids = q.map(x => x.card.id);
    assert.equal(new Set(ids).size, ids.length, `${cat}: doppelte Karten`);
  }
});

test('Duell liefert genau zehn verschiedene Karten', () => {
  const q = sess.buildDuel(10);
  assert.equal(q.length, 10);
  assert.equal(new Set(q.map(x => x.card.id)).size, 10);
});

test('Vorschau summiert sich zur Zahl der eingeplanten Wiederholungen', () => {
  CARDS.slice(0, 40).forEach((c, i) => {
    const cs = schedule(fresh(), GOOD);
    cs.due = store.todayNum() + (i % 10);
    store.putCard(c.id, cs);
  });
  const fc = sess.forecast(7);
  assert.equal(fc.length, 7);
  assert.ok(fc.every(n => Number.isInteger(n) && n >= 0));
  const erwartet = CARDS.slice(0, 40).filter((c, i) => (i % 10) < 7).length;
  assert.equal(fc.reduce((a, b) => a + b, 0), erwartet);
});

test('Übersicht bleibt in sich stimmig', () => {
  CARDS.slice(0, 20).forEach(c => store.putCard(c.id, schedule(fresh(), GOOD)));
  const o = sess.overview();
  assert.equal(o.total, CARDS.length);
  assert.ok(o.seen <= o.total && o.learned <= o.seen && o.mature <= o.learned);
  assert.ok(o.accuracy >= 0 && o.accuracy <= 1);
});

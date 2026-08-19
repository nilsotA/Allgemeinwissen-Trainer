/* Eigenschaftstest für den Planer: statt einzelner Beispiele werden zufällige
   Bewertungsfolgen durchgespielt und die Zusicherungen geprüft, die immer
   gelten müssen. Das findet Fälle, an die beim Schreiben der Beispieltests
   niemand gedacht hat – etwa früh beantwortete Karten mit hohem Faktor. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const speicher = new Map();
globalThis.localStorage = {
  getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k),
};

const store = await import('../assets/js/store.js');
const { schedule, fresh, strength, retention, AGAIN, HARD, GOOD, EASY } = await import('../assets/js/srs.js');

const TAG = 86400000;
/* Fester Startwert: ein Fehlschlag ist damit reproduzierbar und nicht
   „manchmal rot“. */
let rnd = 12345;
const zufall = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;

test('zufällige Bewertungsfolgen verletzen keine Zusicherung des Planers', () => {
  const echt = Date.now;
  let versatz = 0;
  Date.now = () => echt() + versatz;
  try {
    for (let lauf = 0; lauf < 800; lauf++) {
      versatz = 0;
      let s = fresh();
      for (let schritt = 0; schritt < 20; schritt++) {
        const g = [AGAIN, HARD, GOOD, EASY][Math.floor(zufall() * 4)];
        // mal früh, mal punktgenau, mal spät antworten
        const ziel = s.due + Math.floor(zufall() * 9) - 4;
        versatz += Math.max(0, ziel - store.todayNum()) * TAG;
        const t = store.todayNum();
        const vor = { ...s };
        s = schedule(s, g);

        assert.ok(Number.isInteger(s.iv) && s.iv >= 0 && s.iv <= 365, `Intervall ${s.iv}`);
        assert.ok(s.ef >= 1.3 - 1e-9 && s.ef <= 2.9 + 1e-9, `Leichtigkeit ${s.ef}`);
        assert.ok(s.due >= t, `Termin ${s.due} liegt vor heute ${t}`);
        assert.equal(s.seen, vor.seen + 1);
        assert.ok(s.ok <= s.seen);
        assert.equal(s.reps, g === AGAIN ? 0 : vor.reps + 1);
        if (g !== AGAIN && vor.iv > 0) {
          assert.ok(s.iv >= vor.iv, `Intervall geschrumpft: ${vor.iv} → ${s.iv} bei Note ${g}`);
          assert.ok(s.due >= vor.due, `Termin nach vorn gezogen: ${vor.due} → ${s.due}`);
        }
        const st = strength(s);
        assert.ok(st >= 0 && st <= 1, `Reifegrad ${st}`);
        const r = retention(s, t);
        assert.ok(r >= 0 && r <= 1, `Merkwahrscheinlichkeit ${r}`);
      }
    }
  } finally { Date.now = echt; }
});

test('eine bessere Note verkürzt das Intervall nie', () => {
  // „Leicht" darf aus derselben Ausgangslage nie früher wiederkommen als „Gut",
  // und „Gut" nie früher als „Schwer" – sonst bestraft die App ehrliche Selbsteinschätzung.
  for (let iv = 0; iv <= 200; iv += 7) {
    for (let reps = 0; reps <= 6; reps++) {
      for (let ef = 1.3; ef <= 2.9; ef += 0.4) {
        const basis = { ...fresh(), iv, reps, ef, due: store.todayNum() };
        const [h, g, e] = [HARD, GOOD, EASY].map(n => schedule(basis, n, { jitter: false }).iv);
        assert.ok(h <= g && g <= e,
          `iv=${iv} reps=${reps} ef=${ef.toFixed(1)}: schwer ${h}, gut ${g}, leicht ${e}`);
      }
    }
  }
});

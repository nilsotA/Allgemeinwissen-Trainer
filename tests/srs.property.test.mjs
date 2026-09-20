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
const { schedule, nachDuellFehler, fresh, strength, isLeech, AGAIN, HARD, GOOD, EASY } = await import('../assets/js/srs.js');

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

test('auch mit Duellfehlern dazwischen bleibt der Planer widerspruchsfrei', () => {
  /* nachDuellFehler() deckelt das Intervall und setzt den Termin auf heute -
     und schedule() rechnet anschliessend auf diesem Zustand weiter. Genau diese
     Mischung kam in keinem Test vor, obwohl sie im Alltag staendig vorkommt:
     Wer abends ein Duell spielt, schickt damit gelernte Karten ins Tagestraining.

     Geprueft wird zusaetzlich der Anker, an dem das ganze Wachstum haengt:
     „due − iv" ist der Tag der letzten Abfrage und darf nie in der Zukunft
     liegen. Wo er es tut, rechnet die naechste Antwort mit einer Zeit, die es
     nicht gab - genau der Fehler, den nachDuellFehler() beheben sollte. */
  const echt = Date.now;
  let versatz = 0;
  Date.now = () => echt() + versatz;
  try {
    for (let lauf = 0; lauf < 600; lauf++) {
      versatz = 0;
      let s = fresh();
      for (let schritt = 0; schritt < 25; schritt++) {
        const ziel = s.due + Math.floor(zufall() * 9) - 4;
        versatz += Math.max(0, ziel - store.todayNum()) * TAG;
        const t = store.todayNum();
        const vor = { ...s };

        if (zufall() < 0.25 && s.seen > 0) {
          const ueberlebt = t - (vor.due - vor.iv);      // so lange trug die Karte wirklich
          s = nachDuellFehler(s, t);
          assert.ok(s.iv >= 0 && s.iv <= vor.iv, `Duellfehler: Intervall ${vor.iv} → ${s.iv}`);
          assert.ok(s.due >= t, `Duellfehler: Termin ${s.due} liegt vor heute ${t}`);
          assert.equal(s.seen, vor.seen, 'ein Duellfehler ist keine Abfrage im Tagestraining');
          /* Der eigentliche Vertrag: Das Intervall darf nicht mehr Zeit
             behaupten, als die Karte wirklich getragen hat. Sonst rechnet die
             naechste richtige Antwort aus einer Strecke, die es nie gab. */
          assert.ok(s.iv <= Math.max(0, ueberlebt),
            `Duellfehler behauptet ${s.iv} Tage, getragen hat die Karte ${ueberlebt}`);
        } else {
          const g = [AGAIN, HARD, GOOD, EASY][Math.floor(zufall() * 4)];
          s = schedule(s, g);
          assert.ok(Number.isInteger(s.iv) && s.iv >= 0 && s.iv <= 365, `Intervall ${s.iv}`);
          assert.ok(s.ef >= 1.3 - 1e-9 && s.ef <= 2.9 + 1e-9, `Leichtigkeit ${s.ef}`);
          assert.ok(s.due >= t, `Termin ${s.due} liegt vor heute ${t}`);
          assert.ok(s.ok <= s.seen);
          if (g !== AGAIN && vor.iv > 0) {
            assert.ok(s.iv >= vor.iv, `Intervall geschrumpft: ${vor.iv} → ${s.iv} bei Note ${g}`);
            assert.ok(s.due >= vor.due, `Termin nach vorn gezogen: ${vor.due} → ${s.due}`);
          }
        }
        assert.ok(s.due - s.iv <= t,
          `letzte Abfrage liegt in der Zukunft: due ${s.due} − iv ${s.iv} > heute ${t}`);
        const st = strength(s);
        assert.ok(st >= 0 && st <= 1, `Reifegrad ${st}`);
        assert.equal(typeof isLeech(s), 'boolean');
      }
    }
  } finally { Date.now = echt; }
});

test('ein Duellfehler treibt das naechste Intervall nicht in die Hoehe', () => {
  /* Der Fall aus dem README: eine 30-Tage-Karte, vor zehn Tagen gelernt, im
     Duell falsch beantwortet. Blieb das Intervall dabei stehen, galt sie am
     naechsten Tag als puenktlich abgefragte 30-Tage-Karte - und die richtige
     Antwort, geprimt vom Loesungstext, den das Duell gerade gezeigt hatte,
     trieb sie auf rund 75 Tage. Nachweislich gescheitert war der Abruf aber
     schon nach zehn. */
  const t = store.todayNum();
  const karte = { ef: 2.5, iv: 30, due: t + 20, reps: 4, lapses: 0, seen: 6, ok: 6, last: 0 };
  const nach = nachDuellFehler(karte, t);
  assert.equal(nach.due, t, 'die Karte muss ins naechste Tagestraining');
  assert.equal(nach.iv, 10, `getragen hat sie zehn Tage, das Intervall sagt ${nach.iv}`);

  const danach = schedule(nach, GOOD, { jitter: false });
  assert.ok(danach.iv <= 30,
    `nach dem Duellfehler waechst das Intervall auf ${danach.iv} Tage – erwartet hoechstens 30`);

  // Gegenprobe ohne Duellfehler: dieselbe Karte puenktlich beantwortet waechst weiter.
  const ohne = schedule({ ...karte, due: t }, GOOD, { jitter: false });
  assert.ok(ohne.iv > danach.iv,
    'ohne Duellfehler muss dieselbe Karte weiter wachsen als mit');
});

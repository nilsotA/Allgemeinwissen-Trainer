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

test('eine umformulierte Frage nimmt ihren Lernstand mit', () => {
  // Die Kennung haengt am Fragetext. Ohne diese Uebernahme faengt eine Karte
  // nach einer Umformulierung bei null an - und der Nutzer merkt es nie.
  const c = CARDS[0];
  const alteKennung = c.cat + '-frueher';
  const stand = { ...fresh(), iv: 40, reps: 5, seen: 9, ok: 8, due: store.todayNum() + 40 };
  store.putCard(alteKennung, stand);
  store.toggleFlag(alteKennung);

  const bewegt = store.uebernimmVorgaenger([[c.id, ['gibt-es-nicht', alteKennung]]]);
  assert.equal(bewegt, 1);
  assert.deepEqual(store.cardState(c.id), stand, 'Stand nicht uebernommen');
  assert.ok(!store.cardState(alteKennung), 'alter Eintrag blieb liegen');
  assert.equal(store.isFlagged(c.id), true, 'Markierung nicht mitgewandert');

  // Zweiter Lauf: ein vorhandener Stand darf nicht ueberschrieben werden.
  store.putCard(alteKennung, { ...fresh(), seen: 1 });
  assert.equal(store.uebernimmVorgaenger([[c.id, [alteKennung]]]), 0);
  assert.deepEqual(store.cardState(c.id), stand);
});

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

test('Schwachstellen-Vorschlaege ueberspringen abgeschaltete Themen', () => {
  // Sonst bietet die Statistik einen Uebungsknopf fuer genau das Thema an,
  // das der Nutzer im Tagestraining ausdruecklich weggeschaltet hat.
  for (const c of CARDS) {
    store.putCard(c.id, { ...fresh(), seen: 6, correct: 2, last: store.todayNum() });
  }
  store.setSetting('cats', ['mat']);
  const schwach = sess.weakSubs(1, 20);
  assert.ok(schwach.length > 0, 'keine Schwachstellen gefunden');
  assert.ok(schwach.every(w => w.cat === 'mat'), 'fremdes Thema unter den Vorschlaegen');
  assert.equal(sess.catAktiv('mat'), true);
  assert.equal(sess.catAktiv('spo'), false);
  store.setSetting('cats', []);
  assert.equal(sess.catAktiv('spo'), true, 'ohne Filter ist jedes Thema aktiv');
});

test('die Erinnerung ans Sichern merkt sich den Zeitpunkt', () => {
  assert.equal(store.tageSeitSicherung(), null, 'ohne Sicherung darf kein Datum stehen');
  store.merkeSicherung();
  assert.equal(store.tageSeitSicherung(), 0);
  // Ein aus einer Datei eingelesener Stand bringt seinen Zeitpunkt mit
  const text = store.exportJSON();
  store.resetAll();
  assert.equal(store.tageSeitSicherung(), null, 'Zurücksetzen löscht auch den Zeitpunkt');
  store.importJSON(text);
  assert.equal(store.tageSeitSicherung(), 0, 'Zeitpunkt ging beim Einlesen verloren');
});

test('Fortschritt je Stufe zählt nur aktive Themen und alle drei Stufen', () => {
  const alle = sess.levelProgress();
  assert.deepEqual(Object.keys(alle).sort(), ['1', '2', '3']);
  const gesamt = [1, 2, 3].reduce((n, d) => n + alle[d].n, 0);
  assert.equal(gesamt, CARDS.length, 'nicht jede Karte hat eine Stufe');
  for (const d of [1, 2, 3]) {
    assert.equal(alle[d].seen, 0, 'ohne Abfragen darf nichts gesehen sein');
    assert.equal(alle[d].pct, 0);
  }
  // Eine Karte lernen: nur ihre Stufe darf sich bewegen.
  const c = CARDS.find(x => x.d === 1);
  store.putCard(c.id, { ...fresh(), iv: 60, reps: 4, seen: 5, ok: 5, due: store.todayNum() + 60 });
  const nachher = sess.levelProgress();
  assert.equal(nachher[1].seen, 1);
  assert.equal(nachher[2].seen, 0);
  assert.ok(nachher[1].mature === 1, 'gefestigte Karte wird nicht gezählt');

  store.setSetting('cats', ['mat']);
  const nurMat = sess.levelProgress();
  const matKarten = CARDS.filter(x => x.cat === 'mat').length;
  assert.equal([1, 2, 3].reduce((n, d) => n + (nurMat[d]?.n || 0), 0), matKarten,
    'pausierte Themen zählen in der Stufenübersicht mit');
});

test('Schwerpunktthemen bekommen doppelt so viele neue Karten', () => {
  store.setSetting('newPerDay', 90);
  const ohne = sess.newCards().slice(0, 90);
  const anteilOhne = ohne.filter(c => c.cat === 'mat').length;

  store.setSetting('focus', ['mat']);
  const mit = sess.newCards().slice(0, 90);
  const anteilMit = mit.filter(c => c.cat === 'mat').length;

  assert.ok(anteilMit > anteilOhne * 1.6,
    `Schwerpunkt wirkt kaum: ${anteilOhne} → ${anteilMit} von 90`);
  assert.equal(new Set(mit.map(c => c.id)).size, mit.length, 'doppelte Karten');
  store.setSetting('focus', null);
});

test('ein abgeschaltetes Thema wirkt auch als Schwerpunkt nicht', () => {
  store.setSetting('cats', ['spo']);
  store.setSetting('focus', ['mat']);
  assert.equal(sess.focusCats(), null, 'pausiertes Thema zählt als Schwerpunkt');
  const q = sess.buildDaily();
  assert.ok(q.every(x => x.card.cat === 'spo'), 'fremdes Thema im Plan');
  store.setSetting('focus', null);
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

test('neue Karten liegen gleichmäßig verteilt, nicht als Block am Ende', () => {
  // Der kritische Fall: mehr neue als fällige Karten
  store.setSetting('newPerDay', 12);
  CARDS.slice(0, 3).forEach(c => {
    const cs = schedule(fresh(), GOOD);
    cs.due = store.todayNum();
    store.putCard(c.id, cs);
  });
  const q = sess.buildDaily();
  const neu = q.filter(x => x.fresh).length;
  assert.ok(neu >= 10, `nur ${neu} neue Karten im Plan`);
  // In der ersten Hälfte muss ungefähr die Hälfte der neuen Karten stecken
  const haelfte = Math.floor(q.length / 2);
  const neuVorn = q.slice(0, haelfte).filter(x => x.fresh).length;
  const anteil = neuVorn / neu;
  assert.ok(anteil > 0.3 && anteil < 0.7,
    `${(anteil * 100).toFixed(0)} % der neuen Karten liegen in der ersten Hälfte – erwartet rund 50 %`);
});

test('die Verschränkung behält alle Karten und keine doppelt', () => {
  for (const [nRev, nNeu] of [[0, 12], [12, 0], [3, 12], [40, 5], [1, 1], [90, 12]]) {
    store.resetAll();
    store.setSetting('newPerDay', nNeu);
    store.setSetting('maxReviews', nRev || 1);
    CARDS.slice(0, nRev).forEach(c => {
      const cs = schedule(fresh(), GOOD);
      cs.due = store.todayNum();
      store.putCard(c.id, cs);
    });
    const q = sess.buildDaily();
    const ids = q.map(x => x.card.id);
    assert.equal(new Set(ids).size, ids.length, `${nRev}/${nNeu}: doppelte Karten`);
    assert.equal(q.filter(x => !x.fresh).length, nRev, `${nRev}/${nNeu}: falsche Zahl an Wiederholungen`);
  }
});

test('ein manipuliertes Backup schmuggelt keine Zeichenketten in Zahlenfelder', () => {
  const boesartig = JSON.stringify({
    cards: { 'x': { ef: '<img src=x onerror=alert(1)>', iv: 'viel', due: {}, seen: [1], reps: null } },
    days: { '2026-01-01': { done: '<script>', correct: 'nein' }, 'kein-datum': { done: 5 } },
    streak: '<b>99</b>', best: Infinity, totalAnswers: 'tausend',
    settings: { newPerDay: 'alle', recallMode: 'boeser-modus', theme: 'javascript:', cats: [1, 2, {}] },
    flags: { gut: true, 7: true },
  });
  store.importJSON(boesartig);
  const s = store.S();
  for (const [k, v] of Object.entries(s.cards.x)) {
    assert.equal(typeof v, 'number', `cards.x.${k} ist ${typeof v}`);
    assert.ok(Number.isFinite(v));
  }
  for (const [k, v] of Object.entries(s.days['2026-01-01'])) {
    assert.equal(typeof v, 'number', `days.${k} ist ${typeof v}`);
  }
  assert.ok(!('kein-datum' in s.days), 'ungültiger Datumsschlüssel wurde übernommen');
  assert.equal(typeof s.streak, 'number');
  assert.ok(Number.isFinite(s.best));
  assert.equal(typeof s.totalAnswers, 'number');
  assert.equal(s.settings.newPerDay, 12, 'unbrauchbarer Wert muss auf die Voreinstellung zurückfallen');
  assert.equal(s.settings.recallMode, 'auto');
  assert.equal(s.settings.theme, 'system');
  assert.deepEqual(s.settings.cats, [], 'nur Zeichenketten dürfen als Kategorien überleben');
});

test('ein echtes Backup übersteht Export und Import unverändert', () => {
  store.resetAll();
  store.setSetting('newPerDay', 20);
  store.setSetting('theme', 'light');
  const id = CARDS[5].id;
  store.putCard(id, schedule(fresh(), GOOD));
  store.touchStreak();
  const gesichert = store.exportJSON();
  const vorher = JSON.parse(gesichert);
  store.resetAll();
  store.importJSON(gesichert);
  const s = store.S();
  assert.equal(s.settings.newPerDay, 20);
  assert.equal(s.settings.theme, 'light');
  assert.equal(s.streak, vorher.streak);
  assert.deepEqual(s.cards[id], vorher.cards[id]);
});

test('offensichtlicher Unsinn wird beim Einlesen abgewiesen', () => {
  for (const txt of ['null', '[]', '"text"', '{}', '{"cards":"nein"}', '42']) {
    assert.throws(() => store.importJSON(txt), undefined, `„${txt}" wurde angenommen`);
  }
});

test('bei grossem Rückstand pausieren neue Karten', () => {
  store.setSetting('maxReviews', 90);
  store.setSetting('newPerDay', 12);
  assert.equal(sess.newBudget(), 12, 'ohne Rückstand läuft das Budget normal');

  // 85 fällige Karten anlegen – das sind mehr als 90 Prozent des Deckels
  CARDS.slice(0, 85).forEach(c => {
    const cs = schedule(fresh(), GOOD);
    cs.due = store.todayNum();
    store.putCard(c.id, cs);
  });
  assert.ok(sess.imRueckstau(), 'Rückstand müsste erkannt sein');
  assert.equal(sess.newBudget(), 0, 'neue Karten müssten pausieren');
  const q = sess.buildDaily();
  assert.equal(q.filter(x => x.fresh).length, 0, 'keine neue Karte im Plan');
  assert.ok(q.length > 0, 'Wiederholungen laufen weiter');
});

test('die Bremse lässt sich übersteuern', () => {
  store.setSetting('maxReviews', 90);
  CARDS.slice(0, 85).forEach(c => {
    const cs = schedule(fresh(), GOOD);
    cs.due = store.todayNum();
    store.putCard(c.id, cs);
  });
  assert.equal(sess.newBudget(), 0);
  store.setSetting('trotzdemNeu', true);
  assert.equal(sess.newBudget(), 12, 'übersteuert müsste das Budget wieder greifen');
  assert.ok(sess.buildDaily().some(x => x.fresh));
});

test('knapp unter der Schwelle laufen neue Karten weiter', () => {
  store.setSetting('maxReviews', 90);
  CARDS.slice(0, 60).forEach(c => {
    const cs = schedule(fresh(), GOOD);
    cs.due = store.todayNum();
    store.putCard(c.id, cs);
  });
  assert.equal(sess.imRueckstau(), false);
  assert.equal(sess.newBudget(), 12);
});

/* Die Leiter sortierte innerhalb einer Stufe alphabetisch nach dem Fragetext.
   Dadurch standen gleich anfangende Fragen beieinander – in der allerersten
   Einheit zweimal „Ab welchem Alter darf man in Deutschland …". Das arbeitet
   gegen das Verschränken, das der ganze Sinn der Kategorierotation ist. */
test('die Leiter reiht neue Karten nicht alphabetisch auf', () => {
  const neu = sess.newCards();
  const proKat = {};
  for (const c of neu) (proKat[c.cat] ||= []).push(c);
  let alphabetisch = 0, geprueft = 0;
  for (const liste of Object.values(proKat)) {
    const stufe1 = liste.filter(c => c.d === 1).slice(0, 25);
    if (stufe1.length < 10) continue;
    geprueft++;
    const sortiert = stufe1.every((c, i) => i === 0 || stufe1[i - 1].q.localeCompare(c.q) <= 0);
    if (sortiert) alphabetisch++;
  }
  assert.ok(geprueft >= 5, `nur ${geprueft} Kategorien geprüft`);
  assert.equal(alphabetisch, 0, `${alphabetisch} Kategorien liefern ihre neuen Karten alphabetisch`);
});

/* Welche Kategorie die Runde eröffnet, wird absichtlich gewürfelt. Innerhalb
   einer Kategorie muss die Reihenfolge dagegen feststehen – sonst hinge es vom
   Zufall ab, welche Grundlagen zuerst drankommen. */
test('innerhalb einer Kategorie ist die Reihenfolge neuer Karten reproduzierbar', () => {
  const proKat = (liste) => {
    const o = {};
    for (const c of liste) (o[c.cat] ||= []).push(c.id);
    return o;
  };
  const a = proKat(sess.newCards()), b = proKat(sess.newCards());
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  for (const k of Object.keys(a)) assert.deepEqual(a[k], b[k], `Reihenfolge in ${k} schwankt`);
});

/* Die Leiter soll Grundlagen zuerst bringen – das darf die Streuung nicht aufheben. */
test('die Leiter bringt weiterhin die leichten Karten zuerst', () => {
  const erste = sess.newCards().slice(0, 60);
  assert.ok(erste.every(c => c.d === 1), 'in den ersten 60 neuen Karten steckt eine schwerere');
});

/* Ist jede Karte einmal gesehen, gibt es nichts Neues mehr - dann darf die
   Startseite auch nicht "12 neu frei" melden. */
test('neu frei zeigt den Vorrat, nicht nur das Tagesbudget', () => {
  const voll = { ...fresh(), reps: 5, seen: 6, ok: 5, iv: 40, due: store.todayNum() + 30 };
  for (const c of CARDS) store.putCard(c.id, { ...voll });
  const o = sess.overview();
  assert.equal(sess.newCards().length, 0, 'es sollte keine neue Karte mehr geben');
  assert.equal(o.newLeft, 0, `newLeft war ${o.newLeft}, obwohl der Vorrat leer ist`);
});

/* Ein lastDay in der Zukunft entsteht durch eine zurueckgestellte Uhr, einen Flug
   ueber die Datumsgrenze oder ein Backup aus einer spaeteren Zeitzone. Vorher fiel
   die Serie dann auf 0 und wurde bei der naechsten Antwort dauerhaft auf 1 gesetzt. */
test('eine Serie überlebt ein Datum aus der Zukunft', () => {
  const st = store.S();
  st.streak = 60; st.best = 60;
  st.lastDay = store.numToKey(store.todayNum() + 1);
  assert.equal(store.liveStreak(), 60, 'die Serie darf nicht auf 0 fallen');
  store.touchStreak();
  assert.equal(store.S().streak, 60, `nach einer Antwort stand die Serie bei ${store.S().streak}`);
  assert.equal(store.S().best, 60);
});

test('eine echte Lücke setzt die Serie weiterhin zurück', () => {
  const st = store.S();
  st.streak = 12; st.best = 12;
  st.lastDay = store.numToKey(store.todayNum() - 3);
  assert.equal(store.liveStreak(), 0);
  store.touchStreak();
  assert.equal(store.S().streak, 1);
  assert.equal(store.S().best, 12, 'der Rekord bleibt stehen');
});

/* Der gesamte Lernfortschritt liegt nur auf diesem Geraet. Die Sicherungsdatei ist
   das einzige Netz – wenn beim Wiederherstellen still ein Feld verlorengeht, faellt
   das erst auf, wenn es zu spaet ist. Der Test scheitert, sobald jemand ein Feld
   zum Zustand hinzufuegt, ohne saeubern() davon zu erzaehlen. */
test('eine Sicherung geht verlustfrei wieder herein', () => {
  const st = store.S();
  st.cards['pruef-1'] = { ef: 2.3, iv: 9, due: 5, reps: 4, lapses: 2, seen: 9, ok: 7, last: 123 };
  st.days['2026-08-20'] = { done: 12, correct: 9, newC: 3, sec: 400, duel: 10, duelOk: 6 };
  st.flags['pruef-1'] = 1755600000000;      // Markierungen tragen einen Zeitstempel
  Object.assign(st, {
    totalAnswers: 99, totalCorrect: 70, streak: 5, best: 9, lastDay: '2026-08-20',
    claims: 20, claimsMiss: 4, factSeen: 30, factIdx: 30, factDay: '2026-08-20',
    duelBest: 8, duelAnswers: 40, duelCorrect: 25, lastExport: 19000,
    quizBest: 150, quizRunden: [{ t: 1755600001000, p: 150, m: 180, r: 10, f: 1, l: 1, k: { geo: [30, 30], spo: [0, 15] } }],
  });
  Object.assign(st.settings, { focus: ['spo'], newPerDay: 15, recallMode: 'recall' });

  const vorher = JSON.parse(store.exportJSON());
  const zurueck = store.pruefeBackup(store.exportJSON());
  const verloren = [];
  (function vergleiche(a, b, pfad) {
    for (const k of Object.keys(a)) {
      if (k === 'rev') continue;            // wird beim Einlesen absichtlich neu gesetzt
      if (!(k in b)) { verloren.push(pfad + k + ' fehlt ganz'); continue; }
      if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) vergleiche(a[k], b[k], pfad + k + '.');
      else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        verloren.push(`${pfad}${k}: ${JSON.stringify(a[k])} wurde ${JSON.stringify(b[k])}`);
      }
    }
  })(vorher, zurueck, '');
  assert.deepEqual(verloren, [], 'Felder gehen beim Wiederherstellen verloren');
});

/* Ein zweiter offener Tab darf einen eingelesenen Stand nicht wieder einsammeln.
   Geprueft wird nicht die Fassungsnummer, sondern das Ergebnis: Zaehlt der neue
   Zustand nicht hoeher als alles Gespeicherte, fuehrt schon das erste Speichern
   den fremden Stand wieder herein – und die wiederhergestellte Sicherung traegt
   ploetzlich Karten, die gar nicht in der Datei standen. */
test('ein eingelesener Stand sammelt nicht den fremden Tab wieder ein', () => {
  const datei = JSON.stringify({
    ...JSON.parse(store.exportJSON()),
    cards: { 'aus-der-datei': { ef: 2.5, iv: 3, due: 1, reps: 1, lapses: 0, seen: 1, ok: 1, last: 50 } },
  });
  // Dieser Tab ruht seit langem, der andere war fleissig und hat viel abgelegt.
  store.S().rev = 2;
  const fremd = JSON.parse(store.exportJSON());
  fremd.rev = 500;
  fremd.cards = { 'aus-dem-anderen-tab': { ef: 2.5, iv: 1, due: 1, reps: 1, lapses: 0, seen: 1, ok: 1, last: 9999 } };
  localStorage.setItem('wissenswerk.v1', JSON.stringify(fremd));

  store.importJSON(datei);

  const ids = Object.keys(store.S().cards);
  assert.ok(ids.includes('aus-der-datei'), 'die Karte aus der Datei muss da sein');
  assert.ok(!ids.includes('aus-dem-anderen-tab'),
    `der fremde Tab wurde wieder eingesammelt: ${ids.join(', ')}`);
  const abgelegt = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  assert.ok(!Object.keys(abgelegt.cards).includes('aus-dem-anderen-tab'),
    'auch im Speicher darf der fremde Stand nicht wieder auftauchen');
});

/* Zuruecksetzen und Einlesen sind ausdrueckliche Entscheidungen – aber das
   Zusammenfuehren zweier Tabs kennt nur Wachstum. Ohne Generationsnummer fuellte
   der zweite offene Tab einen bewusst geleerten Stand einfach wieder auf:
   Nachgestellt genuegte ein einziger Stern in Tab B, und der komplette
   Altbestand stand wieder im Speicher. Der Test faehrt zwei echte
   Modulinstanzen gegeneinander, wie zwei Tabs es tun. */
test('ein Zuruecksetzen ueberlebt den zweiten offenen Tab', async () => {
  const B = await import('../assets/js/store.js?zweiter-tab');
  store.putCard('probe-tab', { ef: 2.5, iv: 3, due: 5, reps: 2, lapses: 0, seen: 4, ok: 3, last: 111 });
  store.S().totalAnswers = 42; store.S().streak = 17;
  store.save(true);
  B.save(true);                       // Tab B zieht den Stand einmal zu sich
  assert.ok(Object.keys(B.S().cards).length >= 1, 'Tab B muss den Stand kennen');

  store.resetAll();                   // Tab A: Alles zuruecksetzen
  B.toggleFlag('irgendwas');          // Tab B tippt danach einen Stern an
  B.save(true);

  const danach = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  assert.equal(Object.keys(danach.cards).length, 0,
    `der Altbestand ist wieder da: ${Object.keys(danach.cards).join(', ')}`);
  assert.equal(danach.totalAnswers, 0, 'auch die Zaehler muessen leer bleiben');
  assert.equal(Object.keys(B.S().cards).length, 0,
    'Tab B selbst muss den ersetzten Stand uebernommen haben');
});

test('der Tagesplan ist bei jedem Aufruf anders sortiert', () => {
  // Genau deshalb darf die Startseite den Plan nicht zweimal bauen: Die Ansage
  // beschriebe sonst eine Runde, die beim Tippen verworfen wird. Die Laenge
  // bleibt gleich, die Reihenfolge nicht - ein Laengenvergleich reicht als
  // Nachweis also nicht aus.
  store.setSetting('newPerDay', 40);
  const folgen = new Set();
  for (let i = 0; i < 12; i++) folgen.add(sess.buildDaily().map(x => x.card.id).join(','));
  assert.ok(folgen.size > 1,
    'zwoelf Aufrufe ergaben dieselbe Reihenfolge - dann waere der Plan-Cache unnoetig');
  const laengen = new Set([...folgen].map(f => f.split(',').length));
  assert.equal(laengen.size, 1, 'die Laenge muss dabei stabil bleiben');
});

test('der Neu-Vorrat in overview zaehlt dieselbe Menge wie die Warteschlange', () => {
  // overview() baute fuer diese eine Zahl die komplette Neu-Warteschlange auf
  // (sortieren, mischen, reihum). Jetzt faellt sie in der ohnehin laufenden
  // Schleife ab - das darf am Ergebnis nichts aendern, auch nicht mit
  // eingeschraenkten Themen.
  const t = store.todayNum();
  for (let i = 0; i < 30; i++) {
    const c = CARDS[i * 7];
    store.putCard(c.id, { ...fresh(), iv: 3, reps: 2, seen: 4, ok: 3, due: t - 1 });
  }
  // Der heikle Fall: Karten MIT Zustand, aber ohne je gestellte Abfrage. Sie
  // gelten als neu (isNew prueft seen === 0, nicht die blosse Existenz). Ohne
  // sie liefe jede Zaehlung, die nur auf einen fehlenden Zustand schaut,
  // faelschlich durch.
  for (let i = 0; i < 25; i++) store.putCard(CARDS[i * 11 + 3].id, { ...fresh(), seen: 0 });
  const erwartet = () => {
    const a = sess.activeCats();
    const pool = CARDS.filter(c => !a || a.has(c.cat));
    return Math.min(sess.newBudget(), sess.newCards(pool).length);
  };
  assert.equal(sess.overview().newLeft, erwartet(), 'ueber alle Themen');

  store.setSetting('cats', ['mat', 'spo']);
  assert.equal(sess.overview().newLeft, erwartet(), 'mit eingeschraenkten Themen');

  // Entscheidend ist der Fall, in dem der Vorrat KLEINER ist als das Tagesbudget
  // - sonst verdeckt das Math.min jeden Zaehlfehler. Alles auf gesehen setzen,
  // dann genau drei Karten mit Zustand, aber ohne Abfrage zuruecklassen.
  store.setSetting('cats', null);
  for (const c of CARDS) store.putCard(c.id, { ...fresh(), seen: 1, reps: 1, iv: 5, due: t + 5 });
  assert.equal(sess.overview().newLeft, 0, 'ohne Vorrat muss die Zahl null sein');
  for (const c of CARDS.slice(0, 3)) store.putCard(c.id, { ...fresh(), seen: 0 });
  assert.equal(sess.overview().newLeft, 3,
    'drei Karten mit Zustand, aber ohne Abfrage, gelten als neu');
  assert.equal(sess.overview().newLeft, erwartet(), 'und decken sich mit der Warteschlange');
});

test('ein fehlgeschlagenes Speichern darf den anderen Tab nicht ueberschreiben', async () => {
  /* Die Fassungsnummer wurde vor dem Schreiben erhoeht. Schlug das Schreiben
     fehl, lief sie trotzdem weiter - der Tab hielt sich fuer den aktuelleren
     und uebersprang danach das Zusammenfuehren. */
  store.resetAll();
  const B = await import('../assets/js/store.js?fehlschlag-tab');
  B.resetAll();
  store.save(true);
  B.save(true);

  // Tab A scheitert fuenfmal am vollen Speicher
  const echt = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = (k, v) => {
    if (k === 'wissenswerk.v1') throw new Error('QuotaExceededError');
    return echt(k, v);
  };
  for (let i = 0; i < 5; i++) store.save(true);
  globalThis.localStorage.setItem = echt;

  // Tab B lernt derweil zwanzig Karten und speichert erfolgreich
  for (let i = 0; i < 20; i++) B.putCard('karte-' + i, { ...fresh(), seen: 1, reps: 1, last: 5 });
  B.S().totalAnswers = 20;
  B.save(true);

  // Und jetzt schreibt Tab A wieder
  store.save(true);
  const stand = JSON.parse(globalThis.localStorage.getItem('wissenswerk.v1'));
  assert.equal(Object.keys(stand.cards).length, 20,
    `die zwanzig Karten aus Tab B muessen ueberleben, gefunden: ${Object.keys(stand.cards).length}`);
  assert.equal(stand.totalAnswers, 20, 'auch der Zaehler darf nicht zurueckfallen');
});

test('bei weiter vollem Speicher meldet sich jeder Fehlversuch', () => {
  // Der Nutzer kann den Hinweis wegbekommen, waehrend der Speicher voll bleibt.
  store.resetAll();
  let gemeldet = 0;
  store.setSaveErrorHandler(() => { gemeldet++; });
  const echt = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = (k, v) => {
    if (k === 'wissenswerk.v1') throw new Error('QuotaExceededError');
    return echt(k, v);
  };
  for (let i = 0; i < 4; i++) store.save(true);
  globalThis.localStorage.setItem = echt;
  store.setSaveErrorHandler(() => {});
  assert.equal(gemeldet, 4, `jeder Fehlversuch muss melden, gemeldet: ${gemeldet}`);
});

test('das Themen-Duell haengt nicht am Tagestraining', () => {
  /* Wer auf „Thema im Duell" tippt, waehlt das Thema ausdruecklich - auch wenn
     es unter Mehr pausiert ist. Sonst meldete der Knopf „Keine Karten in
     diesem Thema" fuer ein Thema mit hunderten Karten, waehrend „Ganzes Thema
     ueben" direkt daneben lief. */
  store.resetAll();
  store.setSetting('cats', ['mat']);          // Sport pausiert
  const duell = sess.buildDuel(10, 'spo');
  assert.equal(duell.length, 10, 'das Duell muss trotzdem Karten liefern');
  assert.ok(duell.every(x => x.card.cat === 'spo'), 'und zwar nur aus dem gewaehlten Thema');
  assert.ok(sess.buildTopic('spo', 20).length > 0, 'Gegenprobe: das Themen-Training lief schon immer');
});

test('das Duell beginnt nicht jedes Mal mit denselben Karten', () => {
  /* Fest sortiert kamen die schwaechsten Karten in jeder Runde erneut - aus dem
     Tempotest wurde das Auswendiglernen von drei Karten. Der Aufbau trennt klar:
     zehn wacklige Karten, vierzig fest sitzende. Die Schwellen sind ausgemessen
     (40 Versuche): nie eine Karte in allen Runden, Anteil der Wackligen zwischen
     30 und 38 Prozent. */
  const t = store.todayNum();
  const aufbau = () => {
    store.resetAll();
    for (let i = 0; i < 10; i++) {
      store.putCard(CARDS[i].id, { ...fresh(), iv: 2, reps: 1, seen: 12, ok: 2, lapses: 6, due: t + 1, last: t });
    }
    for (let i = 10; i < 50; i++) {
      store.putCard(CARDS[i].id, { ...fresh(), iv: 60, reps: 8, seen: 10, ok: 10, lapses: 0, due: t + 60, last: t });
    }
  };
  aufbau();
  const wacklig = new Set(CARDS.slice(0, 10).map(c => c.id));
  const RUNDEN = 12;
  const zaehl = {};
  for (let r = 0; r < RUNDEN; r++) {
    for (const id of new Set(sess.buildDuel(10).map(x => x.card.id))) zaehl[id] = (zaehl[id] || 0) + 1;
  }
  const immer = Object.values(zaehl).filter(n => n === RUNDEN).length;
  assert.equal(immer, 0, `${immer} Karten kamen in allen ${RUNDEN} Duellen vor`);

  // Die Vorauswahl soll trotzdem bei den Wackligen bleiben, nicht rein zufaellig
  // sein: Bei gleicher Chance fuer alle waeren es Bruchteile eines Prozents.
  const treffer = Object.entries(zaehl).filter(([id]) => wacklig.has(id)).reduce((a, [, n]) => a + n, 0);
  const anteil = treffer / (RUNDEN * 10);
  assert.ok(anteil > 0.20 && anteil < 0.55,
    `Anteil wackliger Karten ${(anteil * 100).toFixed(1)} % liegt ausserhalb 20-55 %`);
});

/* ---- Zusammenfuehren zweier Tabs: was nur wachsen darf und was nicht ---- */

/* „Alle Markierungen loeschen" war mit zwei offenen Tabs wirkungslos: Das
   Zusammenfuehren kannte bei flags nur Wachstum, der zweite Tab holte jeden
   geloeschten Stern sofort zurueck. */
test('eine geloeschte Markierung bleibt geloescht', async () => {
  const B = await import('../assets/js/store.js?markier-tab');
  store.toggleFlag('stern-1');
  store.save(true);
  B.save(true);                            // Tab B zieht die Markierung zu sich
  assert.equal(B.isFlagged('stern-1'), true, 'Tab B muss den Stern erst einmal sehen');

  store.toggleFlag('stern-1');             // Tab A nimmt ihn wieder weg
  store.save(true);
  assert.equal(store.isFlagged('stern-1'), false, 'in Tab A ist der Stern weg');

  B.save(true);                            // Tab B schreibt danach irgendetwas
  assert.equal(B.isFlagged('stern-1'), false, 'der geloeschte Stern kam aus Tab B zurueck');
  const abgelegt = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  assert.ok(!abgelegt.flags['stern-1'] || abgelegt.flags['stern-1'] < 0,
    'auch im Speicher darf die Markierung nicht wieder stehen');
});

/* touchStreak() setzt die Serie nach einer Pause bewusst auf 1 zurueck. Stand
   streak in der Maximum-Liste, hob der zweite Tab sie wieder auf den alten
   Wert - die Anzeige log dann eine Serie, die es nicht mehr gab. */
test('eine abgerissene Serie wird vom zweiten Tab nicht wieder aufgeblasen', async () => {
  const B = await import('../assets/js/store.js?serien-tab');
  const st = store.S();
  st.streak = 30; st.best = 30; st.lastDay = store.numToKey(store.todayNum() - 9);
  store.save(true);
  B.save(true);
  assert.equal(B.S().streak, 30, 'Tab B muss die alte Serie erst einmal sehen');

  store.touchStreak();                     // Tab A lernt heute - nach neun Tagen Pause
  store.save(true);
  assert.equal(store.S().streak, 1, 'in Tab A faengt die Serie neu an');

  B.save(true);
  assert.equal(B.S().streak, 1, `die abgerissene Serie stand danach bei ${B.S().streak}`);
  assert.equal(B.S().best, 30, 'der Rekord bleibt dabei stehen');
});

/* Diese Zaehler standen in keiner Merge-Regel: Der schreibende Tab drueckte
   seinen eigenen (aelteren) Stand durch, und die Merkanker fingen von vorne an. */
test('Merkanker und Selbsteinschaetzung ueberleben den zweiten Tab', async () => {
  const B = await import('../assets/js/store.js?zaehler-tab');
  Object.assign(store.S(), {
    claims: 20, claimsMiss: 4, factSeen: 30, factIdx: 7, factDay: '2026-08-20',
  });
  store.save(true);

  B.save(true);                            // Tab B schreibt und fuehrt dabei zusammen
  const b = B.S();
  assert.equal(b.claims, 20, 'claims verloren');
  assert.equal(b.claimsMiss, 4, 'claimsMiss verloren');
  assert.equal(b.factSeen, 30, 'factSeen verloren');
  assert.equal(b.factIdx, 7, 'factIdx gehoert zum groesseren factSeen');
  const abgelegt = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  assert.equal(abgelegt.claims, 20, 'im Speicher steht wieder der alte Stand');
});

/* Der Kartenvergleich beim Zusammenfuehren entscheidet ueber last. Setzt
   nachDuellFehler() das Feld nicht, sieht die gedeckelte Karte genauso alt aus
   wie die ungedeckelte im anderen Tab - und die Deckelung faellt weg. */
test('eine im Duell verpatzte Karte behaelt ihre Deckelung im zweiten Tab', async () => {
  const { nachDuellFehler } = await import('../assets/js/srs.js');
  const B = await import('../assets/js/store.js?duell-tab');
  const t = store.todayNum();
  store.putCard('duell-1', { ef: 2.5, iv: 30, due: t + 20, reps: 5, lapses: 0, seen: 6, ok: 5, last: 1000 });
  store.save(true);
  B.save(true);
  assert.equal(B.cardState('duell-1').iv, 30, 'Tab B muss die Karte erst einmal kennen');

  store.putCard('duell-1', nachDuellFehler(store.cardState('duell-1')));
  store.save(true);
  assert.equal(store.cardState('duell-1').iv, 10, 'die Deckelung selbst muss stimmen');

  B.save(true);
  assert.equal(B.cardState('duell-1').iv, 10,
    `die Deckelung war nach dem Zusammenfuehren wieder bei ${B.cardState('duell-1').iv}`);
});

/* Eine Karte kann markiert sein, ohne je gelernt worden zu sein - beim
   Nachschlagen genuegt ein Tippen auf den Stern. Dann gibt es keinen
   Kartenstand, an dem die Markierung haengen koennte. */
test('eine nur markierte Karte nimmt ihre Markierung ins neue Kennwort mit', () => {
  const c = CARDS[1];
  const alt = c.cat + '-nur-markiert';
  store.toggleFlag(alt);
  assert.equal(store.uebernimmVorgaenger([[c.id, [alt]]]), 1, 'nichts hat sich bewegt');
  assert.equal(store.isFlagged(c.id), true, 'die Markierung ist beim Umformulieren verlorengegangen');
  assert.equal(store.isFlagged(alt), false, 'die alte Kennung ist noch markiert');
});

/* Ein Stand aus einer aelteren Fassung traegt bei den Markierungen noch „true".
   Wuerde das beim Laden verworfen, verschwaenden alle Sterne beim Update. */
test('eine Markierung aus einer aelteren Fassung bleibt erhalten', async () => {
  localStorage.setItem('wissenswerk.v1', JSON.stringify({
    ...JSON.parse(store.exportJSON()), rev: 3, flags: { 'alt-wahr': true },
  }));
  const A = await import('../assets/js/store.js?altbestand');
  assert.equal(A.isFlagged('alt-wahr'), true, 'die alte Markierung ist verlorengegangen');
  // ... und laesst sich danach loeschen, ohne dass sie zurueckkommt.
  A.toggleFlag('alt-wahr');
  assert.equal(A.isFlagged('alt-wahr'), false);
});

/* Die Uebernahme umformulierter Karten lief nur einmal beim Modulstart - also
   vor jedem Einlesen. Wer eine Sicherung zurueckholte, verlor den Stand aller
   Karten, deren Frage seither neu formuliert worden war. */
test('ein eingelesenes Backup traegt umformulierte Karten mit', () => {
  const c = CARDS.find(x => x.alt && x.alt.length);
  assert.ok(c, 'es muss mindestens eine umformulierte Karte geben');
  const stand = { ef: 2.4, iv: 40, due: store.todayNum() + 40, reps: 6, lapses: 1, seen: 9, ok: 8, last: 5000 };
  const datei = JSON.stringify({ ...JSON.parse(store.exportJSON()), cards: { [c.alt[0]]: stand } });

  store.importJSON(datei);
  assert.ok(store.cardState(c.id), 'die umformulierte Karte faengt nach dem Einlesen bei null an');
  assert.equal(store.cardState(c.id).iv, 40, 'der Stand kam unvollstaendig an');
  assert.ok(!store.cardState(c.alt[0]), 'die alte Kennung liegt noch herum');

  // Dasselbe gilt fuer den Weg zurueck: Sicherung holen ersetzt den Stand ebenso.
  store.resetAll();
  assert.ok(!store.cardState(c.id), 'nach dem Zuruecksetzen darf nichts mehr stehen');
  assert.equal(store.sicherungZurueck(), true);
  assert.equal(store.cardState(c.id)?.iv, 40, 'der zurueckgeholte Stand hat die Umformulierung verloren');
});

/* „Alle Markierungen loeschen" beerdigte nur, was DIESER Tab im Speicher hatte.
   Waehrend einer Lerneinheit verwirft ein Tab die Meldungen des anderen bewusst -
   dessen frische Sterne kannte er also nicht, sie bekamen keinen Grabstein, und
   das Speichern danach fuehrte sie wieder herein. Der Nutzer sah „Markierungen
   geloescht" und darunter unveraendert „Alle 1 Markierungen loeschen". */
test('Markierungen loeschen erwischt auch die des zweiten Tabs', async () => {
  const B = await import('../assets/js/store.js?loesch-tab');
  store.toggleFlag('stern-eigen');
  store.save(true);
  B.save(true);                          // Tab B holt sich den Stand
  B.toggleFlag('stern-fremd');           // ... und setzt einen eigenen Stern
  B.save(true);
  assert.equal(store.isFlagged('stern-fremd'), false,
    'Tab A darf den fremden Stern noch nicht kennen - sonst prueft der Test nichts');

  assert.ok(store.loescheAlleMarkierungen() >= 1);

  assert.equal(store.isFlagged('stern-eigen'), false);
  assert.equal(store.isFlagged('stern-fremd'), false, 'der fremde Stern blieb stehen');
  const abgelegt = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  const uebrig = Object.entries(abgelegt.flags).filter(([, v]) => v === true || v > 0);
  assert.deepEqual(uebrig, [], `im Speicher stehen noch Markierungen: ${JSON.stringify(uebrig)}`);
  B.save(true);
  assert.equal(B.isFlagged('stern-fremd'), false, 'Tab B holt seinen Stern zurueck');
});

/* Der Stempel ist zugleich die Fassungsnummer der Entscheidung. Faengt die Uhr
   bei 0 an, kann eine spaetere Entscheidung einen KLEINEREN Betrag tragen als
   eine fruehere - etwa wenn die Geraeteuhr vorging und dann korrigiert wurde.
   Dann gewinnt beim Zusammenfuehren der alte Stern gegen den neuen Grabstein. */
test('ein Grabstein schlaegt auch einen Stern aus der Zukunft', async () => {
  const st = store.S();
  st.flags['stern-zukunft'] = Date.now() + 3600000;      // Uhr ging eine Stunde vor
  store.save(true);
  const B = await import('../assets/js/store.js?uhr-tab');
  assert.equal(B.isFlagged('stern-zukunft'), true, 'Tab B muss den Stern erst sehen');

  B.toggleFlag('stern-zukunft');                          // jetzt wegnehmen
  B.save(true);
  assert.equal(B.isFlagged('stern-zukunft'), false);

  store.save(true);                                       // Tab A schreibt irgendetwas
  assert.equal(store.isFlagged('stern-zukunft'), false,
    'der Stern aus der Zukunft hat den Grabstein ueberlebt');
});

/* Die Deckelung nach einem Duellfehler traegt eine frische last-Marke, und beim
   Zusammenfuehren gewinnt der juengere Stand als GANZES. Auf einem veralteten
   Kartenzustand angewandt loeschte sie damit eine im anderen Tab bereits
   gezaehlte Wiederholung: reps, ok und das gewachsene Intervall waren weg. */
test('ein Duellfehler wirft die Wiederholung des anderen Tabs nicht weg', async () => {
  const { nachDuellFehler } = await import('../assets/js/srs.js');
  const B = await import('../assets/js/store.js?duellverlust-tab');
  const t = store.todayNum();
  store.putCard('karte-x', { ef: 2.5, iv: 14, due: t, reps: 4, lapses: 0, seen: 11, ok: 9, last: 1000 });
  store.save(true);
  B.save(true);                                    // beide Tabs kennen die Karte

  // Tab A wiederholt sie regulaer und schreibt.
  store.putCard('karte-x', { ef: 2.6, iv: 35, due: t + 35, reps: 5, lapses: 0, seen: 12, ok: 10, last: 2000 });
  store.save(true);

  // Tab B kennt das nicht (war beschaeftigt) und verpatzt sie im Duell.
  B.aendereKarte('karte-x', (aktuell) => nachDuellFehler(aktuell));
  B.save(true);

  const nachher = JSON.parse(localStorage.getItem('wissenswerk.v1')).cards['karte-x'];
  assert.equal(nachher.reps, 5, `die Wiederholung von Tab A ist weg: ${JSON.stringify(nachher)}`);
  assert.equal(nachher.seen, 12, 'die gezaehlte Abfrage ist weg');
  assert.equal(nachher.ok, 10, 'die richtige Antwort ist weg');
  assert.equal(nachher.due, t, 'die Karte muss trotzdem ins naechste Training');
  assert.ok(nachher.iv < 35, `die Deckelung fehlt: iv ${nachher.iv}`);
});

/* Quizrunden werden nur angehaengt. Zwei Tabs, die je eine Runde spielen,
   muessen hinterher beide Runden haben - und der Bestwert ist ein Rekord, der
   nie faellt. */
test('eine im anderen Tab gespielte Quizrunde geht nicht verloren', async () => {
  const B = await import('../assets/js/store.js?quiz-tab');
  store.merkeQuizRunde({ t: 1000, p: 120, m: 180, r: 8, f: 2, l: 2, k: { geo: [15, 30] } });
  // Tab B kennt den ersten Stand, spielt dann seine eigene Runde ...
  B.merkeQuizRunde({ t: 2000, p: 90, m: 180, r: 6, f: 3, l: 3, k: { spo: [0, 30] } });
  // ... und Tab A spielt noch eine, ohne von B gehoert zu haben, ausser ueber den Speicher.
  store.merkeQuizRunde({ t: 3000, p: 150, m: 180, r: 10, f: 1, l: 1, k: { ges: [30, 30] } });
  const runden = store.S().quizRunden.map(r => r.t);
  assert.deepEqual(runden, [1000, 2000, 3000], `Runden: ${runden}`);
  assert.equal(store.S().quizBest, 150);
  assert.equal(new Set(store.S().quizRunden.map(r => r.t)).size, 3, 'keine Runde doppelt');
});

test('kaputte Quizrunden im Speicher bringen die App nicht zu Fall', () => {
  const { mischeRunden } = store;
  assert.deepEqual(mischeRunden([{ t: 5 }, { t: 3 }], [{ t: 5 }, null, { t: 4 }]).map(r => r.t), [3, 4, 5]);
  const viele = Array.from({ length: 40 }, (_, i) => ({ t: i + 1 }));
  assert.equal(mischeRunden(viele, []).length, 30, 'hoechstens dreissig Runden');
  assert.equal(mischeRunden(viele, [])[0].t, 11, 'die aeltesten fallen weg');
  const datei = JSON.stringify({ ...JSON.parse(store.exportJSON()),
    quizRunden: [{ t: 'x' }, 'unsinn', { t: 7, p: -5, k: { geo: 'kein array', spo: [3, 15] } }], quizBest: 'viel' });
  const rein = store.pruefeBackup(datei);
  assert.deepEqual(rein.quizRunden, [{ t: 7, p: 0, m: 0, r: 0, f: 0, l: 0, k: { spo: [3, 15] } }]);
  assert.equal(rein.quizBest, 0);
});

/* Das Quiz zieht quer durch alle aktiven Themen - auch nie gesehene Karten,
   denn ein Quizspiel fragt nicht nur, was man schon gelernt hat. Pausierte
   Themen bleiben draussen; wer Mathematik abgeschaltet hat, will sie auch im
   Quiz nicht. (Das Duell ohne Thema haelt es genauso.) */
test('die Quizrunde fragt jedes aktive Thema und laesst pausierte weg', () => {
  const alle = sess.buildQuiz();
  assert.equal(alle.length, 12);
  assert.equal(new Set(alle.map(x => x.card.cat)).size, 9, 'alle neun Themen');
  store.setSetting('cats', ['spo', 'geo', 'ges']);
  const drei = sess.buildQuiz();
  assert.equal(drei.length, 12, 'auch mit drei Themen eine volle Runde');
  assert.deepEqual([...new Set(drei.map(x => x.card.cat))].sort(), ['geo', 'ges', 'spo']);
  assert.equal(new Set(drei.map(x => x.card.id)).size, 12, 'keine Karte doppelt');
});

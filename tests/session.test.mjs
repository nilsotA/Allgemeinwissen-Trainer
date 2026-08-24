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
  st.flags['pruef-1'] = true;
  Object.assign(st, {
    totalAnswers: 99, totalCorrect: 70, streak: 5, best: 9, lastDay: '2026-08-20',
    claims: 20, claimsMiss: 4, factSeen: 30, factIdx: 30, factDay: '2026-08-20',
    duelBest: 8, duelAnswers: 40, duelCorrect: 25, lastExport: 19000,
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

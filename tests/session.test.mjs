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

/* Der Speicher wird MIT geleert, nicht nur der Zustand. Sonst reicht ein Test
   sein Netz (wissenswerk.v1.vorher) an den naechsten weiter – und seit
   sichereJetzigen() ein reicheres Netz nicht mehr ueberschreibt, entscheidet
   die Reihenfolge der Tests darueber, was „Letztes Einlesen rueckgaengig"
   zurueckholt. Ein frisches Geraet hat weder Zustand noch Netz. */
beforeEach(() => { speicher.clear(); store.resetAll(); });

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

  /* Der Test lief bisher nur auf frisch zurueckgesetztem Speicher, also mit
     today().newC === 0. Dort ist newBudget() schlicht newPerDay, und 0 <= 5 zu
     pruefen erreicht die eigentliche Mechanik gar nicht: den ABZUG der heute
     schon gelernten Karten. Der Fall „heute schon welche gelernt" kam in keiner
     der Pruefungen vor. */
  store.today().newC = 4;
  assert.equal(sess.newBudget(), 1, 'schon gelernte neue Karten müssen abgezogen werden');
  assert.equal(sess.buildDaily().filter(x => x.fresh).length, 1,
    'bei Budget 5 und 4 verbrauchten darf genau eine neue Karte kommen');

  store.today().newC = 7;                       // mehr verbraucht als erlaubt
  assert.equal(sess.newBudget(), 0, 'ein überschrittenes Budget darf nicht negativ werden');
  assert.equal(sess.buildDaily().filter(x => x.fresh).length, 0,
    'ist das Budget aufgebraucht, kommt keine neue Karte mehr');
  store.today().newC = 0;
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
  // Ohne diese Zeile ist die Zusicherung bei leerem Plan trivial wahr.
  assert.ok(q.length > 0, 'Tagesplan leer – die Zusicherung darüber wäre trivial');
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

test('das Duell fragt nur Gelerntes, sobald es zehn gelernte Karten gibt', () => {
  /* Der Knopf verspricht „zehn Fragen aus dem Gelernten". Frueher fuellte ein
     dritter Topf pauschal aus dem ganzen Bestand auf: Nach zwei Wochen waren im
     Schnitt 3,7 von 10 Fragen nie gesehen, und kein einziges Duell hielt das
     Versprechen. Ein Fehler auf so einer Karte verfiel dazu spurlos. */
  const t = store.todayNum();
  const bekannt = (anzahl) => {
    store.resetAll();
    for (let i = 0; i < anzahl; i++)
      store.putCard(CARDS[i].id, { ...fresh(), seen: 6, ok: 4, reps: 3, iv: 5, due: t, last: t });
    return new Set(CARDS.slice(0, anzahl).map(c => c.id));
  };
  const ids = bekannt(120);
  for (let r = 0; r < 25; r++) {
    const duell = sess.buildDuel(10);
    assert.equal(duell.length, 10, 'das Duell muss zehn Fragen liefern');
    const fremd = duell.filter(x => !ids.has(x.card.id));
    assert.equal(fremd.length, 0,
      `Runde ${r}: ${fremd.length} nie gesehene Karten im Duell (${fremd.map(x => x.card.q.slice(0, 30)).join(' | ')})`);
  }
});

test('in der ersten Woche fuellt das Duell mit Unberuehrtem auf', () => {
  /* Die Kehrseite der Regel: Wer erst sieben Karten gelernt hat, soll trotzdem
     zehn Fragen bekommen - sonst waere der Knopf in der ersten Woche tot. */
  const t = store.todayNum();
  for (const wieViele of [0, 3, 7, 9]) {
    store.resetAll();
    for (let i = 0; i < wieViele; i++)
      store.putCard(CARDS[i].id, { ...fresh(), seen: 4, ok: 3, reps: 2, iv: 3, due: t, last: t });
    const duell = sess.buildDuel(10);
    assert.equal(duell.length, 10, `${wieViele} bekannte Karten: nur ${duell.length} Fragen`);
    assert.equal(new Set(duell.map(x => x.card.id)).size, 10, `${wieViele}: doppelte Karten`);
    const bekannteDrin = duell.filter(x => (store.cardState(x.card.id)?.seen || 0) > 0).length;
    assert.equal(bekannteDrin, wieViele,
      `${wieViele} bekannte Karten, aber ${bekannteDrin} im Duell - das Gelernte kommt zuerst`);
  }
});

test('Vorschau summiert sich zur Zahl der eingeplanten Wiederholungen', () => {
  /* Frueher: due = heute + (i % 10). Das verteilt gleichmaessig, schliesst
     Ueberfaellige aus – und geprueft wurde nur Laenge, Vorzeichen und Summe.
     Damit haette forecast() alles in einen Tag legen oder die Tage vertauschen
     koennen, ohne dass etwas auffaellt: der ganze Sinn einer Vorschau. Jetzt
     steht ein unsymmetrischer Plan mit Ueberfaelligen dahinter, und verglichen
     wird das ganze Feld. */
  const versatz = [-3, -1, 0, 0, 0, 1, 1, 2, 4, 4, 4, 4, 6, 9, 12];
  versatz.forEach((v, i) => {
    const cs = schedule(fresh(), GOOD);
    cs.due = store.todayNum() + v;
    store.putCard(CARDS[i].id, cs);
  });
  const fc = sess.forecast(7);
  assert.equal(fc.length, 7);
  assert.ok(fc.every(n => Number.isInteger(n) && n >= 0));
  // Ueberfaellige gehoeren auf den heutigen Tag, alles ab Tag 7 faellt heraus.
  const soll = [0, 0, 0, 0, 0, 0, 0];
  for (const v of versatz) if (v < 7) soll[Math.max(0, v)]++;
  assert.deepEqual(fc, soll, `Vorschau ${fc.join(',')} statt ${soll.join(',')}`);
});

test('Übersicht bleibt in sich stimmig', () => {
  CARDS.slice(0, 20).forEach(c => store.putCard(c.id, schedule(fresh(), GOOD)));
  const o = sess.overview();
  assert.equal(o.total, CARDS.length);
  assert.ok(o.seen <= o.total && o.learned <= o.seen && o.mature <= o.learned);
  assert.ok(o.accuracy >= 0 && o.accuracy <= 1);
  /* Die Ungleichungskette darueber besteht auch, wenn overview() durchweg 0
     meldet – 0 <= 0 <= 0 <= 0. Sie sagt dann nichts mehr ueber die Zaehlung,
     nur noch ueber die Reihenfolge dreier Nullen. Also erst die Zahlen selbst. */
  assert.equal(o.seen, 20, `20 Karten angefangen, overview meldet ${o.seen}`);
  assert.ok(o.learned > 0, 'nach einer guten Antwort muss mindestens eine Karte gelernt sein');
  assert.ok(o.total > 2000, 'die Gesamtzahl muss der Sammlung entsprechen');
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
    settings: { newPerDay: 'alle', recallMode: 'boeser-modus', theme: 'javascript:', cats: [1, 2, {}, 'sprache'], focus: ['sprache'] },
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
  assert.deepEqual(s.settings.cats, ['sprache'], 'nur Zeichenketten dürfen als Kategorien überleben');
  /* Die Ablage laesst ein erfundenes Kuerzel stehen - sie weiss nichts ueber
     Themen. Wirksam werden darf es trotzdem nicht: Sonst liegt kein einziges
     Thema mehr im Umfang und die Startseite meldet wortlos „alles erledigt". */
  assert.equal(sess.activeCats(), null, 'ein erfundenes Kuerzel darf keinen Umfang aufspannen');
  assert.equal(sess.focusCats(), null, 'und auch keinen Schwerpunkt');
  assert.ok(sess.buildDaily().length > 0, 'es muss weiter etwas zu lernen geben');
});

test('ein erfundenes Themenkuerzel sperrt die Einstellungen nicht aus', () => {
  /* Der Aussperrer: cats/focus mit einem Kuerzel, das es nicht gibt - ein
     Tipper in einer von Hand bearbeiteten Sicherung. Vorher warf der Aufbau des
     Einstellungsbildschirms, und mit ihm waren „Einlesen", „Rueckgaengig" und
     „Alles zuruecksetzen" dauerhaft unerreichbar. */
  store.resetAll();
  store.setSetting('cats', ['geo', 'sprache']);
  store.setSetting('focus', ['sprache']);
  assert.deepEqual([...sess.activeCats()], ['geo'], 'nur das echte Kuerzel spannt den Umfang auf');
  assert.equal(sess.focusCats(), null, 'ein erfundener Schwerpunkt wirkt nicht');
  const q = sess.buildDaily();
  assert.ok(q.length > 0 && q.every(x => x.card.cat === 'geo'), 'geuebt wird das echte Thema');
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

test('zwei Tabs verschlucken keine Festlegung', async () => {
  /* claims und claimsMiss wurden beim Zusammenfuehren mit dem Maximum
     vereinigt - genau der Fehler, vor dem der Kommentar am Kopf von store.js
     warnt. Zwei Tabs mit je einer Festlegung ergaben claims=1 statt 2: Die
     Selbsteinschaetzung zeigte „5 / 19 - deutlich zu optimistisch", wahr waren
     5 / 20 und „solide". Der Test faehrt zwei echte Modulinstanzen. */
  const sitzung = {};
  globalThis.sessionStorage = { getItem: (k) => sitzung[k] ?? null, setItem: (k, v) => { sitzung[k] = String(v); } };
  const A = await import('../assets/js/store.js?festlegungen-a');
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };   // eigener Tab, eigene Kennung
  const B = await import('../assets/js/store.js?festlegungen-b');
  /* Erst beide auf denselben Stand: Ein resetAll() traegt eine neue
     Generationsnummer, und ein hoeherer Stand wird uebernommen statt
     eingesammelt - der erste Zaehlschritt fiele sonst weg. */
  A.resetAll(); A.save(true); B.resetAll(); B.save(true);
  A.save(true); B.save(true);

  A.zaehle('claim'); A.zaehle('claimMiss');   // Tab A: eine Festlegung, daneben
  A.S().claims = 1; A.S().claimsMiss = 1;
  A.save(true);
  B.zaehle('claim');                          // Tab B: eine Festlegung, richtig
  B.S().claims = 1;
  B.save(true);

  const danach = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  assert.equal(danach.claims, 2, `zwei Festlegungen, gezaehlt: ${danach.claims}`);
  assert.equal(danach.claimsMiss, 1, `ein Fehlgriff, gezaehlt: ${danach.claimsMiss}`);
});

test('eine zurueckgenommene Festlegung holt der andere Tab nicht zurueck', async () => {
  /* Der zweite Weg in dasselbe Loch: Tab A legt sich fest und nimmt die
     Antwort mit „Rueckgaengig" zurueck - claims faellt also von 1 auf 0. Beim
     naechsten Schreiben von Tab B trug dessen Maximum die alte 1 wieder ein. */
  const sitzung = {};
  globalThis.sessionStorage = { getItem: (k) => sitzung[k] ?? null, setItem: (k, v) => { sitzung[k] = String(v); } };
  const A = await import('../assets/js/store.js?zuruecknehmen-a');
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  const B = await import('../assets/js/store.js?zuruecknehmen-b');
  A.resetAll(); A.save(true); B.resetAll(); B.save(true);
  A.save(true); B.save(true);

  /* Genau der Ablauf aus app.js: erst den Tageseintrag tief kopieren (das tut
     snapshot()), dann antworten, dann zuruecknehmen. */
  const vorher = structuredClone(A.today());
  A.zaehle('claim'); A.S().claims = 1;
  A.save(true);
  B.save(true);                              // Tab B holt den Stand mit der Festlegung
  assert.equal(B.S().claims, 1, 'Tab B muss die Festlegung erst einmal kennen');

  // undoLast(): Tageseintrag zurueck, Gesamtzahl zurueck, Ablage benachrichtigen.
  A.S().days[A.dayKey()] = vorher;
  A.S().claims = 0;
  A.beitragZurueck(A.dayKey());
  A.save(true);

  B.zaehle('done');                          // Tab B beantwortet irgendeine Karte
  B.save(true);
  const danach = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  assert.equal(danach.claims, 0, `die zurueckgenommene Festlegung ist wieder da: ${danach.claims}`);
});

test('eine zurueckgenommene Antwort bleibt auch mit zweitem Tab zurueckgenommen', async () => {
  /* Der allgemeine Fall derselben Luecke: Der Beitrag eines Tabs konnte nur
     wachsen (Maximum je Feld), also kam jede Ruecknahme zurueck, sobald der
     zweite Tab schrieb - samt verbrauchtem Budget fuer neue Karten. Jeder
     Beitragsblock traegt jetzt eine eigene Fassungsnummer, und die juengere
     gilt als Ganzes. */
  const sitzung = {};
  globalThis.sessionStorage = { getItem: (k) => sitzung[k] ?? null, setItem: (k, v) => { sitzung[k] = String(v); } };
  const A = await import('../assets/js/store.js?ruecknahme-a');
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  const B = await import('../assets/js/store.js?ruecknahme-b');
  A.resetAll(); A.save(true); B.resetAll(); B.save(true);
  A.save(true); B.save(true);

  for (let i = 0; i < 3; i++) { A.zaehle('done'); A.zaehle('newC'); }
  A.S().totalAnswers = 3;
  A.save(true);
  B.save(true);                              // Tab B kennt jetzt drei Antworten
  const vorher = structuredClone(A.today());

  A.zaehle('done'); A.zaehle('newC'); A.S().totalAnswers = 4;   // die vierte Antwort
  A.save(true);
  B.save(true);
  assert.equal(JSON.parse(localStorage.getItem('wissenswerk.v1')).days[A.dayKey()].done, 4);

  A.S().days[A.dayKey()] = vorher;           // undoLast()
  A.S().totalAnswers = 3;
  A.beitragZurueck(A.dayKey());
  A.save(true);
  B.zaehle('done'); B.S().totalAnswers = 1;  // Tab B beantwortet danach eine Karte
  B.save(true);

  const stand = JSON.parse(localStorage.getItem('wissenswerk.v1'));
  assert.equal(stand.days[A.dayKey()].done, 4,
    `drei aus Tab A plus eine aus Tab B, gezaehlt ${stand.days[A.dayKey()].done}`);
  assert.equal(stand.days[A.dayKey()].newC, 3,
    `die zurueckgenommene neue Karte ist wieder da: ${stand.days[A.dayKey()].newC} statt 3`);
  assert.equal(stand.totalAnswers, 4, `Gesamtzahl ${stand.totalAnswers} statt 4`);
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

/* Die Gegnerpruefung des Quizmodus fand: Der Bestwert wurde gelesen, BEVOR
   merkeQuizRunde ueber holeFremdenStand() den Stand des anderen Tabs einholte.
   Waehrend einer laufenden Runde verwirft ein Tab die Meldungen des anderen,
   der eigene quizBest ist also womoeglich veraltet - und der Rueckblick meldete
   „Neuer Bestwert!" fuer eine Punktzahl, die der andere Tab laengst ueberboten
   hatte. merkeQuizRunde gibt den Bestwert deshalb selbst zurueck, nach dem
   Einholen. */
test('der Bestwert kennt die Runde des anderen Tabs', async () => {
  const B = await import('../assets/js/store.js?quiz-best');
  store.merkeQuizRunde({ t: 1000, p: 100, m: 180, r: 7, f: 3, l: 2, k: {} });
  B.merkeQuizRunde({ t: 2000, p: 170, m: 180, r: 12, f: 0, l: 0, k: {} });   // anderer Tab, hoeher
  const vorher = store.merkeQuizRunde({ t: 3000, p: 150, m: 180, r: 10, f: 1, l: 1, k: {} });
  assert.equal(vorher, 170, 'der zurueckgegebene Bestwert muss den fremden Tab kennen');
  assert.equal(store.S().quizBest, 170, 'und 150 darf ihn nicht senken');
  assert.ok(150 <= vorher, 'die Runde ist damit kein neuer Bestwert');
});

/* Die Quizrunde ist die Spieleabend-Simulation. Vorher zog sie auch „Was ist die
   Ableitung von x hoch drei?" und den Doppelauftrag des Schulsports - Lehrerwissen,
   das am Spieleabend niemand fragt. Es bleibt im Tagestraining, nur der
   Pruefstand laesst es aus, solange die Einstellung aus ist. */
test('die Quizrunde fragt wie ein Spieleabend, nicht wie ein Staatsexamen', () => {
  /* Zuerst das Sieb selbst messen. istLehrerwissen prueft c.sub gegen eine von
     Hand gepflegte Namensliste, und buildQuiz filtert mit derselben Funktion –
     der Test befragte also das Sieb mit dem Sieb. Faellt ein Name aus der Liste
     heraus, weil ein Teilgebiet in data/*.js umbenannt wird, rutschen die Karten
     durch buildQuiz UND gelten nicht mehr als Lehrerwissen: lehrer.length bleibt
     0, und der Test besteht, waehrend genau das passiert, was er verhindern soll. */
  const abgedeckt = new Set(CARDS.filter(sess.istLehrerwissen).map(c => c.cat + '/' + c.sub));
  assert.equal(abgedeckt.size, 13,
    `LEHRERWISSEN nennt Teilgebiete, die es im Bestand nicht mehr gibt – abgedeckt sind nur: ${[...abgedeckt].sort().join(', ')}`);

  const gezogen = [];
  for (let i = 0; i < 30; i++) gezogen.push(...sess.buildQuiz().map(x => x.card));
  const lehrer = gezogen.filter(sess.istLehrerwissen);
  assert.equal(lehrer.length, 0, `Lehrerwissen in der Quizrunde: ${lehrer.slice(0, 3).map(c => c.cat + '/' + c.sub).join(', ')}`);
  assert.ok(gezogen.some(c => c.cat === 'mat') && gezogen.some(c => c.cat === 'spo'),
    'Mathe und Sport bleiben trotzdem dabei - mit Mathegeschichte, Anatomie, Regelkunde');
  // Wer es will, bekommt es: dann kommt Lehrerwissen in 360 Ziehungen praktisch sicher vor.
  store.setSetting('quizLehrerwissen', true);
  const mit = [];
  for (let i = 0; i < 30; i++) mit.push(...sess.buildQuiz().map(x => x.card));
  assert.ok(mit.some(sess.istLehrerwissen), 'mit Einstellung muss Lehrerwissen wieder gezogen werden');
});

/* Eine zu Ende gespielte Quizrunde machte den gespeicherten Stand unlesbar.
   load() laeuft beim Modulstart und ruft saeubereRunden(); dessen Helfer `zahl`
   war ein const und lag zu diesem Zeitpunkt noch in seiner Totzone. Der catch
   in load() fing den ReferenceError als „Speicher unlesbar" ab und die App
   startete mit den Standardwerten. Die Kartenstaende kamen beim naechsten
   Speichern ueber das Zusammenfuehren zurueck, die EINSTELLUNGEN nicht –
   Farbschema, neue Karten pro Tag und abgeschaltete Themen waren bei jedem
   Start wieder auf Anfang. Der Test laedt das Modul in einer frischen Lage mit
   genau einer gespeicherten Runde. */
test('eine gespeicherte Quizrunde überlebt den Neustart samt Einstellungen', async () => {
  const abgelegt = {
    rev: 5, totalAnswers: 42,
    settings: { theme: 'dark', newPerDay: 30, cats: ['mat'] },
    cards: {},
    quizRunden: [{ t: 1767225600000, p: 9, m: 12, r: 9, f: 3, l: 4, k: { mat: [3, 4] } }],
  };
  const { execFileSync } = await import('node:child_process');
  const wurzel = new URL('..', import.meta.url).pathname;
  const skript = `
    globalThis.localStorage = {
      _d: { 'wissenswerk.v1': ${JSON.stringify(JSON.stringify(abgelegt))} },
      getItem(k) { return this._d[k] ?? null; },
      setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; },
    };
    const s = await import(${JSON.stringify(wurzel + 'assets/js/store.js')});
    console.log(JSON.stringify({ a: s.S().totalAnswers, t: s.settings().theme,
      n: s.settings().newPerDay, c: s.settings().cats, r: s.S().quizRunden.length }));
  `;
  const aus = execFileSync(process.execPath, ['--input-type=module', '-e', skript],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const ist = JSON.parse(aus.trim().split('\n').pop());
  assert.equal(ist.a, 42, 'der gespeicherte Stand wurde nicht geladen');
  assert.equal(ist.t, 'dark', 'das Farbschema ist verlorengegangen');
  assert.equal(ist.n, 30, 'die Zahl neuer Karten pro Tag ist verlorengegangen');
  assert.deepEqual(ist.c, ['mat'], 'die Themenauswahl ist verlorengegangen');
  assert.equal(ist.r, 1, 'die gespeicherte Quizrunde ist verschwunden');
});

/* Vier Wege, auf denen der Lernfortschritt verschwand. Alle vier hat der
   App-Pruefstand im Browser nachgestellt; hier stehen sie als Netz. */
test('„Gesicherten Stand zurückholen" ist umkehrbar', () => {
  // Stand A: ein Jahr Lernen. Dann ein Backup einlesen (Stand B, duenn).
  store.putCard('probe-a', { ...fresh(), iv: 40, reps: 6, seen: 9, ok: 8 });
  store.S().totalAnswers = 4500;
  const duenn = JSON.stringify({ ...JSON.parse(store.exportJSON()), cards: {}, totalAnswers: 3 });
  store.importJSON(duenn);
  assert.equal(store.kennzahlen(store.S()).antworten, 3, 'das duenne Backup muss angekommen sein');

  // Der Griff holt Stand A zurueck – und der duenne wandert ins Netz.
  assert.equal(store.sicherungZurueck(), true);
  assert.equal(store.kennzahlen(store.S()).antworten, 4500, 'Stand A kam nicht zurueck');
  assert.ok(store.sicherungKennzahlen(), 'nach dem Zurueckholen fehlt das Netz – der Griff waere einmalig');

  /* Und der Weg zurueck steht offen. Frueher loeschte sicherungZurueck() den
     Schluessel: Wer den Knopf Monate nach dem Einlesen antippte – er steht dort
     unveraendert, zehn Pixel unter dem roten –, verlor alles seither Gelernte
     ohne jede Umkehr. */
  assert.equal(store.sicherungZurueck(), true);
  assert.equal(store.kennzahlen(store.S()).antworten, 3, 'der zweite Griff fuehrt nicht zurueck');
});

test('ein dünnerer Stand überschreibt kein reicheres Netz', () => {
  // Ein Jahr Fortschritt, dann ein Fehlgriff im Dateiwaehler.
  store.S().totalAnswers = 12000;
  store.importJSON(JSON.stringify({ ...JSON.parse(store.exportJSON()), cards: {}, totalAnswers: 40 }));
  assert.equal(store.sicherungKennzahlen().antworten, 12000, 'das Jahr muss im Netz liegen');

  /* Jetzt „Alles zuruecksetzen", um den Fehlgriff loszuwerden. Frueher schrieb
     das den Fehlgriff ueber das Jahr – und „rueckgaengig" holte danach genau
     den Fehlgriff zurueck, den der Nutzer loswerden wollte. */
  store.resetAll();
  assert.equal(store.sicherungKennzahlen().antworten, 12000,
    'das Zuruecksetzen hat das reichere Netz ueberschrieben');
  store.sicherungZurueck();
  assert.equal(store.kennzahlen(store.S()).antworten, 12000, 'das Jahr ist nicht mehr erreichbar');
});

test('Einlesen meldet nicht „geladen", wenn der Speicher voll ist', () => {
  const echt = globalThis.localStorage.setItem;
  const datei = JSON.stringify({ ...JSON.parse(store.exportJSON()), cards: {}, totalAnswers: 5000 });
  globalThis.localStorage.setItem = (k) => {
    if (k === 'wissenswerk.v1') { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; }
  };
  try {
    assert.equal(store.importJSON(datei), false,
      'importJSON meldet Erfolg, obwohl nichts geschrieben wurde – der Stand waere beim naechsten Oeffnen weg');
  } finally { globalThis.localStorage.setItem = echt; }
});

test('ein unlesbarer Speicher wird gemeldet und die Rohdaten aufgehoben', async () => {
  const { execFileSync } = await import('node:child_process');
  const wurzel = new URL('..', import.meta.url).pathname;
  const skript = `
    globalThis.localStorage = {
      _d: { 'wissenswerk.v1': '{"rev":3,"totalAnswers":8000,"cards":{"a":{' },
      getItem(k) { return this._d[k] ?? null; },
      setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
    };
    const s = await import(${JSON.stringify(wurzel + 'assets/js/store.js')});
    console.log(JSON.stringify({ p: !!s.startProblem(),
      roh: globalThis.localStorage._d['wissenswerk.v1.kaputt'] || null }));
  `;
  const aus = execFileSync(process.execPath, ['--input-type=module', '-e', skript],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const ist = JSON.parse(aus.trim().split('\n').pop());
  assert.equal(ist.p, true, 'der Startfehler wird nicht gemeldet – die App startet stumm bei null');
  assert.ok(ist.roh && ist.roh.includes('8000'),
    'die unlesbaren Rohdaten sind nicht aufgehoben – daraus liesse sich von Hand noch retten');
});

/* Tageszaehler waren das einzige, was zwei Tabs unabhaengig hochzaehlen – und
   sie wurden beim Zusammenfuehren ueber Math.max vereinigt. Das Maximum zweier
   unabhaengig gewachsener Zahlen ist nicht ihre Summe: Nachgestellt wurden aus
   acht gegebenen Antworten vier, in der Tagesstatistik wie in der Gesamtzahl. */
test('zwei Tabs verlieren keine Antwort aus der Zählung', async () => {
  const sitzung = {};
  globalThis.sessionStorage = { getItem: (k) => sitzung[k] ?? null, setItem: (k, v) => { sitzung[k] = String(v); } };
  const A = await import('../assets/js/store.js?zwei-tabs-a');
  // Der zweite Tab hat eine eigene Kennung – also einen leeren sessionStorage.
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  const B = await import('../assets/js/store.js?zwei-tabs-b');
  /* Erst beide auf denselben Stand bringen. Ein resetAll() traegt eine neue
     Generationsnummer, und ein Stand hoeherer Generation wird UEBERNOMMEN statt
     eingesammelt – der erste Zaehlschritt des anderen Tabs faellt dabei zu
     Recht weg. Gemessen im ersten Anlauf: sieben statt acht. */
  A.resetAll(); A.save(true); B.resetAll(); B.save(true);
  A.save(true); B.save(true);

  for (let i = 0; i < 4; i++) {
    A.zaehle('done'); A.zaehle('correct'); A.save(true);
    B.zaehle('done'); B.save(true);
  }
  const stand = JSON.parse(globalThis.localStorage.getItem('wissenswerk.v1'));
  const tag = Object.values(stand.days)[0];
  assert.equal(tag.done, 8, `acht Antworten gegeben, gezaehlt ${tag.done}`);
  assert.equal(tag.correct, 4, `vier richtige gegeben, gezaehlt ${tag.correct}`);
  assert.equal(stand.totalAnswers, 8, `Gesamtzahl ${stand.totalAnswers} statt 8`);
  assert.equal(stand.totalCorrect, 4, `Gesamtrichtige ${stand.totalCorrect} statt 4`);
  // Je Tab ein Eintrag – der Schluesselvorrat waechst mit den Tabs, nicht mit den Starts.
  assert.equal(Object.keys(tag.je).length, 2, JSON.stringify(tag.je));
});

/* Ein Tagesbuch ohne „je" stammt aus der Zeit vor dieser Rechnung. Sein
   bisheriger Stand darf nicht verschwinden, sobald der erste Tab wieder zaehlt. */
test('alte Tagesbücher ohne Beitragsliste überleben', async () => {
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  const C = await import('../assets/js/store.js?altbestand');
  C.resetAll();
  const heute = C.today();
  heute.done = 17; heute.correct = 9;        // so sah es vor der Umstellung aus
  delete heute.je;
  C.zaehle('done');
  assert.equal(C.today().done, 18, 'der alte Stand ist beim ersten Zaehlen verschwunden');
  assert.equal(C.today().correct, 9, 'die alten Richtigen sind verschwunden');
});

/* Der Deckel auf die Beitragsliste warf weg, statt zu deckeln: Die ersten acht
   Schluessel blieben, der Rest fiel, und summiere() schrieb die kleinere Summe
   in den Tag. Wer seine eigene Sicherung wieder einlas, verlor damit stillschweigend
   Antworten – in genau dem Vorgang, der den Fortschritt retten soll.
   Die Begruendung fuer die Acht war falsch: Auf dem iPhone bekommt jeder
   Kaltstart der installierten App einen frischen sessionStorage und damit eine
   neue Kennung. Zehn Starts an einem Tag sind zehn Schluessel. */
test('eine Sicherung mit vielen Tagesbeiträgen kommt heil zurück', async () => {
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  const S = await import('../assets/js/store.js?rundreise-je');
  const je = {};
  for (let i = 0; i < 10; i++) je['start' + i] = { done: 3, correct: 2 };
  const datei = JSON.stringify({ rev: 1, cards: {}, days: { '2026-09-14': { done: 30, correct: 20, je } } });

  const rein = S.pruefeBackup(datei);
  const tag = rein.days['2026-09-14'];
  assert.equal(tag.done, 30, `aus 30 Antworten wurden ${tag.done}`);
  assert.equal(tag.correct, 20, `aus 20 richtigen wurden ${tag.correct}`);
  assert.equal(Object.keys(tag.je).length, 10, 'Beitraege sind verschwunden');
});

test('eine präparierte Datei flutet den Speicher nicht – verliert aber auch nichts', async () => {
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  const S = await import('../assets/js/store.js?flut');
  const je = {};
  for (let i = 0; i < 500; i++) je['k' + i] = { done: 1 };
  const rein = S.pruefeBackup(JSON.stringify({ rev: 1, cards: {}, days: { '2026-09-14': { done: 500, je } } }));
  const tag = rein.days['2026-09-14'];
  assert.ok(Object.keys(tag.je).length <= 65, `${Object.keys(tag.je).length} Schluessel – der Deckel greift nicht`);
  assert.equal(tag.done, 500, `die Summe ist von 500 auf ${tag.done} gefallen`);
});

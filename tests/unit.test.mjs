/* Einheitentests für Lernalgorithmus und Fragenlogik.  Aufruf: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { schedule, strength, preview, isDue, isNew, isLeech, nachDuellFehler, fresh,
        AGAIN, HARD, GOOD, EASY } = await import('../assets/js/srs.js');
const { todayNum } = await import('../assets/js/store.js');
const { options, similarity, bewerte, normalize, shuffle, OHNE_ZUSATZ, OHNE_VORWORT, OHNE_FORMELKOPF } = await import('../assets/js/quiz.js');
const { CARDS, BY_ID } = await import('../data/index.js');
const { execFileSync } = await import('node:child_process');
const { writeFileSync, mkdtempSync } = await import('node:fs');
const { join } = await import('node:path');
const { tmpdir } = await import('node:os');

/* Der Scheduler laesst ein Intervall nur dann voll wachsen, wenn die Karte auch
   faellig war. Ketten von schedule()-Aufrufen am selben Tag beschreiben sonst
   einen Fall, den es in der App nicht gibt. Dieser Helfer laesst den Termin
   eintreten, ohne die Uhr zu stellen. */
const faellig = (cs) => ({ ...cs, due: todayNum() });

/* ---------------- Scheduler ---------------- */

test('frische Karte ist neu und heute fällig', () => {
  const f = fresh();
  assert.equal(f.reps, 0);
  assert.equal(f.seen, 0);
  assert.ok(isNew(f));
  assert.ok(isDue(f));
});

test('erste richtige Antwort ergibt ein Intervall von einem Tag', () => {
  const s = schedule(fresh(), GOOD);
  assert.equal(s.iv, 1);
  assert.equal(s.reps, 1);
  assert.equal(s.due, todayNum() + 1);
  assert.equal(s.ok, 1);
});

test('„leicht" beim ersten Mal ergibt drei Tage', () => {
  assert.equal(schedule(fresh(), EASY).iv, 3);
});

test('„nochmal" setzt zurück, zählt einen Lapse und senkt den Leichtigkeitsfaktor', () => {
  let s = schedule(fresh(), GOOD);
  s = schedule(s, GOOD);
  const before = s.ef;
  const after = schedule(s, AGAIN);
  assert.equal(after.reps, 0);
  assert.equal(after.iv, 0);
  assert.equal(after.lapses, 1);
  assert.ok(after.ef < before, 'EF muss sinken');
  assert.equal(after.due, todayNum(), 'nach einem Fehler wieder heute fällig');
  assert.equal(after.ok, s.ok, 'ein Fehler zählt nicht als Treffer');
});

test('Nachlernen in derselben Einheit zaehlt nicht als zweiter Aussetzer', () => {
  let s = schedule(fresh(), GOOD);
  s = schedule(s, GOOD);
  const erster = schedule(s, AGAIN);                       // Karte kippt um
  const zweiter = schedule(erster, AGAIN, { nachlernen: true });   // gleich nochmal falsch
  const dritter = schedule(zweiter, AGAIN, { nachlernen: true });
  assert.equal(erster.lapses, 1);
  assert.equal(dritter.lapses, 1, 'drei Fehlversuche in einer Einheit sind ein Aussetzer');
  assert.equal(dritter.ef, erster.ef, 'der Leichtigkeitsfaktor faellt nur einmal');
  assert.equal(dritter.seen, erster.seen + 2, 'gesehen wurde die Karte trotzdem dreimal');
  assert.equal(dritter.due, todayNum());
  // Am naechsten Termin kippt sie erneut - das ist ein neuer Aussetzer.
  const spaeter = schedule(dritter, AGAIN);
  assert.equal(spaeter.lapses, 2);
  assert.ok(spaeter.ef < dritter.ef);
});

test('Intervalle wachsen bei wiederholtem „gut" bis zum Deckel', () => {
  let s = fresh();
  let prev = 0;
  for (let i = 0; i < 12; i++) {
    s = schedule(faellig(s), GOOD);
    if (prev >= 365) { assert.equal(s.iv, 365, 'am Deckel bleibt das Intervall stehen'); break; }
    assert.ok(s.iv > prev, `Intervall ${s.iv} muss größer als ${prev} sein`);
    prev = s.iv;
  }
});

test('auch „schwer" verlängert das Intervall immer, nie gleich oder kürzer', () => {
  for (const start of [1, 2, 3, 4, 7, 15, 40, 120]) {
    const base = { ...fresh(), reps: 3, iv: start, due: todayNum() };   // Termin ist da
    for (let run = 0; run < 60; run++) {
      const s = schedule({ ...base }, HARD);
      assert.ok(s.iv > start, `iv ${start} → ${s.iv}: „schwer" darf nicht stagnieren`);
    }
  }
});

test('Intervallvorschau ist stabil – derselbe Knopf zeigt nicht mal dies, mal das', () => {
  const states = [fresh(), schedule(fresh(), GOOD), schedule(schedule(fresh(), GOOD), GOOD)];
  for (const cs of states) {
    for (const g of [HARD, GOOD, EASY]) {
      const seen = new Set(Array.from({ length: 60 }, () => preview(cs, g)));
      assert.equal(seen.size, 1, `Vorschau schwankt zwischen: ${[...seen].join(', ')}`);
    }
  }
});

test('Intervall bleibt in den Grenzen 1 bis 365', () => {
  let s = fresh();
  for (let i = 0; i < 60; i++) {
    for (const g of [GOOD, EASY, HARD]) {
      s = schedule(s, g);
      assert.ok(s.iv >= 1 && s.iv <= 365, `Intervall außerhalb der Grenzen: ${s.iv}`);
      assert.ok(Number.isInteger(s.iv), 'Intervall muss ganzzahlig sein');
      assert.ok(s.due >= todayNum(), 'Fälligkeit darf nicht in der Vergangenheit liegen');
    }
  }
});

test('Leichtigkeitsfaktor bleibt zwischen 1,3 und 2,9', () => {
  let s = fresh();
  for (let i = 0; i < 40; i++) s = schedule(s, HARD);
  assert.ok(s.ef >= 1.3, `EF zu klein: ${s.ef}`);
  let t = fresh();
  for (let i = 0; i < 40; i++) t = schedule(t, EASY);
  assert.ok(t.ef <= 2.9, `EF zu groß: ${t.ef}`);
});

test('„leicht" bringt ein längeres Intervall als „gut", „gut" ein längeres als „schwer"', () => {
  const base = faellig(schedule(faellig(schedule(faellig(schedule(fresh(), GOOD)), GOOD)), GOOD));
  const ivs = [HARD, GOOD, EASY].map(g => {
    // Streuung ausmitteln, damit der Vergleich nicht am Zufall hängt
    const runs = Array.from({ length: 200 }, () => schedule({ ...base }, g).iv);
    return runs.reduce((a, b) => a + b, 0) / runs.length;
  });
  assert.ok(ivs[0] < ivs[1], `schwer (${ivs[0]}) muss unter gut (${ivs[1]}) liegen`);
  assert.ok(ivs[1] < ivs[2], `gut (${ivs[1]}) muss unter leicht (${ivs[2]}) liegen`);
});

test('Reifegrad liegt immer zwischen 0 und 1', () => {
  assert.equal(strength(null), 0);
  assert.equal(strength(fresh()), 0);
  let s = fresh();
  for (let i = 0; i < 20; i++) {
    s = schedule(s, i % 5 === 0 ? AGAIN : GOOD);
    const v = strength(s);
    assert.ok(v >= 0 && v <= 1, `Reifegrad außerhalb 0..1: ${v}`);
  }
});

test('Wackelkandidat wird erst nach mehreren Fehlern erkannt', () => {
  let s = fresh();
  assert.equal(isLeech(s), false);
  for (let i = 0; i < 5; i++) s = schedule(schedule(s, GOOD), AGAIN);
  assert.equal(isLeech(s), true);
});

test('Intervallvorschau ist für jede Bewertung eine nichtleere Angabe', () => {
  for (const cs of [null, fresh(), schedule(schedule(fresh(), GOOD), GOOD)]) {
    for (const g of [AGAIN, HARD, GOOD, EASY]) {
      const p = preview(cs, g);
      assert.equal(typeof p, 'string');
      assert.ok(p.length > 0);
    }
  }
  assert.equal(preview(fresh(), AGAIN), 'gleich');
});

test('Scheduler verändert den übergebenen Zustand nicht', () => {
  const s = schedule(fresh(), GOOD);
  const copy = JSON.parse(JSON.stringify(s));
  schedule(s, EASY);
  assert.deepEqual(s, copy, 'schedule() muss frei von Nebenwirkungen sein');
});

/* ---------------- Antwortoptionen ---------------- */

test('jede Karte liefert vier verschiedene Optionen mit der richtigen darunter', () => {
  for (const c of CARDS) {
    for (let run = 0; run < 4; run++) {
      const o = options(c);
      assert.equal(o.length, 4, `${c.id}: ${o.length} Optionen`);
      assert.equal(new Set(o).size, 4, `${c.id}: doppelte Optionen (${o.join(' | ')})`);
      assert.ok(o.includes(c.a), `${c.id}: richtige Antwort fehlt`);
    }
  }
});

test('Kartendaten sind vollständig und eindeutig', () => {
  const ids = new Set(), qs = new Set();
  for (const c of CARDS) {
    assert.ok(c.q && c.q.length >= 8, `${c.id}: Frage zu kurz`);
    assert.ok(c.a && c.a.length > 0, `${c.id}: keine Antwort`);
    assert.ok([1, 2, 3].includes(c.d), `${c.id}: ungültige Stufe`);
    assert.ok(!ids.has(c.id), `doppelte ID ${c.id}`);
    assert.ok(!qs.has(c.q), `doppelte Frage: ${c.q}`);
    ids.add(c.id); qs.add(c.q);
    assert.equal(BY_ID[c.id], c);
    if (c.w) assert.ok(!c.w.includes(c.a), `${c.id}: Ablenker enthält die richtige Antwort`);
  }
});

test('Zahlwörter und Ziffern gelten als dieselbe Antwort', () => {
  // 93 Karten haben ein Zahlwort in der Lösung. Wer „8" tippt, hat die Frage
  // nach den Planeten richtig beantwortet – das darf nicht als Fehler zählen.
  for (const [ein, loesung] of [['8', 'Acht'], ['sieben', '7'], ['12', 'Zwölf'], ['2 Minuten', 'Zwei Minuten']]) {
    assert.ok(similarity(ein, loesung) >= 0.95, `„${ein}" gilt nicht als „${loesung}"`);
  }
  // Zusammensetzungen bleiben unangetastet
  assert.equal(normalize('Vierzig'), 'vierzig');
  assert.equal(normalize('zweite Ableitung'), 'zweite ableitung');
});

test('zugelassene Nebenschreibweisen zählen als richtig, Ablenker nicht', () => {
  const mitAz = CARDS.filter(c => c.az && c.az.length);
  assert.ok(mitAz.length > 0, 'keine Karte mit Nebenschreibweise');
  for (const c of mitAz) {
    for (const z of c.az) {
      const beste = Math.max(...[c.a, ...c.az].map(l => similarity(z, l)));
      assert.ok(beste >= 0.9, `${c.id}: „${z}" wird nicht anerkannt`);
    }
    for (const w of c.w || []) {
      const beste = Math.max(...[c.a, ...c.az].map(l => similarity(w, l)));
      assert.ok(beste < 0.8, `${c.id}: Ablenker „${w}" gilt als richtig`);
    }
  }
});

test('Karten-IDs hängen nur an der Frage, nicht an der Position', async () => {
  // Zwei Importe müssen dieselben IDs ergeben
  const again = await import('../data/index.js');
  assert.deepEqual(again.CARDS.map(c => c.id), CARDS.map(c => c.id));
});

/* ---------------- Freie Eingabe ---------------- */

test('normalize vereinheitlicht Umlaute, Satzzeichen und Füllwörter', () => {
  assert.equal(normalize('Öl'), 'oel');
  assert.equal(normalize('Die Zugspitze!'), 'zugspitze');
  assert.equal(normalize('  MEHRERE   Leerzeichen '), 'mehrere leerzeichen');
  assert.equal(normalize('Straße'), 'strasse');
});

/* Ein deutsches Tastenfeld gibt í, ó, ø, ř oder ć gar nicht her - wer „Brasilia"
   tippt, hat die Hauptstadt gewusst. Bekannt waren nur é, à, ç und ñ; alles
   andere fiel dem Muster [^a-z0-9] zum Opfer und zerriss das Wort: Aus
   „Brasília" wurde „bras lia". Umlaute bleiben ausdruecklich in der deutschen
   Umschrift - die kann man tippen, und „Konigs" statt „Königs" ist ein
   Schreibfehler, kein Tastaturproblem. */
test('fremde Diakritika fallen auf ihren Grundbuchstaben', () => {
  assert.equal(normalize('Brasília'), 'brasilia');
  assert.equal(normalize('Jørn Utzon'), 'jorn utzon');
  assert.equal(normalize('Bedřich Smetana'), 'bedrich smetana');
  assert.equal(normalize('Solidarność'), 'solidarnosc');
  assert.equal(normalize('Niccolò Machiavelli'), 'niccolo machiavelli');
  assert.equal(normalize('Gabriel García Márquez'), 'gabriel garcia marquez');
  // Die deutsche Umschrift bleibt, sonst hiesse „Öl" auf einmal „ol".
  assert.equal(normalize('Öl'), 'oel');
  assert.equal(normalize('Köln'), 'koeln');
  // Zerlegt eingegebene Umlaute (a + Trema) muessen genauso ankommen.
  assert.equal(normalize('O\u0308l'), 'oel');
});

/* Der Gegenbeweis am ganzen Bestand: Keine Karte darf die Tastenfeld-Schreibweise
   ihrer eigenen Antwort abweisen. */
test('jede Antwort ist auch ohne fremde Diakritika richtig', () => {
  const HALTEN = new Set(['ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'ß']);
  const tastenfeld = (t) => [...t].map(z => HALTEN.has(z) ? z
    : z.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
       .replace(/ø/g, 'o').replace(/Ø/g, 'O').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
       .replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/đ/g, 'd').replace(/þ/g, 'th')).join('');
  const schlecht = [];
  // c.az sind die zugelassenen Nebenschreibweisen. Hier stand einmal c.al -
  // ein Feld, das es nirgends gibt: Der „Rundumbeweis" prueft dann nur die
  // Hauptantworten und laesst genau die Haelfte aus, fuer die er gedacht war.
  for (const c of CARDS) for (const t of [c.a, ...(c.az || [])]) {
    const getippt = tastenfeld(t);
    if (getippt === t) continue;
    const note = bewerte(c, getippt);
    if (note < 0.8) schlecht.push(`${c.id}: „${getippt}" gilt nur zu ${note.toFixed(2)} als „${t}"`);
  }
  assert.deepEqual(schlecht, [], 'Antworten, die ohne Sonderzeichen durchfallen');
});

/* Die Zahlwortliste war ein Objektliteral - da antwortet auch die
   Prototypenkette. Wer „constructor" tippte, bekam „function Object() { [native
   code] }" in die Bewertung. */
test('Wörter aus der Prototypenkette bleiben Wörter', () => {
  for (const w of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
    assert.equal(normalize(w), w.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      `„${w}" wurde zu „${normalize(w)}"`);
  }
  assert.equal(normalize('sieben'), '7', 'die Zahlwörter müssen weiter greifen');
});

test('normalize schneidet keine Wortteile aus zusammengesetzten Wörtern', () => {
  // „in", „im", „von" usw. dürfen nur als eigenständige Wörter entfallen
  assert.equal(normalize('Induktion'), 'induktion');
  assert.equal(normalize('Immunsystem'), 'immunsystem');
  assert.equal(normalize('Vondersee'), 'vondersee');
  assert.equal(normalize('Dampfmaschine'), 'dampfmaschine');
});

test('similarity erkennt Treffer, Beinahetreffer und Fehlgriffe', () => {
  assert.equal(similarity('Zugspitze', 'Zugspitze'), 1);
  assert.ok(similarity('zugspitze', 'Die Zugspitze') > 0.85, 'Artikel darf nicht stören');
  assert.ok(similarity('Zugspize', 'Zugspitze') > 0.8, 'ein Tippfehler darf nicht durchfallen');
  assert.ok(similarity('Brocken', 'Zugspitze') < 0.5, 'falsche Antwort muss klar durchfallen');
  assert.equal(similarity('', 'Zugspitze'), 0);
});


/* Der Dreher – zwei vertauschte Nachbarzeichen – ist auf der Handytastatur der
   haeufigste Vertipper, und er ist ein Tippfehler und kein Wissensfehler.
   Gemessen wurden vorher 8,6 % aller Dreher als „passt" gewertet, jetzt 77,7 %. */
test('ein Buchstabendreher ist ein Tippfehler, kein anderes Wort', () => {
  assert.ok(similarity('Varusshclacht', 'Varusschlacht') >= 0.8,
    'Dreher auf der Kopfgrenze eines langen Wortes');
  assert.ok(similarity('Impressionsimus', 'Impressionismus') >= 0.8, 'Dreher im hinteren Teil');
  assert.ok(similarity('Alexandre der Große', 'Alexander der Große') >= 0.8, 'Dreher in einem von drei Woertern');
  // Ein Dreher kostet weniger als eine echte Verwechslung derselben Laenge
  assert.ok(similarity('Bren', 'Bern') > similarity('Bonn', 'Bern'),
    '„Bren" weiss die Antwort, „Bonn" nicht');
});

/* Die Ausnahme fuer den Dreher darf die Kopfregel nicht aufweichen: Im Deutschen
   sitzt die Unterscheidung vorn, und diese Paare ERSETZEN Zeichen, sie tauschen
   sie nicht. Sie muessen weiterhin klar unter „passt" bleiben. */
test('vorn unterschiedene Woerter bleiben getrennt', () => {
  for (const [a, b] of [
    ['Impressionismus', 'Expressionismus'],
    ['intramuskulaer', 'intermuskulaer'],
    ['Bundesrat', 'Bundestag'],
    ['Zinn', 'Zink'], ['Au', 'Ag'], ['XIV', 'XVI'], ['Kiel', 'Kohl'],
  ]) {
    assert.ok(similarity(a, b) < 0.8, `„${a}" darf nicht als „${b}" gelten (${similarity(a, b)})`);
  }
});

test('similarity liefert nie Werte außerhalb von 0 bis 1', () => {
  const probe = ['', 'a', 'xyz', '1234', 'Ein sehr langer Satz mit vielen Wörtern darin'];
  for (const c of CARDS.slice(0, 200)) {
    for (const p of probe) {
      const v = similarity(p, c.a);
      assert.ok(v >= 0 && v <= 1, `similarity(${JSON.stringify(p)}, ${JSON.stringify(c.a)}) = ${v}`);
    }
  }
});

test('shuffle behält alle Elemente und verändert das Original nicht', () => {
  const src = Array.from({ length: 50 }, (_, i) => i);
  const out = shuffle(src);
  assert.equal(out.length, src.length);
  assert.deepEqual([...out].sort((a, b) => a - b), src);
  assert.deepEqual(src, Array.from({ length: 50 }, (_, i) => i));
});

test('normalize übersetzt Hoch-, Tiefstellungen und griechische Zeichen', () => {
  assert.equal(normalize('H₂O'), normalize('H2O'));
  assert.equal(normalize('a² + b² = c²'), normalize('a2 + b2 = c2'));
  assert.equal(normalize('E = mc²'), normalize('E = mc2'));
  assert.equal(normalize('π'), 'pi');
  assert.equal(normalize('90°'), '90 grad');
});

test('normalize liefert für sinnhafte Eingaben nie einen leeren Text', () => {
  for (const s of ['π', '²', '±', '√2', '10 °C', 'µ']) {
    assert.notEqual(normalize(s), '', `„${s}" normalisiert zu einem leeren Text`);
  }
});

test('Formeleingaben in Alltagsschreibweise werden als richtig erkannt', () => {
  const paare = [['H2O', 'H₂O'], ['a2+b2=c2', 'a² + b² = c²'], ['E=mc2', 'E = mc²'], ['pi', 'π']];
  for (const [eingabe, loesung] of paare) {
    assert.ok(similarity(eingabe, loesung) >= 0.8,
      `„${eingabe}" gegen „${loesung}" ergab nur ${similarity(eingabe, loesung).toFixed(2)}`);
  }
});

test('Verneinungen und Zusätze werden nicht als richtig durchgewinkt', () => {
  const faelle = [
    ['Nicht die Zugspitze', 'Die Zugspitze'],
    ['Bayern ist es nicht, sondern Hessen', 'Bayern'],
    ['Der Satz des Pythagoras ist hier völlig falsch und gilt gar nicht', 'Satz des Pythagoras'],
    ['keine Ahnung, vielleicht Berlin', 'Berlin'],
  ];
  for (const [eingabe, loesung] of faelle) {
    const v = similarity(eingabe, loesung);
    assert.ok(v < 0.8, `„${eingabe}" gegen „${loesung}" wurde mit ${v.toFixed(2)} akzeptiert`);
  }
});

test('knappe richtige Eingaben gelten weiterhin', () => {
  const paare = [
    ['Pythagoras', 'Satz des Pythagoras'],
    ['Zugspitze', 'Die Zugspitze'],
    ['Bayern', 'Bayern'],
    ['die zugspitze', 'Zugspitze'],
    ['Karl der Grosse', 'Karl der Große'],
  ];
  for (const [eingabe, loesung] of paare) {
    const v = similarity(eingabe, loesung);
    assert.ok(v >= 0.8, `„${eingabe}" gegen „${loesung}" ergab nur ${v.toFixed(2)}`);
  }
});

test('keine Antwort im Bestand normalisiert zu einem leeren Text', () => {
  const leer = CARDS.filter(c => normalize(c.a) === '');
  assert.deepEqual(leer.map(c => c.a), [],
    'diese Antworten könnten bei freier Eingabe nie als richtig erkannt werden');
});

test('jede Antwort im Bestand stimmt mit sich selbst überein', () => {
  const schlecht = CARDS.filter(c => similarity(c.a, c.a) < 1);
  assert.deepEqual(schlecht.map(c => c.a), []);
});

test('eine Antwort wird auch mit anderer Groß- und Kleinschreibung erkannt', () => {
  for (const c of CARDS.slice(0, 300)) {
    assert.ok(similarity(c.a.toUpperCase(), c.a) >= 0.95, `${c.id}: ${c.a}`);
  }
});

test('eine richtige Antwort verkürzt das Intervall nie', () => {
  // „leicht" ergibt 3 Tage; ein anschließendes „schwer" darf nicht auf 2 zurückfallen
  for (const erst of [HARD, GOOD, EASY]) {
    const nach1 = faellig(schedule(fresh(), erst));
    for (const zweit of [HARD, GOOD, EASY]) {
      for (let run = 0; run < 30; run++) {
        const nach2 = schedule({ ...nach1 }, zweit);
        assert.ok(nach2.iv > nach1.iv,
          `${nach1.iv} Tage → ${nach2.iv} Tage bei Bewertung ${zweit}: Rückschritt trotz richtiger Antwort`);
      }
    }
  }
});

test('die Bewertungsknöpfe versprechen unterschiedliche Intervalle', () => {
  for (const erst of [HARD, GOOD, EASY]) {
    const cs = faellig(schedule(fresh(), erst));
    const gezeigt = [HARD, GOOD, EASY].map(g => preview(cs, g));
    assert.equal(new Set(gezeigt).size, 3,
      `nach „${erst}" zeigen die Knöpfe ${gezeigt.join(' / ')}`);
  }
});

test('eine falsche Zahl macht die Antwort falsch', () => {
  const faelle = [
    ['5 Liter', '1,5 Liter'],
    ['3 Stunden', '7 Stunden'],
    ['12 Bundesländer', '16 Bundesländer'],
    ['3,20 Meter', '2,44 Meter'],
  ];
  for (const [eingabe, loesung] of faelle) {
    const v = similarity(eingabe, loesung);
    assert.ok(v < 0.8, `„${eingabe}" gegen „${loesung}" wurde mit ${v.toFixed(2)} akzeptiert`);
  }
});

test('eine unvollständige Antwort gilt nicht als richtig', () => {
  const faelle = [
    ['Länge mal Breite', 'Länge mal Breite mal Höhe'],
    ['Grundseite mal Höhe', 'Grundseite mal Höhe geteilt durch 2'],
    ['Kapital mal Zinssatz', 'Kapital mal Zinssatz geteilt durch 100'],
  ];
  for (const [eingabe, loesung] of faelle) {
    const v = similarity(eingabe, loesung);
    assert.ok(v < 0.8, `„${eingabe}" gegen „${loesung}" wurde mit ${v.toFixed(2)} akzeptiert`);
  }
});

test('eine falsche Formel gilt nicht als richtige Antwort', () => {
  const faelle = [
    ['a² − b² = c²', 'a² + b² = c²'],
    ['(a + b)² = a² − 2ab + b²', '(a + b)² = a² + 2ab + b²'],
    ['−cos(x)', 'cos(x)'],
    ['sin(x)', 'cos(x)'],
    ['A = 2 · π · r', 'A = π · r²'],
    ['U = R + I', 'U = R · I'],
  ];
  for (const [eingabe, loesung] of faelle) {
    const v = similarity(eingabe, loesung);
    assert.ok(v < 0.8, `„${eingabe}" gegen „${loesung}" wurde mit ${v.toFixed(2)} akzeptiert`);
  }
});

test('Formeln gelten unabhängig von der Schreibweise der Zeichen', () => {
  const faelle = [
    ['a2+b2=c2', 'a² + b² = c²'],
    ['E=mc2', 'E = mc²'],
    ['-273,15 °C', '−273,15 °C'],
    ['U = R * I', 'U = R · I'],
  ];
  for (const [eingabe, loesung] of faelle) {
    const v = similarity(eingabe, loesung);
    assert.ok(v >= 0.8, `„${eingabe}" gegen „${loesung}" ergab nur ${v.toFixed(2)}`);
  }
});

test('Bindestrichnamen bleiben unversehrt', () => {
  for (const name of ['Marie-Antoinette', 'Hitler-Stalin-Pakt', 'D-Day, 6. Juni 1944', 'Der Zwei-plus-Vier-Vertrag']) {
    assert.equal(similarity(name, name), 1, `„${name}" stimmt nicht mit sich selbst überein`);
  }
});

/* Der schlimmste denkbare Fehler dieser App: eine falsche Eingabe als richtig
   abnicken. Wer beim freien Abrufen den Ablenker tippt, bekommt sonst ein Häkchen
   auf eine Falschantwort und lernt sie als richtig. Eine frühere Fassung des
   Vergleichs tat das bei 148 Karten – „Ag" galt als Symbol für Gold. */
test('kein Ablenker im Bestand wird als richtige Eingabe durchgewunken', () => {
  const durchgerutscht = [];
  for (const c of CARDS) {
    if (!c.w || c.mc) continue;
    for (const w of c.w) {
      // bewerte() statt similarity(): So laeuft der Rundumschlag durch denselben
      // Weg wie die App, samt Nebenschreibweisen und Mengenkarten.
      if (bewerte(c, w) >= 0.8) durchgerutscht.push(`„${w}" galt als „${c.a}" (${c.id})`);
    }
  }
  assert.deepEqual(durchgerutscht, [], durchgerutscht.join('\n'));
});

/* Umgekehrt darf die Strenge nicht dazu führen, dass richtige Antworten mit
   einem Tippfehler reihenweise abgelehnt werden. */
test('ein Tippfehler in der Antwort wird weit überwiegend verziehen', () => {
  let erkannt = 0, abgelehnt = 0;
  for (const c of CARDS) {
    const laengstes = c.a.split(' ').sort((x, y) => y.length - x.length)[0] || '';
    if (laengstes.length < 8) continue;
    const i = Math.floor(laengstes.length * 0.75);
    const vertippt = c.a.replace(laengstes,
      laengstes.slice(0, i) + (laengstes[i] === 'e' ? 'a' : 'e') + laengstes.slice(i + 1));
    similarity(vertippt, c.a) >= 0.8 ? erkannt++ : abgelehnt++;
  }
  const quote = erkannt / (erkannt + abgelehnt);
  assert.ok(quote >= 0.9, `nur ${(quote * 100).toFixed(1)} % der Tippfehler wurden verziehen`);
});

/* Vertauschte Aussagen sind der häufigste Ablenkertyp der Sammlung. Sie stimmen
   zeichenweise zu über 90 Prozent mit der Lösung überein und meinen das Gegenteil. */
test('vertauschte Aussagen gelten nicht als richtig', () => {
  const faelle = [
    ['Masse ist eine Kraft, Gewicht ist ortsunabhängig', 'Masse ist ortsunabhängig, Gewicht ist eine Kraft'],
    ['kW ist Energie, kWh ist Leistung', 'kW ist Leistung, kWh ist Energie'],
    ['Ag', 'Au'],
    ['Ludwig XVI.', 'Ludwig XIV.'],
    ['Kupfer und Zink', 'Kupfer und Zinn'],
    ['Das Training der intermuskulären Koordination', 'Das Training der intramuskulären Koordination'],
    ['Den Expressionismus', 'Den Impressionismus'],
    ['4 geteilt durch 3', '3 geteilt durch 4'],
  ];
  for (const [eingabe, loesung] of faelle) {
    const v = similarity(eingabe, loesung);
    assert.ok(v < 0.8, `„${eingabe}" ging als „${loesung}" durch (${v.toFixed(2)})`);
  }
});

/* Die Gegenrichtung zur Strenge: richtige Antworten in ueblichen Schreibvarianten
   muessen durchgehen, sonst wird die freie Eingabe zur Schikane. */
test('uebliche Schreibvarianten einer richtigen Antwort gelten', () => {
  const varianten = [
    ['klein geschrieben', (a) => a.toLowerCase()],
    ['Punkt am Ende', (a) => a + '.'],
    ['ohne Artikel vorn', (a) => a.replace(/^(Der|Die|Das|Ein|Eine|Den|Dem)\s+/, '')],
    ['Umlaute umschrieben', (a) => a.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')],
    ['ohne nachgestellten Klammerzusatz', (a) => a.replace(OHNE_ZUSATZ, '').trim()],
  ];
  for (const [name, wandeln] of varianten) {
    const daneben = [];
    for (const c of CARDS) {
      const v = wandeln(c.a);
      if (!v || v === c.a || v.length < 2) continue;
      if (similarity(v, c.a) < 0.8) daneben.push(`„${v}" gegen „${c.a}"`);
    }
    assert.deepEqual(daneben, [], `${name}: ${daneben.slice(0, 3).join(' · ')}`);
  }
});

/* Ein nachgestellter Klammerzusatz erläutert nur – verlangt wird er nicht.
   Wer ihn aber mit einer falschen Zahl hinschreibt, bekommt kein Häkchen: Das
   ist eine Aussage über die Zahl, und sie ist falsch. */
test('der Klammerzusatz ist freiwillig, eine falsche Zahl darin aber nicht egal', () => {
  assert.ok(similarity('Stickstoff', 'Stickstoff (78 %)') >= 0.8, 'knappe Form muss gelten');
  assert.ok(similarity('Stickstoff (78 %)', 'Stickstoff (78 %)') >= 0.8, 'volle Form muss gelten');
  assert.ok(similarity('Stickstoff (21 %)', 'Stickstoff (78 %)') < 0.8, 'falsche Zahl im Zusatz');
  assert.ok(similarity('Sauerstoff', 'Stickstoff (78 %)') < 0.8, 'falsches Gas');
});

/* Der teuerste Fehler des Schedulers: Wer nach dem Tagestraining noch ein paar
   Extra-Runden macht, uebt Karten, die noch gar nicht faellig sind. Rechnete das
   Wachstum allein aus dem alten Intervall mal Leichtigkeitsfaktor, sprang die
   schwaechste Karte an EINEM Tag von einem Tag auf ein Jahr - und galt danach als
   gefestigt. Genau die Karte, die man nacharbeiten wollte. */
test('eine Karte vor ihrem Termin waechst nur anteilig', () => {
  const t = todayNum();
  // Zehn Tage geplant, erst einer vergangen: fast kein Wachstum
  const frueh = schedule({ ...fresh(), reps: 4, iv: 10, ef: 2.5, due: t + 9 }, GOOD, { jitter: false });
  assert.ok(frueh.iv <= 13, `nach einem von zehn Tagen wuchs das Intervall auf ${frueh.iv}`);
  // Derselbe Zustand, aber der Termin ist da: volles Wachstum
  const reif = schedule({ ...fresh(), reps: 4, iv: 10, ef: 2.5, due: t }, GOOD, { jitter: false });
  assert.ok(reif.iv >= 20, `am Termin sollte es deutlich wachsen, war ${reif.iv}`);
});

test('mehrere Extra-Runden am selben Tag schieben eine Karte nicht ins nächste Jahr', () => {
  let s = { ...fresh(), reps: 4, iv: 1, ef: 2.5, due: todayNum() };
  for (let i = 0; i < 8; i++) s = schedule(s, EASY);          // achtmal hintereinander, ohne Tageswechsel
  assert.ok(s.iv <= 14, `nach acht Extra-Runden an einem Tag stand das Intervall bei ${s.iv} Tagen`);
  assert.ok(strength(s) < 0.6, `die Karte gilt nach ${s.iv} Tagen bereits als gefestigt`);
});

test('eine frühe Antwort zieht den Termin nie nach vorn', () => {
  const t = todayNum();
  for (const g of [HARD, GOOD, EASY]) {
    const vorher = { ...fresh(), reps: 3, iv: 30, ef: 2.3, due: t + 25 };
    const nachher = schedule(vorher, g);
    assert.ok(nachher.due >= vorher.due,
      `Termin rutschte von ${vorher.due} auf ${nachher.due} bei Bewertung ${g}`);
  }
});

/* Das Einpflegeskript ordnet neue Karten ueber ihr Teilgebiet einer Datei zu.
   Teilgebiete sind aber NICHT eindeutig – „Verfahren erkennen" gibt es in
   Mathematik und in Sport. Die fruehere Fassung nahm stillschweigend die erste
   Datei und haette Sportkarten in data/mat.js abgelegt. */
test('mehrdeutige Teilgebiete werden beim Einpflegen nicht geraten', () => {
  const mehrfach = new Map();
  for (const c of CARDS) {
    if (!mehrfach.has(c.sub)) mehrfach.set(c.sub, new Set());
    mehrfach.get(c.sub).add(c.cat);
  }
  const strittig = [...mehrfach].filter(([, cats]) => cats.size > 1);
  assert.ok(strittig.length > 0,
    'Der Test braucht ein Teilgebiet, das in mehreren Themen vorkommt');
  const [sub, cats] = strittig[0];
  const [einThema] = [...cats];

  const karte = (extra) => ({ q: 'Pruefsatz ' + extra.marke + ' fuer den Einpflegetest?',
    a: 'Antwort', s: sub, d: 2, t: 'Kontext fuer den Pruefsatz.', w: ['B', 'C', 'D'], ...extra });
  const daten = { gebiete: [{ cards: [
    karte({ marke: 'ohne' }),
    karte({ marke: 'mit', cat: einThema }),
    karte({ marke: 'falsch', cat: [...CARDS.reduce((s2, c) => s2.add(c.cat), new Set())]
      .find(k => !cats.has(k)) }),
  ] }] };
  const datei = join(mkdtempSync(join(tmpdir(), 'einpflegen-')), 'ergebnis.json');
  writeFileSync(datei, JSON.stringify(daten));
  const aus = execFileSync(process.execPath,
    ['scripts/merge-cards.mjs', datei, '--dry'], { encoding: 'utf8' });

  assert.match(aus, /Feld cat noetig/, 'ohne Thema muss die Karte abgewiesen werden');
  assert.match(aus, /gibt es nicht im Thema/, 'falsches Thema muss abgewiesen werden');
  assert.match(aus, new RegExp(`data/${einThema}\\.js\\s+\\+1`),
    'mit richtigem Thema landet genau eine Karte in der richtigen Datei');
  assert.match(aus, /1 Karten wären ergänzt, 2 abgewiesen/);
});

/* Bei einem eindeutigen Teilgebiet gewann frueher die Eindeutigkeit, und ein
   ausdrueckliches Feld cat wurde stillschweigend ignoriert. Eine Karte, die
   „Sport" sagt und ein Teilgebiet aus Mathematik traegt, landete wortlos in
   data/mat.js - wer beides angibt und sich widerspricht, will davon erfahren. */
test('ein widersprechendes Thema wird auch bei eindeutigem Teilgebiet abgewiesen', () => {
  const themen = new Map();
  for (const c of CARDS) {
    if (!themen.has(c.sub)) themen.set(c.sub, new Set());
    themen.get(c.sub).add(c.cat);
  }
  const [sub, cats] = [...themen].find(([, k]) => k.size === 1);
  const eigenes = [...cats][0];
  const fremdes = [...new Set(CARDS.map(c => c.cat))].find(k => k !== eigenes);

  const karte = (extra) => ({ q: 'Widerspruchsprobe ' + extra.marke + '?', a: 'Antwort',
    s: sub, d: 2, t: 'Kontext.', w: ['B', 'C', 'D'], ...extra });
  const daten = { gebiete: [{ cards: [
    karte({ marke: 'passt', cat: eigenes }),
    karte({ marke: 'widerspricht', cat: fremdes }),
    karte({ marke: 'erfunden', cat: 'gibtsnicht' }),
  ] }] };
  const datei = join(mkdtempSync(join(tmpdir(), 'thema-')), 'ergebnis.json');
  writeFileSync(datei, JSON.stringify(daten));
  const aus = execFileSync(process.execPath,
    ['scripts/merge-cards.mjs', datei, '--dry'], { encoding: 'utf8' });

  assert.match(aus, /gibt es nicht im Thema/, 'das widersprechende Thema muss auffallen');
  assert.match(aus, /unbekanntes Thema/, 'ein erfundenes Thema muss auffallen');
  assert.match(aus, /1 Karten wären ergänzt, 2 abgewiesen/, aus);
});

/* Ein Zeilenumbruch im Kartentext stand roh in einer Zeichenkette mit doppelten
   Anfuehrungszeichen: data/*.js war damit syntaktisch kaputt, und die App zeigte
   nach dem naechsten Start nur noch eine weisse Seite. Auffallen wuerde das erst
   im Browser - die Pruefskripte lesen die Datei ja gar nicht mehr ein. */
test('Zeilenumbrüche und Anführungszeichen überstehen das Einpflegen', () => {
  const zaehler = new Map();
  for (const c of CARDS) {
    if (!zaehler.has(c.sub)) zaehler.set(c.sub, new Set());
    zaehler.get(c.sub).add(c.cat);
  }
  const [eindeutig] = [...zaehler].find(([, cats]) => cats.size === 1);

  const daten = { gebiete: [{ cards: [{
    q: 'Pruefsatz mit\nUmbruch und\tTabulator?',
    a: 'Eine Antwort mit "Anführung" und \\ Schrägstrich',
    s: eindeutig, d: 2,
    t: 'Erste Zeile\nZweite Zeile.', w: ['B', 'C', 'D'],
  }] }] };
  const datei = join(mkdtempSync(join(tmpdir(), 'umbruch-')), 'ergebnis.json');
  writeFileSync(datei, JSON.stringify(daten));
  const aus = execFileSync(process.execPath,
    ['scripts/merge-cards.mjs', datei, '--dry'], { encoding: 'utf8' });

  const zeile = aus.split('\n').find(z => z.startsWith('{q:"'));
  assert.ok(zeile, `keine Kartenzeile in der Vorschau:\n${aus}`);
  let gelesen;
  assert.doesNotThrow(() => { [gelesen] = new Function('return [' + zeile.replace(/,$/, '') + ']')(); },
    `die erzeugte Zeile parst nicht: ${zeile}`);
  assert.equal(gelesen.q, 'Pruefsatz mit Umbruch und Tabulator?');
  assert.equal(gelesen.t, 'Erste Zeile Zweite Zeile.');
  assert.equal(gelesen.a, 'Eine Antwort mit "Anführung" und \\ Schrägstrich');
});

/* Bei manchen Antworten nennt die Loesung eine MENGE – die vier DNA-Basen, die
   fuenf Verfassungsorgane. Wer sie in anderer Folge tippt, hat recht. Bei anderen
   ist die Reihenfolge die ganze Antwort: der Modellierungskreislauf, die PECH-
   Regel, die Rangfolge beim Skat. Das laesst sich nicht rechnen, es steht als
   Kennzeichen ug an der Karte. Beide Seiten muessen halten. */
test('bei Mengenantworten zaehlt die Reihenfolge nicht', () => {
  const mengen = CARDS.filter(c => c.ug);
  assert.ok(mengen.length >= 20, `nur ${mengen.length} Mengenkarten`);
  for (const c of mengen) {
    const teile = c.a.split(/,| und /).map(t => t.trim()).filter(Boolean);
    const gedreht = [...teile].reverse().join(', ');
    assert.ok(bewerte(c, gedreht) >= 0.8,
      `${c.id}: „${gedreht}" gilt nicht als „${c.a}"`);
  }
});

/* Die Karten stehen hier mit ihrem Fragetext. Das ist Absicht und keine
   Nachlaessigkeit: Wird eine dieser Fragen umformuliert, faellt der Test aus und
   zwingt dazu, die Reihenfolgeeigenschaft an der neuen Fassung nachzupruefen.
   Genau das ist einmal passiert, als die Skatkarte ihre Richtungsangabe bekam. */
test('bei Abfolgen bleibt die Reihenfolge die Antwort', () => {
  const abfolgen = [
    'Welche Schritte umfasst der Modellierungskreislauf?',
    'In welcher Reihenfolge schwimmt man die Lagen im Einzel-Lagenschwimmen?',
    'Welche Farben hat die deutsche Flagge von oben nach unten?',
    'Was ist die PECH-Regel bei Sportverletzungen?',
    'Welche Rangfolge haben die Kartenfarben beim Skat, vom niedrigsten zum höchsten Grundwert?',
    'Wie lauten die ersten zehn Primzahlen?',
  ];
  for (const frage of abfolgen) {
    const c = CARDS.find(x => x.q === frage);
    assert.ok(c, `Karte fehlt: ${frage}`);
    assert.ok(!c.ug, `${c.id} ist faelschlich als Menge gekennzeichnet`);
    const teile = c.a.split(/,| und /).map(t => t.trim()).filter(Boolean);
    const gedreht = [...teile].reverse().join(', ');
    assert.ok(bewerte(c, gedreht) < 0.8,
      `${c.id}: umgekehrte Reihenfolge gilt faelschlich als richtig`);
  }
});

/* Ein Fehler im Duell zieht die Karte ins naechste Tagestraining. Dabei muss der
   Anker „due − iv = letzte Abfrage" wahr bleiben – sonst gilt eine Karte, die
   nach zehn Tagen nachweislich gescheitert ist, morgen als puenktlich
   abgefragte 30-Tage-Karte, und die vom Duell-Loesungstext geprimte richtige
   Antwort treibt das Intervall auf rund 75 Tage. */
test('nach einem Duell-Fehler ist das Intervall auf die verstrichene Zeit gedeckelt', () => {
  const t = todayNum();
  // Vor 10 Tagen gelernt, Intervall 30 – also in 20 Tagen faellig
  const cs = { ef: 2.5, iv: 30, due: t + 20, reps: 4, lapses: 0, seen: 6, ok: 5, last: 1 };
  const nach = nachDuellFehler(cs, t);
  assert.equal(nach.due, t, 'die Karte muss heute faellig sein');
  assert.equal(nach.iv, 10, 'das Intervall ist die wirklich verstrichene Zeit');
  assert.equal(nach.due - nach.iv, cs.due - cs.iv, 'der Anker letzte Abfrage bleibt wahr');
  // Das naechste korrekte Wachstum rechnet aus 10 Tagen, nicht aus 30
  const danach = schedule(nach, GOOD, { jitter: false });
  assert.ok(danach.iv <= Math.round(10 * 2.5) + 1,
    `Wachstum aus dem echten Abstand: iv=${danach.iv} statt hoechstens 26`);

  // Ueberfaellige Karte: nie verlaengern, das alte Intervall bleibt stehen
  const spaet = { ef: 2.5, iv: 5, due: t - 3, reps: 3, lapses: 0, seen: 4, ok: 3, last: 1 };
  assert.equal(nachDuellFehler(spaet, t).iv, 5, 'ueberfaellig bleibt beim alten Intervall');

  // Heute gelernt, morgen faellig: Intervall faellt auf null, naechster Termin morgen
  const frisch = { ef: 2.5, iv: 1, due: t + 1, reps: 1, lapses: 0, seen: 1, ok: 1, last: 1 };
  const f = nachDuellFehler(frisch, t);
  assert.equal(f.iv, 0);
  const fDanach = schedule(f, GOOD, { jitter: false });
  assert.ok(fDanach.iv >= 1 && fDanach.due > t, 'auch aus null waechst ein gueltiger Termin');
});

test('der deutsche Tausenderpunkt macht die richtige Zahl nicht falsch', () => {
  // normalize zerlegte „3.600" zu „3 600", waehrend der Nutzer „3600" tippt -
  // die exakt richtige Zahl galt dann als glatt falsch. Auf dem Handy tippt
  // praktisch niemand Tausenderpunkte.
  assert.equal(normalize('3.600'), normalize('3600'));
  assert.equal(normalize('1 zu 13.983.816'), normalize('1 zu 13983816'));
  assert.equal(bewerte({ a: '3.600' }, '3600'), 1);
  assert.equal(bewerte({ a: '300.000 km/s' }, '300000 km/s'), 1);
  // Das Dezimalkomma bleibt davon unberuehrt - es trennt keine Tausender.
  assert.notEqual(normalize('3,14'), normalize('314'));
  // Und eine wirklich andere Zahl bleibt falsch.
  assert.ok(bewerte({ a: '3.600' }, '3700') < 0.6);
});

test('Durch, mal und wurzel gelten nur dort als Rechenzeichen, wo Zahlen stehen', () => {
  /* Drei der acht Operatorwoerter sind zugleich gewoehnliche deutsche Woerter.
     Zaehlten sie immer mit, fiel die natuerliche Kurzantwort hart durch. */
  assert.ok(bewerte({ a: 'Durch Eindampfen' }, 'Eindampfen') >= 0.6,
    'die Kurzform darf hoechstens knapp daneben sein, nicht glatt falsch');
  assert.ok(bewerte({ a: 'Durch quadratische Ergänzung' }, 'quadratische Ergänzung') >= 0.6);
  assert.ok(bewerte({ a: 'Wurzel aus der Summe aller Komponentenquadrate' },
    'aus der Summe aller Komponentenquadrate') >= 0.6);
  // Wo Zahlen im Spiel sind, trennt die Regel weiterhin scharf.
  assert.ok(bewerte({ a: 'a2 plus b2' }, 'a2 minus b2') <= 0.5);
  assert.ok(bewerte({ a: 'Grundseite mal Höhe geteilt durch 2' },
    'Grundseite geteilt Höhe geteilt durch 2') <= 0.5);
});

test('Eine Abkuerzung braucht einen Beleg: leere Uebereinstimmung gilt nicht', () => {
  /* Zwei Filter zusammen konnten eine Uebereinstimmung aus dem Nichts erzeugen.
     Getippt „Lehre" gegen die Loesung „Mit werden": links faellt „Lehre" als
     Klassifikator weg, rechts „werden" als Bindewort - uebrig bleibt auf beiden
     Seiten nichts, und die Abkuerzung meldete trotzdem 0,95. Gemessen galten so
     zehn voellig fremde Eingaben auf der Karte „Nur eine" als richtig. */
  assert.ok(bewerte({ a: 'Mit „werden“' }, 'Lehre') < 0.8,
    '„Lehre" ist keine Antwort auf „Mit werden"');
  for (const unsinn of ['Lehre', 'Satz', 'Regel', 'Formel', 'Gesetz', 'Prinzip'])
    assert.ok(bewerte({ a: 'Nur eine' }, unsinn) < 0.8, `„${unsinn}" ist keine Antwort auf „Nur eine"`);

  // Die Abkuerzung selbst muss weiter greifen - dort ist der Beleg vorhanden.
  assert.ok(bewerte({ a: 'Satz des Pythagoras' }, 'Pythagoras') >= 0.9,
    'das tragende Wort wurde wiedergefunden, der Klassifikator darf fehlen');
  assert.ok(bewerte({ a: 'Das Gesetz von Ohm' }, 'Ohm') >= 0.9);
  assert.ok(bewerte({ a: 'Die Regel von Sarrus' }, 'Sarrus') >= 0.9);

  /* Nebenbefund derselben Messung: „Nur eine" schrumpft in normalize() auf
     „nur" - „eine" ist ein Fuellwort. Die naheliegende Eingabe fiel damit auf 0.
     Betroffen war genau eine Karte im ganzen Bestand, sie hat jetzt az. */
  const china = BY_ID ? [...CARDS].find(c => c.a === 'Nur eine') : null;
  assert.ok(china && bewerte(china, 'Eine') >= 0.9, '„Eine" muss auf „Nur eine" zaehlen');
  assert.ok(bewerte(china, '1') >= 0.9, '„1" muss auf „Nur eine" zaehlen');
});

test('Ein einleitendes Verhaeltniswort der Loesung darf fehlen', () => {
  /* „Woraus wird Tofu hergestellt?" hat die Loesung „Aus Sojabohnen". Wer
     „Sojabohnen" tippt, hat recht und bekam trotzdem 0,60. Artikel erledigte
     FUELLWOERTER laengst, die Verhaeltniswoerter fehlten dort - gemessen waren
     davon 75 der 2048 Karten betroffen. */
  for (const [loesung, kurz] of [['Aus Sojabohnen', 'Sojabohnen'], ['Aus Italien', 'Italien'],
                                 ['Auf dem Sinai', 'dem Sinai'], ['Mit einer Steinschleuder', 'einer Steinschleuder'],
                                 ['An seiner extremen Härte', 'seiner extremen Härte']])
    assert.ok(bewerte({ a: loesung }, kurz) >= 0.8, `„${kurz}" gilt nicht als „${loesung}"`);

  /* Warum das hier sitzt und nicht in FUELLWOERTER: Dort verschwaende das Wort
     ueberall, auch in der Eingabe - „Vor Christus" und „Nach Christus" waeren
     dann dasselbe. Hier faellt nur das erste Wort der LOESUNG weg. */
  assert.ok(bewerte({ a: 'Vor Christus' }, 'Nach Christus') < 0.8,
    'das Verhaeltniswort der Eingabe zaehlt weiter');
});

test('Messgeraet und App teilen dieselbe Nachsicht', () => {
  /* scripts/abdeckung.mjs hielt eine eigene Kopie der Verhaeltniswoerter und
     kannte den Klammerzusatz gar nicht. Die Kopie war laengst veraltet: „an"
     fehlte. Gemessen waren zwei von 18 gemeldeten Luecken deshalb gar keine -
     die Karten „An Oder und Neisse" und „Stickstoff (78 %)" gab es laengst.
     Die Muster sind jetzt exportiert, damit es nur eine Quelle gibt. */
  assert.ok(OHNE_ZUSATZ instanceof RegExp && OHNE_VORWORT instanceof RegExp,
    'beide Muster muessen exportiert bleiben - sonst faellt die Messung zurueck auf eine Kopie');
  assert.equal('Stickstoff (78 %)'.replace(OHNE_ZUSATZ, ''), 'Stickstoff');
  for (const w of ['an', 'aus', 'auf', 'mit', 'nach', 'bei', 'vor', 'unter'])
    assert.ok(OHNE_VORWORT.test(`${w} Oder und Neiße`), `„${w}" fehlt in OHNE_VORWORT`);
  assert.ok(!OHNE_VORWORT.test('Anden'), 'nur ganze Woerter, nicht Wortanfaenge');
});

test('Getippte Formeln zaehlen wie gesetzte: ^2 ist ², sqrt ist Wurzel, der Strich ein Strich', () => {
  /* Kein deutsches Tastenfeld hat ², ³, √ oder den Ableitungsstrich U+2032. Die
     Karten setzen sie, der Nutzer tippt ^2, sqrt und '. Vorher wurde ² zur
     Ziffer und ^ zu „hoch" - dieselbe Potenz in zwei Woertern. Gemessen vor der
     Reparatur: „3x^2" auf „3x²" 0,33, „x^3" auf „x³" 0,25, „sqrt(2)" auf „√2"
     0,38, die Produktregel mit ASCII-Strich 0,59. Ein Mathelehrer, der am Handy
     seine Ableitung tippt, galt als falsch. */
  for (const [a, tipp] of [['3x²', '3x^2'], ['a² + b² = c²', 'a^2 + b^2 = c^2'], ['x³', 'x^3'],
                           ['√2', 'sqrt(2)'], ['u′·v + u·v′', "u'*v + u*v'"], ['f′(x₀) = 0', "f'(x0) = 0"],
                           ['371.000 km²', '371000 km^2'], ['371.000 km²', '371000 km2']])
    assert.ok(bewerte({ a }, tipp) >= 0.8, `„${tipp}" gilt nicht als „${a}"`);
  // Ein Exponent, der keine Ziffer ist, bleibt „hoch" - e^x ist nicht ex.
  assert.ok(bewerte({ a: 'e^x' }, 'e hoch x') >= 0.8);
  assert.ok(bewerte({ a: 'e^x' }, 'ex') < 0.8, '„ex" ist nicht e hoch x');
  // Die Rechenzeichen tragen weiter Bedeutung.
  assert.ok(bewerte({ a: 'a² + b² = c²' }, 'a^2 - b^2 = c^2') < 0.8, 'minus ist nicht plus');
});

test('Der Formelkopf ist keine Antwort: „A = π · r²" gilt auch als „π·r²"', () => {
  /* Der Kopf benennt die Groesse, die Formel ist die Antwort. Wer die
     Kreisflaeche als „pi*r^2" tippt, hat sie gewusst - und bekam 0,17. */
  assert.ok(bewerte({ a: 'A = π · r²' }, 'π·r²') >= 0.8);
  assert.ok(bewerte({ a: 'A = π · r²' }, 'pi*r^2') >= 0.8);
  assert.ok(bewerte({ a: 'V = (4/3) · π · r³' }, '4/3*pi*r^3') >= 0.8);
  assert.ok(bewerte({ a: 'A = π · r²' }, '2*pi*r') < 0.8, 'der Umfang ist nicht die Flaeche');
  assert.ok(OHNE_FORMELKOPF instanceof RegExp, 'das Muster muss exportiert bleiben - das Messgeraet teilt es');
});

test('getipptes Bindestrich-Minus vor einem Buchstaben ist ein Vorzeichen, kein Trennzeichen', () => {
  // Vieta: x1·x2 = q. Wer „-q" tippt, meint den Ablenker −q und darf nicht als richtig gelten.
  assert.ok(bewerte({ a: 'q' }, '-q') < 0.8, '„-q" gilt nicht als „q"');
  assert.ok(bewerte({ a: '−q' }, '-q') >= 0.8, '„-q" gilt als „−q"');
  assert.ok(bewerte({ a: '−1' }, '-1') >= 0.8, 'Ziffern wie bisher');
  assert.ok(bewerte({ a: 'Yerkes-Dodson-Gesetz' }, 'Yerkes-Dodson Gesetz') >= 0.8, 'Bindestriche im Wort bleiben Trenner');
});

test('eine Klammer, die am Wort klebt, ist Teil der Formel und kein Zusatz', () => {
  // „a^(m+n)" endet mit einer Klammer, aber „a^" ist keine Antwort. Nur ein
  // durch Leerzeichen abgesetzter Zusatz wie „Erythropoetin (EPO)" ist freiwillig.
  assert.ok(similarity('a^', 'a^(m+n)') < 0.8, '„a^" darf nicht als „a^(m+n)" gelten');
  assert.ok(similarity('P(AnB)/P', 'P(A∩B)/P(B)') < 0.8, 'abgeschnittene Formel gilt nicht');
  assert.ok(similarity('Erythropoetin', 'Erythropoetin (EPO)') >= 0.8, 'abgesetzter Zusatz bleibt freiwillig');
});

/* Das Werkzeug, mit dem geprüfte Korrekturen eingepflegt werden. Es fasst
   Kartenzeilen als Text an – deshalb muss belegt sein, dass es das eine Feld
   trifft und die übrigen unangetastet lässt. */
const { ersetzeInZeile, kennung } = await import('../scripts/karte-aendern.mjs');
const ZEILE = '{q:"Wie lang ist ein Marathon?",a:"42,195 km",s:"Rekorde",d:1,t:"Alt.",w:["40 km","42 km","45 km"]},';

test('ändert genau ein Feld und lässt die anderen stehen', () => {
  const neu = ersetzeInZeile(ZEILE, 't', 'Neuer Kontext.');
  assert.ok(neu.includes('t:"Neuer Kontext."'), 't ist ersetzt');
  assert.ok(neu.includes('a:"42,195 km"'), 'a bleibt');
  assert.ok(neu.includes('w:["40 km","42 km","45 km"]'), 'w bleibt');
  assert.equal(neu.split(',t:').length, 2, 't kommt genau einmal vor');
});

test('eine neue Frage hinterlegt den alten Wortlaut als p', () => {
  // Ohne p bekäme die Karte eine neue Kennung und der Lernstand bliebe an der alten hängen.
  const neu = ersetzeInZeile(ZEILE, 'q', 'Wie lang ist ein Marathonlauf?');
  assert.ok(neu.startsWith('{q:"Wie lang ist ein Marathonlauf?",p:"Wie lang ist ein Marathon?",'));
  assert.throws(() => ersetzeInZeile(neu, 'q', 'Noch anders'), /schon ein p/);
});

test('Nebenschreibweisen werden ergänzt, nicht ersetzt', () => {
  const eins = ersetzeInZeile(ZEILE, 'az', ['42195 m']);
  const zwei = ersetzeInZeile(eins, 'az', ['42,195 Kilometer', '42195 m']);
  assert.ok(zwei.includes('az:["42195 m","42,195 Kilometer"]'), 'ergänzt und entdoppelt');
});

test('ein Ablenker darf nicht die Antwort sein und keiner doppelt', () => {
  assert.throws(() => ersetzeInZeile(ZEILE, 'w', ['40 km', '42,195 km', '45 km']), /gleich der Antwort/);
  assert.throws(() => ersetzeInZeile(ZEILE, 'w', ['40 km', '40 km', '45 km']), /zwei Ablenker sind gleich/);
  assert.throws(() => ersetzeInZeile(ZEILE, 'w', ['40 km', '42 km']), /genau drei/);
});

test('die Kennung stimmt mit der aus data/index.js überein', () => {
  const beispiel = CARDS[0];
  assert.equal(kennung(beispiel.q, beispiel.cat), beispiel.id);
});

/* Ein getipptes Minus direkt hinter einer Klammer ging verloren: „(-b" wurde zu
   „b". Getroffen hat das die meistgetippte Formel der Schulmathematik – wer die
   Mitternachtsformel am Handy eingab, bekam 0,50 und galt als falsch. Das
   typografische Minus (U+2212) war nie betroffen, deshalb fiel es nie auf. */
test('ein Minuszeichen hinter einer Klammer bleibt ein Vorzeichen', () => {
  const mitternacht = { a: 'x = (−b ± √(b² − 4ac)) / (2a)' };
  assert.ok(bewerte(mitternacht, 'x = (-b ± sqrt(b^2 - 4ac)) / (2a)') >= 0.8, 'ASCII-Fassung der Mitternachtsformel');
  assert.ok(bewerte(mitternacht, '(-b +- sqrt(b^2 - 4ac))/(2a)') >= 0.8, 'ohne Formelkopf, mit „+-" statt ±');
  assert.equal(normalize('(-5)'), 'minus 5');
  // Bindestriche im Wort bleiben Trenner, auch direkt hinter einer Klammer.
  assert.equal(normalize('(Nord-Süd)'), 'nord sued');
});

/* Ein Bindestrich zwischen zwei Zahlen ist mehrdeutig: „1618-1648" ist eine
   Spanne, „b^2-4ac" ein Rechenzeichen. Statt zu raten liest der Vergleich die
   Eingabe in beiden Lesarten und nimmt die bessere – beides gilt gleichzeitig. */
test('ein Bindestrich zwischen Zahlen ist eine Spanne', () => {
  const krieg = { a: '1618 bis 1648' };
  for (const ein of ['1618-1648', '1618–1648', '1618 bis 1648']) {
    assert.ok(bewerte(krieg, ein) >= 0.8, `„${ein}" gilt nicht als „1618 bis 1648"`);
  }
  // Und die Antwort muss auf sich selbst passen, egal welcher Strich getippt wird.
  const bmi = { a: 'normal 18,5–24,9' };
  assert.ok(bewerte(bmi, 'normal 18,5-24,9') >= 0.8, 'Bindestrich statt Halbgeviertstrich');
  // Mit Luft drumherum bleibt es ein Rechenzeichen.
  assert.equal(normalize('7 - 3'), '7 minus 3');
});

/* Am Handy wird abgekuerzt. Gemessen an 612 Eingaben, die ohne Kenntnis des
   Bewerters aufgeschrieben wurden, war das die groesste Gruppe zu Unrecht
   abgewiesener Antworten. */
test('uebliche Abkuerzungen gelten als das ausgeschriebene Wort', () => {
  const paare = [
    [{ a: 'Der Vertrag von Verdun' }, 'Vertrag v. Verdun'],
    [{ a: 'Klerus, Adel und Bauern' }, 'klerus, adel u. bauern'],
    [{ a: 'Zwischen Mars und Jupiter' }, 'zw. Mars u. Jupiter'],
    [{ a: 'Wegen der Neigung der Erdachse' }, 'wg. neigung der erdachse'],
    [{ a: '13,8 Milliarden Jahre' }, '13,8 Mrd. Jahre'],
    [{ a: 'Etwa sechs Millionen Juden' }, 'ca. 6 Mio. Juden'],
  ];
  for (const [karte, ein] of paare) {
    assert.ok(bewerte(karte, ein) >= 0.8, `„${ein}" gilt nicht als „${karte.a}"`);
  }
  // Abgekuerzt wird nach Bequemlichkeit, nicht nach Duden: Solche Kuerzel loest
  // der Vergleich an der Loesung selbst auf.
  assert.ok(bewerte({ a: 'Der systematische Fehler folgt einer falschen Regel' },
    'syst. Fehler folgt einer falschen Regel') >= 0.8, 'freie Abkuerzung am Wortstamm');
  // Aber nur, wenn der volle Wortlaut in der Loesung wirklich vorkommt.
  assert.ok(bewerte({ a: 'Der Bundesrat' }, 'Bundest.') < 0.8, 'erfundene Aufloesung');
  /* Roemische Zahlen sehen aus wie Kuerzel und stehen mit Punkt. Als Kuerzel
     gelesen waere „VII." ein Anfang von „VIII" – und der falsche Heinrich
     bekaeme 1,00. */
  assert.ok(bewerte({ a: 'Heinrich VIII.' }, 'Heinrich VII.') < 0.8, 'der falsche Heinrich');
  /* Der Schlusspunkt eines Satzes ist keine Abkuerzung: „VO₂max." darf nicht
     als „VO₂ maximal" gelesen werden, „Vitamin D." nicht als „Vitamin der". */
  assert.ok(bewerte({ a: 'VO₂max' }, 'VO₂max.') >= 0.8, 'Punkt am Satzende');
  assert.ok(bewerte({ a: 'Vitamin D' }, 'Vitamin D.') >= 0.8, 'Punkt am Satzende');
});

/* Ein Klammerzusatz darf auf beiden Seiten stehen – aber er darf nicht beide
   Seiten gleichzeitig stutzen, sonst vergleichen sich zwei Ruempfe. */
test('ein Klammerzusatz in der Eingabe ist erlaubt, stutzt aber nicht die Loesung', () => {
  assert.ok(bewerte({ a: 'Das Scherbengericht' }, 'Scherbengericht (Ostrakismos)') >= 0.8);
  assert.ok(bewerte({ a: '3 · (2x + 3)' }, '3 · (2x + 9)') < 0.8, 'falsche Zahl in der Klammer');
});

/* Auf „Wer schrieb den Faust?" antwortet man „Goethe". Die Regel ist eng
   gefasst, weil die naheliegende weite Fassung gemessen unbrauchbar ist: „das
   letzte Wort einer grossgeschriebenen Antwort" traefe auf 659 Karten zu und
   wuerde 86 Ablenker des Bestands durchwinken. */
test('bei einer Personenfrage gilt der Nachname allein', () => {
  const gilt = (id, ein) => bewerte(BY_ID[id], ein);
  const finde = (antwort) => CARDS.find(c => c.a === antwort);

  assert.ok(gilt(finde('Johann Wolfgang von Goethe').id, 'Goethe') >= 0.8, 'Goethe');
  assert.ok(gilt(finde('Margaret Thatcher').id, 'Thatcher') >= 0.8, 'Thatcher – Rollenfrage mit Eigenschaftswort');

  // Zwei verschiedene Menschen mit demselben Nachnamen: dann zaehlt der Vorname.
  for (const voll of ['Alexander Fleming', 'Gerd Müller']) {
    const k = finde(voll);
    assert.ok(bewerte(k, voll.split(' ').pop()) < 0.8, `„${voll}" ist ohne Vornamen nicht eindeutig`);
  }
  // Eine Stadt ist kein Verein, auch wenn sie im Vereinsnamen steht.
  assert.ok(bewerte(finde('Bayern München'), 'München') < 0.8, 'München ist eine eigene Antwort');
});

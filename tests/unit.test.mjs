/* Einheitentests für Lernalgorithmus und Fragenlogik.  Aufruf: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { schedule, strength, preview, isDue, isNew, isLeech, fresh,
        AGAIN, HARD, GOOD, EASY } = await import('../assets/js/srs.js');
const { todayNum } = await import('../assets/js/store.js');
const { options, similarity, bewerte, normalize, shuffle } = await import('../assets/js/quiz.js');
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
    ['ohne nachgestellten Klammerzusatz', (a) => a.replace(/\s*\([^()]*\)\s*$/, '').trim()],
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

test('bei Abfolgen bleibt die Reihenfolge die Antwort', () => {
  const abfolgen = [
    'Welche Schritte umfasst der Modellierungskreislauf?',
    'In welcher Reihenfolge schwimmt man die Lagen im Einzel-Lagenschwimmen?',
    'Welche Farben hat die deutsche Flagge von oben nach unten?',
    'Was ist die PECH-Regel bei Sportverletzungen?',
    'Welche Rangfolge haben die Kartenfarben beim Skat?',
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

/* Findet Begriffe, die in der Sammlung nur als ABLENKER vorkommen und nie als
   Antwort. Der Gedanke: Ein Ablenker ist per Bauart eine gleichwertige
   Alternative zur richtigen Antwort - taucht er nie selbst als Antwort auf,
   kennt die Sammlung den Begriff, prueft ihn aber nicht ab.

   WIE GUT DIE REGEL WIRKLICH IST: gemessen, nicht behauptet. Von 42 so
   gefundenen Kandidaten wurden 16 zu Karten, die zwei unabhaengige Pruefungen
   bestanden - 38 Prozent. Der Grund fuer die maessige Quote ist systematisch:
   Ablenker werden gerade so gewaehlt, dass sie plausible Nachbarn vorhandener
   Antworten sind, sitzen also per Konstruktion in bereits besetzten
   Themenfeldern. Die Liste ist eine Ideenquelle, KEINE Bedarfsanalyse. Wer
   Luecken sucht, faengt bei unbesetzten Themen an und nimmt diese Liste erst
   innerhalb davon zur Hand.

   Aufruf: node scripts/nie-antwort.mjs [anzahl]                              */
import { CARDS } from '../data/index.js';
import { normalize } from '../assets/js/quiz.js';

const wieViele = Number(process.argv[2]) || 40;

/* „Aus Schweden" und „Schweden" sind dieselbe Antwort. normalize() raeumt
   Artikel weg, aber keine Praepositionen - ohne diesen Schritt galt Schweden
   als nie beantwortet, obwohl es die Antwort der IKEA-Karte ist. */
const kern = (t) => normalize(t).replace(/^(aus|seit|im|in|vom|zum|zur|bei|nach|auf|mit|ueber|unter)\s+/, '');

const istAntwort = new Set();
for (const c of CARDS) {
  istAntwort.add(kern(c.a));
  for (const alt of c.az || []) istAntwort.add(kern(alt));
}

/* Fuelltypen taugen nicht als eigene Karte: Zahlen, Zeitspannen, Farben,
   Mengenangaben. Sie passen als Ablenker zu beliebigen Fragen und waeren als
   Antwort nicht eindeutig treffbar - in der ersten Runde stellte die Haelfte
   des Ausschusses genau diese Sorte. */
const FUELLTYP = new RegExp('\\d|^(aus|seit|im|in|vom|zum|zur|bei|nach|ueber|über|mit|ohne|durch|gegen'
  + '|jeden|jede|alle|keine|beide|unendlich|etwa|rund|mehr|weniger|nur|erst|dann)\\b'
  + '|^(der |die |das )?(rot|blau|gelb|gruen|grün|schwarz|weiss|weiß|braun|grau)\\b', 'i');

const zaehler = new Map();
for (const c of CARDS) {
  for (const w of c.w || []) {
    const k = kern(w);
    if (!k || istAntwort.has(k) || FUELLTYP.test(w) || w.split(/\s+/).length > 4) continue;
    const ohneArtikel = w.replace(/^(Der|Die|Das|Den|Dem|Ein|Eine)\s+/, '');
    if (!/^[A-ZÄÖÜ]/.test(ohneArtikel)) continue;      // nur Eigennamen und Begriffe
    if (!zaehler.has(k)) zaehler.set(k, { text: w, mal: 0, cats: new Set() });
    const e = zaehler.get(k);
    e.mal++;
    e.cats.add(c.cat);
  }
}

const liste = [...zaehler.values()].sort((a, b) => b.mal - a.mal || a.text.localeCompare(b.text, 'de'));
const ablenker = CARDS.reduce((n, c) => n + (c.w || []).length, 0);

console.log(`${ablenker} Ablenker in ${CARDS.length} Karten.`);
console.log(`${liste.length} Begriffe stehen nur als Ablenker da – Ideenquelle, keine Bedarfsanalyse:`);
console.log(`gemessene Ausbeute der Regel: 38 % (16 brauchbare Karten aus 42 Kandidaten).\n`);
for (const e of liste.slice(0, wieViele)) {
  console.log(`  ${String(e.mal).padStart(2)}x  ${e.text.slice(0, 44).padEnd(46)} [${[...e.cats].sort().join(' ')}]`);
}

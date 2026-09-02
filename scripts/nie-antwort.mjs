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

/* Zweite Quelle: die KONTEXTTEXTE. Die zweite Messung zeigte, dass 16 von 38
   Fehlschlaegen Fakten betrafen, die in der Sammlung stehen - nur im t-Feld
   statt auf der Antwortposition. Groenland, Zloty, Bismarck, die Bastille: alle
   da, keiner je Antwort. Das schaerfere Muster dahinter heisst „eine Entitaet,
   nur eine Frageachse": Zur Pflanze gibt es den Chloroplast, aber nicht das
   Chlorophyll; zum Kaiserreich das Gruendungsjahr, aber nicht den Reichskanzler.
   Das Thema gilt als erledigt, das Quiz fragt die andere Achse. */
const ausText = (t) => {
  const raus = [];
  // Eigennamen: grossgeschriebene Woerter, die nicht am Satzanfang stehen.
  const woerter = String(t || '').split(/\s+/);
  for (let i = 1; i < woerter.length; i++) {
    const roh = woerter[i].replace(/^[„"(]+|[.,;:!?"“)]+$/g, '');
    if (!/^[A-ZÄÖÜ][a-zäöüß]{3,}$/.test(roh)) continue;
    if (/[.!?:]$/.test(woerter[i - 1])) continue;      // Satzanfang, kein Eigenname
    raus.push(roh);
  }
  return raus;
};

const zaehler = new Map();
for (const c of CARDS) {
  for (const w of ausText(c.t)) {
    const k = kern(w);
    if (!k || istAntwort.has(k) || FUELLTYP.test(w)) continue;
    if (!zaehler.has(k)) zaehler.set(k, { text: w, mal: 0, cats: new Set(), woher: 'Kontext' });
    const e = zaehler.get(k);
    e.mal++;
    e.cats.add(c.cat);
  }
}
for (const c of CARDS) {
  for (const w of c.w || []) {
    const k = kern(w);
    if (!k || istAntwort.has(k) || FUELLTYP.test(w) || w.split(/\s+/).length > 4) continue;
    const ohneArtikel = w.replace(/^(Der|Die|Das|Den|Dem|Ein|Eine)\s+/, '');
    if (!/^[A-ZÄÖÜ]/.test(ohneArtikel)) continue;      // nur Eigennamen und Begriffe
    if (!zaehler.has(k)) zaehler.set(k, { text: w, mal: 0, cats: new Set(), woher: 'Ablenker' });
    const e = zaehler.get(k);
    e.mal++;
    e.cats.add(c.cat);
    if (e.woher === 'Kontext') e.woher = 'beides';     // steht als Ablenker UND im Kontext
  }
}

/* Im Deutschen ist jedes Substantiv grossgeschrieben - „Jahre", „Welt", „Stadt"
   sehen aus wie Eigennamen und ueberschwemmten die Liste. Der Unterschied liegt
   in der Streuung: Ein Allerweltswort taucht quer durch alle Themen auf, ein
   Eigenname bleibt bei seinem. Ab drei Themen gilt ein Begriff als Fuellwort. */
const liste = [...zaehler.values()]
  .filter((e) => e.cats.size <= 2)
  .sort((a, b) => {
    // Wer in BEIDEN Rollen auftaucht, ist der aussichtsreichste Kandidat.
    const rang = (x) => (x.woher === 'beides' ? 0 : 1);
    return rang(a) - rang(b) || b.mal - a.mal || a.text.localeCompare(b.text, 'de');
  });
const ablenker = CARDS.reduce((n, c) => n + (c.w || []).length, 0);

const beides = liste.filter((e) => e.woher === 'beides').length;
console.log(`${CARDS.length} Karten, ${ablenker} Ablenker.`);
console.log(`${liste.length} Begriffe kommen vor, ohne je Antwort zu sein – davon ${beides} in beiden Rollen.`);
console.log(`Die Liste ist eine Ideenquelle, keine Bedarfsanalyse:`);
console.log(`gemessene Ausbeute der Ablenker-Regel: 38 % (16 brauchbare Karten aus 42 Kandidaten).`);
console.log(`Wer in beiden Rollen auftaucht, ist der aussichtsreichste Kandidat.\n`);
for (const e of liste.slice(0, wieViele)) {
  console.log(`  ${String(e.mal).padStart(2)}x  ${e.text.slice(0, 40).padEnd(42)} ${e.woher.padEnd(9)} [${[...e.cats].sort().join(' ')}]`);
}

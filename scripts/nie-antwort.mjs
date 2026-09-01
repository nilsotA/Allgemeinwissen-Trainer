/* Findet Begriffe, die in der Sammlung nur als ABLENKER vorkommen und nie als
   Antwort. Jeder davon ist eine Luecke: Ein Ablenker ist per Bauart eine
   gleichwertige Alternative zur richtigen Antwort - taucht er nie selbst als
   Antwort auf, kennt die Sammlung den Begriff, prueft ihn aber nicht ab.

   Der Befund stammt aus einem gemessenen Haertetest gegen typische
   Quizspiel-Fragen: Von dreizehn Begriffen, die dort fehlten, stand kein
   einziger im a-Feld - aber fast alle als Ablenker oder im Kontexttext.

   Aufruf: node scripts/nie-antwort.mjs [anzahl]                     */
import { CARDS } from '../data/index.js';
import { normalize } from '../assets/js/quiz.js';

const wieViele = Number(process.argv[2]) || 40;

const istAntwort = new Set();
for (const c of CARDS) {
  istAntwort.add(normalize(c.a));
  for (const alt of c.az || []) istAntwort.add(normalize(alt));
}

/* Zahlen, Mengenangaben und Wendungen wie „Aus Frankreich" taugen nicht als
   eigene Karte - gesucht sind Eigennamen und Begriffe, die fuer sich stehen. */
const TAUGT_NICHT = /^(aus |seit |im |in |vom |der |die |das )?\d|^(aus|seit|im|in|vom) |^(unendlich|keine|alle|beide|nichts)/i;

const zaehler = new Map();
for (const c of CARDS) {
  for (const w of c.w || []) {
    const n = normalize(w);
    if (!n || istAntwort.has(n) || TAUGT_NICHT.test(w)) continue;
    if (!zaehler.has(n)) zaehler.set(n, { text: w, mal: 0, cats: new Set() });
    const e = zaehler.get(n);
    e.mal++;
    e.cats.add(c.cat);
  }
}

const liste = [...zaehler.values()].sort((a, b) => b.mal - a.mal || a.text.localeCompare(b.text, 'de'));
const ablenker = CARDS.reduce((n, c) => n + (c.w || []).length, 0);
const nie = liste.reduce((n, e) => n + e.mal, 0);

console.log(`${ablenker} Ablenker in ${CARDS.length} Karten.`);
console.log(`${liste.length} Begriffe stehen nur als Ablenker da (${nie} Nennungen) – jeder ist eine moegliche Karte.\n`);
console.log(`Die ${wieViele} haeufigsten:`);
for (const e of liste.slice(0, wieViele)) {
  console.log(`  ${String(e.mal).padStart(2)}x  ${e.text.slice(0, 44).padEnd(46)} [${[...e.cats].sort().join(' ')}]`);
}

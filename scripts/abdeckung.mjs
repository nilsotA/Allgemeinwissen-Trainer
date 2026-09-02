/* Misst, wie viele typische Quizfragen die Sammlung beantwortet - gegen einen
   FESTEN Pruefsatz in data/quizprobe.json.

   WARUM FEST: Zwei fruehere Messungen mit je frisch erfundenen Fragen ergaben
   97/160 und 122/160. Der Sprung sah nach Fortschritt aus, war aber keiner:
   verschiedene Fragensaetze, keine gemeinsame Teilmenge, keine
   Schwierigkeitskontrolle. Nur ein eingefrorener Satz trennt die Wirkung neuer
   Karten von der Schwierigkeit der Fragen. Der Pruefsatz wird deshalb NICHT
   nachgebessert, wenn die Sammlung waechst - sein Wert liegt darin, dass er
   gleich bleibt.

   WAS DIE ZAHL BEDEUTET, und was nicht: Sie ist absichtlich streng. Als
   abgedeckt gilt eine Frage nur, wenn eine Karte die erwartete Antwort auch
   wirklich als ANTWORT traegt - nicht, wenn der Begriff bloss im Kontexttext
   oder unter den Ablenkern steht. Genau diese Unterscheidung war der wichtigste
   Befund der bisherigen Messungen. Der absolute Wert haengt daran, wer den
   Pruefsatz geschrieben hat; aussagekraeftig ist die Veraenderung ueber die
   Zeit, nicht die Hoehe.

   Aufruf: node scripts/abdeckung.mjs [--fehlend]                              */
import { readFileSync } from 'node:fs';
import { CARDS } from '../data/index.js';
import { normalize } from '../assets/js/quiz.js';

const PROBE = JSON.parse(readFileSync(new URL('../data/quizprobe.json', import.meta.url), 'utf8'));
const zeigeFehlend = process.argv.includes('--fehlend');

/* Praepositionen und Artikel weg: „Aus Japan" und „Japan" sind dieselbe Antwort. */
const kern = (t) => normalize(t).replace(/^(aus|seit|im|in|vom|zum|zur|bei|nach|auf|mit)\s+/, '');

/* Verglichen wird woertlich - mit EINER Ausnahme: Eine reine Zahl darf am Anfang
   einer laengeren Antwort stehen. „Bei welcher Temperatur siedet Wasser?" wird
   mit „100 °C" beantwortet, der Pruefsatz erwartet „100"; das als Luecke zu
   zaehlen waere ein Fehlurteil des Messgeraets, nicht ein Befund.

   Eine allgemeine Nachsicht fuer kuerzere Wortfolgen war der erste Versuch und
   ist gemessen durchgefallen: Sie brachte drei zusaetzliche Treffer, von denen
   ZWEI falsch waren - „Martin Luther" passte auf „Martin Luther King Jr." und
   „E. T. A. Hoffmann" auf die Eulersche Zahl „e". Ein Messgeraet, das zwei von
   drei Zugewinnen erfindet, misst schlechter als das strenge. */
const folge = (t) => kern(t).split(' ').filter(Boolean);
const istZahl = (w) => /^[\d.,]+$/.test(w);
const passt = (kartenFolge, gesucht) => {
  if (kartenFolge.join(' ') === gesucht.join(' ')) return true;
  /* Eine gesuchte ZAHL darf irgendwo in der Kartenantwort stehen, nicht nur am
     Anfang: Die Karte zum Kriegsende antwortet „8. Mai 1945", der Pruefsatz
     erwartet „1945". Der Inhalt ist da, nur genauer. Verglichen wird auf ganze
     Woerter, „100" trifft also nicht „1100". Fuer Woerter gilt die Nachsicht
     ausdruecklich NICHT - dort erfand sie zwei von drei Treffern (Martin Luther
     King, die Eulersche Zahl e). */
  return gesucht.length === 1 && istZahl(gesucht[0]) && kartenFolge.includes(gesucht[0]);
};

const kartenAntworten = [];
for (const c of CARDS) {
  for (const a of [c.a, ...(c.az || [])]) {
    const f = folge(a);
    if (f.length) kartenAntworten.push({ f, c });
  }
}

const proGebiet = new Map();
const fehlend = [];
for (const p of PROBE) {
  if (!proGebiet.has(p.gebiet)) proGebiet.set(p.gebiet, { ab: 0, ges: 0 });
  const g = proGebiet.get(p.gebiet);
  g.ges++;
  const gesucht = folge(p.antwort);
  const treffer = kartenAntworten.find((k) => passt(k.f, gesucht));
  if (treffer) g.ab++;
  else fehlend.push(p);
}

const ges = PROBE.length;
const ab = ges - fehlend.length;
console.log(`Quizabdeckung: ${ab} von ${ges} (${Math.round((100 * ab) / ges)} %) – fester Pruefsatz, ${CARDS.length} Karten\n`);
for (const [gebiet, g] of [...proGebiet].sort((a, b) => a[1].ab / a[1].ges - b[1].ab / b[1].ges)) {
  const balken = '█'.repeat(Math.round((10 * g.ab) / g.ges)).padEnd(10, '·');
  console.log(`  ${gebiet.padEnd(18)} ${balken} ${String(g.ab).padStart(2)}/${g.ges}`);
}
if (zeigeFehlend) {
  console.log(`\n${fehlend.length} unbeantwortet:`);
  for (const p of fehlend) console.log(`  [${p.gebiet}] ${p.frage}  →  ${p.antwort}`);
} else if (fehlend.length) {
  console.log(`\n${fehlend.length} unbeantwortet – mit --fehlend auflisten.`);
}

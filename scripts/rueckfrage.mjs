/* Welche Begriffe ERKLAERT die Sammlung, ohne je nach ihnen zu fragen?

   Der Anlass kam aus der Abdeckungsmessung. Dort steht bei mehreren Luecken
   nicht „fehlt", sondern „steht in der FRAGE von … – die Karte fragt die andere
   Richtung": Es gibt „Was feiern Christen an Ostern?", aber nicht „Welches Fest
   feiert die Auferstehung Jesu?". Am Spieleabend kommt die Frage in der
   Richtung, in der sie kommt.

   Beide Richtungen sind auch nicht dasselbe Koennen. „Was ist ein Kartell?"
   prueft Wiedererkennen – die Erklaerung steht schon da, man muss sie nur
   bestaetigen. „Wie nennt man eine wettbewerbswidrige Absprache zwischen
   Unternehmen?" verlangt den Begriff aus dem Gedaechtnis. Das ist die Richtung,
   die ein Quiz abfragt, und die schwerere von beiden.

   Gesucht wird deshalb eng: Karten, deren FRAGE einen Begriff nennt und deren
   ANTWORT ihn erklaert – und deren Begriff nirgends im Bestand auf der
   Antwortposition steht. Karten, die ohnehin schon nach einem Begriff fragen
   („Was ist die Hauptstadt von Estland?" – „Tallinn"), gehoeren nicht dazu: Sie
   laufen bereits in die gesuchte Richtung.

   WAS DIE LISTE NICHT IST: eine Arbeitsanweisung. Nicht jeder erklaerte Begriff
   verdient die Rueckfrage – manche Erklaerungen treffen mehrere Begriffe
   zugleich („Ein Stoff, der Reaktionen beschleunigt" passt auch auf ein Enzym),
   und dann waere die Rueckfrage mehrdeutig. Das muss ein Mensch entscheiden.

   Aufruf: npm run rueckfrage [anzahl]                                        */

import { CARDS } from '../data/index.js';
import { normalize } from '../assets/js/quiz.js';

/* Dieselbe Normalform wie in nie-antwort.mjs: „Aus Schweden" und „Schweden"
   sind dieselbe Antwort. */
const kern = (t) => normalize(t).replace(/^(aus|seit|im|in|vom|zum|zur|bei|nach|auf|mit|ueber|unter)\s+/, '');

/* „Wofuer steht …" und „Was ist die Abkuerzung …" fragen schon nach einem
   Begriff, nur nach seiner Langform. Sie haben die Rueckfrage nicht noetig. */
const ERKLAERFRAGE = /^(Was ist|Was sind|Was bedeutet|Was bedeuten|Was versteht man unter|Was besagt|Was sagt|Wozu dient|Was misst|Was beschreibt|Was bezeichnet)\s+(.+?)\?$/;
const ARTIKEL = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+/i;
const ABKUERZUNGSFRAGE = /\bAbk(ü|ue)rzung\b|\bwofür steht\b/i;

/* Der Begriff in der Frage traegt oft einen Zusatz, den die Antwort auf der
   Gegenseite nicht hat: „Betrag einer Zahl" gegen die vorhandene Antwort
   „Betrag", „Platons Hoehlengleichnis" gegen „Hoehlengleichnis". Ohne diesen
   Schritt meldete der Bericht drei Luecken, die keine waren – aufgefallen erst,
   als die Dublettenpruefung in check-content.mjs die fertig geschriebenen
   Karten zurueckwies. Der Bericht muss das selbst merken, nicht das Tor danach. */
const ZUSATZ = /\s+(von|vom|einer|eines|eine|einen|im|in|beim|bei|des|der|die|das|zweier|zum|zur)\s+.*$/;
const GENITIV = /^\S+s\s+/;
const schonGefragt = (begriff, istAntwort) => {
  const fassungen = new Set([begriff, begriff.replace(ZUSATZ, ''), begriff.replace(GENITIV, '')]);
  for (const f of fassungen) if (f.length >= 4 && istAntwort.has(kern(f))) return true;
  return false;
};

export function rueckfragen(karten) {
  const istAntwort = new Set();
  for (const c of karten) {
    istAntwort.add(kern(c.a));
    for (const a of c.az || []) istAntwort.add(kern(a));
  }
  const raus = [];
  for (const c of karten) {
    if (ABKUERZUNGSFRAGE.test(c.q)) continue;
    const m = c.q.match(ERKLAERFRAGE);
    if (!m) continue;
    const begriff = m[2].replace(ARTIKEL, '').trim().replace(/^[„"]+|[“"]+$/g, '');
    /* Ein Begriff ist ein Begriff und kein Nebensatz. Und er muss lang genug
       sein, dass die Rueckfrage nach ihm ueberhaupt Sinn ergibt. */
    if (begriff.length < 4 || begriff.split(/\s+/).length > 3) continue;
    /* Die Antwort muss eine ERKLAERUNG sein. Ist sie selbst ein kurzer Begriff,
       laeuft die Karte schon in die gesuchte Richtung – „Was ist Kochsalz
       chemisch?" mit der Antwort „Natriumchlorid" verlangt bereits den Begriff. */
    if (c.a.split(/\s+/).length < 3) continue;
    if (schonGefragt(begriff, istAntwort)) continue;
    raus.push({ id: c.id, cat: c.cat, sub: c.sub, d: c.d, begriff, a: c.a });
  }
  return raus.sort((x, y) => x.cat.localeCompare(y.cat) || x.sub.localeCompare(y.sub, 'de')
    || x.begriff.localeCompare(y.begriff, 'de'));
}

/* ---------- Selbstprobe ---------- */
/* Ein Bericht, der nichts findet, ist erst dann eine Aussage, wenn er zeigen
   kann, dass er etwas finden WUERDE. Zwei erfundene Karten gehen durch den
   Bericht: eine mit fehlender Rueckfrage – die muss auftauchen – und eine, zu
   der die Rueckfrage schon existiert – die darf es nicht. Ohne die zweite waere
   „findet etwas" auch dann wahr, wenn die Regel einfach alles durchliesse. */
const PROBE = [
  { id: 'probe-1', cat: 'xxx', sub: 'Probe', d: 1,
    q: 'Was ist ein Flunkerphosphat?', a: 'Ein erfundener Speicherstoff ohne Wirkung', az: [], w: [] },
  { id: 'probe-2', cat: 'xxx', sub: 'Probe', d: 1,
    q: 'Was ist ein Schnarrgeflecht?', a: 'Ein erfundenes Gewebe ohne Funktion', az: [], w: [] },
  { id: 'probe-3', cat: 'xxx', sub: 'Probe', d: 1,
    q: 'Wie heisst das erfundene Gewebe ohne Funktion?', a: 'Ein Schnarrgeflecht', az: [], w: [] },
  /* Dieselbe Sache noch einmal, nur mit Zusatz in der Frage: Wer den Zusatz
     nicht abstreift, haelt das fuer eine vierte, ungefragte Sache. */
  { id: 'probe-4', cat: 'xxx', sub: 'Probe', d: 1,
    q: 'Was ist ein Schnarrgeflecht des Menschen?', a: 'Ein erfundenes Gewebe ohne jede Funktion', az: [], w: [] },
];

function selbstprobe() {
  const gefunden = new Set(rueckfragen([...CARDS, ...PROBE]).map((e) => e.id));
  const fehler = [];
  if (!gefunden.has('probe-1')) fehler.push('die erfundene Karte ohne Rueckfrage steht nicht im Bericht');
  if (gefunden.has('probe-2')) fehler.push('die erfundene Karte MIT Rueckfrage steht faelschlich im Bericht');
  if (gefunden.has('probe-4')) fehler.push('der Zusatz im Begriff macht aus einer gefragten Sache eine ungefragte');
  return fehler;
}

const wieViele = Number(process.argv[2]) || 0;
const liste = rueckfragen(CARDS);
const erklaerkarten = CARDS.filter((c) => !ABKUERZUNGSFRAGE.test(c.q) && ERKLAERFRAGE.test(c.q)).length;

console.log(`${CARDS.length} Karten, davon ${erklaerkarten} Erklaerfragen.`);
console.log(`${liste.length} erklaerte Begriffe stehen nirgends auf der Antwortposition – `
  + `zu ihnen fehlt die Rueckfrage.\n`);
let letzte = '';
for (const e of (wieViele ? liste.slice(0, wieViele) : liste)) {
  const kopf = `${e.cat}/${e.sub}`;
  if (kopf !== letzte) { console.log(`  ${kopf}`); letzte = kopf; }
  console.log(`    ${e.begriff.padEnd(34)} d${e.d}  <- „${e.a.slice(0, 70)}"`);
}

const fehler = selbstprobe();
if (fehler.length) {
  console.error('\nSelbstprobe gescheitert:');
  for (const f of fehler) console.error('  ' + f);
  process.exit(1);
}
console.log('\nSelbstprobe bestanden: die erfundene Luecke steht im Bericht, die erfundene Nicht-Luecke nicht.');

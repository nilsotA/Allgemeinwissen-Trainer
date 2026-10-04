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
/* Was die Frage um den Begriff herum noch sagt, ist nicht Teil des Begriffs:
   „Begriff „Binge-Watching"", „Integral anschaulich", „Sinfonie ueblicherweise",
   „Bruttoinlandsprodukt (BIP)". Und die Antwortseite beugt anders: „Enzyme"
   fuer „Enzym", „Genfer Konventionen" fuer „Genfer Konvention", „Das lyrische
   Ich" fuer „lyrisches Ich". Beim Nachschreiben der Rueckfragen stellten sich
   24 von 48 gemeldeten Luecken als laengst gefragt heraus – die Haelfte des
   Berichts war Arbeit fuer nichts. Deshalb werden Vorspann und Nachspann
   abgestreift und Woerter auf einen groben Stamm gekuerzt, bevor verglichen
   wird. */
const VORSPANN = /^(der |die |das |die sieben |sieben |drei |vier |fuenf |fünf |sechs |acht |neun |zehn |zwei )?(begriff|begriffe|fachbegriff|wort|ausdruck|bezeichnung)?\s*/i;
const NACHSPANN = /\s+(anschaulich|ueblicherweise|üblicherweise|chemisch|physikalisch|biologisch|rechtlich|juristisch|mathematisch|grammatisch|sportlich|medizinisch|wirtschaftlich|politisch|allgemein|genau|konkret|woertlich|wörtlich|urspruenglich|ursprünglich|eigentlich|vereinfacht|kurz|etwa|ungefaehr|ungefähr|dabei|hier|heute|grob|gesehen|gesagt|betrachtet|in deutschland|in der eu|in europa)$/i;
const KLAMMER = /\s*\([^)]*\)\s*/g;
/* Grober Stamm, zweimal gekuerzt: „Konventionen" und „Konvention" treffen
   sich bei „konventio", „lyrisches" und „lyrische" bei „lyrisch". */
const stammWort = (w) => { for (let i = 0; i < 2 && w.length > 4; i++) w = w.replace(/(en|es|er|em|e|n|s)$/, ''); return w; };
const stamm = (t) => kern(t).split(' ').map(stammWort).join(' ');
const sortiert = (t) => stamm(t).split(' ').sort().join(' ');
const schonGefragt = (begriff, istAntwort, istAntwortStamm, istAntwortSortiert) => {
  const roh = begriff.replace(KLAMMER, ' ').replace(/[„“"]/g, '').trim();
  let ohneRand = roh.replace(VORSPANN, '').trim();
  for (let vorher = null; vorher !== ohneRand;) { vorher = ohneRand; ohneRand = ohneRand.replace(NACHSPANN, '').trim(); }
  const fassungen = new Set([begriff, roh, ohneRand, ohneRand.replace(ZUSATZ, ''), ohneRand.replace(GENITIV, '')]);
  for (const f of fassungen) {
    // Abkuerzungen duerfen kurz sein („PNF", „BIP"), Woerter nicht.
    if (f.length < (/^[A-ZÄÖÜ0-9-]+$/.test(f) ? 3 : 4)) continue;
    if (istAntwort.has(kern(f)) || istAntwortStamm.has(stamm(f)) || istAntwortSortiert.has(sortiert(f))) return true;
  }
  return false;
};

export function rueckfragen(karten) {
  const istAntwort = new Set(), istAntwortStamm = new Set(), istAntwortSortiert = new Set();
  for (const c of karten) {
    for (const a of [c.a, ...(c.az || [])]) { istAntwort.add(kern(a)); istAntwortStamm.add(stamm(a)); istAntwortSortiert.add(sortiert(a)); }
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
    if (schonGefragt(begriff, istAntwort, istAntwortStamm, istAntwortSortiert)) continue;
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
  /* Vorspann, Nachspann und Beugung: Alle drei fragen nach dem Schnarrgeflecht,
     das probe-3 schon auf der Antwortposition hat. */
  { id: 'probe-5', cat: 'xxx', sub: 'Probe', d: 1,
    q: 'Was bedeutet der Begriff „Schnarrgeflecht“?', a: 'Ein erfundenes Gewebe, das nichts tut', az: [], w: [] },
  { id: 'probe-6', cat: 'xxx', sub: 'Probe', d: 1,
    q: 'Was ist ein Schnarrgeflecht anschaulich?', a: 'Ein erfundenes Gewebe, das nichts leistet', az: [], w: [] },
  { id: 'probe-7', cat: 'xxx', sub: 'Probe', d: 1,
    q: 'Was sind Schnarrgeflechte?', a: 'Erfundene Gewebe ohne jede Funktion', az: [], w: [] },
];

function selbstprobe() {
  const gefunden = new Set(rueckfragen([...CARDS, ...PROBE]).map((e) => e.id));
  const fehler = [];
  if (!gefunden.has('probe-1')) fehler.push('die erfundene Karte ohne Rueckfrage steht nicht im Bericht');
  if (gefunden.has('probe-2')) fehler.push('die erfundene Karte MIT Rueckfrage steht faelschlich im Bericht');
  if (gefunden.has('probe-4')) fehler.push('der Zusatz im Begriff macht aus einer gefragten Sache eine ungefragte');
  if (gefunden.has('probe-5')) fehler.push('„der Begriff X" gilt als anderer Begriff als X');
  if (gefunden.has('probe-6')) fehler.push('„X anschaulich" gilt als anderer Begriff als X');
  if (gefunden.has('probe-7')) fehler.push('der Plural gilt als anderer Begriff als der Singular');
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

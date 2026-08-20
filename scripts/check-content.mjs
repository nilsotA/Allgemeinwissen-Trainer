/* Prüft die Kartensammlung auf Vollständigkeit und die Antwortoptionen auf Plausibilität. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { CARDS, CATS, countByCat } from '../data/index.js';
import FACTS from '../data/facts.js';
import { options, normalize } from '../assets/js/quiz.js';

const norm = (t) => normalize(t);

let errors = 0, warnings = 0;
const fail = (m) => { console.error('FEHLER  ' + m); errors++; };
const warn = (m) => { console.warn('HINWEIS ' + m); warnings++; };

const catIds = new Set(CATS.map(c => c.id));
const qs = new Map();

for (const c of CARDS) {
  if (!c.q || c.q.length < 8) fail(`${c.id}: Frage zu kurz`);
  if (!c.a) fail(`${c.id}: keine Antwort`);
  if (!catIds.has(c.cat)) fail(`${c.id}: unbekannte Kategorie ${c.cat}`);
  if (![1, 2, 3].includes(c.d)) fail(`${c.id}: Stufe ${c.d} ungültig`);
  if (!c.t) warn(`${c.id}: kein Kontexttext`);
  if (c.w) {
    if (c.w.includes(c.a)) fail(`${c.id}: Ablenker enthält die richtige Antwort`);
    if (new Set(c.w).size !== c.w.length) fail(`${c.id}: doppelte Ablenker`);
  }
  if (qs.has(c.q)) fail(`Doppelte Frage: „${c.q}“ (${c.id} / ${qs.get(c.q)})`);
  qs.set(c.q, c.id);
  if (c.q.length > 160) warn(`${c.id}: Frage sehr lang (${c.q.length} Zeichen)`);
  if (c.a.length > 100) warn(`${c.id}: Antwort sehr lang für ein Handy-Display (${c.a.length} Zeichen)`);
}

/* Die richtige Antwort darf sich nicht schon an ihrer Form verraten:
   ein Einschub in Klammern oder eine Einheit, die keiner der Ablenker trägt,
   macht die Frage lösbar, ohne etwas zu wissen. */
const hasAside = (s) => /\(|bzw\./.test(s);
const words = (s) => s.replace(/[0-9]+/g, '#')
  .replace(/[^A-Za-zÄÖÜäöüß#]+/g, ' ').trim().toLowerCase()
  .split(' ').filter(w => w && w !== '#').join(' ');

/* Ist die richtige Antwort deutlich laenger als alle Ablenker, laesst sich die
   Karte ohne Wissen loesen: „nimm die laengste Option". In einer fruehen Fassung
   traf diese Strategie in 47 Prozent der Faelle statt in 25 wie beim Raten. */
let laengenAusreisser = 0;
for (const c of CARDS) {
  if (!c.w || c.w.length < 3) continue;
  const laengsterAblenker = Math.max(...c.w.map(w => w.length));
  if (c.a.length - laengsterAblenker >= 12 && c.a.length >= laengsterAblenker * 1.45) {
    laengenAusreisser++;
    warn(`${c.id}: Antwort ${c.a.length} Zeichen, laengster Ablenker nur ${laengsterAblenker} – „${c.a.slice(0, 50)}"`);
  }
}

/* Steht die Antwort schon im Fragetext, ist die Karte ohne Wissen loesbar:
   „Wie viele Disziplinen hat der Siebenkampf?" beantwortet sich selbst.
   Ausgenommen sind Ausschlussfragen, die die Auswahl bewusst mitliefern
   („Welches Instrument ist kein Streichinstrument: Bratsche, Cello, Oboe …?"). */
for (const c of CARDS) {
  const q = norm(c.q), a = norm(c.a);
  if (a.length < 4 || !q.includes(a)) continue;
  const nenntAuswahl = (c.w || []).filter(w => q.includes(norm(w))).length >= 2;
  if (!nenntAuswahl) fail(`${c.id}: die Antwort steht schon in der Frage – „${c.q}“`);
}

for (const c of CARDS) {
  if (!c.w || c.w.length < 3) continue;
  if (hasAside(c.a) && !c.w.some(hasAside)) {
    warn(`${c.id}: nur die richtige Antwort hat einen Einschub – „${c.a}“`);
  } else if ([c.a, ...c.w].every(x => /\d/.test(x))) {
    // Verräterisch ist nur der Fall, dass die Antwort eine Einheit nennt und ein Ablenker gar keine
    if (words(c.a) && c.w.some(x => !words(x))) {
      warn(`${c.id}: Einheit nur in der richtigen Antwort – „${c.a}“ gegen „${c.w.join('“, „')}“`);
    }
  }
}

/* Eine Frage darf die Antwort einer ANDEREN Karte nicht ausplaudern. Der
   harmlose Fall ist haeufig und egal: Dass „Niedersachsen" in irgendeiner Frage
   vorkommt, verraet nicht, welches Bundesland an die meisten anderen grenzt –
   ueber den ganzen Bestand gemessen sind das 23 solcher Faelle, alle unschaedlich.

   Schaedlich ist der enge Fall: Eine Karte fragt nach einer Zahl, und eine andere
   Frage zum selben Gegenstand nennt sie beilaeufig. Genau das war zweimal
   passiert. Drei Bedingungen zusammen trennen ihn sauber:

   1. Die Antwort ist eine blosse Zahl oder ein Zahlwort.
   2. Beide Fragen liegen inhaltlich dicht beieinander (Ueberlappung ab 0,3,
      verglichen ueber die ersten sechs Buchstaben – sonst zaehlt
      „paedagogische" nicht als „paedagogischen" und der Fall rutscht durch).
   3. Die Zahl steht in der anderen Frage FREI im Satz. Ohne diese Bedingung
      meldete die Pruefung auch „Welche Dezimalzahl ergibt der Bruch 1/3?" und
      „die Folge (1 + 1/n) hoch n" – dort ist die Ziffer Teil einer Formel und
      verraet nichts. */
const ZAHLWORT = { null: '0', eins: '1', ein: '1', zwei: '2', drei: '3', vier: '4',
  fuenf: '5', sechs: '6', sieben: '7', acht: '8', neun: '9', zehn: '10', elf: '11', zwoelf: '12' };
const zahlwert = (a) => {
  const t = norm(a).trim();
  return /^\d+$/.test(t) ? t : (ZAHLWORT[t] || null);
};
const stamm = (t) => new Set(norm(t).split(' ').filter(w => w.length > 4).map(w => w.slice(0, 6)));
const umlautfrei = (t) => t.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
function freiGenannt(frage, v) {
  // Nur Leerraum davor: Eine Klammer davor heisst fast immer Formel – „(1 + 1/n)".
  if (new RegExp(`(^|\\s)${v}([\\s.,;:?!]|$)`).test(frage)) return true;
  const wort = Object.keys(ZAHLWORT).find(w => ZAHLWORT[w] === v);
  return !!wort && new RegExp(`\\b${wort}\\b`).test(umlautfrei(frage));
}
for (const a of CARDS) {
  const v = zahlwert(a.a);
  if (!v) continue;
  const wa = stamm(a.q);
  if (!wa.size) continue;
  for (const b of CARDS) {
    if (b.id === a.id) continue;
    const wb = stamm(b.q);
    if (!wb.size) continue;
    let g = 0;
    for (const w of wa) if (wb.has(w)) g++;
    if (g / (wa.size + wb.size - g) < 0.3) continue;
    if (!norm(b.q).split(' ').includes(v)) continue;
    if (!freiGenannt(b.q, v)) continue;
    fail(`${b.id}: die Frage nennt „${v}" und verraet damit die Antwort von ${a.id} – „${a.q}"`);
  }
}

/* Das Kennzeichen ug sagt: Die Antwort nennt eine Menge, die Reihenfolge traegt
   keine Bedeutung. Das ergibt nur bei Aufzaehlungen Sinn – steht es an einer
   Karte mit einteiliger Antwort, ist es ein Versehen und wuerde beim freien
   Abrufen nur die Woerter eines Satzes durcheinanderwuerfeln lassen. */
for (const c of CARDS) {
  if (!c.ug) continue;
  const glieder = String(c.a).split(/,| und /).map(t => t.trim()).filter(Boolean);
  /* Zwei Glieder reichen: „Aufteilen und Verteilen" ist eine Menge, und die
     Reihenfolge traegt dort ebenso wenig wie bei fuenf Gliedern. Der Wert faengt
     den groben Fehler ab – das Kennzeichen an einer einteiligen Antwort. */
  if (glieder.length < 2) fail(`${c.id}: als Menge gekennzeichnet, aber die Antwort ist keine Aufzaehlung – „${c.a}"`);
  if (c.mc) warn(`${c.id}: als Menge gekennzeichnet, laeuft aber nur als Auswahlfrage`);
}
console.log('Mengenkarten :', `${CARDS.filter(c => c.ug).length} – dort zaehlt die Reihenfolge der Antwort nicht`);

/* Eine zugelassene Nebenschreibweise darf keinem Ablenker gleichen - sonst
   zaehlte beim freien Abrufen ausgerechnet die falsche Antwort als richtig. */
for (const c of CARDS) {
  for (const z of c.az || []) {
    if (norm(z) === norm(c.a)) warn(`${c.id}: Nebenschreibweise „${z}" ist die Antwort selbst`);
    if ((c.w || []).some(w => norm(w) === norm(z))) fail(`${c.id}: Nebenschreibweise „${z}" ist zugleich ein Ablenker`);
  }
}

// Antwortoptionen mehrfach ziehen, weil Ablenker teils zufällig gewählt werden
for (const c of CARDS) {
  for (let run = 0; run < 6; run++) {
    const o = options(c);
    if (o.length !== 4) fail(`${c.id}: ${o.length} statt 4 Optionen`);
    if (new Set(o).size !== 4) fail(`${c.id}: doppelte Optionen (${o.join(' | ')})`);
    if (!o.includes(c.a)) fail(`${c.id}: richtige Antwort fehlt in den Optionen`);
  }
}

/* Die Merkanker sind seit dem Umbau Abrufaufgaben, keine Lesehaeppchen: Oben
   steht ein Hinweisreiz, der Text kommt erst auf Tastendruck. Das funktioniert
   nur, wenn der Reiz die Antwort NICHT schon enthaelt. Ob eine Ueberschrift ein
   guter Reiz ist, laesst sich nicht rechnen - das ist von Hand entschieden.
   Pruefbar ist der Rest: dass es ueberhaupt einen Reiz gibt, dass er nicht mit
   dem Text zusammenfaellt und dass kein Reiz zweimal vorkommt. */
const reiz = (f) => String(f.f || f.t || '');
const reizGesehen = new Map();
for (const f of FACTS) {
  const r = reiz(f);
  if (r.length < 12) fail(`Merkanker „${r}": Hinweisreiz zu kurz fuer einen Abrufversuch`);
  if (!f.x || f.x.length < 40) fail(`Merkanker „${r}": Aufloesung zu duenn`);
  if (norm(f.x).includes(norm(r)) && r.length > 15) {
    fail(`Merkanker „${r}": der Hinweisreiz steht woertlich in der Aufloesung`);
  }
  if (reizGesehen.has(norm(r))) fail(`Zwei Merkanker mit demselben Hinweisreiz: „${r}"`);
  reizGesehen.set(norm(r), r);
}
const eigene = FACTS.filter(f => f.f).length;

const byCat = countByCat();
const byLvl = CARDS.reduce((o, c) => (o[c.d] = (o[c.d] || 0) + 1, o), {});
console.log('\nKarten gesamt:', CARDS.length);
console.log('Je Kategorie :', CATS.map(c => `${c.id}=${byCat[c.id] || 0}`).join('  '));
console.log('Je Stufe     :', `Grundlagen=${byLvl[1] || 0}  Solide=${byLvl[2] || 0}  Profi=${byLvl[3] || 0}`);
const subs = new Set(CARDS.map(c => c.cat + '/' + c.sub));
console.log('Teilgebiete  :', subs.size);
console.log('Merkanker    :', `${FACTS.length} – davon ${eigene} mit eigener Abruffrage, ${FACTS.length - eigene} mit der Ueberschrift als Reiz`);

/* Wie gut funktioniert „nimm die laengste Option"? Sollte bei 25 Prozent liegen. */
let laengsteGewinnt = 0, mitAblenkern = 0;
for (const c of CARDS) {
  if (!c.w || c.w.length < 3) continue;
  mitAblenkern++;
  const alle = [c.a, ...c.w];
  const max = Math.max(...alle.map(x => x.length));
  if (c.a.length === max && alle.filter(x => x.length === max).length === 1) laengsteGewinnt++;
}
const quote = (laengsteGewinnt / mitAblenkern) * 100;
console.log(`Ratequote    : ${quote.toFixed(1)} % mit „nimm die laengste Option" (Zufall waere 25 %)`);

/* Zweite Ratestrategie: „streich die beiden Extremwerte". Liegen die Ablenker
   symmetrisch um die richtige Antwort, bleiben nur zwei Optionen uebrig - 50 statt
   25 Prozent Trefferquote.

   Gezaehlt wird nur, wo die Strategie ueberhaupt greift: vier Optionen, in
   jeder genau eine Zahl, davor und dahinter derselbe Text. „11. November 1918"
   neben „28. Juni 1919" ist keine Zahlenreihe, die man sortiert - die alte
   Fassung las daraus 11,1918 und 28,1919 und zaehlte die Karte mit.

   Die Quote wird bewusst nicht auf 50 Prozent heruntergedrueckt. Bei Karten wie
   „Wie hoch ist die Netzspannung?" (230 Volt neben 110, 400 und 12) sind alle
   Ablenker echte Groessen - dass die richtige Antwort dazwischen liegt, ist die
   Folge guter Ablenker und nicht ihr Fehler. Wer sie auseinanderzoege, tauschte
   Lehrwert gegen Ratefestigkeit. Maschinell umsortiert wird deshalb nichts.

   Von Hand durchgesehen trugen 22 der damals 86 eingeklammerten Karten Ablenker,
   die nichts erklaeren - rund gegriffene Nachbarwerte. Bei ihnen wurde je ein Wert
   getauscht, mehrfach gegen einen, der selbst etwas beibringt (11 Bundeslaender
   der alten BRD, 4 kg Kugel der Frauen, 598 Abgeordnete als alte Sollgroesse).
   Das drueckte die Quote von 81,9 auf 61,0 Prozent. Die Schranke faengt weiter
   den systematischen Fall ab: Ablenker, die maschinell um die Antwort gelegt wurden. */
const zahl = (s) => {
  const t = String(s);
  const tr = [...t.matchAll(/\d[\d.,]*/g)];
  if (tr.length !== 1) return null;
  const v = parseFloat(tr[0][0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  if (!isFinite(v)) return null;
  return { v, rand: t.slice(0, tr[0].index).trim() + '\u0000' + t.slice(tr[0].index + tr[0][0].length).trim() };
};
let zahlkarten = 0, inDerMitte = 0;
for (const c of CARDS) {
  if (!c.w || c.w.length < 3) continue;
  const teile = [c.a, ...c.w].map(zahl);
  if (teile.some(x => x === null)) continue;
  if (new Set(teile.map(x => x.rand)).size !== 1) continue;
  const alle = teile.map(x => x.v);
  if (new Set(alle).size !== 4) continue;
  zahlkarten++;
  const sortiert = [...alle].sort((x, y) => x - y);
  if (alle[0] !== sortiert[0] && alle[0] !== sortiert[3]) inDerMitte++;
}
if (zahlkarten) {
  const mittig = (inDerMitte / zahlkarten) * 100;
  console.log(`Klammerquote : ${mittig.toFixed(1)} % der Zahlenkarten haben die Antwort zwischen den Ablenkern (Zufall waere 50 %)`);
  /* 70 statt der frueheren 85: Nach dem Handdurchgang liegt der Wert bei 61 %.
     Die Schranke haelt den Stand fest, ohne die Karten zu verbieten, deren
     Ablenker die Antwort aus gutem Grund einklammern (Rechenfehler in Mathe,
     Jahreszahlen in Geschichte, 16 % neben 19 % Mehrwertsteuer). */
  if (mittig > 70) fail(`Zu viele Zahlenkarten klammern die Antwort ein (${mittig.toFixed(1)} %) – wer beide Extremwerte streicht, raet mit 50 statt 25 Prozent.`);
}
if (quote > 32) fail(`Die Laenge verraet die Antwort zu oft: ${quote.toFixed(1)} % statt hoechstens 32 %`);
/* Zwei Arten von Schludrigkeit, die beim Lesen durchrutschen und beim Lernen
   Zeit kosten: derselbe Satz zweimal im selben Kontexttext, und zwei Karten,
   die dieselbe Frage mit derselbe Antwort stellen. Die zweite Sorte kostet
   doppelte Wiederholungen fuer einen einzigen Fakt. */
for (const c of CARDS) {
  const saetze = String(c.t || '').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 15);
  const gesehen = new Set();
  for (const satz of saetze) {
    if (gesehen.has(satz)) fail(`${c.id}: derselbe Satz steht zweimal im Kontext – „${satz.slice(0, 60)}"`);
    gesehen.add(satz);
  }
}

const wortmenge = (t) => new Set(norm(t).split(' ').filter(w => w.length > 4));
const ueberlappung = (a, b) => {
  if (a.size < 3 || b.size < 3) return 0;
  let g = 0;
  for (const w of a) if (b.has(w)) g++;
  return g / (a.size + b.size - g);
};
const fragen = CARDS.map(c => ({ c, q: wortmenge(c.q), a: wortmenge(c.a) }));
for (let i = 0; i < fragen.length; i++) {
  for (let j = i + 1; j < fragen.length; j++) {
    // Beides muss passen: „Wofuer steht die Abkuerzung X?" gibt es zu Recht
    // mehrfach – erst wenn auch die Antworten zusammengehen, ist es eine Dublette.
    // Die Antwortschwelle liegt bewusst niedrig bei 0,25: Zwei Karten koennen
    // denselben Sachverhalt mit ganz anderen Woertern beantworten („Wurzel aus
    // der Summe aller Komponentenquadrate" gegen „Wurzel aus der Summe der
    // quadrierten Koordinaten"). Gemessen trennt 0,25 sauber – darueber
    // rutschte genau dieser Fall durch, darunter kaemen die Abkuerzungsfragen.
    if (ueberlappung(fragen[i].q, fragen[j].q) < 0.7) continue;
    if (ueberlappung(fragen[i].a, fragen[j].a) < 0.25 && norm(fragen[i].c.a) !== norm(fragen[j].c.a)) continue;
    fail(`Inhaltliche Dublette: ${fragen[i].c.id} „${fragen[i].c.q}" und ${fragen[j].c.id} „${fragen[j].c.q}"`);
  }
}

/* „Wissen des Tages" laeuft als Rundlauf: Steht derselbe Gedanke zweimal drin,
   bekommt der Nutzer ihn innerhalb eines halben Jahres doppelt serviert.
   Geprueft wird nur, was sich verlaesslich pruefen laesst: gleicher Titel oder
   gleicher Text. Zwei Fassungen DERSELBEN Erklaerung in anderen Worten faengt
   das nicht - gemessen an den beiden gefundenen Faellen (A4 zweimal erklaert,
   Verdopplungsregel einmal mit 70 und einmal mit 72) trennt Wortueberlappung
   nicht: bei der Schwelle, die beide faengt, kommen 15 Fehlalarme mit. Solche
   Dubletten findet nur, wer die Datei liest. */
const faktTitel = new Map(), faktText = new Map();
FACTS.forEach((f, i) => {
  if (!f || !f.t || !f.x) { fail(`Tagesfakt ${i}: Titel oder Text fehlt`); return; }
  const t = norm(f.t), x = norm(f.x);
  if (faktTitel.has(t)) fail(`Tagesfakt mit gleichem Titel: „${f.t}" (${faktTitel.get(t)} und ${i})`);
  if (faktText.has(x)) fail(`Tagesfakt mit gleichem Text: „${f.t}" und „${FACTS[faktText.get(x)].t}"`);
  faktTitel.set(t, i); faktText.set(x, i);
});

/* Kennungen haengen am Fragetext. Wer eine Frage umschreibt, gibt der Karte
   damit eine neue Kennung - und wirft den Lernfortschritt aller Nutzer weg,
   ohne dass es irgendwo auffiele. Deshalb liegt der Bestand als Liste bei und
   wird bei jeder Pruefung verglichen. Verschwundene Kennungen brauchen einen
   Nachfolger: der alte Wortlaut kommt bei der Karte unter p in die Datei.
   Uebernehmen mit: node scripts/check-content.mjs --kennungen */
const KENNUNGEN = 'data/kennungen.json';
const jetzt = CARDS.map(c => c.id).sort();
const nachfolger = new Set(CARDS.flatMap(c => c.alt || []));
if (process.argv.includes('--kennungen')) {
  writeFileSync(KENNUNGEN, JSON.stringify(jetzt, null, 0).replace(/","/g, '",\n "') + '\n');
  console.log(`${KENNUNGEN} auf ${jetzt.length} Kennungen gebracht`);
} else if (existsSync(KENNUNGEN)) {
  const frueher = JSON.parse(readFileSync(KENNUNGEN, 'utf8'));
  const heute = new Set(jetzt);
  const weg = frueher.filter(id => !heute.has(id) && !nachfolger.has(id));
  if (weg.length) {
    fail(`${weg.length} Karten haben ihre Kennung verloren – der Lernfortschritt dazu waere weg. `
      + `Bei jeder umformulierten Karte den alten Fragetext als p eintragen, sonst `
      + `mit --kennungen uebernehmen. Betroffen: ${weg.slice(0, 6).join(', ')}${weg.length > 6 ? ' …' : ''}`);
  }
  const neuHinzu = jetzt.filter(id => !new Set(frueher).has(id)).length;
  if (neuHinzu) console.log(`Kennungen    : ${neuHinzu} neu, ${frueher.length - weg.length} unveraendert`);
} else {
  warn(`${KENNUNGEN} fehlt – einmal mit --kennungen anlegen, dann faellt jede verlorene Kennung auf`);
}

console.log(`\n${errors} Fehler, ${warnings} Hinweise`);
process.exit(errors ? 1 : 0);

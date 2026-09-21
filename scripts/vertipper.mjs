/* Wie viele Handy-Vertipper verzeiht der Vergleich?

   Warum ueberhaupt gemessen: Wer die Antwort weiss und sich auf dem Handy
   vertippt, hat sie gewusst. Sagt die App ihm trotzdem „knapp daneben – vergleich
   genau", uebt sie Zweifel ein, wo keiner hingehoert. Wie oft das passiert, war
   bis hierher unbekannt: Der Gegentest in tests/unit.test.mjs setzte den Fehler
   bei 75 Prozent der Wortlaenge und mass damit genau die Haelfte, in der die
   Kopfregel aus quiz.js ohnehin nicht greift.

   Vier Arten, und zwar die der TASTATUR und nicht die des Zufalls: ein
   ausgelassener Buchstabe, zwei vertauschte, eine Nachbartaste, ein Doppler.
   Die Nachbarschaft kommt aus der deutschen Handytastatur, drei Reihen.

   Zahlen zaehlen nicht als Vertipper: Wer statt „6" eine „16" tippt, hat etwas
   anderes geantwortet. Veraendert wird deshalb nur, was ein Buchstabe ist.

   Aufruf: npm run vertipper                                                  */

import { CARDS } from '../data/index.js';
import { bewerte, normalize } from '../assets/js/quiz.js';

/* Deutsche Handytastatur. Nachbarn sind die Tasten links und rechts sowie die
   drei darueber und darunter – so, wie der Daumen danebengreift. */
const REIHEN = ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'];
const NACHBARN = new Map();
for (let r = 0; r < REIHEN.length; r++) {
  for (let i = 0; i < REIHEN[r].length; i++) {
    const z = REIHEN[r][i];
    const menge = NACHBARN.get(z) || new Set();
    if (i > 0) menge.add(REIHEN[r][i - 1]);
    if (i < REIHEN[r].length - 1) menge.add(REIHEN[r][i + 1]);
    for (const nr of [r - 1, r + 1]) {
      if (!REIHEN[nr]) continue;
      for (const j of [i - 1, i, i + 1]) if (REIHEN[nr][j]) menge.add(REIHEN[nr][j]);
    }
    NACHBARN.set(z, menge);
  }
}

const istBuchstabe = (z) => /[a-zäöüß]/i.test(z);

/* Jede Art liefert alle Vertipper, die sie auf einer Antwort erzeugen kann –
   nicht eine Stichprobe. Ohne Zufall braucht die Messung keinen festen Startwert
   und liefert bei jedem Lauf dieselbe Zahl. */
const ARTEN = {
  'ausgelassen': (s) => {
    const raus = [];
    for (let i = 0; i < s.length; i++) if (istBuchstabe(s[i])) raus.push([s.slice(0, i) + s.slice(i + 1), i]);
    return raus;
  },
  'vertauscht': (s) => {
    const raus = [];
    for (let i = 0; i < s.length - 1; i++) {
      if (!istBuchstabe(s[i]) || !istBuchstabe(s[i + 1]) || s[i] === s[i + 1]) continue;
      raus.push([s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2), i]);
    }
    return raus;
  },
  'Nachbartaste': (s) => {
    const raus = [];
    for (let i = 0; i < s.length; i++) {
      for (const n of NACHBARN.get(s[i].toLowerCase()) || []) raus.push([s.slice(0, i) + n + s.slice(i + 1), i]);
    }
    return raus;
  },
  'doppelt': (s) => {
    const raus = [];
    for (let i = 0; i < s.length; i++) if (istBuchstabe(s[i])) raus.push([s.slice(0, i + 1) + s[i] + s.slice(i + 1), i]);
    return raus;
  },
};

/* Liegt die Stelle in der vorderen oder hinteren Haelfte IHRES Wortes? Genau
   daran haengt die Kopfregel, und genau danach faellt die Messung auseinander. */
function vorne(text, stelle) {
  let anfang = text.lastIndexOf(' ', stelle) + 1;
  let ende = text.indexOf(' ', stelle);
  if (ende < 0) ende = text.length;
  return stelle - anfang < (ende - anfang) / 2;
}

const frei = CARDS.filter(c => !c.mc);
const zeile = (n, g) => `${(n / g * 100).toFixed(1).padStart(5)} %`;

console.log(`Vertipper auf ${frei.length} frei abfragbaren Karten\n`);
console.log('Art             passt   davon vorn   davon hinten   knapp   glatt falsch');

let gesamtPasst = 0, gesamtAlle = 0;
for (const [name, mach] of Object.entries(ARTEN)) {
  let passt = 0, knapp = 0, falsch = 0, alle = 0;
  let vP = 0, vA = 0, hP = 0, hA = 0;
  for (const c of frei) {
    for (const [eingabe, stelle] of mach(c.a)) {
      const s = bewerte(c, eingabe);
      alle++;
      const gut = s >= 0.8;
      if (gut) passt++; else if (s >= 0.6) knapp++; else falsch++;
      if (vorne(c.a, stelle)) { vA++; if (gut) vP++; } else { hA++; if (gut) hP++; }
    }
  }
  gesamtPasst += passt; gesamtAlle += alle;
  console.log(`${name.padEnd(14)}${zeile(passt, alle)}      ${zeile(vP, vA)}        ${zeile(hP, hA)}  `
    + `${zeile(knapp, alle)}   ${zeile(falsch, alle)}`);
}
console.log(`\nZusammen        ${zeile(gesamtPasst, gesamtAlle)}   auf ${gesamtAlle.toLocaleString('de-DE')} Eingaben`);

/* ---------- Selbstprobe ---------- */
/* Eine Quote ohne Gegenstueck sagt nichts: Wuerde der Vergleich einfach alles
   durchwinken, stuenden oben 100 Prozent und der Bericht saehe gut aus. Zwei
   Proben halten dagegen – eine nach oben, eine nach unten. */
let fehler = 0;

const woertlich = frei.filter(c => bewerte(c, c.a) < 0.8);
if (woertlich.length) {
  console.error(`\nSelbstprobe gescheitert: ${woertlich.length} Karten erkennen nicht einmal ihre eigene `
    + `Antwort woertlich wieder – zuerst: „${woertlich[0].a}"`);
  fehler++;
}

/* Gegenstueck nach unten: ein Wort der Antwort durch ein voellig anderes Wort
   derselben Laenge ersetzen. Das ist kein Vertipper, sondern eine andere
   Aussage. Liegt diese Quote nicht deutlich unter der von oben, misst der
   Bericht nicht die Nachsicht bei Vertippern, sondern blosse Nachgiebigkeit. */
const nachLaenge = new Map();
for (const c of frei) for (const w of normalize(c.a).split(' ')) {
  if (w.length < 5 || /\d/.test(w)) continue;
  if (!nachLaenge.has(w.length)) nachLaenge.set(w.length, []);
  nachLaenge.get(w.length).push(w);
}
let fremdPasst = 0, fremdAlle = 0;
for (const c of frei) {
  const teile = c.a.split(/\s+/);
  for (let i = 0; i < teile.length; i++) {
    const roh = normalize(teile[i]);
    const topf = nachLaenge.get(roh.length);
    if (!topf || roh.length < 5) continue;
    /* Ein festes Wort aus dem Topf statt eines zufaelligen: Die Messung soll bei
       jedem Lauf dieselbe Zahl liefern. Der Griff haengt an der Antwort selbst,
       damit nicht immer dasselbe Wort genommen wird. */
    const kand = topf[(c.a.length * 7 + i * 13) % topf.length];
    if (kand === roh) continue;
    fremdAlle++;
    if (bewerte(c, [...teile.slice(0, i), kand, ...teile.slice(i + 1)].join(' ')) >= 0.8) fremdPasst++;
  }
}
const fremdQuote = fremdPasst / fremdAlle * 100;
const vertipperQuote = gesamtPasst / gesamtAlle * 100;
console.log(`Gegenstueck     ${zeile(fremdPasst, fremdAlle)}   ein ganz anderes Wort derselben Laenge `
  + `(${fremdAlle.toLocaleString('de-DE')} Eingaben)`);
if (fremdQuote >= vertipperQuote / 2) {
  console.error(`\nSelbstprobe gescheitert: fremde Woerter kommen zu ${fremdQuote.toFixed(1)} % durch, `
    + `Vertipper zu ${vertipperQuote.toFixed(1)} % – der Bericht misst Nachgiebigkeit, nicht Nachsicht`);
  fehler++;
}

if (fehler) process.exit(1);
console.log('\nSelbstprobe bestanden: die woertliche Antwort gilt auf jeder Karte, '
  + 'ein fremdes Wort ueberwiegend nicht.');

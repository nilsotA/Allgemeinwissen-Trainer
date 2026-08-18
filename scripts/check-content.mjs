/* Prüft die Kartensammlung auf Vollständigkeit und die Antwortoptionen auf Plausibilität. */
import { CARDS, CATS, countByCat } from '../data/index.js';
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

// Antwortoptionen mehrfach ziehen, weil Ablenker teils zufällig gewählt werden
for (const c of CARDS) {
  for (let run = 0; run < 6; run++) {
    const o = options(c);
    if (o.length !== 4) fail(`${c.id}: ${o.length} statt 4 Optionen`);
    if (new Set(o).size !== 4) fail(`${c.id}: doppelte Optionen (${o.join(' | ')})`);
    if (!o.includes(c.a)) fail(`${c.id}: richtige Antwort fehlt in den Optionen`);
  }
}

const byCat = countByCat();
const byLvl = CARDS.reduce((o, c) => (o[c.d] = (o[c.d] || 0) + 1, o), {});
console.log('\nKarten gesamt:', CARDS.length);
console.log('Je Kategorie :', CATS.map(c => `${c.id}=${byCat[c.id] || 0}`).join('  '));
console.log('Je Stufe     :', `Grundlagen=${byLvl[1] || 0}  Solide=${byLvl[2] || 0}  Profi=${byLvl[3] || 0}`);
const subs = new Set(CARDS.map(c => c.cat + '/' + c.sub));
console.log('Teilgebiete  :', subs.size);

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
if (quote > 32) fail(`Die Laenge verraet die Antwort zu oft: ${quote.toFixed(1)} % statt hoechstens 32 %`);
console.log(`\n${errors} Fehler, ${warnings} Hinweise`);
process.exit(errors ? 1 : 0);

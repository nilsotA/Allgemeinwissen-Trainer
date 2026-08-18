/* Prüft die Kartensammlung auf Vollständigkeit und die Antwortoptionen auf Plausibilität. */
import { CARDS, CATS, countByCat } from '../data/index.js';
import { options } from '../assets/js/quiz.js';

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
  if (c.a.length > 90) warn(`${c.id}: Antwort sehr lang (${c.a.length} Zeichen)`);
}

/* Die richtige Antwort darf sich nicht schon an ihrer Form verraten:
   ein Einschub in Klammern oder eine Einheit, die keiner der Ablenker trägt,
   macht die Frage lösbar, ohne etwas zu wissen. */
const hasAside = (s) => /\(|bzw\./.test(s);
const words = (s) => s.replace(/[0-9]+/g, '#')
  .replace(/[^A-Za-zÄÖÜäöüß#]+/g, ' ').trim().toLowerCase()
  .split(' ').filter(w => w && w !== '#').join(' ');

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
console.log(`\n${errors} Fehler, ${warnings} Hinweise`);
process.exit(errors ? 1 : 0);

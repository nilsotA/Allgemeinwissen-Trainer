import { CARDS } from './data/index.js';

const PARTIKEL = new Set(['von','van','de','del','della','di','du','la','le','dos','da','den','ter','ibn','al','zu']);
const ROEMISCH = /^[IVXLCDM]+\.?$/;
const PERSONENFRAGE = /\bwer\b|\bwelche[rsm]?\s+(autor|autorin|dichter|komponist|maler|forscher|wissenschaftler|erfinder|philosoph|regisseur|schriftsteller|physiker|mathematiker|trainer|spieler|kanzler|praesident|präsident)/i;

function nachname(a) {
  const w = String(a).trim().split(/\s+/);
  if (w.length < 2 || w.length > 5) return null;
  if (/\d/.test(a)) return null;
  for (const t of w) {
    if (PARTIKEL.has(t.toLowerCase())) continue;
    if (ROEMISCH.test(t)) return null;
    if (!/^[A-ZÄÖÜ]/.test(t)) return null;
  }
  const letzt = w[w.length - 1].replace(/[.,;:]$/, '');
  if (letzt.length < 3 || PARTIKEL.has(letzt.toLowerCase())) return null;
  return letzt;
}

const passt = (c) => {
  const n = nachname(c.a);
  if (!n) return null;
  if (!PERSONENFRAGE.test(c.q)) return null;
  const kl = n.toLowerCase();
  // Selbstsicherung: kein Ablenker derselben Karte darf auf dasselbe Wort enden.
  for (const w of c.w || []) {
    const t = String(w).trim().split(/\s+/).pop().replace(/[.,;:]$/, '').toLowerCase();
    if (t === kl) return null;
  }
  return n;
};

const treffer = CARDS.map(c => [c, passt(c)]).filter(([, n]) => n);
console.log(`Regel traefe auf ${treffer.length} von ${CARDS.length} Karten zu`);

const nach = new Map();
for (const [c, n] of treffer) {
  const k = n.toLowerCase();
  if (!nach.has(k)) nach.set(k, new Set());
  nach.get(k).add(c.a);
}
const doppelt = [...nach.entries()].filter(([, s]) => s.size > 1);
console.log(`Kurzformen, die auf mehrere verschiedene Antworten passen: ${doppelt.length}`);
for (const [k, s] of doppelt) console.log(`  „${k}" -> ${[...s].join('  |  ')}`);

// Gegen ALLE Ablenker des Bestands, nicht nur der eigenen Karte
const alleAblenker = new Map();
for (const c of CARDS) for (const w of c.w || []) {
  const t = String(w).trim().split(/\s+/).pop().replace(/[.,;:]$/, '').toLowerCase();
  if (!alleAblenker.has(t)) alleAblenker.set(t, new Set());
  alleAblenker.get(t).add(w);
}
let fremd = 0;
for (const [c, n] of treffer) {
  const s = alleAblenker.get(n.toLowerCase());
  if (s) { console.log(`  ~ „${n}" (${c.a}) endet wie Ablenker: ${[...s].join(', ')}`); fremd++; }
}
console.log(`Kurzformen, die irgendwo im Bestand auch einen Ablenker beenden: ${fremd}`);
console.log('\nBeispiele:');
for (const [c, n] of treffer.slice(0, 12)) console.log(`  ${c.a}  ->  ${n}      (${c.q.slice(0, 58)})`);

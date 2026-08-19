/* Bündelt alle Karten, vergibt stabile IDs und stellt Suchindizes bereit. */
import { CATS, CAT_BY_ID, LEVELS } from './cats.js';
import ges from './ges.js';
import geo from './geo.js';
import nat from './nat.js';
import mat from './mat.js';
import spo from './spo.js';
import kul from './kul.js';
import spr from './spr.js';
import pol from './pol.js';
import all from './all.js';

export { CATS, CAT_BY_ID, LEVELS };

const SOURCES = { ges, geo, nat, mat, spo, kul, spr, pol, all };

/* FNV-1a – kurz, stabil, unabhängig von der Reihenfolge im Array.
   Dadurch bleibt der Lernfortschritt erhalten, wenn Karten ergänzt werden. */
function hashId(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const seen = new Set();
export const CARDS = [];

for (const [cat, list] of Object.entries(SOURCES)) {
  list.forEach((c) => {
    let id = cat + '-' + hashId(c.q);
    let n = 1;
    while (seen.has(id)) id = `${cat}-${hashId(c.q)}${++n}`;   // Kollisionen sind praktisch ausgeschlossen
    seen.add(id);
    CARDS.push({
      id,
      cat,
      sub: c.s || 'Allgemein',
      q: c.q,
      a: c.a,
      w: c.w || null,
      t: c.t || '',
      d: c.d || 2,
      // Karten, deren Antwort sich getippt nicht von einem Ablenker unterscheiden
      // laesst (etwa „ss" gegen „ss"), duerfen nur als Auswahlfrage laufen.
      mc: !!c.mc,
      // Fruehere Fragefassungen. Die Kennung haengt am Fragetext, damit sie
      // beim Ergaenzen von Karten stabil bleibt - eine Umformulierung wuerde
      // den Lernfortschritt dieser Karte sonst stillschweigend wegwerfen.
      // Wer eine Frage umschreibt, traegt den alten Wortlaut unter p ein.
      alt: (Array.isArray(c.p) ? c.p : c.p ? [c.p] : []).map(q => cat + '-' + hashId(q)),
      // Ebenso richtige Schreibweisen derselben Antwort. „1/x" ist beim freien
      // Abrufen dasselbe wie „Eins durch x" - ohne diese Liste haette der
      // Vergleich die kuerzere Fassung als falsch gemeldet.
      az: Array.isArray(c.az) ? c.az : c.az ? [c.az] : []
    });
  });
}

export const BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

/* Antwort-Pools je Teilgebiet und je Kategorie – Basis für plausible Ablenker */
export const POOL_SUB = {};
export const POOL_CAT = {};
for (const c of CARDS) {
  const ks = c.cat + '/' + c.sub;
  (POOL_SUB[ks] ||= []).push(c.a);
  (POOL_CAT[c.cat] ||= []).push(c.a);
}

export const catCards = (cat) => CARDS.filter(c => c.cat === cat);
export const countByCat = () => {
  const o = {};
  for (const c of CARDS) o[c.cat] = (o[c.cat] || 0) + 1;
  return o;
};

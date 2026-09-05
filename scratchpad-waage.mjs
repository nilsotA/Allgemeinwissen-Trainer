/* Wiegt eine Aenderung am Bewerter ab: Was gewinnt sie beim Tippen, was
   kostet sie an Sicherheit? Beide Seiten in einem Aufruf. */
import { bewerte } from './assets/js/quiz.js';
import { CARDS } from './data/index.js';
import { readFileSync } from 'node:fs';

const BASIS = '/tmp/claude-0/-home-user-Allgemeinwissen-Trainer/ff55709c-ebb2-531b-87ff-6091392de301/scratchpad/tipp';
const karten = new Map(CARDS.map(k => [k.id, k]));
const eingaben = [];
for (const d of ['A.output', 'B.output'])
  eingaben.push(...JSON.parse(readFileSync(`${BASIS}/${d}`, 'utf8')).result.karten);

let gruen = 0, gelb = 0, rot = 0, n = 0;
for (const e of eingaben) {
  const k = karten.get(e.id); if (!k) continue;
  for (const art of ['kurz', 'getippt']) {
    const t = e[art]; if (typeof t !== 'string' || !t.trim()) continue;
    const p = bewerte(k, t); n++;
    if (p >= 0.8) gruen++; else if (p >= 0.6) gelb++; else rot++;
  }
}

const frei = CARDS.filter(c => !c.mc);
let eigen = 0, neben = 0, ablenker = 0;
const schaeden = [];
for (const c of frei) {
  if (bewerte(c, c.a) < 0.95) { eigen++; schaeden.push(`eigene Antwort ${c.id}: ${bewerte(c, c.a).toFixed(2)} – ${c.a}`); }
  for (const z of c.az || []) if (bewerte(c, z) < 0.8) { neben++; schaeden.push(`az ${c.id}: ${bewerte(c, z).toFixed(2)} – ${z}`); }
  for (const w of c.w || []) if (bewerte(c, w) >= 0.8) { ablenker++; schaeden.push(`Ablenker ${c.id}: ${bewerte(c, w).toFixed(2)} – ${w} (soll: ${c.a})`); }
}

console.log(`Tippen (${n}):  gruen ${gruen} (${(100*gruen/n).toFixed(1)} %)   gelb ${gelb}   rot ${rot} (${(100*rot/n).toFixed(1)} %)`);
console.log(`Sicherheit:   eigene Antwort <0,95: ${eigen}   az <0,80: ${neben}   Ablenker >=0,80: ${ablenker}`);
for (const s of schaeden.slice(0, 25)) console.log('   !', s);
if (schaeden.length > 25) console.log(`   ... und ${schaeden.length - 25} weitere`);

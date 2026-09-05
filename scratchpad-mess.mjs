import { bewerte, normalize } from './assets/js/quiz.js';
import { CARDS } from './data/index.js';
import { readFileSync, writeFileSync } from 'node:fs';

const BASIS = '/tmp/claude-0/-home-user-Allgemeinwissen-Trainer/ff55709c-ebb2-531b-87ff-6091392de301/scratchpad/tipp';
const karten = new Map(CARDS.map(k => [k.id, k]));
const eingaben = [];
for (const d of ['A.output', 'B.output'])
  eingaben.push(...JSON.parse(readFileSync(`${BASIS}/${d}`, 'utf8')).result.karten);

const ARTEN = ['kurz', 'getippt', 'eigene', 'gesprochen'];
const zaehler = Object.fromEntries(ARTEN.map(a => [a, { n: 0, gruen: 0, gelb: 0, rot: 0 }]));
const rot = [], gelb = [];

for (const e of eingaben) {
  const k = karten.get(e.id);
  if (!k) continue;
  for (const art of ARTEN) {
    const text = e[art];
    if (typeof text !== 'string' || !text.trim()) continue;
    const p = bewerte(k, text);
    const z = zaehler[art];
    z.n++;
    const fall = { id: k.id, art, punkte: +p.toFixed(2), a: k.a, ein: text, na: normalize(k.a), ne: normalize(text) };
    if (p >= 0.8) z.gruen++;
    else if (p >= 0.6) { z.gelb++; gelb.push(fall); }
    else { z.rot++; rot.push(fall); }
  }
}

console.log('Art          geprueft   gruen    gelb     rot   (gruen = gilt, gelb = knapp daneben, rot = falsch)');
for (const art of ARTEN) {
  const { n, gruen, gelb: g, rot: r } = zaehler[art];
  const q = (x) => `${String(x).padStart(4)} ${(100*x/n).toFixed(0).padStart(3)}%`;
  console.log(`${art.padEnd(12)} ${String(n).padStart(8)}  ${q(gruen)} ${q(g)} ${q(r)}`);
}
const tipp = ['kurz', 'getippt'].map(a => zaehler[a]);
const tn = tipp.reduce((s,z)=>s+z.n,0), tr = tipp.reduce((s,z)=>s+z.rot,0), tg = tipp.reduce((s,z)=>s+z.gelb,0);
console.log(`\nWas man wirklich tippt (kurz + getippt): ${tn} Eingaben, davon rot ${tr} (${(100*tr/tn).toFixed(1)} %), gelb ${tg} (${(100*tg/tn).toFixed(1)} %)`);

writeFileSync(`${BASIS}/rot.json`, JSON.stringify(rot, null, 1));
writeFileSync(`${BASIS}/gelb.json`, JSON.stringify(gelb, null, 1));

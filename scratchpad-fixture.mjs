import { CARDS } from './data/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
const BASIS = '/tmp/claude-0/-home-user-Allgemeinwissen-Trainer/ff55709c-ebb2-531b-87ff-6091392de301/scratchpad/tipp';
const karten = new Map(CARDS.map(k => [k.id, k]));
const raus = [];
for (const d of ['A.output', 'B.output'])
  for (const e of JSON.parse(readFileSync(`${BASIS}/${d}`, 'utf8')).result.karten) {
    const k = karten.get(e.id);
    if (!k) { console.error('unbekannt:', e.id); continue; }
    raus.push({ id: e.id, q: k.q, a: k.a, kurz: e.kurz, eigene: e.eigene, gesprochen: e.gesprochen, getippt: e.getippt });
  }
raus.sort((x, y) => x.id.localeCompare(y.id));
writeFileSync('data/tippprobe.json', JSON.stringify(raus, null, 1) + '\n');
console.log(raus.length, 'Eintraege geschrieben');

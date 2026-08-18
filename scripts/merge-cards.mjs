/* Nimmt geprüfte Karten aus einem Workflow-Ergebnis (JSON) und hängt sie an die
   richtige Datei in data/ an. Das Teilgebiet bestimmt die Datei – die Teilgebiete
   sind über alle Dateien hinweg eindeutig.
   Aufruf: node scripts/merge-cards.mjs <ergebnis.json> [--dry] */
import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS } from '../data/index.js';

const [pfad, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');
if (!pfad) { console.error('Aufruf: node scripts/merge-cards.mjs <ergebnis.json> [--dry]'); process.exit(1); }

/* Teilgebiet -> Datei, aus dem Bestand abgeleitet statt von Hand gepflegt */
const datei = new Map();
for (const c of CARDS) if (!datei.has(c.sub)) datei.set(c.sub, `data/${c.cat}.js`);

const roh = JSON.parse(readFileSync(pfad, 'utf8'));
const eingang = (roh.gebiete || []).flatMap(g => g.cards || []);
const vorhanden = new Set(CARDS.map(c => c.q.trim()));

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const zeile = (c) => `{q:"${esc(c.q)}",a:"${esc(c.a)}",s:"${esc(c.s)}",d:${c.d},`
  + `t:"${esc(c.t)}",w:[${c.w.map(w => `"${esc(w)}"`).join(',')}]},`;

const proDatei = new Map();
const abgelehnt = [];
for (const c of eingang) {
  const q = (c.q || '').trim();
  if (!q || !c.a || !c.s || !Array.isArray(c.w) || c.w.length !== 3) { abgelehnt.push([q, 'unvollständig']); continue; }
  if (vorhanden.has(q)) { abgelehnt.push([q, 'Frage gibt es schon']); continue; }
  const ziel = datei.get(c.s);
  if (!ziel) { abgelehnt.push([q, `unbekanntes Teilgebiet „${c.s}"`]); continue; }
  if (c.w.includes(c.a)) { abgelehnt.push([q, 'Ablenker enthält die Antwort']); continue; }
  if (new Set(c.w).size !== 3) { abgelehnt.push([q, 'doppelte Ablenker']); continue; }
  vorhanden.add(q);
  (proDatei.get(ziel) || proDatei.set(ziel, []).get(ziel)).push(c);
}

let summe = 0;
for (const [ziel, liste] of [...proDatei].sort()) {
  const txt = readFileSync(ziel, 'utf8');
  const schluss = txt.lastIndexOf('];');
  if (schluss < 0) { console.error(`${ziel}: Abschluss „];" nicht gefunden`); process.exit(1); }
  const block = `/* ---------- Ergänzt: Lücken geschlossen ---------- */\n`
    + liste.map(zeile).join('\n') + '\n';
  if (!dry) writeFileSync(ziel, txt.slice(0, schluss) + block + txt.slice(schluss));
  console.log(`${ziel.padEnd(14)} +${liste.length}`);
  summe += liste.length;
}
console.log(`\n${summe} Karten ${dry ? 'wären ergänzt' : 'ergänzt'}, ${abgelehnt.length} abgewiesen`);
for (const [q, why] of abgelehnt) console.log('  raus  ', why, '|', q.slice(0, 60));

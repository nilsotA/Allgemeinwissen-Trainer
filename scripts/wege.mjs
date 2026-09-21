/* Welche Wege der App betritt der Durchlauftest - und welche nie?

   Aufruf: npm run wege   (laesst den Durchlauftest mit ABDECKUNG=1 laufen und
   wertet danach aus). Die Rohdaten sind V8-Abdeckung je Seite; gezaehlt wird
   je Funktion, ob sie in IRGENDEINEM Kontext mindestens einmal lief.

   Was der Bericht NICHT weiss: ob eine kalte Funktion von den Einheitentests
   gedeckt ist. quiz.js, session.js, srs.js und store.js werden dort gemessen -
   kalt im Browser heisst dort also nicht ungeprueft. app.js hat keine
   Einheitentests; was dort kalt steht, ist wirklich ungeprueft. */
import { readFileSync, existsSync } from 'node:fs';

const DATEI = 'abdeckung-roh.json';
if (!existsSync(DATEI)) {
  console.error(`${DATEI} fehlt – erst „ABDECKUNG=1 node tests/e2e.mjs" laufen lassen (npm run wege macht beides).`);
  process.exit(1);
}
const roh = JSON.parse(readFileSync(DATEI, 'utf8'));
if (!Array.isArray(roh) || !roh.length) {
  console.error(`${DATEI} ist leer – der Lauf hat nichts gemessen.`);
  process.exit(1);
}

/* Je Datei: Funktion -> hoechste Zaehlung ueber alle Seiten. Eine Funktion gilt
   als gelaufen, sobald sie IRGENDWO lief; die Kontexte sind Teile desselben
   Durchlaufs, nicht getrennte Messungen. */
const dateien = new Map();
for (const eintrag of roh) {
  const treffer = String(eintrag.url || '').match(/\/assets\/js\/([a-z]+\.js)/);
  if (!treffer) continue;
  const datei = treffer[1];
  if (!dateien.has(datei)) dateien.set(datei, new Map());
  const tafel = dateien.get(datei);
  for (const f of eintrag.functions) {
    const r = f.ranges[0];
    const schluessel = `${r.startOffset}:${r.endOffset}`;
    const alt = tafel.get(schluessel);
    tafel.set(schluessel, { name: f.functionName, start: r.startOffset, ende: r.endOffset,
      zahl: Math.max(alt ? alt.zahl : 0, r.count) });
  }
}
if (!dateien.size) {
  console.error('Keine einzige Datei aus assets/js in den Rohdaten – die Messung lief ins Leere.');
  process.exit(1);
}

/* Winzlinge weglassen: Pfeilfunktionen unter 40 Zeichen sind Vergleicher und
   Kurzschreibweisen, kein eigener Weg durch die App. */
const MINDESTGROESSE = 40;
let gesamt = 0, kalt = 0;
const quelle = new Map();
for (const datei of dateien.keys()) quelle.set(datei, readFileSync(`assets/js/${datei}`, 'utf8'));
const zeileVon = (datei, versatz) => quelle.get(datei).slice(0, versatz).split('\n').length;

for (const [datei, tafel] of [...dateien].sort()) {
  const fns = [...tafel.values()].filter(f => f.ende - f.start > MINDESTGROESSE);
  const tot = fns.filter(f => f.zahl === 0).sort((a, b) => a.start - b.start);
  gesamt += fns.length; kalt += tot.length;
  console.log(`\n${datei}: ${fns.length - tot.length} von ${fns.length} Funktionen gelaufen`);
  for (const f of tot) {
    const kopf = quelle.get(datei).slice(f.start, f.start + 66).replace(/\s+/g, ' ');
    console.log(`  Z${String(zeileVon(datei, f.start)).padStart(4)}  ${f.name || '(ohne Namen)'} – ${kopf}`);
  }
}
const warm = gesamt - kalt;
console.log(`\nSumme: ${warm} von ${gesamt} Funktionen (${(warm / gesamt * 100).toFixed(1)} %), ${kalt} nie gelaufen.`);
console.log('Kalt in quiz.js, session.js, srs.js, store.js heisst nicht ungeprueft – dort messen die Einheitentests.');

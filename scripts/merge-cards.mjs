/* Nimmt geprüfte Karten aus einem Workflow-Ergebnis (JSON) und hängt sie an die
   richtige Datei in data/ an. Das Teilgebiet bestimmt die Datei.
   Aufruf: node scripts/merge-cards.mjs <ergebnis.json> [--dry] */
import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS } from '../data/index.js';

const [pfad, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');
if (!pfad) { console.error('Aufruf: node scripts/merge-cards.mjs <ergebnis.json> [--dry]'); process.exit(1); }

/* Teilgebiet -> Datei, aus dem Bestand abgeleitet statt von Hand gepflegt.
   Teilgebiete sind NICHT durchweg eindeutig: „Verfahren erkennen" gibt es in
   Mathematik und in Sport. Die frühere Fassung nahm einfach die erste Datei und
   haette Sportkarten stillschweigend in data/mat.js abgelegt. Mehrdeutige
   Teilgebiete verlangen deshalb ein ausdrueckliches Feld cat. */
const dateien = new Map();
for (const c of CARDS) {
  if (!dateien.has(c.sub)) dateien.set(c.sub, new Set());
  dateien.get(c.sub).add(`data/${c.cat}.js`);
}
const kategorien = new Set(CARDS.map(c => c.cat));
const zielDatei = (c) => {
  const moeglich = dateien.get(c.s);
  if (!moeglich) return { fehler: `unbekanntes Teilgebiet „${c.s}"` };
  /* Ein ausdrueckliches Thema wird auch dann geprueft, wenn das Teilgebiet
     eindeutig ist. Vorher gewann die Eindeutigkeit und das Feld wurde
     stillschweigend ignoriert: Eine Karte mit cat:"spo" und einem Teilgebiet,
     das es nur in Mathematik gibt, landete wortlos in data/mat.js. Wer beides
     angibt und sich widerspricht, hat einen Fehler gemacht - und will davon
     erfahren, statt die Karte am falschen Ort wiederzufinden. */
  if (c.cat && !kategorien.has(c.cat)) return { fehler: `unbekanntes Thema „${c.cat}"` };
  if (c.cat && !moeglich.has(`data/${c.cat}.js`)) {
    return { fehler: `Teilgebiet „${c.s}" gibt es nicht im Thema „${c.cat}"` };
  }
  if (moeglich.size === 1) return { ziel: [...moeglich][0] };
  if (!c.cat) {
    return { fehler: `Teilgebiet „${c.s}" gibt es in mehreren Themen (${[...moeglich].join(', ')}) – Feld cat noetig` };
  }
  if (!kategorien.has(c.cat)) return { fehler: `unbekanntes Thema „${c.cat}"` };
  const ziel = `data/${c.cat}.js`;
  if (!moeglich.has(ziel)) return { fehler: `Teilgebiet „${c.s}" gibt es nicht im Thema „${c.cat}"` };
  return { ziel };
};

const roh = JSON.parse(readFileSync(pfad, 'utf8'));
const eingang = (roh.gebiete || []).flatMap(g => g.cards || []);
const vorhanden = new Set(CARDS.map(c => c.q.trim()));

/* Zuerst Weissraum einebnen, dann erst maskieren: Ein Zeilenumbruch im Text
   stand sonst roh in einer Zeichenkette mit doppelten Anfuehrungszeichen - die
   Datei war damit syntaktisch kaputt und die App zeigte eine weisse Seite.
   Umbruch, Tabulator und geschuetztes Leerzeichen sind in einer Kartenzeile
   ohnehin nie gewollt. */
const esc = (s) => String(s).replace(/\s+/g, ' ').trim()
  .replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const zeile = (c) => `{q:"${esc(c.q)}",a:"${esc(c.a)}",s:"${esc(c.s)}",d:${c.d},`
  + (c.mc ? 'mc:true,' : '')
  + `t:"${esc(c.t)}",w:[${c.w.map(w => `"${esc(w)}"`).join(',')}]},`;

const proDatei = new Map();
const abgelehnt = [];
for (const c of eingang) {
  const q = (c.q || '').trim();
  if (!q || !c.a || !c.s || !Array.isArray(c.w) || c.w.length !== 3) { abgelehnt.push([q, 'unvollständig']); continue; }
  if (vorhanden.has(q)) { abgelehnt.push([q, 'Frage gibt es schon']); continue; }
  const { ziel, fehler } = zielDatei(c);
  if (fehler) { abgelehnt.push([q, fehler]); continue; }
  if (c.w.includes(c.a)) { abgelehnt.push([q, 'Ablenker enthält die Antwort']); continue; }
  if (new Set(c.w).size !== 3) { abgelehnt.push([q, 'doppelte Ablenker']); continue; }
  vorhanden.add(q);
  (proDatei.get(ziel) || proDatei.set(ziel, []).get(ziel)).push(c);
}

/* Erst alles pruefen, dann schreiben. Die Pruefung sass frueher IN der Schleife:
   Bei zwei Zieldateien war die erste laengst geschrieben, wenn die zweite
   scheiterte - und die Meldung sagte trotzdem „nichts geschrieben". Wer ihr
   glaubte und nicht in git status sah, committete eine halb eingespielte
   Ergaenzung. */
for (const [ziel, liste] of [...proDatei].sort()) {
  try { new Function('return [' + liste.map(zeile).join('\n').replace(/,$/, '') + ']')(); }
  catch (e) {
    console.error(`${ziel}: erzeugte Zeilen parsen nicht – nichts geschrieben (${e.message})`);
    process.exit(1);
  }
}

let summe = 0;
for (const [ziel, liste] of [...proDatei].sort()) {
  const txt = readFileSync(ziel, 'utf8');
  const schluss = txt.lastIndexOf('];');
  if (schluss < 0) { console.error(`${ziel}: Abschluss „];" nicht gefunden`); process.exit(1); }
  const block = `/* ---------- Ergänzt: Lücken geschlossen ---------- */\n`
    + liste.map(zeile).join('\n') + '\n';
  if (dry) console.log(block.trimEnd());
  if (!dry) writeFileSync(ziel, txt.slice(0, schluss) + block + txt.slice(schluss));
  console.log(`${ziel.padEnd(14)} +${liste.length}`);
  summe += liste.length;
}
console.log(`\n${summe} Karten ${dry ? 'wären ergänzt' : 'ergänzt'}, ${abgelehnt.length} abgewiesen`);
for (const [q, why] of abgelehnt) console.log('  raus  ', why, '|', q.slice(0, 60));

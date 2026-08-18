/* Bei Zahlenkarten lag die richtige Antwort in 85 % der Faelle zwischen den
   Ablenkern (Zufall waere 50 %). Wer beide Extremwerte streicht, raet dann mit
   50 statt 25 Prozent Trefferquote. Dieses Skript spiegelt einzelne Ablenker an
   der richtigen Antwort, sodass alle drei auf derselben Seite liegen. Der Abstand
   bleibt gleich, die Ablenker also gleich plausibel.
   Aufruf: node scripts/fix-bracket.mjs [--schreiben] */
import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS } from '../data/index.js';

const schreiben = process.argv.includes('--schreiben');
const JAHR = /^(\d{1,4})(\s*(v\.\s*Chr\.|n\.\s*Chr\.))?$/;

/* Nur echte Jahreszahlen. Bei allem anderen steckt hinter der Zahl eine Struktur,
   die eine Spiegelung zerstoert: 110 und 911 sind Notrufnummern, 1024 und 3125 sind
   Potenzen, 46 sind Chromosomen. Ein gespiegelter Wert waere dort blanker Unsinn. */
const wert = (s) => {
  const m = String(s).trim().match(JAHR);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const aera = /(v|n)\.\s*Chr\./.test(m[2] || '');
  if (!aera && (n < 1000 || n > 2100)) return null;
  return /v\./.test(m[2] || '') ? -n : n;
};
const form = (n, muster) => {
  const vorChr = n < 0;
  if (vorChr && !/Chr\./.test(muster)) return null;   // negative Jahre nur mit Aera-Zusatz
  return `${Math.abs(n)}${vorChr ? ' v. Chr.' : /n\.\s*Chr\./.test(muster) ? ' n. Chr.' : ''}`;
};
/* stabil aus der Karten-ID, damit zwei Laeufe dasselbe tun */
const streu = (id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 100; };

const proDatei = new Map();
let geprueft = 0, geaendert = 0;

for (const c of CARDS) {
  if (!c.w || c.w.length !== 3) continue;
  const a = wert(c.a);
  const ws = c.w.map(wert);
  if (a === null || ws.some(v => v === null)) continue;
  const alle = [a, ...ws];
  if (new Set(alle).size !== 4) continue;
  geprueft++;
  const drunter = ws.filter(v => v < a).length;
  if (drunter === 0 || drunter === 3) continue;          // liegt schon aussen
  if (streu(c.id) >= 62) continue;                        // nur ein Teil, sonst kippt die Schlagseite

  // Die kleinere Gruppe wandert auf die andere Seite: gespiegelt an der Antwort.
  const nachOben = drunter <= 1;
  const neu = [];
  for (let i = 0; i < 3; i++) {
    const v = ws[i];
    const falscheSeite = nachOben ? v < a : v > a;
    if (!falscheSeite) { neu.push({ v, s: c.w[i] }); continue; }
    let kandidat = a + (a - v);                            // Spiegelung
    while (kandidat === a || neu.some(x => x.v === kandidat) || kandidat === 0
           || ws.includes(kandidat)) kandidat += nachOben ? 1 : -1;
    const text = form(kandidat, c.w[i]);
    if (!text) { neu.length = 0; break; }
    neu.push({ v: kandidat, s: text });
  }
  if (neu.length !== 3) continue;
  if (new Set([a, ...neu.map(x => x.v)]).size !== 4) continue;
  const datei = `data/${c.cat}.js`;
  (proDatei.get(datei) || proDatei.set(datei, []).get(datei))
    .push({ alt: c.w, neu: neu.map(x => x.s), a: c.a, q: c.q });
  geaendert++;
}

for (const [datei, liste] of [...proDatei].sort()) {
  let txt = readFileSync(datei, 'utf8');
  for (const e of liste) {
    const altStr = `w:[${e.alt.map(w => JSON.stringify(w)).join(',')}]`;
    const neuStr = `w:[${e.neu.map(w => JSON.stringify(w)).join(',')}]`;
    if (!txt.includes(altStr)) { console.error(`  ! nicht gefunden in ${datei}: ${e.q.slice(0, 50)}`); continue; }
    txt = txt.replace(altStr, neuStr);
    console.log(`${datei}  „${e.a}"  ${e.alt.join(' / ')}   ->   ${e.neu.join(' / ')}`);
  }
  if (schreiben) writeFileSync(datei, txt);
}
console.log(`\n${geprueft} Zahlenkarten geprueft, ${geaendert} ${schreiben ? 'geaendert' : 'waeren zu aendern'}`);

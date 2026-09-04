/* Aendert genau ein Feld einer bestehenden Karte – ueber ihre Kennung, nicht
   ueber ihre Zeilennummer.

   Warum ueberhaupt ein Werkzeug: Nach einer Pruefrunde stehen Dutzende
   Korrekturen an, jede an einer anderen Stelle in neun Dateien. Von Hand
   gesucht und ersetzt geht dabei irgendwann eine Zeile kaputt, und zwar still –
   die Datei bleibt gueltiges JavaScript, nur die Karte stimmt nicht mehr.

   Die Kennung ist der FNV-1a-Hash des Fragetexts, dieselbe Rechnung wie in
   data/index.js. Wer die FRAGE aendert, aendert damit die Kennung; deshalb
   hinterlegt dieses Werkzeug den alten Wortlaut automatisch als p. Ueber p
   findet der Lernstand die umbenannte Karte wieder. */

import { readFileSync, writeFileSync } from 'node:fs';

const KATEGORIEN = ['ges', 'geo', 'nat', 'mat', 'spo', 'kul', 'spr', 'pol', 'all'];

export function kennung(frage, kategorie) {
  let h = 0x811c9dc5;
  for (let i = 0; i < frage.length; i++) { h ^= frage.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${kategorie}-${h.toString(36)}`;
}

const js = (wert) => JSON.stringify(wert);

/* Der Kern, absichtlich ohne Dateizugriff: eine Kartenzeile rein, die geaenderte
   Zeile raus. So laesst er sich pruefen, ohne data/ anzufassen. */
export function ersetzeInZeile(zeile, feld, wert) {
  const kopf = zeile.match(/^\{q:("(?:[^"\\]|\\.)*")/);
  if (!kopf) throw new Error('keine Kartenzeile');

  if (feld === 'q') {
    if (/,p:/.test(zeile)) throw new Error('Karte hat schon ein p – der Vorgaenger muss von Hand geprueft werden');
    const alt = JSON.parse(kopf[1]);
    return zeile.replace(kopf[0], `{q:${js(wert)},p:${js(alt)}`);
  }

  if (feld === 'a') {
    const m = zeile.match(/(^\{q:(?:"(?:[^"\\]|\\.)*"),a:)("(?:[^"\\]|\\.)*")/);
    if (!m) throw new Error('kein a');
    return zeile.replace(m[0], `${m[1]}${js(wert)}`);
  }

  if (feld === 't') {
    const m = zeile.match(/,t:("(?:[^"\\]|\\.)*")/);
    if (!m) throw new Error('kein t');
    return zeile.replace(m[0], `,t:${js(wert)}`);
  }

  if (feld === 'w' || /^w[012]$/.test(feld)) {
    const m = zeile.match(/,w:(\[(?:[^[\]\\]|\\.)*\])/);
    if (!m) throw new Error('kein w');
    let liste;
    if (feld === 'w') {
      if (!Array.isArray(wert) || wert.length !== 3) throw new Error('w braucht genau drei Ablenker');
      liste = wert;
    } else {
      liste = JSON.parse(m[1]);
      liste[Number(feld[1])] = wert;
    }
    // Ein Ablenker, der gleich der Antwort ist, waere im Quiz zweimal richtig.
    const antwort = JSON.parse(zeile.match(/,a:("(?:[^"\\]|\\.)*")/)[1]);
    if (liste.includes(antwort)) throw new Error('ein Ablenker ist gleich der Antwort');
    if (new Set(liste).size !== liste.length) throw new Error('zwei Ablenker sind gleich');
    return zeile.replace(m[0], `,w:${js(liste)}`);
  }

  if (feld === 'az') {
    const vorhanden = zeile.match(/,az:(\[(?:[^[\]\\]|\\.)*\])/);
    const neu = Array.isArray(wert) ? wert : [wert];
    const liste = [...new Set([...(vorhanden ? JSON.parse(vorhanden[1]) : []), ...neu])];
    if (vorhanden) return zeile.replace(vorhanden[0], `,az:${js(liste)}`);
    const m = zeile.match(/(^\{q:(?:"(?:[^"\\]|\\.)*"),a:(?:"(?:[^"\\]|\\.)*"))/);
    return zeile.replace(m[0], `${m[0]},az:${js(liste)}`);
  }

  throw new Error(`unbekanntes Feld ${feld}`);
}

export function aendere(id, feld, wert) {
  const kategorie = id.split('-')[0];
  if (!KATEGORIEN.includes(kategorie)) throw new Error(`unbekannte Kategorie in ${id}`);
  const pfad = `data/${kategorie}.js`;
  const zeilen = readFileSync(pfad, 'utf8').split('\n');
  for (let i = 0; i < zeilen.length; i++) {
    const kopf = zeilen[i].match(/^\{q:("(?:[^"\\]|\\.)*")/);
    if (!kopf || kennung(JSON.parse(kopf[1]), kategorie) !== id) continue;
    const neu = ersetzeInZeile(zeilen[i], feld, wert);
    if (neu === zeilen[i]) throw new Error(`${id}: die Ersetzung hat nichts geaendert (${feld})`);
    zeilen[i] = neu;
    writeFileSync(pfad, zeilen.join('\n'));
    return `${pfad}:${i + 1}`;
  }
  throw new Error(`Karte ${id} nicht gefunden`);
}

/* Aufruf: node scripts/karte-aendern.mjs auftrag.json
   Die Datei enthaelt [{ id, feld, wert }, …]. Alles oder nichts: Ein Fehler
   bricht ab, bevor die naechste Aenderung geschrieben wird. */
if (process.argv[2]) {
  const auftraege = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  for (const { id, feld, wert } of auftraege) console.log(`${id} ${feld} -> ${aendere(id, feld, wert)}`);
  console.log(`${auftraege.length} Aenderungen – jetzt npm test und npm run build`);
}

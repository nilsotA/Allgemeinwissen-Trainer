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
import { pathToFileURL } from 'node:url';

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
    /* Angehaengt wird hinter dem a-Feld, wo immer das steht. Vorher verlangte
       das Muster, dass a unmittelbar auf q folgt – bei jeder Karte, die schon
       einen alten Wortlaut als p traegt, steht dazwischen aber genau der, und
       das Muster fand nichts. Der Fehler kam als „Cannot read properties of
       null" heraus und nicht als Satz, der sagt, was los ist. */
    const m = zeile.match(/,a:(?:"(?:[^"\\]|\\.)*")/);
    if (!m) throw new Error('kein a-Feld gefunden, an das az anschliessen koennte');
    return zeile.replace(m[0], `${m[0]},az:${js(liste)}`);
  }

  throw new Error(`unbekanntes Feld ${feld}`);
}

/* Wendet eine Liste von Auftraegen an – wirklich alles oder nichts. Vorher
   stand hier ein Schreibvorgang je Aenderung; faellt der 80. Auftrag durch,
   lagen 79 Aenderungen schon in den Dateien und der Rest nicht. Genau das ist
   mir bei 321 Korrekturen passiert. Jetzt wird erst im Speicher geaendert und
   nur geschrieben, wenn ALLE Auftraege durchgehen.

   Rueckgabe: eine Zeile je Auftrag, damit sichtbar bleibt, was passiert ist. */
export function aendereAlle(auftraege) {
  const dateien = new Map();
  const lade = (pfad) => {
    if (!dateien.has(pfad)) dateien.set(pfad, readFileSync(pfad, 'utf8').split('\n'));
    return dateien.get(pfad);
  };
  const berichte = [];
  for (const { id, feld, wert } of auftraege) {
    const kategorie = id.split('-')[0];
    if (!KATEGORIEN.includes(kategorie)) throw new Error(`unbekannte Kategorie in ${id}`);
    const pfad = `data/${kategorie}.js`;
    const zeilen = lade(pfad);
    let gefunden = false;
    for (let i = 0; i < zeilen.length; i++) {
      const kopf = zeilen[i].match(/^\{q:("(?:[^"\\]|\\.)*")/);
      if (!kopf || kennung(JSON.parse(kopf[1]), kategorie) !== id) continue;
      gefunden = true;
      const neu = ersetzeInZeile(zeilen[i], feld, wert);
      if (neu === zeilen[i]) {
        /* Bei az ist das kein Fehler, sondern der Normalfall beim zweiten
           Durchlauf: Die Schreibweise steht schon da, die Liste ist eine Menge.
           Bei jedem anderen Feld heisst „nichts geaendert", dass der neue Wert
           dem alten gleicht – und das ist fast immer ein Versehen. */
        if (feld === 'az') { berichte.push(`${id} az -> ${pfad}:${i + 1} (stand schon da)`); break; }
        throw new Error(`${id}: die Ersetzung hat nichts geaendert (${feld})`);
      }
      zeilen[i] = neu;
      berichte.push(`${id} ${feld} -> ${pfad}:${i + 1}`);
      break;
    }
    if (!gefunden) throw new Error(`Karte ${id} nicht gefunden`);
  }
  for (const [pfad, zeilen] of dateien) writeFileSync(pfad, zeilen.join('\n'));
  return berichte;
}

export function aendere(id, feld, wert) {
  return aendereAlle([{ id, feld, wert }])[0];
}

/* Aufruf: node scripts/karte-aendern.mjs auftrag.json
   Die Datei enthaelt [{ id, feld, wert }, …]. Alles oder nichts: Ein Fehler
   bricht ab, bevor die naechste Aenderung geschrieben wird.

   Geprueft wird, ob DIESE Datei aufgerufen wurde – nicht nur, ob irgendein
   Argument dasteht. Sonst startet der Aufruf mit, sobald ein anderes Skript
   kennung() oder aendere() importiert und selbst ein Argument hat; genau das
   ist mir passiert, und die Auswertungsdatei landete als Auftragsdatei hier. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) {
  const auftraege = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  for (const zeile of aendereAlle(auftraege)) console.log(zeile);
  console.log(`${auftraege.length} Aenderungen – jetzt npm test und npm run build`);
}

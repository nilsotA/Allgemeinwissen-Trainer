/* Quizmodus - der Pruefstand der App.

   Das Tagestraining fragt in Ruhe ab, das Duell zieht aus dem Gelernten. Ein
   Quizspiel fragt dagegen ALLES, unter Zeitdruck, und rechnet in Punkten. Genau
   das bildet dieser Modus nach: eine Runde quer durch alle Themen, eine Uhr je
   Frage, Punkte fuer Treffer und Tempo, und am Ende die Frage, wo die Punkte
   verloren gingen.

   Alles hier ist rein: Zufall und Kartenstand kommen als Parameter herein.
   Dadurch laesst sich die Ziehung mit festem Zufall wiederholen, und die
   Punkteformel steht an einer einzigen Stelle, an der ein Test sie festnagelt.
   Die Oberflaeche (Uhr, Knoepfe, Ergebnisbild) lebt in app.js und benutzt den
   Duell-Pfad, der die sichtbarkeitsbewusste Uhr schon hat. */
import { strength, isLeech } from './srs.js';

export const FRAGEN_JE_RUNDE = 12;
export const FRIST_MS = 15000;        // dieselbe Frist wie im Duell
export const BLITZ_MS = 5000;         // so lange gibt es den Tempobonus
export const PUNKTE_TREFFER = 10;
export const PUNKTE_BLITZ = 5;
export const MAX_JE_FRAGE = PUNKTE_TREFFER + PUNKTE_BLITZ;

/* Die Punkteformel in einem Satz: Zehn Punkte fuer jeden Treffer, fuenf dazu,
   wenn die Antwort in den ersten fuenf Sekunden kam. Falsch und abgelaufen
   bringen nichts. Gezaehlt wird die SICHTBARE Zeit - eine Unterbrechung kostet
   den Bonus nicht (siehe sichtbareZeit in app.js). Der Bonus ist bewusst
   kleiner als der Treffer: Ein Quiz belohnt Wissen, Tempo ist die Zugabe. */
export function punkte(ok, sichtbareMs) {
  if (!ok) return 0;
  return PUNKTE_TREFFER + (sichtbareMs <= BLITZ_MS ? PUNKTE_BLITZ : 0);
}

function mischen(arr, zufall) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Die Ziehung fuer eine Runde.

   - Jedes Thema im Pool kommt mindestens einmal dran; bei neun Themen und zwoelf
     Fragen sind drei Themen zweimal an der Reihe. Welche, entscheidet der Zufall.
   - Die Schwierigkeit steigt wie im Quiz: das erste Drittel Basis, dann Solide,
     dann Profi. Fehlt einem Thema eine Stufe, nimmt es eine beliebige Karte.
   - Auch nie gesehene Karten werden gezogen. Ein Quiz fragt nicht nur, was man
     schon gelernt hat - das ist der Unterschied zum Duell.
   - Die Zusatzplaetze (ein Thema zum zweiten Mal) bevorzugen bekannte Karten,
     die wackeln. Das ist die Regel aus dem Duell: Woran man unter Zeitdruck
     scheiterte, muss unter Zeitdruck wiederkommen.

   Der Rueckgabewert hat die Form der anderen Warteschlangen ({card, fresh}),
   damit startRun() ihn ohne Sonderfall annimmt. */
export function ziehung(pool, { n = FRAGEN_JE_RUNDE, zufall = Math.random, stand = () => null } = {}) {
  const kategorien = mischen([...new Set(pool.map(c => c.cat))], zufall);
  if (!kategorien.length) return [];
  const wackelt = (c) => {
    const s = stand(c.id);
    return !!s && s.seen > 0 && (isLeech(s) || strength(s) < 0.6);
  };
  const gewaehlt = new Set();
  const out = [];
  for (let i = 0; i < n; i++) {
    const stufe = 1 + Math.floor((i * 3) / n);
    const cat = kategorien[i % kategorien.length];
    const frei = (passt) => pool.filter(c => !gewaehlt.has(c.id) && passt(c));
    let kandidaten = frei(c => c.cat === cat && c.d === stufe);
    if (!kandidaten.length) kandidaten = frei(c => c.cat === cat);
    if (!kandidaten.length) kandidaten = frei(() => true);
    if (!kandidaten.length) break;
    if (i >= kategorien.length) {
      const schwach = kandidaten.filter(wackelt);
      if (schwach.length) kandidaten = schwach;
    }
    const card = kandidaten[Math.floor(zufall() * kandidaten.length)];
    gewaehlt.add(card.id);
    out.push({ card, fresh: false });
  }
  return out;
}

/* Das Ergebnisbild einer Runde aus den einzelnen Antworten.
   antworten: [{ card, ok, abgelaufen, punkte }]
   Die Themen stehen nach verlorenen Punkten sortiert - die Frage nach der Runde
   ist nicht „wie gut war ich", sondern „wo habe ich verloren". Bei Gleichstand
   entscheidet die uebergebene Themenreihenfolge, damit das Bild stabil bleibt. */
export function auswertung(antworten, reihenfolge = []) {
  const felder = new Map();
  let punkteGesamt = 0, richtig = 0, falsch = 0, langsam = 0, blitzVerpasst = 0;
  for (const a of antworten) {
    const e = felder.get(a.card.cat)
      || { cat: a.card.cat, punkte: 0, max: 0, richtig: 0, falsch: 0, langsam: 0 };
    e.max += MAX_JE_FRAGE;
    e.punkte += a.punkte;
    if (a.ok) { e.richtig++; richtig++; if (a.punkte < MAX_JE_FRAGE) blitzVerpasst++; }
    else if (a.abgelaufen) { e.langsam++; langsam++; }
    else { e.falsch++; falsch++; }
    punkteGesamt += a.punkte;
    felder.set(a.card.cat, e);
  }
  const rang = new Map(reihenfolge.map((id, i) => [id, i]));
  const liste = [...felder.values()]
    .map(e => ({ ...e, verloren: e.max - e.punkte }))
    .sort((a, b) => b.verloren - a.verloren || (rang.get(a.cat) ?? 99) - (rang.get(b.cat) ?? 99));
  return {
    punkte: punkteGesamt, max: antworten.length * MAX_JE_FRAGE,
    richtig, falsch, langsam, blitzVerpasst,
    verlorenFalsch: falsch * MAX_JE_FRAGE,
    verlorenLangsam: langsam * MAX_JE_FRAGE,
    verlorenBlitz: blitzVerpasst * PUNKTE_BLITZ,
    felder: liste,
  };
}

/* Was von einer Runde in den Speicher wandert: knapp, weil der Speicher der
   einzige Ort ist und jede Runde ihn ein Stueck fuellt. t ist der Zeitstempel
   und zugleich der Schluessel beim Zusammenfuehren zweier Tabs. */
export function rundenEintrag(aw, t) {
  return {
    t, p: aw.punkte, m: aw.max, r: aw.richtig, f: aw.falsch, l: aw.langsam,
    k: Object.fromEntries(aw.felder.map(e => [e.cat, [e.punkte, e.max]])),
  };
}

/* Wo ueber die letzten Runden hinweg die meisten Punkte liegen blieben - der
   eine Satz, den der Startbildschirm sagen soll. null, solange nichts verloren
   ging oder keine Runde da ist. */
export function schwaechstesFeld(runden, letzte = 5) {
  const verloren = new Map();
  for (const r of runden.slice(-letzte)) {
    for (const [cat, [p, m]] of Object.entries(r.k || {})) {
      verloren.set(cat, (verloren.get(cat) || 0) + Math.max(0, (m || 0) - (p || 0)));
    }
  }
  let bestes = null;
  for (const [cat, v] of verloren) if (v > 0 && (!bestes || v > bestes.verloren)) bestes = { cat, verloren: v };
  return bestes;
}

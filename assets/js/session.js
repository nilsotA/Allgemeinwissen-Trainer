/* Stellt die Lernwarteschlange zusammen: fällige Wiederholungen + neue Karten,
   verschränkt über die Kategorien (Interleaving). */
import { CARDS, catCards } from '../../data/index.js';
import { S, settings, cardState, today, todayNum, isFlagged, uebernimmVorgaenger } from './store.js';
import { isDue, isNew, strength, isLeech } from './srs.js';
import { shuffle } from './quiz.js';

/* Umformulierte Karten erben den Stand ihrer frueheren Fassung. Muss laufen,
   bevor irgendjemand Kartenstaende liest - deshalb hier und nicht spaeter. */
uebernimmVorgaenger(CARDS.filter(c => c.alt && c.alt.length).map(c => [c.id, c.alt]));

export function activeCats() {
  const sel = settings().cats;
  return (!sel || !sel.length) ? null : new Set(sel);
}

function inScope(c) {
  const a = activeCats();
  return !a || a.has(c.cat);
}

/** Fällige Karten, dringendste zuerst.
    seen > 0 ist wichtig: eine Karte mit Zustand, aber ohne Abfrage gilt als neu –
    ohne diese Bedingung stünde sie gleichzeitig in beiden Listen und käme doppelt dran. */
export function dueCards(pool = CARDS) {
  const t = todayNum();
  return pool
    .filter(c => inScope(c))
    .map(c => ({ c, s: cardState(c.id) }))
    .filter(x => x.s && x.s.seen > 0 && isDue(x.s, t))
    .sort((a, b) => (a.s.due - b.s.due) || (strength(a.s) - strength(b.s)))
    .map(x => x.c);
}

/** Noch nie gesehene Karten – leichte zuerst, damit Grundlagen zuerst sitzen. */
export function newCards(pool = CARDS) {
  const ladder = settings().level === 'ladder';
  const list = pool.filter(c => inScope(c) && isNew(cardState(c.id)));
  const byCat = {};
  for (const c of list) (byCat[c.cat] ||= []).push(c);
  for (const k of Object.keys(byCat)) {
    // Zweitkriterium ist die ID, nicht der Fragetext. Alphabetisch sortiert kamen
    // gleich anfangende Fragen hintereinander – in der allerersten Einheit etwa
    // zweimal „Ab welchem Alter darf man in Deutschland …". Das arbeitet gegen das
    // Verschränken. Die ID ist ein Hash der Frage: streut wie Zufall, liegt aber
    // fest, sodass die Reihenfolge innerhalb einer Kategorie reproduzierbar bleibt.
    // (Welche Kategorie beginnt, wird weiter unten bewusst gewürfelt.)
    byCat[k] = ladder
      ? byCat[k].sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      : shuffle(byCat[k]);
  }
  // Reihum durch die Kategorien: gemischte Themen prägen sich besser ein.
  // Schwerpunktthemen sind in jeder Runde zweimal an der Reihe. Ohne das bekommt
  // ein Studienfach denselben Anteil wie jedes andere Thema - bei neun Themen
  // also ein Neuntel, ganz gleich wie viele Karten dahinterstehen.
  const schwer = focusCats();
  const keys = shuffle(Object.keys(byCat));
  const out = [];
  let more = true;
  while (more) {
    more = false;
    for (const k of keys) {
      const zuege = schwer && schwer.has(k) ? 2 : 1;
      for (let i = 0; i < zuege; i++) {
        const n = byCat[k].shift();
        if (n) { out.push(n); more = true; }
      }
    }
  }
  return out;
}

/** Schwerpunktthemen – null, wenn keins gewählt ist. Abgeschaltete zählen nicht mit. */
export function focusCats() {
  const f = settings().focus;
  if (!f || !f.length) return null;
  const a = activeCats();
  const s = new Set(f.filter(id => !a || a.has(id)));
  return s.size ? s : null;
}

/* Ab wann der Rueckstand so gross ist, dass neue Karten nur schaden.
   Ohne diese Bremse staut sich der Rueckstand in der Simulation auf ueber 300
   Karten auf, nach zwei Wochen Abwesenheit auf ueber 800 - und genau daran
   geben Lernende auf. Mit Bremse bleibt die Spitze bei rund 18, ohne dass am
   Ende weniger Karten sitzen. */
export const rueckstauSchwelle = () => Math.round(settings().maxReviews * 0.9);
/* Die Anzahl faelliger Karten laesst sich durchreichen, wo sie ohnehin schon
   ermittelt wurde - overview() rief dueCards() sonst zweimal. */
export const imRueckstau = (faellig = null) =>
  (faellig ?? dueCards().length) >= rueckstauSchwelle();

/** Wie viele neue Karten sind heute noch frei? */
export function newBudget(faellig = null) {
  if (imRueckstau(faellig) && !settings().trotzdemNeu) return 0;
  return Math.max(0, settings().newPerDay - (today().newC || 0));
}

/** Tagesplan: Wiederholungen zuerst, neue Karten eingestreut. */
export function buildDaily(pool = CARDS) {
  const rev = dueCards(pool).slice(0, settings().maxReviews);
  const fresh = newCards(pool).slice(0, newBudget());
  return interleave(rev, fresh);
}

/** Neue Karten gleichmäßig zwischen die Wiederholungen streuen.
    Über einen Sollanteil statt über eine feste Schrittweite: Bei mehr neuen als
    fälligen Karten ergäbe die Schrittweite immer 1, und der Rest landete als
    Block am Ende – genau dort, wo die Aufmerksamkeit am kleinsten ist. */
function interleave(rev, fresh) {
  if (!fresh.length) return rev.map(c => ({ card: c, fresh: false }));
  if (!rev.length) return fresh.map(c => ({ card: c, fresh: true }));
  const gesamt = rev.length + fresh.length;
  const out = [];
  let ri = 0, fi = 0;
  for (let i = 0; i < gesamt; i++) {
    const sollNeu = Math.round(((i + 1) * fresh.length) / gesamt);
    if (fi < sollNeu && fi < fresh.length) out.push({ card: fresh[fi++], fresh: true });
    else if (ri < rev.length) out.push({ card: rev[ri++], fresh: false });
    else out.push({ card: fresh[fi++], fresh: true });
  }
  return out;
}

/** Themen-Training: alles zu einer Kategorie, fällige und neue zuerst. */
export function buildTopic(cat, limit = 20) {
  const pool = catCards(cat);
  const t = todayNum();
  const due = pool.filter(c => { const s = cardState(c.id); return s && s.seen > 0 && isDue(s, t); });
  const fresh = pool.filter(c => isNew(cardState(c.id)));
  const rest = shuffle(pool.filter(c => !due.includes(c) && !fresh.includes(c)));
  const ladder = fresh.sort((a, b) => a.d - b.d);
  const picked = [...due, ...ladder, ...rest].slice(0, limit);
  return picked.map(c => ({ card: c, fresh: isNew(cardState(c.id)) }));
}

/** Wackelkandidaten: oft vergessen oder schwach – gezieltes Nacharbeiten. */
export function buildWeak(limit = 20) {
  const t = todayNum();
  const scored = CARDS
    .filter(c => inScope(c))
    .map(c => ({ c, s: cardState(c.id) }))
    .filter(x => x.s && x.s.seen > 0)
    // Faellige zuerst: eine Karte vor ihrem Termin zu ueben bringt wenig und
    // haelt nur den Platz einer Karte besetzt, die heute wirklich ansteht.
    .sort((a, b) => (isDue(b.s, t) - isDue(a.s, t))
                 || (isLeech(b.s) - isLeech(a.s))
                 || (strength(a.s) - strength(b.s)));
  return scored.slice(0, limit).map(x => ({ card: x.c, fresh: false }));
}

/** Duell: schnelle Multiple-Choice-Runde, wahlweise auf ein Thema begrenzt.
 *  Drei Toepfe: erst die schwaechsten bekannten Karten, dann weiteres
 *  Bekanntes, dann Neues. Ohne den ersten Topf kaeme ausgerechnet das, woran
 *  man unter Zeitdruck gescheitert ist, nie wieder unter Zeitdruck dran –
 *  eine Karte, die man in zwanzig Sekunden abruft, ist im Duell verloren. */
export function buildDuel(n = 10, cat = null) {
  const pool = CARDS.filter(c => inScope(c) && (!cat || c.cat === cat));
  const known = pool.map(c => ({ c, s: cardState(c.id) })).filter(x => x.s && x.s.seen > 0);
  const schwach = known
    .filter(x => isLeech(x.s) || strength(x.s) < 0.6)
    .sort((a, b) => (isLeech(b.s) - isLeech(a.s)) || (strength(a.s) - strength(b.s)))
    .slice(0, Math.round(n * 0.3))
    .map(x => x.c);
  const rest = shuffle(known.map(x => x.c).filter(c => !schwach.includes(c)))
    .slice(0, Math.ceil(n * 0.6) - schwach.length);
  const gewaehlt = [...schwach, ...rest];
  const neu = shuffle(pool.filter(c => !gewaehlt.includes(c))).slice(0, n - gewaehlt.length);
  return shuffle([...gewaehlt, ...neu]).map(c => ({ card: c, fresh: false }));
}

/** Kennzahlen für Startseite und Statistik. */
export function overview() {
  const t = todayNum();
  // Alle Kennzahlen auf denselben Ausschnitt beziehen: sonst zeigte die Startseite
  // „3 faellig" (gefiltert) neben „400 sitzt fest" (ungefiltert).
  const pool = CARDS.filter(c => inScope(c));
  let learned = 0, mature = 0, seenTotal = 0, neuVorrat = 0;
  for (const c of pool) {
    const s = cardState(c.id);
    // Dieselbe Bedingung wie isNew - der Vorrat faellt in dieser Schleife mit ab,
    // statt dass newCards() dafuer die ganze Warteschlange aufbaut.
    if (!s || !s.seen) { neuVorrat++; continue; }
    seenTotal++;
    if (s.reps > 0) learned++;
    if (strength(s) >= 0.6) mature++;
  }
  const due = dueCards().length;
  const st = S();
  return {
    total: pool.length, seen: seenTotal, learned, mature, due,
    // Nicht nur das Budget, sondern auch der Vorrat: Sind alle Karten einmal
    // gesehen, stand auf der Startseite „12 neu frei" neben „alles erledigt".
    newLeft: Math.min(newBudget(due), neuVorrat),
    accuracy: st.totalAnswers ? st.totalCorrect / st.totalAnswers : 0,
    t
  };
}

/** Ist dieses Thema im Tagestraining aktiv? */
export const catAktiv = (catId) => {
  const a = activeCats();
  return !a || a.has(catId);
};

/** Fortschritt je Kategorie (0..1) für die Themenliste. */
export function catProgress() {
  const out = {};
  for (const c of CARDS) {
    const o = (out[c.cat] ||= { n: 0, sum: 0, due: 0, fresh: 0 });
    o.n++;
    const s = cardState(c.id);
    if (!s || !s.seen) { o.fresh++; continue; }
    o.sum += strength(s);
    if (isDue(s)) o.due++;
  }
  for (const k of Object.keys(out)) out[k].pct = out[k].n ? out[k].sum / out[k].n : 0;
  return out;
}

/* Fortschritt je Schwierigkeitsstufe. „Sitzen die Grundlagen aus Klasse 5 bis 8?"
   war die Ausgangsfrage an diese App - beantworten konnte sie sie bisher nicht,
   weil die Statistik nur nach Thema aufschluesselte. */
export function levelProgress() {
  const out = {};
  for (const c of CARDS) {
    if (!inScope(c)) continue;
    const o = (out[c.d] ||= { n: 0, sum: 0, seen: 0, mature: 0 });
    o.n++;
    const s = cardState(c.id);
    if (!s || !s.seen) continue;
    o.seen++;
    const st = strength(s);
    o.sum += st;
    if (st >= 0.6) o.mature++;
  }
  for (const k of Object.keys(out)) out[k].pct = out[k].n ? out[k].sum / out[k].n : 0;
  return out;
}

/* Fortschritt je Teilgebiet eines Themas. Mit 44 Teilgebieten ist „das ganze
   Thema üben" oft zu grob: Wer vor einer Prüfung in Bewegungslehre steht, will
   genau die 21 Karten und nicht 20 zufällige aus 260. */
export function subProgress(cat) {
  const out = new Map();
  for (const c of CARDS) {
    if (c.cat !== cat) continue;
    if (!out.has(c.sub)) out.set(c.sub, { sub: c.sub, n: 0, sum: 0, due: 0, fresh: 0 });
    const o = out.get(c.sub);
    o.n++;
    const s = cardState(c.id);
    if (!s || !s.seen) { o.fresh++; continue; }
    o.sum += strength(s);
    if (isDue(s)) o.due++;
  }
  return [...out.values()]
    .map(o => ({ ...o, pct: o.n ? o.sum / o.n : 0 }))
    .sort((a, b) => b.n - a.n || (a.sub < b.sub ? -1 : 1));
}

/** Markierte Karten üben – was du beim Nachschlagen angehakt hast. */
export function buildFlagged(limit = 20) {
  const pool = CARDS.filter(c => isFlagged(c.id));
  return shuffle(pool).slice(0, limit).map(c => ({ card: c, fresh: isNew(cardState(c.id)) }));
}
export const flaggedCount = () => CARDS.reduce((n, c) => n + (isFlagged(c.id) ? 1 : 0), 0);

/** Wie viele Wiederholungen stehen an den nächsten Tagen an? */
export function forecast(days = 7) {
  const t = todayNum();
  const out = Array.from({ length: days }, () => 0);
  for (const c of CARDS) {
    if (!inScope(c)) continue;
    const s = cardState(c.id);
    if (!s || !s.seen) continue;
    const idx = Math.max(0, s.due - t);
    if (idx < days) out[idx]++;
  }
  return out;
}

/** Schwächste Teilgebiete – Grundlage für gezieltes Nacharbeiten. */
export function weakSubs(minKarten = 4, limit = 6) {
  const acc = {};
  for (const c of CARDS) {
    // Ein abgeschaltetes Thema darf hier nicht auftauchen: Der Eintrag ist ein
    // Knopf, der eine Uebungsrunde startet - fuer ein Thema, das der Nutzer
    // ausdruecklich weggeschaltet hat.
    if (!inScope(c)) continue;
    const s = cardState(c.id);
    if (!s || !s.seen) continue;
    const key = c.cat + '/' + c.sub;
    const o = (acc[key] ||= { cat: c.cat, sub: c.sub, n: 0, seen: 0, ok: 0, sum: 0 });
    o.n++; o.seen += s.seen; o.ok += (s.ok || 0); o.sum += strength(s);
  }
  return Object.values(acc)
    .filter(o => o.n >= minKarten)          // mindestens so viele geübte Karten, nicht Abfragen
    .map(o => ({ ...o, rate: o.seen ? o.ok / o.seen : 0, pct: o.sum / o.n }))
    .sort((a, b) => a.rate - b.rate || a.pct - b.pct)
    .slice(0, limit);
}

/** Übung für ein einzelnes Teilgebiet. */
export function buildSub(cat, sub, limit = 20) {
  const pool = CARDS.filter(c => c.cat === cat && c.sub === sub);
  const t = todayNum();
  const due = pool.filter(c => { const s = cardState(c.id); return s && s.seen > 0 && isDue(s, t); });
  const rest = shuffle(pool.filter(c => !due.includes(c)));
  return [...due, ...rest].slice(0, limit).map(c => ({ card: c, fresh: isNew(cardState(c.id)) }));
}

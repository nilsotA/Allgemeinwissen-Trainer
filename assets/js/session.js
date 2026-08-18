/* Stellt die Lernwarteschlange zusammen: fällige Wiederholungen + neue Karten,
   verschränkt über die Kategorien (Interleaving). */
import { CARDS, catCards } from '../../data/index.js';
import { S, settings, cardState, today, todayNum } from './store.js';
import { isDue, isNew, strength, isLeech } from './srs.js';
import { shuffle } from './quiz.js';

export function activeCats() {
  const sel = settings().cats;
  return (!sel || !sel.length) ? null : new Set(sel);
}

function inScope(c) {
  const a = activeCats();
  return !a || a.has(c.cat);
}

/** Fällige Karten, dringendste zuerst. */
export function dueCards(pool = CARDS) {
  const t = todayNum();
  return pool
    .filter(c => inScope(c))
    .map(c => ({ c, s: cardState(c.id) }))
    .filter(x => x.s && isDue(x.s, t))
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
    byCat[k] = ladder
      ? byCat[k].sort((a, b) => a.d - b.d || a.q.localeCompare(b.q))
      : shuffle(byCat[k]);
  }
  // Reihum durch die Kategorien: gemischte Themen prägen sich besser ein
  const keys = shuffle(Object.keys(byCat));
  const out = [];
  let more = true;
  while (more) {
    more = false;
    for (const k of keys) {
      const n = byCat[k].shift();
      if (n) { out.push(n); more = true; }
    }
  }
  return out;
}

/** Wie viele neue Karten sind heute noch frei? */
export function newBudget() {
  return Math.max(0, settings().newPerDay - (today().newC || 0));
}

/** Tagesplan: Wiederholungen zuerst, neue Karten eingestreut. */
export function buildDaily(pool = CARDS) {
  const rev = dueCards(pool).slice(0, settings().maxReviews);
  const fresh = newCards(pool).slice(0, newBudget());
  return interleave(rev, fresh);
}

/** Neue Karten gleichmäßig zwischen die Wiederholungen streuen. */
function interleave(rev, fresh) {
  if (!fresh.length) return rev.map(c => ({ card: c, fresh: false }));
  if (!rev.length) return fresh.map(c => ({ card: c, fresh: true }));
  const out = [];
  const step = Math.max(1, Math.round(rev.length / fresh.length));
  let fi = 0;
  rev.forEach((c, i) => {
    out.push({ card: c, fresh: false });
    if (i % step === step - 1 && fi < fresh.length) out.push({ card: fresh[fi++], fresh: true });
  });
  while (fi < fresh.length) out.push({ card: fresh[fi++], fresh: true });
  return out;
}

/** Themen-Training: alles zu einer Kategorie, fällige und neue zuerst. */
export function buildTopic(cat, limit = 20) {
  const pool = catCards(cat);
  const t = todayNum();
  const due = pool.filter(c => { const s = cardState(c.id); return s && isDue(s, t); });
  const fresh = pool.filter(c => isNew(cardState(c.id)));
  const rest = shuffle(pool.filter(c => !due.includes(c) && !fresh.includes(c)));
  const ladder = fresh.sort((a, b) => a.d - b.d);
  const picked = [...due, ...ladder, ...rest].slice(0, limit);
  return picked.map(c => ({ card: c, fresh: isNew(cardState(c.id)) }));
}

/** Wackelkandidaten: oft vergessen oder schwach – gezieltes Nacharbeiten. */
export function buildWeak(limit = 20) {
  const scored = CARDS
    .filter(c => inScope(c))
    .map(c => ({ c, s: cardState(c.id) }))
    .filter(x => x.s && x.s.seen > 0)
    .sort((a, b) => (isLeech(b.s) - isLeech(a.s)) || (strength(a.s) - strength(b.s)));
  return scored.slice(0, limit).map(x => ({ card: x.c, fresh: false }));
}

/** Duell: schnelle Multiple-Choice-Runde aus dem gesamten aktiven Bestand. */
export function buildDuel(n = 10) {
  const pool = CARDS.filter(c => inScope(c));
  const known = pool.filter(c => { const s = cardState(c.id); return s && s.seen > 0; });
  // Zwei Drittel Bekanntes (Festigung), ein Drittel Neues (Ausweitung)
  const a = shuffle(known).slice(0, Math.ceil(n * 0.6));
  const b = shuffle(pool.filter(c => !a.includes(c))).slice(0, n - a.length);
  return shuffle([...a, ...b]).map(c => ({ card: c, fresh: false }));
}

/** Kennzahlen für Startseite und Statistik. */
export function overview() {
  const t = todayNum();
  let learned = 0, mature = 0, seenTotal = 0;
  for (const c of CARDS) {
    const s = cardState(c.id);
    if (!s || !s.seen) continue;
    seenTotal++;
    if (s.reps > 0) learned++;
    if (strength(s) >= 0.6) mature++;
  }
  const due = dueCards().length;
  const st = S();
  return {
    total: CARDS.length, seen: seenTotal, learned, mature, due,
    newLeft: newBudget(),
    accuracy: st.totalAnswers ? st.totalCorrect / st.totalAnswers : 0,
    t
  };
}

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

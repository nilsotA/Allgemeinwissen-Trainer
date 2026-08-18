/* Spaced-Repetition-Motor: SM-2-Variante mit Lapse-Handling und Fuzz.
   Bewertungen: 0 = nochmal, 1 = schwer, 2 = gut, 3 = leicht */
import { todayNum } from './store.js';

export const AGAIN = 0, HARD = 1, GOOD = 2, EASY = 3;

export function fresh() {
  return { ef: 2.5, iv: 0, due: todayNum(), reps: 0, lapses: 0, seen: 0, ok: 0, last: 0 };
}

function fuzz(days) {
  if (days < 3) return days;
  const spread = Math.max(1, Math.round(days * 0.06));
  return days + (Math.floor(Math.random() * (2 * spread + 1)) - spread);
}

/** Neuen Zustand aus altem Zustand + Bewertung berechnen. */
export function schedule(cs, grade) {
  const s = { ...(cs || fresh()) };
  const t = todayNum();
  s.seen = (s.seen || 0) + 1;
  s.last = Date.now();

  if (grade === AGAIN) {
    s.lapses = (s.lapses || 0) + 1;
    s.ef = Math.max(1.3, s.ef - 0.2);
    s.reps = 0;
    s.iv = 0;              // wird noch in dieser Sitzung erneut gezeigt
    s.due = t;             // morgen sowieso wieder fällig
    return s;
  }

  s.ok = (s.ok || 0) + 1;
  const bump = grade === HARD ? -0.15 : grade === EASY ? 0.15 : 0;
  s.ef = Math.min(2.9, Math.max(1.3, s.ef + bump));

  if (s.reps === 0) {
    s.iv = grade === EASY ? 3 : 1;
  } else if (s.reps === 1) {
    s.iv = grade === HARD ? 2 : grade === EASY ? 7 : 4;
  } else {
    const mult = grade === HARD ? 1.25 : grade === EASY ? s.ef * 1.35 : s.ef;
    s.iv = Math.max(s.iv + 1, Math.round(s.iv * mult));
  }
  s.iv = Math.min(365, Math.max(1, fuzz(Math.round(s.iv))));
  s.reps += 1;
  s.due = t + s.iv;
  return s;
}

/** Reifegrad 0..1 – wie fest sitzt die Karte? */
export function strength(cs) {
  if (!cs || !cs.reps) return 0;
  const byIv = Math.min(1, Math.log2(cs.iv + 1) / Math.log2(121));   // 120 Tage ≈ 1.0
  const acc = cs.seen ? cs.ok / cs.seen : 0;
  return Math.max(0, Math.min(1, byIv * 0.72 + acc * 0.28));
}

export const isDue = (cs, t = todayNum()) => !!cs && cs.due <= t;
export const isNew = (cs) => !cs || cs.seen === 0;

/** Karte, die immer wieder umkippt → gezielt üben */
export const isLeech = (cs) => !!cs && cs.lapses >= 4 && strength(cs) < 0.45;

/** Erwartete Merkwahrscheinlichkeit heute (grobe Vergessenskurve). */
export function retention(cs, t = todayNum()) {
  if (!cs || !cs.reps) return 0;
  const elapsed = Math.max(0, t - (cs.due - cs.iv));
  const stability = Math.max(1, cs.iv);
  return Math.exp(-elapsed / (stability * 2.4));
}

/** Menschenlesbares Intervall für die Bewertungsknöpfe. */
export function preview(cs, grade) {
  const iv = schedule({ ...(cs || fresh()) }, grade).iv;
  if (grade === AGAIN) return 'gleich';
  if (iv <= 1) return '1 Tag';
  if (iv < 31) return `${iv} Tage`;
  if (iv < 365) return `${Math.round(iv / 30)} Mon.`;
  return `${(iv / 365).toFixed(1)} J.`;
}

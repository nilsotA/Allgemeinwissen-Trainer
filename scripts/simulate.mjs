/* Simuliert 120 Tage Nutzung, um Arbeitslast und Behaltensquote zu prüfen.
   Nutzt den echten Scheduler aus assets/js/srs.js. */
const RealDate = Date;
let NOW = RealDate.UTC(2026, 0, 5, 9, 0, 0);
globalThis.Date = class extends RealDate {
  constructor(...a) { super(...(a.length ? a : [NOW])); }
  static now() { return NOW; }
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { schedule, strength, AGAIN, HARD, GOOD, EASY, fresh } = await import('../assets/js/srs.js');
const { CARDS } = await import('../data/index.js');
const { todayNum } = await import('../assets/js/store.js');

const NEW_PER_DAY = 12, MAX_REVIEWS = 90, DAYS = 120;
const state = new Map();
let pool = CARDS.slice();
let rows = [];

/* Wie gut erinnert sich die Person? Grob an der Vergessenskurve orientiert. */
function recall(cs, t) {
  if (!cs.reps) return 0.55;                                  // erster Kontakt, Multiple Choice
  const elapsed = Math.max(0, t - (cs.due - cs.iv));
  const p = Math.exp(-elapsed / (Math.max(1, cs.iv) * 3.2));
  return Math.min(0.97, 0.55 + 0.42 * p);
}

for (let day = 0; day < DAYS; day++) {
  const t = todayNum();
  const due = [...state.entries()].filter(([, cs]) => cs.due <= t).slice(0, MAX_REVIEWS);
  let answers = 0, correct = 0;

  for (const [id, cs] of due) {
    const ok = Math.random() < recall(cs, t);
    answers++; if (ok) correct++;
    const g = !ok ? AGAIN : Math.random() < 0.18 ? HARD : Math.random() < 0.2 ? EASY : GOOD;
    state.set(id, schedule(cs, g));
  }
  for (let i = 0; i < NEW_PER_DAY && pool.length; i++) {
    const c = pool.shift();
    const ok = Math.random() < 0.55;
    answers++; if (ok) correct++;
    state.set(c.id, schedule(fresh(), ok ? GOOD : AGAIN));
  }

  const mature = [...state.values()].filter(cs => strength(cs) >= 0.6).length;
  rows.push({ day: day + 1, reviews: due.length, answers, acc: answers ? correct / answers : 0,
              inLearning: state.size, mature });
  NOW += 86400000;
}

const at = (d) => rows[d - 1];
console.log('Tag | Wdh. | Antworten | Trefferquote | angefangen | gefestigt');
for (const d of [1, 7, 14, 30, 60, 90, 120]) {
  const r = at(d);
  console.log(String(r.day).padStart(3), '|', String(r.reviews).padStart(4), '|',
    String(r.answers).padStart(9), '|', (r.acc * 100).toFixed(0).padStart(11) + '%', '|',
    String(r.inLearning).padStart(10), '|', String(r.mature).padStart(9));
}
const peak = rows.reduce((a, r) => Math.max(a, r.answers), 0);
const avg = rows.reduce((a, r) => a + r.answers, 0) / rows.length;
console.log(`\nSpitzenlast: ${peak} Karten/Tag · Schnitt: ${avg.toFixed(1)} Karten/Tag`);
console.log(`Geschätzte Zeit im Schnitt: ~${Math.round(avg * 7 / 60)} Minuten pro Tag (7 s je Karte)`);
console.log(`Nach ${DAYS} Tagen: ${at(DAYS).mature} von ${CARDS.length} Karten gefestigt.`);

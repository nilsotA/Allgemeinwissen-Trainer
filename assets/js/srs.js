/* Spaced-Repetition-Motor: SM-2-Variante mit Lapse-Handling und Fuzz.
   Bewertungen: 0 = nochmal, 1 = schwer, 2 = gut, 3 = leicht */
import { todayNum } from './store.js';

export const AGAIN = 0, HARD = 1, GOOD = 2, EASY = 3;

export function fresh() {
  return { ef: 2.5, iv: 0, due: todayNum(), reps: 0, lapses: 0, seen: 0, ok: 0, last: 0 };
}

/* Streuung gegen Klumpenbildung. Bewusst OHNE Mindestbreite: bei kurzen
   Intervallen waere ein Tag Streuung schon ein Drittel des Intervalls, und die
   Streuung koennte das garantierte Wachstum wieder aufheben. Deshalb wird erst
   ab etwa neun Tagen gestreut, und nie unter den Ausgangswert. */
function fuzz(days, floor) {
  const spread = Math.round(days * 0.06);
  if (spread < 1) return days;
  const shifted = days + (Math.floor(Math.random() * (2 * spread + 1)) - spread);
  return Math.max(floor, shifted);
}

/** Neuen Zustand aus altem Zustand + Bewertung berechnen.
    Mit opts.jitter = false bleibt die Streuung aus – so kann die Oberflaeche
    dasselbe Intervall anzeigen, das anschliessend auch gesetzt wird.
    Mit opts.nachlernen = true zaehlt ein „Nochmal" nicht als neuer Aussetzer –
    fuer die Wiederholung derselben Karte innerhalb einer Einheit. */
export function schedule(cs, grade, opts) {
  const jitter = !opts || opts.jitter !== false;
  const s = { ...(cs || fresh()) };
  const t = todayNum();
  s.seen = (s.seen || 0) + 1;
  s.last = Date.now();

  if (grade === AGAIN) {
    /* Nur das erste Umkippen einer Karte zaehlt als Aussetzer. Die zweite und
       dritte Antwort auf dieselbe Karte innerhalb einer Einheit ist Nachlernen,
       kein neuer Aussetzer: Sonst meldete die App nach einer einzigen zaehen
       Runde „Diese Karte ist dir schon 3-mal entfallen", der Leichtigkeitsfaktor
       faellt dreifach, und der Wackelkandidaten-Filter schlug nach zwei
       schlechten Tagen an statt nach vier schlechten Terminen. */
    if (!opts || !opts.nachlernen) {
      s.lapses = (s.lapses || 0) + 1;
      s.ef = Math.max(1.3, s.ef - 0.2);
    }
    s.reps = 0;
    s.iv = 0;              // wird noch in dieser Sitzung erneut gezeigt
    s.due = t;             // morgen sowieso wieder fällig
    return s;
  }

  s.ok = (s.ok || 0) + 1;
  const bump = grade === HARD ? -0.15 : grade === EASY ? 0.15 : 0;
  s.ef = Math.min(2.9, Math.max(1.3, s.ef + bump));

  const prev = s.iv;
  const altDue = s.due;
  if (s.reps === 0) {
    s.iv = grade === EASY ? 3 : 1;
  } else if (s.reps === 1) {
    // Die feste Leiter 2/4/7 kann unter dem ersten Intervall liegen – nach „leicht"
    // (3 Tage) haette „schwer" sonst auf 2 Tage verkuerzt, obwohl richtig geantwortet
    // wurde. Deshalb ein Mindestabstand zum Vorwert, der die drei Stufen trennt.
    const leiter = grade === HARD ? 2 : grade === EASY ? 7 : 4;
    const mindest = prev + (grade === HARD ? 1 : grade === EASY ? 4 : 2);
    s.iv = Math.max(leiter, mindest);
  } else {
    const mult = grade === HARD ? 1.25 : grade === EASY ? s.ef * 1.35 : s.ef;
    s.iv = Math.max(s.iv + 1, Math.round(s.iv * mult));
  }
  let nominal = Math.max(1, Math.round(s.iv));

  /* Wurde die Karte VOR ihrem Termin abgefragt, waechst das Intervall nur
     anteilig zur tatsaechlich verstrichenen Zeit. Ohne das schiebt eine
     Extra-Runde die schwaechste Karte an einem einzigen Tag von einem Tag auf
     ein Jahr: Das Wachstum rechnete allein aus dem alten Intervall mal
     Leichtigkeitsfaktor, ganz gleich ob seit der letzten Abfrage zehn Tage
     vergangen waren oder zehn Sekunden. Wer punktgenau am Termin antwortet,
     bekommt unveraendert das volle Wachstum. */
  if (prev > 0 && t < altDue) {
    const verstrichen = t - (altDue - prev);
    const anteil = Math.max(0, Math.min(1, verstrichen / prev));
    nominal = Math.max(prev, prev + Math.round((nominal - prev) * anteil));
  }

  // Untergrenze: nie kuerzer als vorher, sonst hebt die Streuung das Wachstum auf
  s.iv = Math.min(365, jitter ? fuzz(nominal, Math.max(1, Math.min(nominal, prev))) : nominal);
  s.reps += 1;
  // Eine fruehe Antwort darf den Termin nie nach vorn ziehen.
  s.due = Math.max(prev > 0 ? altDue : 0, t + s.iv);
  return s;
}

/** Zustand einer gelernten Karte nach einem Fehler im Duell.

    Das Duell zaehlt getrennt und darf den Scheduler nicht beschaedigen – aber
    die Karte soll ins naechste Tagestraining. Bisher wurde nur due auf heute
    gezogen und das Intervall blieb stehen. Damit war der Anker
    „due − iv = letzte Abfrage" zerstoert: Eine 30-Tage-Karte, vor zehn Tagen
    gelernt und im Duell falsch beantwortet, galt am naechsten Tag als
    puenktlich abgefragte 30-Tage-Karte. Die richtige Antwort – geprimt vom
    Loesungstext, den das Duell gerade gezeigt hat – trieb das Intervall auf
    rund 75 Tage, obwohl der Abruf nachweislich schon nach zehn Tagen
    gescheitert war.

    Deshalb wird das Intervall auf die tatsaechlich verstrichene Zeit gedeckelt.
    Der Anker bleibt wahr, und das naechste Wachstum rechnet aus dem, was die
    Karte wirklich getragen hat. Es wird nur gedeckelt, nie verlaengert – bei
    einer ohnehin ueberfaelligen Karte bleibt das alte Intervall stehen. */
export function nachDuellFehler(cs, t = todayNum()) {
  const zuletzt = cs.due - cs.iv;
  return { ...cs, due: t, iv: Math.max(0, Math.min(cs.iv, t - zuletzt)) };
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

/** Menschenlesbares Intervall für die Bewertungsknöpfe.
    Ohne Streuung, damit der Knopf nicht bei jedem Antippen etwas anderes verspricht. */
export function preview(cs, grade) {
  const iv = schedule({ ...(cs || fresh()) }, grade, { jitter: false }).iv;
  if (grade === AGAIN) return 'gleich';
  if (iv <= 1) return '1 Tag';
  if (iv < 31) return `${iv} Tage`;
  if (iv < 365) return `${Math.round(iv / 30)} Mon.`;
  return `${(iv / 365).toFixed(1)} J.`;
}

/* Persistenz + Nutzerzustand (localStorage) */
const KEY = 'wissenswerk.v1';

const DEFAULTS = {
  version: 1,
  settings: {
    newPerDay: 12,        // neue Karten pro Tag
    maxReviews: 90,       // Deckel für Wiederholungen
    recallMode: 'auto',   // auto | mc | recall  (auto = freies Abrufen ab Reifegrad)
    sound: true,
    level: 'ladder',      // ladder = leicht zuerst | mixed
    theme: 'system',      // system | dark | light
    trotzdemNeu: false,   // neue Karten auch bei grossem Rueckstand einfuehren
    cats: null            // null = alle Kategorien aktiv, sonst Array von IDs
  },
  cards: {},              // id -> { ef, iv, due, reps, lapses, seen, ok, last }
  flags: {},              // id -> true, wenn beim Nachschlagen markiert
  days: {},               // 'YYYY-MM-DD' -> { done, correct, newC, min }
  streak: 0,
  best: 0,
  lastDay: null,
  factDay: null,
  factIdx: 0,
  totalAnswers: 0,
  totalCorrect: 0,
  duelBest: 0
};

function deepMerge(base, add) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(add || {})) {
    const v = add[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

/* Vollstaendiger Kartenzustand. Fehlt eines dieser Felder, rechnet sich das
   undefined stillschweigend zu NaN weiter: strength() liefert dann NaN, jeder
   Vergleich damit ist falsch, und Anzeigen wie „sitzt fest" stehen ohne
   Fehlermeldung auf null. Deshalb wird beim Laden aufgefuellt. */
const KARTE_LEER = { ef: 2.5, iv: 0, due: 0, reps: 0, lapses: 0, seen: 0, ok: 0, last: 0 };

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    const zustand = deepMerge(structuredClone(DEFAULTS), parsed);
    for (const [id, c] of Object.entries(zustand.cards)) {
      if (!c || typeof c !== 'object') { delete zustand.cards[id]; continue; }
      for (const feld of Object.keys(KARTE_LEER)) {
        if (typeof c[feld] !== 'number' || !Number.isFinite(c[feld])) c[feld] = KARTE_LEER[feld];
      }
    }
    return zustand;
  } catch (e) {
    // Bewusst console.error: hier landet auch ein Programmierfehler, und der
    // wuerde sonst den gesamten Fortschritt still auf die Standardwerte setzen.
    console.error('Speicher unlesbar, starte neu', e);
    return structuredClone(DEFAULTS);
  }
}

let saveTimer = null;
let quotaWarned = false;

/** Wird gerufen, wenn der Browser den Speicher verweigert – die App soll dann nicht still Daten verlieren. */
export let onSaveError = () => {};
export const setSaveErrorHandler = (fn) => { onSaveError = fn; };

export function save(now = false) {
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      quotaWarned = false;
    } catch (e) {
      console.warn('Speichern fehlgeschlagen', e);
      if (!quotaWarned) { quotaWarned = true; onSaveError(e); }
    }
  };
  if (now) { clearTimeout(saveTimer); saveTimer = null; write(); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; write(); }, 250);
}

export const S = () => state;
export const settings = () => state.settings;

export function setSetting(key, val) {
  state.settings[key] = val;
  save(true);           // Einstellungen sofort sichern, nicht erst nach der Sammelpause
}

/* ---- Datums-Helfer (lokale Zeitzone, Tagesgrenze 4 Uhr morgens) ---- */
export function dayKey(d = new Date()) {
  const x = new Date(d.getTime());
  if (x.getHours() < 4) x.setDate(x.getDate() - 1);   // Nachteule-Schutz
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function todayNum() {
  const [y, m, d] = dayKey().split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);   // Tage seit Epoch
}
export function numToKey(n) {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function today() {
  const k = dayKey();
  if (!state.days[k]) state.days[k] = { done: 0, correct: 0, newC: 0, sec: 0 };
  return state.days[k];
}

/* Streak fortschreiben, wenn heute mindestens eine Karte beantwortet wurde */
export function touchStreak() {
  const k = dayKey();
  if (state.lastDay === k) return;
  const yesterday = numToKey(todayNum() - 1);
  state.streak = state.lastDay === yesterday ? state.streak + 1 : 1;
  state.best = Math.max(state.best || 0, state.streak);
  state.lastDay = k;
  save();
}

/* Streak zurücksetzen, wenn ein Tag ausgelassen wurde (nur Anzeige) */
export function liveStreak() {
  const k = dayKey();
  const y = numToKey(todayNum() - 1);
  if (state.lastDay === k || state.lastDay === y) return state.streak;
  return 0;
}

export function cardState(id) {
  return state.cards[id] || null;
}

export const isFlagged = (id) => !!state.flags[id];
export function toggleFlag(id) {
  if (state.flags[id]) delete state.flags[id];
  else state.flags[id] = true;
  save();
  return !!state.flags[id];
}
export function putCard(id, cs) {
  state.cards[id] = cs;
  save();
}

/* iOS beendet eine Web-App oft ohne Vorwarnung. Die gebündelte Speicherung
   wartet bis zu 250 ms – ohne diesen Anker gingen die letzten Antworten verloren.
   pagehide ist auf iOS das zuverlässigste Signal, visibilitychange die Ergänzung. */
export function installFlush() {
  if (typeof document === 'undefined') return;
  const flush = () => { if (saveTimer) save(true); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
}

export function resetAll() {
  sichereJetzigen();
  state = structuredClone(DEFAULTS);
  save(true);
}

export function exportJSON() {
  return JSON.stringify(state);
}
/* Ein eingelesenes Backup ist Fremdinhalt. Zahlenfelder landen unformatiert in der
   Oberfläche, deshalb wird hier auf Typen geprüft statt nur auf Vorhandensein. */
const zahl = (v, min, max, standard) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : standard;
};

function saeubern(roh) {
  const rein = structuredClone(DEFAULTS);
  if (roh.settings && typeof roh.settings === 'object') {
    const s = roh.settings;
    rein.settings.newPerDay = zahl(s.newPerDay, 1, 200, 12);
    rein.settings.maxReviews = zahl(s.maxReviews, 5, 1000, 90);
    rein.settings.recallMode = ['auto', 'mc', 'recall'].includes(s.recallMode) ? s.recallMode : 'auto';
    rein.settings.level = ['ladder', 'mixed'].includes(s.level) ? s.level : 'ladder';
    rein.settings.theme = ['system', 'dark', 'light'].includes(s.theme) ? s.theme : 'system';
    rein.settings.sound = !!s.sound;
    rein.settings.trotzdemNeu = !!s.trotzdemNeu;
    rein.settings.cats = Array.isArray(s.cats) ? s.cats.filter(x => typeof x === 'string').slice(0, 50) : null;
  }
  for (const [id, c] of Object.entries(roh.cards || {})) {
    if (typeof id !== 'string' || !c || typeof c !== 'object') continue;
    rein.cards[id] = {
      ef: zahl(c.ef, 1.3, 2.9, 2.5), iv: zahl(c.iv, 0, 365, 0),
      due: zahl(c.due, 0, 1e6, 0), reps: zahl(c.reps, 0, 1e5, 0),
      lapses: zahl(c.lapses, 0, 1e5, 0), seen: zahl(c.seen, 0, 1e6, 0),
      ok: zahl(c.ok, 0, 1e6, 0), last: zahl(c.last, 0, 1e15, 0),
    };
  }
  for (const [tag, d] of Object.entries(roh.days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !d || typeof d !== 'object') continue;
    rein.days[tag] = {
      done: zahl(d.done, 0, 1e6, 0), correct: zahl(d.correct, 0, 1e6, 0),
      newC: zahl(d.newC, 0, 1e6, 0), sec: zahl(d.sec, 0, 1e8, 0),
    };
  }
  for (const id of Object.keys(roh.flags || {})) if (typeof id === 'string') rein.flags[id] = true;
  rein.streak = zahl(roh.streak, 0, 1e5, 0);
  rein.best = zahl(roh.best, 0, 1e5, 0);
  rein.duelBest = zahl(roh.duelBest, 0, 100, 0);
  rein.totalAnswers = zahl(roh.totalAnswers, 0, 1e8, 0);
  rein.totalCorrect = zahl(roh.totalCorrect, 0, 1e8, 0);
  rein.factIdx = zahl(roh.factIdx, 0, 1e5, 0);
  rein.lastDay = /^\d{4}-\d{2}-\d{2}$/.test(roh.lastDay) ? roh.lastDay : null;
  rein.factDay = /^\d{4}-\d{2}-\d{2}$/.test(roh.factDay) ? roh.factDay : null;
  return rein;
}

/* Ein Einlesen ersetzt alles, was auf diesem Geraet liegt - und der Fortschritt
   liegt nur hier. Deshalb wird die Datei erst geprueft und beschrieben, bevor
   irgendetwas ueberschrieben wird, und der bisherige Stand wandert vorher in
   einen Sicherungsschluessel, aus dem er sich zurueckholen laesst. */
const SICHERUNG = KEY + '.vorher';

/** Liest ein Backup, ohne etwas zu veraendern. Wirft, wenn es keines ist. */
export function pruefeBackup(txt) {
  const parsed = JSON.parse(txt);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      !parsed.cards || typeof parsed.cards !== 'object') {
    throw new Error('Kein gültiges Wissenswerk-Backup');
  }
  return saeubern(parsed);
}

/** Kennzahlen eines Zustands, um zwei Staende gegenueberzustellen. */
export function kennzahlen(z) {
  const tage = Object.keys(z.days || {}).sort();
  return {
    karten: Object.keys(z.cards || {}).length,
    antworten: z.totalAnswers || 0,
    letzterTag: tage.length ? tage[tage.length - 1] : null,
  };
}

export function importJSON(txt) {
  const rein = pruefeBackup(txt);
  sichereJetzigen();
  state = rein;
  save(true);
}

function sichereJetzigen() {
  // Darf nie den Import kippen: ist der Speicher voll, gibt es eben keine Sicherung.
  try { localStorage.setItem(SICHERUNG, JSON.stringify(state)); }
  catch (e) { console.warn('Sicherung vor dem Ueberschreiben fehlgeschlagen', e); }
}

export const hatSicherung = () => {
  try { return !!localStorage.getItem(SICHERUNG); } catch (e) { return false; }
};

/** Holt den Stand von vor dem letzten Einlesen oder Zuruecksetzen zurueck. */
export function sicherungZurueck() {
  const roh = localStorage.getItem(SICHERUNG);
  if (!roh) return false;
  const rein = saeubern(JSON.parse(roh));
  localStorage.removeItem(SICHERUNG);
  state = rein;
  save(true);
  return true;
}

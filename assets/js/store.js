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
  totalCorrect: 0
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

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULTS), parsed);
  } catch (e) {
    console.warn('Speicher unlesbar, starte neu', e);
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
  if (now) { clearTimeout(saveTimer); write(); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 250);
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

export function resetAll() {
  state = structuredClone(DEFAULTS);
  save(true);
}

export function exportJSON() {
  return JSON.stringify(state);
}
export function importJSON(txt) {
  const parsed = JSON.parse(txt);
  if (!parsed || typeof parsed !== 'object' || !parsed.cards) throw new Error('Kein gültiges Wissenswerk-Backup');
  state = deepMerge(structuredClone(DEFAULTS), parsed);
  save(true);
}

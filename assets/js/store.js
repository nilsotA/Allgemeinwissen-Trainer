/* Persistenz + Nutzerzustand (localStorage) */
const KEY = 'wissenswerk.v1';

const DEFAULTS = {
  version: 1,
  rev: 0,                 // steigt bei jedem Schreiben – erkennt den anderen Tab
  gen: 0,                 // steigt NUR bei Zuruecksetzen/Einlesen – erzwingt Uebernahme statt Zusammenfuehren
  settings: {
    newPerDay: 12,        // neue Karten pro Tag
    maxReviews: 90,       // Deckel für Wiederholungen
    recallMode: 'auto',   // auto | mc | recall  (auto = freies Abrufen ab Reifegrad)
    sound: true,
    level: 'ladder',      // ladder = leicht zuerst | mixed
    theme: 'system',      // system | dark | light
    trotzdemNeu: false,   // neue Karten auch bei grossem Rueckstand einfuehren
    cats: null,           // null = alle Kategorien aktiv, sonst Array von IDs
    focus: null           // Schwerpunktthemen: bekommen doppelt so viele neue Karten
  },
  cards: {},              // id -> { ef, iv, due, reps, lapses, seen, ok, last }
  flags: {},              // id -> true, wenn beim Nachschlagen markiert
  days: {},               // 'YYYY-MM-DD' -> { done, correct, newC, min }
  streak: 0,
  best: 0,
  lastDay: null,
  lastExport: 0,          // Tagesnummer der letzten Sicherung – Grundlage der Erinnerung
  factDay: null,
  claims: 0,         // „Hab ich" vor der Aufloesung – wie oft behauptet
  claimsMiss: 0,     // ... und wie oft danach doch „Nochmal"
  factIdx: 0,
  factSeen: 0,       // wie viele Merkanker schon gezeigt wurden (fuer die Rueckschau)
  totalAnswers: 0,       // nur geplantes Lernen – das Duell zaehlt getrennt
  totalCorrect: 0,
  duelBest: 0,
  duelAnswers: 0,
  duelCorrect: 0,
  duelMs: 0,             // aufsummierte Antwortzeit richtiger Duell-Antworten
  duelTimed: 0           // wie viele Antworten in duelMs stecken
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

/* Zwei offene Tabs teilen sich einen Speicher. Wer zuletzt schreibt, hat sonst
   recht - und loescht die Lerneinheit des anderen. Alle Zaehler hier wachsen nur,
   deshalb laesst sich verlustfrei zusammenfuehren statt zu ueberschreiben. */
function zusammenfuehren(fremd, eigen) {
  /* Zuruecksetzen und das Einlesen einer Sicherung sind ausdrueckliche
     Entscheidungen. Das Zusammenfuehren kennt aber nur Wachstum – ein bewusst
     geleerter Stand wuerde vom zweiten offenen Tab einfach wieder aufgefuellt:
     Nachgestellt stand nach „Alles zuruecksetzen" der komplette Altbestand
     wieder im Speicher, sobald der andere Tab einen einzigen Stern setzte.
     Deshalb traegt jedes Ersetzen eine neue Generationsnummer, und ein Stand
     hoeherer Generation wird uebernommen statt eingesammelt. */
  if ((Number(fremd.gen) || 0) > (Number(eigen.gen) || 0)) {
    const uebernommen = saeubern(fremd);
    uebernommen.rev = Number(fremd.rev) || 0;
    uebernommen.gen = Number(fremd.gen) || 0;
    return uebernommen;
  }
  const z = structuredClone(eigen);
  const groesser = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);
  for (const [id, f] of Object.entries(fremd.cards || {})) {
    const e = z.cards[id];
    // Der juengere Kartenzustand gewinnt als Ganzes – Felder mischen ergaebe Unsinn.
    if (!e || (f.last || 0) > (e.last || 0) || ((f.last || 0) === (e.last || 0) && (f.seen || 0) > (e.seen || 0))) {
      z.cards[id] = f;
    }
  }
  for (const [tag, f] of Object.entries(fremd.days || {})) {
    const e = z.days[tag] || {};
    z.days[tag] = { done: groesser(e.done, f.done), correct: groesser(e.correct, f.correct),
                    newC: groesser(e.newC, f.newC), sec: groesser(e.sec, f.sec),
                    duel: groesser(e.duel, f.duel), duelOk: groesser(e.duelOk, f.duelOk) };
  }
  for (const id of Object.keys(fremd.flags || {})) z.flags[id] = true;
  for (const k of ['totalAnswers', 'totalCorrect', 'streak', 'best', 'duelBest',
                   'duelAnswers', 'duelCorrect', 'duelMs', 'duelTimed', 'lastExport']) {
    z[k] = groesser(z[k], fremd[k]);
  }
  if ((fremd.lastDay || '') > (z.lastDay || '')) z.lastDay = fremd.lastDay;
  z.rev = groesser(z.rev, fremd.rev);
  return z;                                  // Einstellungen bleiben die dieses Tabs
}

export function save(now = false) {
  const write = () => {
    /* Die Fassungsnummer darf nur zaehlen, was wirklich im Speicher steht.
       Wurde sie vor dem Schreiben erhoeht und das Schreiben schlug fehl (volles
       Kontingent, privater Modus), lief sie bei jedem Versuch weiter - der Tab
       hielt sich dann faelschlich fuer den aktuelleren und uebersprang beim
       naechsten gelungenen Schreiben das Zusammenfuehren. Nachgestellt gingen so
       zwanzig im anderen Tab gelernte Karten verloren, ohne jede Meldung. */
    let vorherigeRev = state.rev || 0;
    try {
      const roh = localStorage.getItem(KEY);
      if (roh) {
        const fremd = JSON.parse(roh);
        if (fremd && typeof fremd === 'object' && (fremd.rev || 0) > (state.rev || 0)) {
          state = zusammenfuehren(fremd, state);
          vorherigeRev = state.rev || 0;   // nach dem Zusammenfuehren neu ablesen
        }
      }
      state.rev = vorherigeRev + 1;
      localStorage.setItem(KEY, JSON.stringify(state));
      quotaWarned = false;
    } catch (e) {
      state.rev = vorherigeRev;
      if (!quotaWarned) console.warn('Speichern fehlgeschlagen', e);
      quotaWarned = true;
      /* Immer melden, nicht nur beim ersten Mal: Der Nutzer kann den Hinweis
         wegbekommen (Sichern), waehrend der Speicher weiter voll ist.
         Zurueckgesetzt wird quotaWarned nur nach einem GELUNGENEN Schreiben -
         den gibt es dann nie, und der Hinweis kam nie wieder. Der Empfaenger
         ist gegen Wiederholung unempfindlich. */
      onSaveError(e);
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

/** 'YYYY-MM-DD' als Tagesnummer, passend zu todayNum(). */
export function keyToNum(k) {
  const [y, m, d] = String(k || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/* Streak fortschreiben, wenn heute mindestens eine Karte beantwortet wurde.
   Ein lastDay in der Zukunft ist dabei kein Fehler des Nutzers: Es reicht, dass
   die Uhr des Geraets zurueckgestellt wird, dass man ueber die Datumsgrenze
   zurueckfliegt oder ein Backup von einem Geraet in einer spaeteren Zeitzone
   einliest. Vorher fiel die Serie dann auf 0 und wurde bei der naechsten Antwort
   dauerhaft auf 1 gesetzt - sechzig Tage Serie waren damit weg. */
export function touchStreak() {
  const k = dayKey();
  if (state.lastDay === k) return;
  const heute = todayNum();
  const letzter = keyToNum(state.lastDay);
  if (letzter !== null && letzter > heute) { state.lastDay = k; save(); return; }
  state.streak = letzter === heute - 1 ? state.streak + 1 : 1;
  state.best = Math.max(state.best || 0, state.streak);
  state.lastDay = k;
  save();
}

/* Streak zurücksetzen, wenn ein Tag ausgelassen wurde (nur Anzeige) */
export function liveStreak() {
  const heute = todayNum();
  const letzter = keyToNum(state.lastDay);
  if (letzter === null) return 0;
  return letzter >= heute - 1 ? state.streak : 0;
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
/* Laeuft gerade eine Einheit? Dann darf der Zustand nicht unter ihr weggetauscht
   werden. Die Oberflaeche meldet das hier an. */
let istBeschaeftigt = () => false;
export const setBusyCheck = (fn) => { istBeschaeftigt = fn; };

/** Wird gerufen, wenn ein anderer Tab geschrieben hat und wir uebernommen haben. */
export let onFremdStand = () => {};
export const setFremdStandHandler = (fn) => { onFremdStand = fn; };

export function installFlush() {
  if (typeof document === 'undefined') return;
  const flush = () => { if (saveTimer) save(true); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    let fremd;
    try { fremd = JSON.parse(e.newValue); } catch (err) { return; }
    if (!fremd || typeof fremd !== 'object' || (fremd.rev || 0) <= (state.rev || 0)) return;
    // Waehrend einer Einheit nur merken: beim naechsten Speichern wird ohnehin
    // zusammengefuehrt, und ein Tausch mitten im Ablauf verschluckt Antworten.
    if (istBeschaeftigt()) return;
    const vorher = state;
    const eigeneGen = Number(state.gen) || 0;
    state = zusammenfuehren(fremd, state);
    const uebernommen = (Number(state.gen) || 0) > eigeneGen;
    /* Der Handler bekommt gesagt, ob zusammengefuehrt oder uebernommen wurde –
       nach einem Zuruecksetzen im anderen Tab waere „zusammengefuehrt" gelogen.
       Und er erfaehrt, ob sich sichtbar etwas geaendert hat: Nach einem Reset
       rendert der andere Tab seine Startseite und speichert dabei den
       Merkanker-Tag. Dieses generationsgleiche Folge-Ereignis aendert nichts,
       ueberschrieb aber die ehrliche „uebernommen"-Meldung wieder mit
       „zusammengefuehrt". */
    const sichtbar = uebernommen
      || state.totalAnswers !== vorher.totalAnswers
      || state.duelAnswers !== vorher.duelAnswers
      || state.streak !== vorher.streak
      || Object.keys(state.cards).length !== Object.keys(vorher.cards).length
      || Object.keys(state.flags).length !== Object.keys(vorher.flags).length;
    onFremdStand(uebernommen, sichtbar);
  });
}

/* Zuruecksetzen und Einlesen sind ausdrueckliche Entscheidungen - sie duerfen
   nicht vom Zusammenfuehren wieder eingesammelt werden. Deshalb bekommt der neue
   Zustand eine hoehere Fassungsnummer als alles, was gerade gespeichert ist. */
function ersetzeZustand(neu) {
  let gespeichert = 0;
  try { gespeichert = Number(JSON.parse(localStorage.getItem(KEY) || '{}').rev) || 0; }
  catch (e) { /* unlesbar ist so gut wie nicht vorhanden */ }
  neu.rev = Math.max(Number(state.rev) || 0, gespeichert) + 1;
  let gespeicherteGen = 0;
  try { gespeicherteGen = Number(JSON.parse(localStorage.getItem(KEY) || '{}').gen) || 0; }
  catch (e) { /* unlesbar ist so gut wie nicht vorhanden */ }
  neu.gen = Math.max(Number(state.gen) || 0, gespeicherteGen) + 1;
  state = neu;
  save(true);
}

export function resetAll() {
  sichereJetzigen();
  ersetzeZustand(structuredClone(DEFAULTS));
}

export function exportJSON() {
  return JSON.stringify(state);
}

/* Der Fortschritt liegt allein im Speicher dieses Browsers. Ein geloeschter
   Websitespeicher, ein neues Handy, ein zurueckgesetztes Safari - und Monate
   sind weg. Deshalb merkt sich die App, wann zuletzt gesichert wurde. */
export function merkeSicherung() {
  state.lastExport = todayNum();
  save();
}
/** Tage seit der letzten Sicherung – null, wenn noch nie gesichert wurde. */
export function tageSeitSicherung() {
  return state.lastExport ? Math.max(0, todayNum() - state.lastExport) : null;
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
    rein.settings.focus = Array.isArray(s.focus) ? s.focus.filter(x => typeof x === 'string').slice(0, 50) : null;
  }
  rein.lastExport = zahl(roh.lastExport, 0, 1e6, 0);
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
      duel: zahl(d.duel, 0, 1e6, 0), duelOk: zahl(d.duelOk, 0, 1e6, 0),
    };
  }
  for (const id of Object.keys(roh.flags || {})) if (typeof id === 'string') rein.flags[id] = true;
  rein.streak = zahl(roh.streak, 0, 1e5, 0);
  rein.best = zahl(roh.best, 0, 1e5, 0);
  rein.duelBest = zahl(roh.duelBest, 0, 100, 0);
  rein.duelAnswers = zahl(roh.duelAnswers, 0, 1e8, 0);
  rein.duelCorrect = zahl(roh.duelCorrect, 0, 1e8, 0);
  rein.duelMs = zahl(roh.duelMs, 0, 1e12, 0);
  rein.duelTimed = zahl(roh.duelTimed, 0, 1e8, 0);
  rein.totalAnswers = zahl(roh.totalAnswers, 0, 1e8, 0);
  rein.totalCorrect = zahl(roh.totalCorrect, 0, 1e8, 0);
  rein.gen = zahl(roh.gen, 0, 1e9, 0);
  rein.claims = zahl(roh.claims, 0, 1e7, 0);
  rein.claimsMiss = zahl(roh.claimsMiss, 0, 1e7, 0);
  rein.factIdx = zahl(roh.factIdx, 0, 1e5, 0);
  rein.factSeen = zahl(roh.factSeen, 0, 1e6, 0);
  rein.lastDay = /^\d{4}-\d{2}-\d{2}$/.test(roh.lastDay) ? roh.lastDay : null;
  rein.factDay = /^\d{4}-\d{2}-\d{2}$/.test(roh.factDay) ? roh.factDay : null;
  return rein;
}

/* Ein Einlesen ersetzt alles, was auf diesem Geraet liegt - und der Fortschritt
   liegt nur hier. Deshalb wird die Datei erst geprueft und beschrieben, bevor
   irgendetwas ueberschrieben wird, und der bisherige Stand wandert vorher in
   einen Sicherungsschluessel, aus dem er sich zurueckholen laesst. */
/* Eine umformulierte Frage bekommt eine neue Kennung. Ohne diesen Schritt
   faenge die Karte bei null an: gelernt bleibt gelernt, nur der Name aendert
   sich. Die Zuordnung kommt von aussen, damit die Ablage nichts ueber Inhalte
   wissen muss. */
export function uebernimmVorgaenger(paare) {
  let bewegt = 0;
  for (const [neu, alte] of paare) {
    if (state.cards[neu]) continue;              // neue Kennung hat schon einen Stand
    for (const alt of alte) {
      if (!state.cards[alt]) continue;
      state.cards[neu] = state.cards[alt];
      delete state.cards[alt];
      if (state.flags[alt]) { state.flags[neu] = true; delete state.flags[alt]; }
      bewegt++;
      break;
    }
  }
  if (bewegt) save();
  return bewegt;
}

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
  ersetzeZustand(rein);
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
  ersetzeZustand(rein);
  return true;
}

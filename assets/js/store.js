/* Persistenz + Nutzerzustand (localStorage) */
const KEY = 'wissenswerk.v1';

/* Tageszaehler waren das einzige, was zwei Tabs UNABHAENGIG hochzaehlen – und
   sie wurden beim Zusammenfuehren ueber Math.max vereinigt. Das Maximum zweier
   unabhaengig gewachsener Zahlen ist aber nicht ihre Summe: Nachgestellt wurden
   aus acht gegebenen Antworten vier. Jeder Tab fuehrt deshalb seinen EIGENEN
   Beitrag je Tag; der angezeigte Wert ist die Summe darueber. Je Tab waechst
   sein Eintrag monoton, das Maximum je Schluessel ist also richtig, und die
   Summe ueber die Schluessel ist der wahre Stand.

   Die Kennung liegt im sessionStorage: Ein Neuladen derselben Seite behaelt
   sie, ein zweiter Tab bekommt eine eigene. Damit waechst die Zahl der
   Schluessel je Tag mit der Zahl der Tabs, die an diesem Tag gelernt haben –
   also mit eins oder zwei, nicht mit jedem App-Start. */
const TAB = (() => {
  try {
    const vorhanden = sessionStorage.getItem(KEY + '.tab');
    if (vorhanden) return vorhanden;
    const neu = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(KEY + '.tab', neu);
    return neu;
  } catch (e) { return 'einzeln'; }
})();
const TAGESZAEHLER = ['done', 'correct', 'newC', 'sec', 'duel', 'duelOk', 'claim', 'claimMiss'];
const tagesSumme = (days, feld) => Object.values(days || {})
  .reduce((n, t) => n + (Number(t[feld]) || 0), 0);

/* Ein Tagesbuch ohne „je" stammt aus der Zeit vor dieser Rechnung – sein
   bisheriger Stand wird zum Beitrag eines gedachten frueheren Tabs. */
function beitraege(tag) {
  if (tag.je && typeof tag.je === 'object') return tag.je;
  const alt = {};
  for (const k of TAGESZAEHLER) if (Number(tag[k]) > 0) alt[k] = Number(tag[k]);
  return Object.keys(alt).length ? { v1: alt } : {};
}

/** Summe der Beitraege in die sichtbaren Felder schreiben. */
function summiere(tag) {
  for (const k of TAGESZAEHLER) {
    let n = 0;
    for (const b of Object.values(tag.je || {})) n += Number(b[k]) || 0;
    if (n || tag[k] !== undefined) tag[k] = n;
  }
  return tag;
}

/* Jeder Beitragsblock traegt eine eigene Fassungsnummer. Sie zaehlt nur fuer
   den Tab, dem der Block gehoert - und der ist sein einziger Schreiber. Beim
   Zusammenfuehren gewinnt damit die juengere Fassung des Blocks als GANZES,
   statt Feld fuer Feld das Maximum zu nehmen.

   Ohne sie konnte ein Beitrag nur wachsen, und genau daran scheiterte
   „Rueckgaengig": Die zurueckgenommene Antwort stand noch im abgelegten Block
   desselben Tabs, das Maximum holte sie zurueck, und beim naechsten Schreiben
   des zweiten Tabs war sie wieder da - samt verbrauchtem Budget fuer neue
   Karten. Nur mit dem Ersatzschluessel „einzeln" (kein sessionStorage, etwa im
   privaten Modus) bleibt es beim Maximum: Dort teilen sich alle Zusammenhaenge
   einen Schluessel, und keiner darf fuer die anderen sprechen. */
const EIGENER_BLOCK = TAB !== 'einzeln';
/* Waechst nur. Beim Zuruecknehmen bekommt dieser Tab seinen frueheren Block
   zurueck - mitsamt dessen alter Fassungsnummer. Ohne diesen Merker stuende sie
   danach gleichauf mit der abgelegten Kopie, und das Maximum je Feld holte die
   zurueckgenommene Antwort wieder hervor. */
let eigeneFassung = 0;
function stemple(tag) {
  if (!EIGENER_BLOCK || !tag.je || !tag.je[TAB]) return;
  eigeneFassung = Math.max(eigeneFassung + 1, (Number(tag.je[TAB].n) || 0) + 1);
  tag.je[TAB].n = eigeneFassung;
}

/* Nach einem Zuruecknehmen: Der wiederhergestellte Tageseintrag traegt den
   Stand dieses Tabs von VOR der Antwort. Damit er sich gegen die abgelegte
   Kopie durchsetzt, braucht er eine frische Fassungsnummer - und einen Block,
   auch wenn der Tag vorher ueberhaupt keinen Eintrag hatte. */
export function beitragZurueck(key) {
  if (!EIGENER_BLOCK) return;
  const tag = state.days[key] || (state.days[key] = { done: 0, correct: 0, newC: 0, sec: 0 });
  tag.je = beitraege(tag);
  if (!tag.je[TAB]) tag.je[TAB] = {};
  stemple(tag);
  summiere(tag);
}

/** Einen Tageszaehler erhoehen – im Beitrag dieses Tabs und in der Summe. */
export function zaehle(feld, n = 1) {
  const tag = today();
  tag.je = beitraege(tag);
  if (!tag.je[TAB]) tag.je[TAB] = {};
  tag.je[TAB][feld] = (Number(tag.je[TAB][feld]) || 0) + n;
  stemple(tag);
  summiere(tag);
  return tag[feld];
}

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
    quizLehrerwissen: false, // Lehrerwissen (Analysis, Trainingslehre, ...) auch in der Quizrunde
    cats: null,           // null = alle Kategorien aktiv, sonst Array von IDs
    focus: null           // Schwerpunktthemen: bekommen doppelt so viele neue Karten
  },
  cards: {},              // id -> { ef, iv, due, reps, lapses, seen, ok, last }
  flags: {},              // id -> Zeitstempel (positiv = markiert, negativ = Grabstein)
  days: {},               // 'YYYY-MM-DD' -> { done, correct, newC, min }
  streak: 0,
  best: 0,
  lastDay: null,
  lastExport: 0,          // Tagesnummer der letzten Sicherung – Grundlage der Erinnerung
  factDay: null,
  claims: 0,         // „Hab ich" vor der Aufloesung – wie oft behauptet
  claimsMiss: 0,     // ... und wie oft danach doch „Nochmal"
  factIdx: 0,
  factTage: [],           // die letzten acht Anzeigetage – fuer „Vor N Tagen
  factSeen: 0,       // wie viele Merkanker schon gezeigt wurden (fuer die Rueckschau)
  totalAnswers: 0,       // nur geplantes Lernen – das Duell zaehlt getrennt
  totalCorrect: 0,
  duelBest: 0,
  duelAnswers: 0,
  duelCorrect: 0,
  duelMs: 0,             // aufsummierte Antwortzeit richtiger Duell-Antworten
  duelTimed: 0,          // wie viele Antworten in duelMs stecken
  quizBest: 0,           // beste Punktzahl einer Quizrunde
  quizRunden: []         // die letzten Quizrunden: { t, p, m, r, f, l, k } - siehe quizmodus.js
};

/* Quizrunden werden nur angehaengt, nie geaendert. Deshalb reicht beim
   Zusammenfuehren zweier Tabs die Vereinigung ueber den Zeitstempel - jede
   Runde gibt es genau einmal, egal in welchem Tab sie gespielt wurde. Mehr als
   RUNDEN_MAX werden nicht aufgehoben: Der Speicher ist der einzige Ort, und die
   Frage nach der Runde ist „wo verliere ich zuletzt", nicht „wie war es im Mai". */
const RUNDEN_MAX = 30;
export function mischeRunden(a, b) {
  const nachT = new Map();
  for (const r of [...(a || []), ...(b || [])]) if (r && r.t && !nachT.has(r.t)) nachT.set(r.t, r);
  return [...nachT.values()].sort((x, y) => x.t - y.t).slice(-RUNDEN_MAX);
}

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

/* Eine Markierung ist kein „true", sondern ein Zeitpunkt. Das Zusammenfuehren
   zweier Tabs kannte bei flags nur Wachstum: Der zweite Tab holte jeden
   geloeschten Stern sofort zurueck, „Alle Markierungen loeschen" war mit zwei
   offenen Tabs also wirkungslos. Ein negativer Stempel ist ein Grabstein - die
   Markierung wurde zu diesem Zeitpunkt entfernt. Beim Zusammenfuehren gewinnt
   der juengere Stempel; bei gleichem Betrag der Grabstein, damit beide Tabs
   dasselbe Ergebnis bekommen. Alte Staende mit „true" zaehlen als Stempel 1 und
   verlieren damit gegen jede spaetere Entscheidung. */
const istMarkiert = (v) => v === true || (typeof v === 'number' && v > 0);
const alsStempel = (v) => {
  if (v === true) return 1;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
let flagUhr = 0;
/* Streng steigend: Zwei Tastendruecke in derselben Millisekunde bekaemen sonst
   denselben Stempel, und die zweite Entscheidung verlore gegen die erste. */
const flagStempel = () => (flagUhr = Math.max(Date.now(), flagUhr + 1));
/* Und streng ueber allem, was schon abgelegt ist. Faengt die Uhr bei 0 an, kann
   ein Stempel aus der Vergangenheit kommen: Ging die Geraeteuhr eine Stunde vor
   und wurde danach korrigiert, trug eine gesetzte Markierung einen groesseren
   Betrag als der Grabstein, der sie spaeter entfernt - der zweite Tab holte den
   geloeschten Stern beim naechsten Zusammenfuehren zurueck. Dasselbe im Kleinen
   beim Leeren vieler Markierungen: Das kostet Millisekunden, in denen ein frisch
   gesetzter Stern des anderen Tabs gegen den Grabstein verloere. */
const flagUhrNachziehen = (z) => {
  for (const v of Object.values((z && z.flags) || {})) {
    const b = Math.abs(alsStempel(v));
    if (b > flagUhr) flagUhr = b;
  }
};
const GRABSTEIN_TAGE = 90;
export const zaehleMarkierungen = (z) =>
  Object.values((z && z.flags) || {}).filter(istMarkiert).length;

/* Grabsteine muessen nicht ewig liegen: Nach drei Monaten haelt kein zweiter Tab
   die alte Markierung mehr fest, und die Ablage bliebe sonst dauerhaft mit
   jedem je geloeschten Stern belastet. */
function normalisiereFlags(z) {
  const grenze = Date.now() - GRABSTEIN_TAGE * 86400000;
  for (const [id, v] of Object.entries(z.flags || {})) {
    const s = alsStempel(v);
    if (!s || (s < 0 && -s < grenze)) { delete z.flags[id]; continue; }
    z.flags[id] = s;
  }
  return z;
}

/* Was beim Start schiefging – app.js zeigt es einmal als Balken. Null heisst:
   alles in Ordnung. VOR dem Aufruf erklaert: load() laeuft beim Modulstart und
   schreibt hier hinein. Als Deklaration weiter unten laege der Name in seiner
   Totzone – genau die Falle, in die `zahl` schon getappt ist. */
let startFehler = null, kaputteRohdaten = 0;
export const startProblem = () => (startFehler ? { grund: startFehler, bytes: kaputteRohdaten } : null);

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
    normalisiereFlags(zustand);
    flagUhrNachziehen(zustand);
    // Listen kommen ungeprueft aus dem Speicher - eine kaputte Runde darf das
    // Ergebnisbild nicht zum Absturz bringen.
    zustand.quizRunden = saeubereRunden(zustand.quizRunden);
    return zustand;
  } catch (e) {
    // Bewusst console.error: hier landet auch ein Programmierfehler, und der
    // wuerde sonst den gesamten Fortschritt still auf die Standardwerte setzen.
    console.error('Speicher unlesbar, starte neu', e);
    /* Und der Nutzer sieht davon sonst NICHTS. Nachgestellt: 900 Karten, 8.000
       Antworten, 200 Tage Serie, 94 kB im Speicher – ein fehlendes Byte genuegt,
       und auf dem Schirm steht eine ganz normale Startseite mit „0 Tage in
       Folge". Schlimmer: Schon das erste Zeichnen speichert, die 94 kB Rohdaten
       sind nach 551 Bytes ersetzt, bevor er etwas antippen kann. Daraus liessen
       sich Kartenstaende von Hand noch retten – also werden sie beiseitegelegt,
       BEVOR irgendetwas schreibt, und die App sagt es. */
    try {
      const roh = localStorage.getItem(KEY);
      if (roh) { localStorage.setItem(KEY + '.kaputt', roh); kaputteRohdaten = roh.length; }
    } catch (e2) { /* voll: dann bleibt nur die Meldung */ }
    startFehler = e && e.message ? String(e.message) : 'unbekannt';
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
    /* Je Tab das Maximum – sein eigener Beitrag waechst monoton, ein aelterer
       Stand desselben Tabs kann also nichts Neues bringen. Und danach die
       Summe: Frueher stand hier das Maximum der SUMMEN, und damit gingen die
       Antworten des jeweils kleineren Tabs verloren. */
    const je = { ...beitraege(e) };
    for (const [wer, b] of Object.entries(beitraege(f))) {
      const hier = je[wer] || {};
      /* Traegt einer der beiden Bloecke eine hoehere Fassungsnummer, gilt er
         als Ganzes - nur so kann eine Ruecknahme ueberhaupt ankommen. Bei
         gleicher Nummer (beide aus der Zeit davor) bleibt es beim Maximum je
         Feld, damit alte Staende nichts verlieren. */
      const nHier = Number(hier.n) || 0, nDort = Number(b.n) || 0;
      if (nHier !== nDort) { je[wer] = nHier > nDort ? hier : b; continue; }
      const vereint = {};
      for (const k of TAGESZAEHLER) {
        const n = groesser(hier[k], b[k]);
        if (n) vereint[k] = n;
      }
      if (nHier) vereint.n = nHier;
      je[wer] = vereint;
    }
    z.days[tag] = summiere({ ...e, je });
  }
  for (const [id, f] of Object.entries(fremd.flags || {})) {
    const fremdStempel = alsStempel(f);
    if (!fremdStempel) continue;
    const eigenStempel = alsStempel(z.flags[id]);
    if (Math.abs(fremdStempel) > Math.abs(eigenStempel) ||
        (Math.abs(fremdStempel) === Math.abs(eigenStempel) && fremdStempel < 0)) {
      z.flags[id] = fremdStempel;
    }
  }
  for (const k of ['best', 'duelBest', 'duelMs', 'duelTimed', 'lastExport',
                   'quizBest']) {
    z[k] = groesser(z[k], fremd[k]);
  }
  /* Die vier Gesamtzaehler wachsen ausschliesslich neben ihrem Tageszaehler
     (app.js: d.done++ und st.totalAnswers++ stehen in derselben Zeile), und
     Tage werden nie geloescht. Sie lassen sich also ableiten, statt sie ein
     zweites Mal zusammenfuehren zu muessen – und damit teilen sie automatisch
     die richtige Rechnung der Tagesbeitraege. */
  /* Was die Tagesbuecher nicht erklaeren, traegt jede Seite als Sockel mit:
     Eine eingelesene Sicherung bringt 4.972 Antworten und Tagesbuecher fuer die
     letzten dreissig Tage – die restlichen 4.572 haengen an keinem Tag mehr und
     duerfen trotzdem nicht verschwinden.

     Frueher stand hier schlicht das Maximum aus beiden Gesamtzahlen und der
     Tagessumme. Das hielt den Sockel, nahm aber auch jede Ruecknahme wieder
     zurueck: Wer eine Antwort mit „Rueckgaengig" loeschte, bekam sie vom
     zweiten offenen Tab zurueckgeschrieben, dessen Gesamtzahl noch die alte
     war. Der Sockel trennt beides sauber - er ist der Teil, den die Buecher
     NICHT belegen, und der Rest folgt der Summe nach oben wie nach unten.
     Nebenwirkung, die zum Aufbau passt: Ginge ein Tagesbuch je verloren, waechst
     der Sockel um genau dessen Beitrag, statt dass die Gesamtzahl faellt. */
  const sockel = (feld, stand, gesamt) =>
    Math.max(0, (Number(gesamt) || 0) - tagesSumme(stand.days, feld));
  const ausTagen = (feld, eigenZahl, fernZahl) =>
    Math.max(sockel(feld, eigen, eigenZahl), sockel(feld, fremd, fernZahl))
    + tagesSumme(z.days, feld);
  /* claims/claimsMiss standen frueher in der groesser()-Liste darueber - und
     genau davor warnt der Kommentar am Kopf dieser Datei: Das Maximum zweier
     unabhaengig gewachsener Zahlen ist nicht ihre Summe. Zwei offene Tabs mit je
     einer Festlegung ergaben claims=1 statt 2; die Selbsteinschaetzung zeigte
     „5 / 19 - deutlich zu optimistisch", wahr waren 5 / 20 und „solide". Und
     eine mit „Rueckgaengig" zurueckgenommene Festlegung holte der andere Tab
     wieder hervor, weil sein Maximum noch die alte Zahl trug. Jetzt tragen sie
     dieselbe Rechnung wie die Tageszaehler. */
  z.totalAnswers = ausTagen('done', z.totalAnswers, fremd.totalAnswers);
  z.totalCorrect = ausTagen('correct', z.totalCorrect, fremd.totalCorrect);
  z.duelAnswers = ausTagen('duel', z.duelAnswers, fremd.duelAnswers);
  z.duelCorrect = ausTagen('duelOk', z.duelCorrect, fremd.duelCorrect);
  z.claims = ausTagen('claim', z.claims, fremd.claims);
  z.claimsMiss = ausTagen('claimMiss', z.claimsMiss, fremd.claimsMiss);
  z.quizRunden = mischeRunden(z.quizRunden, saeubereRunden(fremd.quizRunden));
  /* streak darf hier NICHT das Maximum sein: touchStreak() setzt die Serie nach
     einer Pause bewusst auf 1 zurueck: Der zweite Tab hob sie sonst wieder auf
     den alten Wert, und die Startseite zeigte eine Serie, die es nicht mehr gab.
     Die Serie gehoert zu dem Stand, der zuletzt gelernt hat. best bleibt beim
     Maximum - das ist ein Rekord und faellt nie. */
  const eigenerTag = keyToNum(z.lastDay);
  const fremderTag = keyToNum(fremd.lastDay);
  if (fremderTag !== null && (eigenerTag === null || fremderTag > eigenerTag)) {
    z.streak = Number(fremd.streak) || 0;
    z.lastDay = fremd.lastDay;
  } else if (fremderTag !== null && fremderTag === eigenerTag) {
    z.streak = groesser(z.streak, fremd.streak);
  }
  z.best = groesser(z.best, z.streak);
  flagUhrNachziehen(z);            // fremde Stempel duerfen eigene nicht ueberholen
  /* factIdx zeigt in eine Liste und waechst nicht monoton - es wandert mit dem
     Zaehler, zu dem es gehoert, sonst zeigte die Rueckschau auf einen anderen
     Merkanker als den zuletzt gesehenen. */
  if ((Number(fremd.factSeen) || 0) > (Number(z.factSeen) || 0)) {
    z.factSeen = Number(fremd.factSeen) || 0;
    z.factIdx = Number(fremd.factIdx) || 0;
    if (fremd.factDay) z.factDay = fremd.factDay;
    if (Array.isArray(fremd.factTage)) z.factTage = fremd.factTage.slice(-8);
  }
  z.rev = groesser(z.rev, fremd.rev);
  return z;                                  // Einstellungen bleiben die dieses Tabs
}

/* Den abgelegten Stand einholen, ohne zu schreiben. Wer den Zustand veraendern
   will, muss das auf dem juengsten Stand tun - sonst behauptet die eigene
   Aenderung, sie sei die neueste, und verdraengt eine fremde, die sie nie
   gesehen hat. Gibt true zurueck, wenn zusammengefuehrt wurde. */
function holeFremdenStand() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return false;
    const fremd = JSON.parse(roh);
    if (!fremd || typeof fremd !== 'object' || (fremd.rev || 0) <= (state.rev || 0)) return false;
    state = zusammenfuehren(fremd, state);
    return true;
  } catch (e) { return false; }   // unlesbar ist so gut wie nicht vorhanden
}

/** Eine Quizrunde ablegen - auf dem juengsten Stand, damit eine im anderen Tab
    gespielte Runde nicht verdraengt wird (dieselbe Regel wie bei aendereKarte). */
export function merkeQuizRunde(eintrag) {
  holeFremdenStand();
  /* Erst NACH dem Einholen des fremden Stands ablesen und zurueckgeben:
     Waehrend einer Runde verwirft der Tab die Meldungen des anderen
     (setBusyCheck), der eigene quizBest kann also veraltet sein. Vorher meldete
     ein Tab „Neuer Bestwert!" fuer eine Punktzahl, die der andere laengst
     ueberboten hatte. */
  const vorher = state.quizBest || 0;
  state.quizRunden = mischeRunden(state.quizRunden, [eintrag]);
  state.quizBest = Math.max(vorher, eintrag.p || 0);
  save(true);
  return vorher;
}

/** Eine Karte auf dem juengsten Stand veraendern – fuer Aenderungen, die auf
    einem veralteten Kartenzustand Schaden anrichten wuerden. */
export function aendereKarte(id, fn) {
  holeFremdenStand();
  const neu = fn(state.cards[id] || null);
  if (neu) state.cards[id] = neu;
  save();
  return neu;
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
      if (holeFremdenStand()) vorherigeRev = state.rev || 0;   // nach dem Zusammenfuehren neu ablesen
      state.rev = vorherigeRev + 1;
      localStorage.setItem(KEY, JSON.stringify(state));
      quotaWarned = false;
      return true;
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
      return false;
    }
  };
  /* Der Rueckgabewert zaehlt nur im Sofortfall: Nur dort wartet ein Aufrufer
     auf die Antwort „ist es angekommen?". Das Einlesen meldete frueher
     „Fortschritt geladen", waehrend daneben „Speicher voll" stand und im
     Speicher noch der alte Stand lag – beim naechsten Oeffnen war das Backup
     wieder weg. */
  if (now) { clearTimeout(saveTimer); saveTimer = null; return write(); }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; write(); }, 250);
  return true;
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

export const isFlagged = (id) => istMarkiert(state.flags[id]);
export function toggleFlag(id) {
  const an = !istMarkiert(state.flags[id]);
  state.flags[id] = an ? flagStempel() : -flagStempel();
  save();
  return an;
}
/** Alle Markierungen entfernen – als Grabsteine, damit der zweite Tab sie nicht zurueckholt. */
export function loescheAlleMarkierungen() {
  /* Erst einholen, dann beerdigen. Waehrend einer Lerneinheit verwirft dieser
     Tab die Meldungen des anderen bewusst - er kennt dessen frische Markierungen
     also nicht. Ohne den Abgleich bekamen genau die keinen Grabstein, und das
     Speichern danach fuehrte sie wieder herein: Der Nutzer sah „Markierungen
     geloescht" und darunter unveraendert „Alle 1 Markierungen loeschen". */
  holeFremdenStand();
  let n = 0;
  for (const id of Object.keys(state.flags)) {
    if (!istMarkiert(state.flags[id])) continue;
    state.flags[id] = -flagStempel();
    n++;
  }
  save(true);
  return n;
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
      || zaehleMarkierungen(state) !== zaehleMarkierungen(vorher);
    onFremdStand(uebernommen, sichtbar);
  });
}

/* Zuruecksetzen und Einlesen sind ausdrueckliche Entscheidungen - sie duerfen
   nicht vom Zusammenfuehren wieder eingesammelt werden. Deshalb bekommt der neue
   Zustand eine hoehere Fassungsnummer als alles, was gerade gespeichert ist. */
/* Nach jedem Ersetzen muss aufgeraeumt werden, was sonst nur beim Modulstart
   laeuft - allen voran die Uebernahme umformulierter Karten. Ohne diesen Haken
   verloren nach dem Einlesen einer Sicherung genau die Karten ihren Stand,
   deren Frage seither neu formuliert worden war. Der Haken liegt hier und nicht
   in session.js, weil nur die Ablage weiss, wann sie den Zustand austauscht. */
let nachErsatz = () => {};
export const setNachErsatz = (fn) => { nachErsatz = fn; };

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
  nachErsatz();
  return save(true);
}

export function resetAll() {
  sichereJetzigen();
  return ersetzeZustand(structuredClone(DEFAULTS));
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
/* Funktionsdeklaration, kein const: load() laeuft beim Modulstart (Zeile 122)
   und ruft ueber saeubereRunden() hierher – also lange bevor diese Zeile an der
   Reihe waere. Als const lag der Name dann noch in seiner Totzone, load() warf
   „Cannot access 'zahl' before initialization", der catch fing es als
   „Speicher unlesbar" ab und die App startete mit den Standardwerten.
   Ausgeloest hat das jede zu Ende gespielte Quizrunde: Erst dann steht in
   quizRunden ein Eintrag, und erst dann kommt saeubereRunden() ueberhaupt an
   diese Stelle. Die Kartenstaende kamen beim naechsten Speichern ueber das
   Zusammenfuehren zurueck – die EINSTELLUNGEN nicht, denn zusammenfuehren()
   behaelt bewusst die des eigenen Tabs. Farbschema, neue Karten pro Tag und
   abgeschaltete Themen waren damit bei jedem Start wieder auf Anfang.
   Deklarationen werden hochgezogen, Zuweisungen an const nicht. */
function zahl(v, min, max, standard) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : standard;
}

function saeubereRunden(liste) {
  if (!Array.isArray(liste)) return [];
  const rein = [];
  for (const r of liste) {
    if (!r || typeof r !== 'object' || !(Number(r.t) > 0)) continue;
    const k = {};
    for (const [cat, v] of Object.entries(r.k && typeof r.k === 'object' ? r.k : {})) {
      if (!Array.isArray(v)) continue;
      k[cat] = [zahl(v[0], 0, 1e6, 0), zahl(v[1], 0, 1e6, 0)];
    }
    rein.push({ t: zahl(r.t, 1, 1e15, 1), p: zahl(r.p, 0, 1e6, 0), m: zahl(r.m, 0, 1e6, 0),
                r: zahl(r.r, 0, 1e6, 0), f: zahl(r.f, 0, 1e6, 0), l: zahl(r.l, 0, 1e6, 0), k });
  }
  return mischeRunden(rein, []);
}

/* Zaehlerpaare, bei denen das eine eine Teilmenge des anderen ist. Jede Zahl
   fuer sich kann im Rahmen liegen und das Paar trotzdem Unsinn ergeben: Eine
   von Hand bearbeitete oder halb beschaedigte Sicherung mit „14 beantwortet,
   18 richtig" trieb die Statistik auf 129 % Trefferquote in der Wochenkurve
   und 179 % im Wissensstand - Zahlen, die es nicht geben kann. Gedeckelt wird
   der Teil, nie das Ganze: Wer wirklich 14 beantwortet hat, hat hoechstens 14
   richtig. */
const TEILMENGEN = [['correct', 'done'], ['duelOk', 'duel'], ['claimMiss', 'claim']];
function stimmig(z) {
  for (const [teil, ganzes] of TEILMENGEN) {
    if (z[teil] !== undefined && z[ganzes] !== undefined && z[teil] > z[ganzes]) z[teil] = z[ganzes];
  }
  return z;
}

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
    rein.settings.quizLehrerwissen = !!s.quizLehrerwissen;
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
    /* Aus TAGESZAEHLER abgeleitet, nicht von Hand aufgezaehlt: Die Liste hier
       war eine zweite Wahrheit und lief auseinander, als claim/claimMiss
       dazukamen - ein Tagesbuch ohne Beitragsliste verlor sie beim Einlesen. */
    const sauber = {};
    for (const k of TAGESZAEHLER) sauber[k] = zahl(d[k], 0, k === 'sec' ? 1e8 : 1e6, 0);
    /* Die Beitraege je Tab kommen ungeprueft aus der Datei, also braucht es eine
       Obergrenze gegen eine praeparierte Datei, die den Speicher mit Schluesseln
       flutet. Die erste Fassung nahm dafuer die ersten acht und liess den Rest
       FALLEN – mit der Begruendung, mehr als zwei Tabs lernten an einem Tag
       ohnehin nicht. Die Begruendung war falsch: Auf dem iPhone bekommt jeder
       Kaltstart der vom Home-Bildschirm gestarteten App einen frischen
       sessionStorage und damit eine neue Kennung. Zehn Starts an einem Tag sind
       zehn Schluessel. Nachgestellt wurden aus „30 heute geschafft" nach dem
       Einlesen der EIGENEN Sicherung 24 – stiller Verlust in genau dem Vorgang,
       der den Fortschritt retten soll.

       Jetzt wird gedeckelt, ohne wegzuwerfen: Was ueber die Grenze hinausgeht,
       wandert feldweise in einen Sammeleintrag. Die Schluesselzahl bleibt
       begrenzt, die Tagessumme bleibt exakt – und weil der Wert IN der
       Beitragsliste steht, ueberlebt er auch das naechste Zusammenfuehren, das
       die Tageszahl ohnehin aus ihr neu berechnet. */
    if (d.je && typeof d.je === 'object' && !Array.isArray(d.je)) {
      const je = {};
      let n = 0;
      for (const [wer, b] of Object.entries(d.je)) {
        if (typeof wer !== 'string' || wer.length > 24 || !b || typeof b !== 'object') continue;
        const ziel = n < 64 ? (je[wer] = je[wer] || {}) : (je.rest = je.rest || {});
        let etwas = false;
        for (const k of TAGESZAEHLER) {
          const v = zahl(b[k], 0, k === 'sec' ? 1e8 : 1e6, 0);
          if (v) { ziel[k] = (ziel[k] || 0) + v; etwas = true; }
        }
        // Die Fassungsnummer wird nicht addiert: Sie zaehlt Schreibvorgaenge,
        // keine Antworten. Beim Zusammenlegen in „rest" gilt die hoechste.
        const fassung = zahl(b.n, 0, 1e9, 0);
        if (fassung && etwas) ziel.n = Math.max(Number(ziel.n) || 0, fassung);
        stimmig(ziel);
        if (etwas) n++; else if (n < 64) delete je[wer];
      }
      for (const wer of Object.keys(je)) if (!Object.keys(je[wer]).length) delete je[wer];
      if (Object.keys(je).length) { sauber.je = je; summiere(sauber); }
    }
    stimmig(sauber);
    rein.days[tag] = sauber;
  }
  for (const [id, v] of Object.entries(roh.flags || {})) {
    if (typeof id !== 'string') continue;
    const s = alsStempel(v);
    if (s) rein.flags[id] = Math.max(-1e15, Math.min(1e15, s));
  }
  rein.streak = zahl(roh.streak, 0, 1e5, 0);
  rein.best = zahl(roh.best, 0, 1e5, 0);
  rein.duelBest = zahl(roh.duelBest, 0, 100, 0);
  rein.duelAnswers = zahl(roh.duelAnswers, 0, 1e8, 0);
  rein.duelCorrect = zahl(roh.duelCorrect, 0, 1e8, 0);
  rein.duelMs = zahl(roh.duelMs, 0, 1e12, 0);
  rein.duelTimed = zahl(roh.duelTimed, 0, 1e8, 0);
  rein.quizBest = zahl(roh.quizBest, 0, 1e6, 0);
  rein.quizRunden = saeubereRunden(roh.quizRunden);
  rein.totalAnswers = zahl(roh.totalAnswers, 0, 1e8, 0);
  rein.totalCorrect = zahl(roh.totalCorrect, 0, 1e8, 0);
  rein.gen = zahl(roh.gen, 0, 1e9, 0);
  rein.claims = zahl(roh.claims, 0, 1e7, 0);
  rein.claimsMiss = zahl(roh.claimsMiss, 0, 1e7, 0);
  /* Dieselben Teilmengen wie im Tagesbuch, nur fuer die Gesamtzahlen: „43 von
     24 richtig" hiess auf der Statistikseite 179 % Trefferquote. */
  rein.totalCorrect = Math.min(rein.totalCorrect, rein.totalAnswers);
  rein.duelCorrect = Math.min(rein.duelCorrect, rein.duelAnswers);
  rein.claimsMiss = Math.min(rein.claimsMiss, rein.claims);
  rein.factIdx = zahl(roh.factIdx, 0, 1e5, 0);
  rein.factSeen = zahl(roh.factSeen, 0, 1e6, 0);
  rein.lastDay = /^\d{4}-\d{2}-\d{2}$/.test(roh.lastDay) ? roh.lastDay : null;
  rein.factDay = /^\d{4}-\d{2}-\d{2}$/.test(roh.factDay) ? roh.factDay : null;
  rein.factTage = Array.isArray(roh.factTage)
    ? roh.factTage.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).slice(-8) : [];
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
    let etwas = false;
    for (const alt of alte) {
      if (!state.cards[neu] && state.cards[alt]) {   // neue Kennung hat sonst schon einen Stand
        state.cards[neu] = state.cards[alt];
        delete state.cards[alt];
        etwas = true;
      }
      /* Die Markierung wandert getrennt vom Lernstand: Beim Nachschlagen genuegt
         ein Tippen auf den Stern, eine Karte kann also markiert sein, ohne je
         gelernt worden zu sein. Haengte die Uebernahme am Kartenstand, verlor
         genau diese Karte beim Umformulieren ihre Markierung. */
      if (istMarkiert(state.flags[alt])) {
        if (!istMarkiert(state.flags[neu])) { state.flags[neu] = flagStempel(); etwas = true; }
        state.flags[alt] = -flagStempel();
      }
    }
    if (etwas) bewegt++;
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
  return ersetzeZustand(rein);
}

/* Das Netz unter Einlesen und Zuruecksetzen. Zwei Regeln stecken darin:

   Erstens darf es den Vorgang nie kippen – ist der Speicher voll, gibt es eben
   keine Sicherung.

   Zweitens darf ein duennerer Stand keinen dickeren ueberschreiben. Nachgestellt:
   Ein Jahr Fortschritt (1.400 Karten), ein Fehlgriff im Dateiwaehler liest eine
   uralte Sicherung mit 15 Karten ein – das Jahr liegt jetzt im Netz. Der Nutzer
   will den Fehlgriff loswerden und tippt „Alles zuruecksetzen": Das rief
   sichereJetzigen() und schrieb die 15 Karten ueber das Jahr. Danach holte
   „Letztes Einlesen rueckgaengig" genau den Fehlgriff zurueck, den er
   loswerden wollte, und das Jahr war nirgends mehr.

   Beim Tausch (sicherungZurueck) muss trotzdem geschrieben werden, auch wenn
   der jetzige Stand duenner ist – sonst waere der Griff nicht umkehrbar. */
function sichereJetzigen(erzwingen = false) {
  try {
    if (!erzwingen) {
      const alt = localStorage.getItem(SICHERUNG);
      if (alt && (kennzahlen(JSON.parse(alt)).antworten || 0) > (state.totalAnswers || 0)) return;
    }
    localStorage.setItem(SICHERUNG, JSON.stringify(state));
  } catch (e) { console.warn('Sicherung vor dem Ueberschreiben fehlgeschlagen', e); }
}

/** Holt den Stand von vor dem letzten Einlesen oder Zuruecksetzen zurueck. */
export function sicherungZurueck() {
  const roh = localStorage.getItem(SICHERUNG);
  if (!roh) return false;
  const rein = saeubern(JSON.parse(roh));
  /* Frueher: removeItem. Damit war der Griff einmalig und unumkehrbar – und er
     steht unter „Mehr" auch noch Monate nach dem Einlesen, zehn Pixel unter dem
     roten Knopf, ohne Datum und ohne Zahlen. Nachgestellt: drei Monate lernen
     (900 Karten, 4.500 Antworten, Serie 90), ein Tipper, alles weg, kein Weg
     zurueck. Jetzt wird getauscht statt weggeworfen: Der jetzige Stand wandert
     ins Netz, ein zweiter Tipp holt ihn zurueck. */
  sichereJetzigen(true);
  ersetzeZustand(rein);
  return true;
}

/** Kennzahlen des Netzes – damit die Rueckfrage sagen kann, worauf sie zurueckgeht. */
export function sicherungKennzahlen() {
  try {
    const roh = localStorage.getItem(SICHERUNG);
    return roh ? kennzahlen(JSON.parse(roh)) : null;
  } catch (e) { return null; }
}

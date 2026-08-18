/* Baut Antwortmöglichkeiten und vergleicht freie Eingaben. */
import { POOL_SUB, POOL_CAT, CARDS } from '../../data/index.js';

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const YEAR = /^(\d{3,4})(\s*(v\.\s*Chr\.|n\.\s*Chr\.))?$/;
// Deutsche Schreibweise: Punkt trennt Tausender, Komma die Nachkommastellen.
// Ohne diese Unterscheidung wurde „3.600" als 3,6 gelesen und erzeugte Ablenker wie „1,8".
const NUM = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/;
const zuZahl = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

/* Für Jahreszahlen und reine Zahlen erzeugen wir knappe Beinahe-Treffer –
   das trainiert echtes Wissen statt Ausschlussverfahren. */
function numericDistractors(answer) {
  const y = answer.match(YEAR);
  if (y) {
    const base = parseInt(y[1], 10);
    const suffix = y[2] ? y[2].trim() : '';
    const offs = shuffle([-40, -25, -14, -9, -6, -4, 4, 6, 9, 14, 25, 40]).slice(0, 3);
    return offs.map(o => `${Math.max(1, base + o)}${suffix ? ' ' + suffix : ''}`);
  }
  const n = answer.match(NUM);
  if (n) {
    const base = zuZahl(answer);
    if (!isFinite(base) || base === 0) return null;
    const facs = shuffle([0.5, 0.75, 1.5, 2, 1.25, 0.25]).slice(0, 3);
    const fmt = (v) => {
      const gerundet = Number.isInteger(base) ? String(Math.round(v)) : v.toFixed(1).replace('.', ',');
      // Tausenderpunkte wieder einsetzen, damit die Ablenker aussehen wie die Antwort
      return answer.includes('.') ? gerundet.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : gerundet;
    };
    const out = [...new Set(facs.map(f => fmt(base * f)))].filter(v => v !== answer);
    return out.length >= 3 ? out.slice(0, 3) : null;
  }
  return null;
}

/** 4 Antwortoptionen für eine Karte, die richtige ist enthalten. */
export function options(card) {
  const wrong = [];
  const push = (v) => {
    if (!v || v === card.a) return;
    if (wrong.includes(v)) return;
    wrong.push(v);
  };

  if (card.w && card.w.length) shuffle(card.w).forEach(push);
  if (wrong.length < 3) {
    const num = numericDistractors(card.a);
    if (num) num.forEach(push);
  }
  if (wrong.length < 3) shuffle(POOL_SUB[card.cat + '/' + card.sub] || []).forEach(push);
  if (wrong.length < 3) shuffle(POOL_CAT[card.cat] || []).forEach(push);
  if (wrong.length < 3) shuffle(CARDS.map(c => c.a)).forEach(push);

  return shuffle([card.a, ...wrong.slice(0, 3)]);
}

/* ---------- Freies Abrufen: Eingabe mit der Lösung vergleichen ---------- */

/* Zeichen, die beim reinen Wegwerfen von Nicht-ASCII verloren gingen und dann
   „H₂O" zu „h o" oder „π" zu einer leeren Zeichenkette gemacht haben. */
const ZEICHEN = [
  [/[⁰₀]/g, '0'], [/[¹₁]/g, '1'], [/[²₂]/g, '2'], [/[³₃]/g, '3'], [/[⁴₄]/g, '4'],
  [/[⁵₅]/g, '5'], [/[⁶₆]/g, '6'], [/[⁷₇]/g, '7'], [/[⁸₈]/g, '8'], [/[⁹₉]/g, '9'],
  [/π/g, ' pi '], [/[αΑ]/g, ' alpha '], [/[βΒ]/g, ' beta '], [/[γΓ]/g, ' gamma '],
  [/[δΔ]/g, ' delta '], [/[λΛ]/g, ' lambda '], [/[σΣ]/g, ' sigma '], [/[ωΩ]/g, ' omega '],
  [/[µμ]/g, ' mikro '], [/°/g, ' grad '], [/√/g, ' wurzel '], [/[·×*]/g, ' mal '],
  // Rechenzeichen tragen Bedeutung: ohne sie waere „a² − b² = c²" nicht von
  // „a² + b² = c²" zu unterscheiden – die falsche Formel galte als richtig.
  [/=/g, ' gleich '], [/\+/g, ' plus '], [/−/g, ' minus '], [/\^/g, ' hoch '],
  [/(^|\s)-(?=\s|$|\d)/g, ' minus '],
  [/ℕ/g, ' n '], [/ℤ/g, ' z '], [/ℚ/g, ' q '], [/ℝ/g, ' r '], [/ℂ/g, ' c '],
  [/±/g, ' plusminus '], [/[≈~]/g, ' rund '], [/≤/g, ' hoechstens '], [/≥/g, ' mindestens '],
  [/∞/g, ' unendlich '], [/€/g, ' euro '], [/%/g, ' prozent '], [/&/g, ' und '],
  [/[–—]/g, ' '], [/[’´`]/g, "'"], [/[éèê]/g, 'e'], [/[àâá]/g, 'a'], [/[ç]/g, 'c'], [/[ñ]/g, 'n'],
];
const FUELLWOERTER = /\b(der|die|das|ein|eine|einen|einem|im|in|von|vom|zu|zum|zur|und|des|dem)\b/g;

export function normalize(s) {
  let t = String(s).toLowerCase();
  for (const [re, ersatz] of ZEICHEN) t = t.replace(re, ersatz);
  t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
       .replace(/[^a-z0-9]+/g, ' ');
  const ohneFuell = t.replace(FUELLWOERTER, ' ').trim().replace(/\s+/g, ' ');
  // Besteht die Eingabe nur aus Füllwörtern, ist der ungefilterte Text die bessere Grundlage
  return ohneFuell || t.trim().replace(/\s+/g, ' ');
}

/* Verneinungen kehren die Aussage um – wer sie tippt, meint etwas anderes. */
const VERNEINUNG = /\b(nicht|kein|keine|keinen|keiner|nie|niemals|falsch|weiss nicht|ahnung)\b/;

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/* Wörter, die eine Antwort nur einordnen und deshalb weggelassen werden dürfen:
   „Pythagoras" statt „Satz des Pythagoras" ist eine richtige Antwort. */
const KLASSIFIKATOREN = new Set([
  'satz', 'regel', 'gesetz', 'prinzip', 'theorem', 'formel', 'begriff',
  'verfahren', 'methode', 'lehre', 'effekt',
]);
const RECHENWORT = new Set(['mal', 'pro', 'je', 'hoch', 'plus', 'ab', 'bis']);

/* Alles Übrige trägt Bedeutung – vor allem Zahlen und Rechenwörter.
   Ohne diese Prüfung galt „Grundseite mal Höhe" als richtige Antwort auf die
   Dreiecksfläche, obwohl genau das fehlende „geteilt durch 2" der Fehler ist. */
// Schwelle bewusst bei drei Zeichen: „sin", „cos", „Nil", „Rom" tragen die ganze
// Bedeutung. Fuellwoerter wie „der" oder „und" sind zu diesem Zeitpunkt schon weg.
const traegtBedeutung = (t) => /\d/.test(t) || t.length >= 3 || RECHENWORT.has(t);

/** Welche bedeutungstragenden Wörter der Lösung fehlen in der Eingabe? */
function fehlendeWoerter(eingabe, loesung) {
  const vorhanden = new Set(eingabe.split(' ').filter(Boolean));
  return loesung.split(' ').filter(w => w && traegtBedeutung(w) && !vorhanden.has(w));
}

/* Bei Antworten, deren Sinn an einer Zahl haengt, ist der Editierabstand
   ein schlechtes Mass: „3 Stunden" und „7 Stunden" unterscheiden sich in einem
   von neun Zeichen, „a2 plus b2" und „a2 minus b2" in vieren von elf. */
const OPERATOR = new Set(['plus', 'minus', 'gleich', 'mal', 'geteilt', 'durch', 'hoch', 'wurzel']);
const kennwoerter = (t) =>
  t.split(' ').filter(w => /\d/.test(w) || OPERATOR.has(w)).sort().join(' ');

/** 0..1 – wie nah kommt die Eingabe der Lösung? */
export function similarity(input, answer) {
  const a = normalize(input), b = normalize(answer);
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Eine Verneinung, die in der Lösung nicht vorkommt, dreht die Aussage um
  const verneint = VERNEINUNG.test(a) && !VERNEINUNG.test(b);

  // Wer viel mehr schreibt als die Lösung lang ist, hat nicht dieselbe Antwort gegeben,
  // sondern drumherum geredet – sonst ginge „Bayern ist es nicht, sondern Hessen" durch.
  const zuLang = a.length > b.length * 1.7 + 10;

  // Zahlen und Rechenzeichen muessen auf beiden Seiten uebereinstimmen – fehlende
  // wie ueberzaehlige. Sonst galte „−cos(x)" als Antwort auf „cos(x)".
  const kernFalsch = kennwoerter(b) !== kennwoerter(a);

  if (!verneint && !zuLang && !kernFalsch) {
    // Eine kürzere Eingabe zählt nur, wenn sie nichts Bedeutungstragendes auslässt.
    // Einordnende Wörter wie „Satz" dürfen fehlen, Zahlen und Rechenwörter nicht.
    const fehlt = fehlendeWoerter(a, b);
    if (fehlt.every(w => KLASSIFIKATOREN.has(w))) {
      if (fehlt.length === 0) return 0.95;
      if (b.includes(a) || a.length >= Math.max(4, b.length * 0.4)) return 0.9;
    }
  }
  const dist = levenshtein(a, b);
  const roh = Math.max(0, 1 - dist / Math.max(a.length, b.length));
  return (verneint || kernFalsch) ? Math.min(roh, 0.5) : roh;
}

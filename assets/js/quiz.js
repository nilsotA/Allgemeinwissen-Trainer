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
  [/[–—]/g, ' '],
  // Der Ableitungsstrich traegt Bedeutung: ohne ihn waere die Produktregel
  // „u' · v + u · v'" nicht von „u · v + u' · v'" zu unterscheiden.
  [/[’´`']/g, ' strich '],
  // é, à, ç und ñ standen hier einmal einzeln. Sie erledigt jetzt die
  // Zerlegung in normalize() zusammen mit allen anderen Diakritika - eine
  // Liste von Hand haette immer nur die Zeichen gekannt, an die jemand dachte.
];
// „den", „einer", „eines" fehlten: „Grand Canyon" galt deshalb nicht als Antwort
// auf eine Karte, deren Loesung „Den Grand Canyon" lautet.
const FUELLWOERTER = /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|im|in|von|vom|zu|zum|zur|und)\b/g;

/* Wer „Wie viele Kontinente gibt es?" beantwortet, tippt „7" und nicht „Sieben".
   Ohne diese Zuordnung galt die richtige Antwort als falsch – bei 93 Karten,
   deren Loesung ein Zahlwort enthaelt. Die Schreibweisen stehen hier bereits
   in der Form, die nach der Umschrift der Umlaute uebrig bleibt. */
/* Eine Map, kein Objektliteral: Bei einem Objekt beantwortet auch die
   Prototypenkette, und „constructor" lieferte statt des Wortes den Quelltext
   „function Object() { [native code] }" - der stand dann in der Bewertung. */
const ZAHLWOERTER = new Map(Object.entries({
  null: '0', eins: '1', zwei: '2', drei: '3', vier: '4', fuenf: '5', sechs: '6',
  sieben: '7', acht: '8', neun: '9', zehn: '10', elf: '11', zwoelf: '12'
}));

export function normalize(s) {
  // NFC zuerst: Ein zerlegt eingegebenes „ä" (a + Trema) muss die deutsche
  // Umschrift unten genauso erreichen wie das zusammengesetzte Zeichen.
  let t = String(s).normalize('NFC').toLowerCase();
  for (const [re, ersatz] of ZEICHEN) t = t.replace(re, ersatz);
  /* Deutscher Tausenderpunkt raus, bevor das naechste Muster ihn zum Leerzeichen
     macht: Sonst wird aus „3.600" die Wortfolge „3 600", waehrend der Nutzer
     „3600" tippt - und die exakt richtige Zahl galt als glatt falsch. Auf dem
     Handy tippt praktisch niemand Tausenderpunkte. Dieselbe Unterscheidung
     zwischen Tausenderpunkt und Dezimalkomma trifft NUM/zuZahl oben. */
  t = t.replace(/(\d)\.(?=\d{3}(\D|$))/g, '$1');
  t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  /* Erst danach die fremden Diakritika, und nur die: Ein deutsches Tastenfeld
     gibt í, ó, ø, ř oder ć gar nicht her - wer „Brasilia" tippt, hat die
     Hauptstadt gewusst. Bekannt war bisher nur eine Handvoll (é, à, ç, ñ), alles
     andere fiel dem Muster unten zum Opfer und zerriss dabei das Wort: Aus
     „Brasília" wurde „bras lia", und die richtige Antwort galt als falsch.
     Die Umlaute sind vorher schon in ihrer deutschen Umschrift und bleiben es -
     sonst hiesse „Öl" auf einmal „ol". */
  t = t.replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ł/g, 'l')
       .replace(/đ/g, 'd').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ı/g, 'i')
       .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
       .replace(/[^a-z0-9]+/g, ' ');
  t = t.split(' ').map(w => ZAHLWOERTER.get(w) || w).join(' ');
  const ohneFuell = t.replace(FUELLWOERTER, ' ').trim().replace(/\s+/g, ' ');
  // Besteht die Eingabe nur aus Füllwörtern, ist der ungefilterte Text die bessere Grundlage
  return ohneFuell || t.trim().replace(/\s+/g, ' ');
}

/* Verneinungen kehren die Aussage um – wer sie tippt, meint etwas anderes. */
const VERNEINUNG = /\b(nicht|kein|keine|keinen|keiner|nie|niemals|falsch|weiss nicht|ahnung)\b/;

/* Abstand zweier Zeichenketten – mit einer Zusatzregel: Zwei vertauschte
   Nachbarzeichen zaehlen als EIN Fehler, nicht als zwei. Auf der Handytastatur
   ist der Dreher der haeufigste Vertipper, und er ist ein Tippfehler und kein
   Wissensfehler: „Bren" statt „Bern" weiss die Antwort, „Bonn" statt „Bern"
   nicht. Ohne die Regel kosteten beide gleich viel, und kurze Antworten fielen
   dadurch in die Bewertung „glatt falsch". */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let vorvor = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (vorvor && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], vorvor[j - 2] + 1);
      }
    }
    vorvor = prev;
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

/* Grammatisches Bindegewebe: darf in einer knappen Eingabe fehlen, ohne dass sich
   die Aussage ändert. Alles andere trägt Bedeutung – auch „Au", „r" oder „XIV",
   die nur ein bis drei Zeichen lang sind und trotzdem die ganze Antwort ausmachen.
   Eine frühere Fassung hielt alles unter drei Zeichen für bedeutungslos; dadurch
   galt „Ag" als richtige Antwort auf die Frage nach dem Symbol für Gold. */
const WEGLASSBAR = new Set([
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'hat', 'haben',
  'man', 'sich', 'sie', 'es', 'auch', 'noch', 'schon', 'nur', 'sehr',
  'etwa', 'rund', 'also', 'dann', 'dass', 'sowie', 'bzw',
]);
const traegtBedeutung = (t) => !WEGLASSBAR.has(t);

/* Zwei Wörter meinen dasselbe, wenn sie sich nur wie ein Tippfehler unterscheiden.
   Kurze Wörter müssen exakt stimmen – „Zinn"/„Zink", „XIV"/„XVI", „Au"/„Ag" liegen
   einen Buchstaben auseinander und meinen etwas völlig anderes. Bei längeren Wörtern
   muss die vordere Hälfte stimmen: im Deutschen sitzt die Unterscheidung vorn
   (intra-/inter-, Impressionismus/Expressionismus, Bundesrats-/Bundestags-). */
/* Genau eine Ausnahme von der Kopfregel: zwei vertauschte Nachbarzeichen. Ein
   Dreher ist ein Tippfehler und laesst die Buchstaben unveraendert – „varusshclacht"
   ist dasselbe Wort wie „varusschlacht". Die Faelle, um die es der Kopfregel geht,
   sind keine Dreher: „intra"/„inter" und „impressionismus"/„expressionismus"
   tauschen nichts, sie ersetzen. Deshalb bleiben sie weiterhin getrennt. */
function nurDreher(x, y) {
  if (x.length !== y.length) return false;
  const ab = [];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) ab.push(i);
  return ab.length === 2 && ab[1] === ab[0] + 1
    && x[ab[0]] === y[ab[1]] && x[ab[1]] === y[ab[0]];
}

function gleichesWort(x, y) {
  if (x === y) return true;
  const lang = Math.max(x.length, y.length);
  if (lang < 5) return false;
  const kopf = Math.max(4, Math.ceil(lang / 2));
  // Der Dreher wird am ganzen Wort geprueft: Er kann genau auf der Kopfgrenze
  // liegen, und dann steckt im Kopf nur seine Haelfte.
  if (x.slice(0, kopf) !== y.slice(0, kopf) && !nurDreher(x, y)) return false;
  return 1 - levenshtein(x, y) / lang >= 0.8;
}

const woerter = (t) => t.split(' ').filter(Boolean);

/* Ordnet jedem Wort der Lösung höchstens ein Wort der Eingabe zu. Die Vielfachheit
   zählt mit: „Knochen mit Knochen" ist nicht „Knochen mit Knorpel", auch wenn
   „Knochen" irgendwo vorkommt. */
function zuordnen(eingabe, loesung) {
  const frei = woerter(eingabe);
  const fehlend = [];
  for (const w of woerter(loesung)) {
    const i = frei.findIndex(v => gleichesWort(v, w));
    if (i >= 0) frei.splice(i, 1); else fehlend.push(w);
  }
  return { fehlend, ueberzaehlig: frei };
}

/* Bei Antworten, deren Sinn an einer Zahl haengt, ist der Editierabstand
   ein schlechtes Mass: „3 Stunden" und „7 Stunden" unterscheiden sich in einem
   von neun Zeichen, „a2 plus b2" und „a2 minus b2" in vieren von elf. */
const OPERATOR = new Set(['plus', 'minus', 'gleich', 'mal', 'geteilt', 'durch', 'hoch', 'wurzel']);
/* Drei dieser acht Woerter - „durch", „mal", „wurzel" - sind zugleich ganz
   gewoehnliche deutsche Woerter. Zaehlten sie immer mit, fiel die natuerliche
   Kurzantwort auf eine Wodurch-Frage hart durch: „Eindampfen" statt „Durch
   Eindampfen" galt nicht als knapp daneben, sondern als falsch. Rechenzeichen
   zaehlen deshalb nur, wo ueberhaupt Zahlen im Spiel sind - genau der Fall,
   fuer den die Regel gedacht war. */
const kennwoerter = (t) => {
  const ws = woerter(t);
  const rechnerisch = ws.some(w => /\d/.test(w));
  return ws.filter(w => /\d/.test(w) || (rechnerisch && OPERATOR.has(w))).sort().join(' ');
};

/** 0..1 – wie nah kommt die Eingabe der Lösung? */
/* Ein nachgestellter Klammerzusatz erlaeutert die Antwort, er ist nicht die
   Antwort: Wer auf „Stickstoff (78 %)" nur „Stickstoff" tippt, hat recht. Solche
   Eingaben werden deshalb auch gegen die Loesung ohne den Zusatz gemessen. */
const OHNE_ZUSATZ = /\s*\([^()]*\)\s*$/;

/* Bewertet eine getippte Eingabe gegen eine ganze Karte statt gegen eine
   einzelne Zeichenkette: Zugelassene Nebenschreibweisen zaehlen mit, und bei
   Karten mit ug (ungeordnet) zaehlt die Reihenfolge nicht.

   Diese Stelle gab es vorher dreimal – in der App, im Test und in jeder Messung.
   Jede Kopie konnte eine Regel verpassen. */
export function bewerte(card, eingabe) {
  const txt = String(eingabe || '').trim();
  if (!txt) return 0;
  const listen = [card.a, ...(card.az || [])];
  let beste = Math.max(...listen.map(l => similarity(txt, l)));
  if (card.ug) beste = Math.max(beste, ...listen.map(l => similarity(sortiert(txt), sortiert(l))));
  return beste;
}

/* Fuer Mengenantworten: normalisieren, in Woerter zerlegen, sortieren. Damit
   ist „Thymin Adenin Guanin Cytosin" dasselbe wie „Adenin, Thymin, Guanin,
   Cytosin" – und zwar unabhaengig davon, ob der Nutzer Kommas tippt. */
const sortiert = (t) => normalize(t).split(' ').filter(Boolean).sort().join(' ');

export function similarity(input, answer) {
  const knapp = String(answer).replace(OHNE_ZUSATZ, '').trim();
  if (knapp && knapp.length >= 3 && knapp !== String(answer).trim()) {
    return Math.max(vergleich(input, answer), vergleich(input, knapp));
  }
  return vergleich(input, answer);
}

function vergleich(input, answer) {
  const a = normalize(input), b = normalize(answer);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const dist = levenshtein(a, b);
  const roh = Math.max(0, 1 - dist / Math.max(a.length, b.length));

  // Eine Verneinung, die in der Lösung nicht vorkommt, dreht die Aussage um.
  const verneint = VERNEINUNG.test(a) && !VERNEINUNG.test(b);
  // Zahlen und Rechenzeichen muessen auf beiden Seiten uebereinstimmen – fehlende
  // wie ueberzaehlige. Sonst galte „−cos(x)" als Antwort auf „cos(x)".
  const kernFalsch = kennwoerter(b) !== kennwoerter(a);
  if (verneint || kernFalsch) return Math.min(roh, 0.5);

  const { fehlend, ueberzaehlig } = zuordnen(a, b);

  // Stehen dieselben Wörter in anderer Reihenfolge, ist es fast immer die
  // vertauschte Aussage: „Upcycling führt Material zurück, Recycling schafft
  // daraus etwas Höherwertiges". Zeichenweise sind das über 90 Prozent
  // Übereinstimmung – inhaltlich das Gegenteil.
  if (!fehlend.length && !ueberzaehlig.length) {
    const wa = woerter(a), wb = woerter(b);
    const gleicheReihenfolge = wa.length === wb.length && wa.every((w, i) => gleichesWort(w, wb[i]));
    return gleicheReihenfolge ? roh : Math.min(roh, 0.6);
  }

  const fehlt = fehlend.filter(traegtBedeutung);
  const extra = ueberzaehlig.filter(w => traegtBedeutung(w) && !KLASSIFIKATOREN.has(w));
  // Bindewörter dürfen fehlen, aber nicht ausgetauscht werden: „mit haben" und
  // „mit werden" unterscheiden sich genau in so einem Wort.
  const bindungGetauscht = fehlend.some(w => !traegtBedeutung(w))
                        && ueberzaehlig.some(w => !traegtBedeutung(w));
  // Wer viel mehr schreibt als die Lösung lang ist, hat nicht dieselbe Antwort gegeben,
  // sondern drumherum geredet – sonst ginge „Bayern ist es nicht, sondern Hessen" durch.
  const zuLang = a.length > b.length * 1.7 + 10;

  // Eine kürzere Eingabe zählt nur, wenn sie nichts Bedeutungstragendes auslässt
  // und nichts Fremdes hinzufügt. Einordnende Wörter wie „Satz" dürfen fehlen.
  if (!zuLang && !extra.length && !bindungGetauscht && fehlt.every(w => KLASSIFIKATOREN.has(w))) {
    if (fehlt.length === 0) return 0.95;
    if (b.includes(a) || a.length >= Math.max(4, b.length * 0.4)) return 0.9;
  }

  // Fehlt ein tragendes Wort der Lösung, ist die Eingabe inhaltlich eine andere
  // Antwort – auch wenn sich die Zeichenketten stark ähneln: „Ludwig XIV." und
  // „Ludwig XVI." unterscheiden nur zwei von zehn Zeichen. Ein zusätzliches Wort
  // wiegt genauso schwer: „zwei Drittel" ist nicht „ein Drittel", und „A oder B"
  // ist nicht „A und B" – gemessen an den Zeichen fehlen dort nur fünf von 29.
  const luecke = bindungGetauscht || extra.length
              || fehlt.some(w => !KLASSIFIKATOREN.has(w));
  return luecke ? Math.min(roh, 0.6) : roh;
}

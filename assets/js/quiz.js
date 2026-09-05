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
  [/[µμ]/g, ' mikro '], [/°/g, ' grad '], [/√/g, ' wurzel '], /* „2·x" und „2x" sind dasselbe Produkt: Zwischen Zahl und Variable ist das
     Malzeichen nur Schreibweise. Zwischen zwei Zahlen oder zwei Variablen
     bleibt es stehen – dort traegt es Bedeutung. */
  [/(\d)\s*[·×*]\s*(?=[a-zäöüß]\b)/gi, '$1 '],
  [/[·×*]/g, ' mal '],
  /* „(a + b)(a − b)": Zwischen zwei Klammern steht ein unsichtbares Malzeichen.
     Wer es mittippt, schrieb sonst ein Wort mehr als die Loesung und fiel damit
     durch die Kennwortpruefung auf 0,50. */
  [/\)\s*\(/g, ' mal '],
  // Rechenzeichen tragen Bedeutung: ohne sie waere „a² − b² = c²" nicht von
  // „a² + b² = c²" zu unterscheiden – die falsche Formel galte als richtig.
  /* Ein getipptes ^2 und ein hochgestelltes ² sind dieselbe Potenz. Vorher wurde
     ² zur Ziffer und ^ zu „hoch" - „3x²" hiess „3x2", getipptes „3x^2" hiess
     „3x hoch 2", und die richtige Ableitung galt als falsch (gemessen 0,33).
     Kein deutsches Tastenfeld hat ein ²; wer eine Potenz tippt, tippt ^. Die
     Hochzahl geht deshalb in dieselbe Form wie ² - die blosse Ziffer - und nur
     ein Exponent, der keine Ziffer ist (e^x), bleibt „hoch". So passt auch
     „km^2" auf „km²". */
  [/\^(\d)/g, '$1'],
  [/\bsqrt\b/gi, ' wurzel '],
  /* Einheitenkuerzel. Sie sind eindeutig - anders als „m" oder „s" allein, die
     in einer Formel die Masse und die Strecke waeren und deshalb hier fehlen.
     Erst HIER, wenn beide Schreibweisen der Hochzahl schon eine Ziffer sind:
     Sonst wurde „km²" zu „kilometer 2" und „km^2" zu „kilometer hoch 2",
     waehrend das getippte „km2" ein „km2" blieb - und die Flaeche Deutschlands
     galt in zwei von drei Schreibweisen als falsch. So endet alles auf „km2". */
  [/\bm\s*\/\s*s\b/gi, ' meter pro sekunde '], [/\bkm\s*\/\s*h\b/gi, ' kilometer pro stunde '],
  [/\bkcal\b/gi, ' kilokalorien '], [/\bkj\b/gi, ' kilojoule '],
  [/\bkg\b/gi, ' kilogramm '], [/\bkm\b/gi, ' kilometer '],
  [/\bcm\b/gi, ' zentimeter '], [/\bmm\b/gi, ' millimeter '],
  [/\bpkt\.?(?=\s|$)/gi, ' punkte '],
  // Das Gradzeichen ist oben schon zu „grad" geworden.
  [/\bgrad\s+c\b/gi, ' grad celsius '],
  /* „8bit" ist „8 Bit". Zwischen Zahl und Wort faellt das Leerzeichen beim
     Tippen oft weg; gesetzt steht es da. Beide Seiten gleich behandeln. */
  [/(\d)(?=[a-zäöüß])/gi, '$1 '],
  /* Zwischen zwei Zahlen ist ein Binde- oder Halbgeviertstrich fast immer eine
     SPANNE, kein Rechenzeichen: „1618-1648", „18,5-24,9". Beide Seiten muessen
     dabei gleich behandelt werden - sonst passt die Antwort nicht mehr auf sich
     selbst, sobald jemand statt des Halbgeviertstrichs den Bindestrich tippt.
     Ohne Leerzeichen, denn genau so schreibt man Spannen; ein Rechenzeichen
     bekommt dagegen fast immer Luft: „b² − 4ac". */
  [/(\d)[-–](?=\d)/g, '$1 bis '],
  /* „+-" und „+/-" sind das getippte ±. Muss vor der Plus-Regel stehen, sonst
     frisst die das Pluszeichen und uebrig bleibt „plus minus" mit Leerzeichen. */
  [/\+\/?-/g, ' plusminus '],
  [/=/g, ' gleich '], [/\+/g, ' plus '], [/−/g, ' minus '], [/\^/g, ' hoch '],
  /* Auch hinter einer oeffnenden Klammer ist ein getipptes "-" ein Vorzeichen:
     „(-b" wurde sonst zu „b", und die Mitternachtsformel in der Fassung, die
     man am Handy tippt, galt als falsch (gemessen 0,50). Die Klammer selbst
     faellt weiter unten ohnehin weg. */
  [/(^|[\s(\[])-(?=\s|$|\d|[a-zäöüß])/gi, ' minus '],
  /* Ein Bindestrich zwischen zwei EINZELNEN Buchstaben oder Ziffern ist ein
     Rechenzeichen: „(a-b)", „a2-b2", „x-3". Zusammengesetzte Woerter sind es
     nicht, und der Unterschied ist die Laenge des Nachbarn: „Nord-Sued",
     „100-Meter-Lauf", „x-Achse", „E-Mail" und „G7-Staaten" haben auf mindestens
     einer Seite ein ganzes Wort und bleiben deshalb unangetastet. Ohne die Regel
     verlor „a^2-b^2" sein Minus komplett - die dritte binomische Formel, so
     getippt wie man sie tippt, galt als falsch (gemessen 0,50). */
  [/(?<![a-zäöü]{2})([a-zäöü]|\d)-(?=\d|[a-zäöü](?![a-zäöü]))/gi, '$1 minus '],
  [/ℕ/g, ' n '], [/ℤ/g, ' z '], [/ℚ/g, ' q '], [/ℝ/g, ' r '], [/ℂ/g, ' c '],
  [/±/g, ' plusminus '], [/[≈~]/g, ' rund '], [/≤/g, ' hoechstens '], [/≥/g, ' mindestens '],
  [/∞/g, ' unendlich '], [/€/g, ' euro '], [/%/g, ' prozent '], [/&/g, ' und '],
  [/[–—]/g, ' '],
  // Der Ableitungsstrich traegt Bedeutung: ohne ihn waere die Produktregel
  // „u' · v + u · v'" nicht von „u · v + u' · v'" zu unterscheiden.
  [/[’´`'′]/g, ' strich '],
  // é, à, ç und ñ standen hier einmal einzeln. Sie erledigt jetzt die
  // Zerlegung in normalize() zusammen mit allen anderen Diakritika - eine
  // Liste von Hand haette immer nur die Zeichen gekannt, an die jemand dachte.
];
// „den", „einer", „eines" fehlten: „Grand Canyon" galt deshalb nicht als Antwort
// auf eine Karte, deren Loesung „Den Grand Canyon" lautet.
/* Abkuerzungen, die man am Handy tippt. Sie stehen hier und nicht in einer
   Ersetzung nach dem Normalisieren, weil der Punkt sie erst erkennbar macht -
   nach dem Wegwerfen der Satzzeichen ist „u." von einem „u" als Variable nicht
   mehr zu unterscheiden.

   Die Liste muss nicht sprachlich richtig sein, sondern auf BEIDEN Seiten
   gleich wirken: normalize() laeuft ueber die Loesung genauso wie ueber die
   Eingabe. „v." als „von" zu lesen waere in „753 v. Chr." falsch - aber weil
   dort zuerst die Regel fuer „v. Chr." greift, entsteht kein Schaden, und in
   „Vertrag v. Verdun" trifft sie zu. Mehrteiliges deshalb zuerst. */
const MONATE = ['januar', 'februar', 'maerz', 'april', 'mai', 'juni', 'juli',
  'august', 'september', 'oktober', 'november', 'dezember'];

const ABKUERZUNGEN = [
  /* „9.11.1989" ist dasselbe Datum wie „9. November 1989". Muss vor allem
     anderen stehen, damit der Tausenderpunkt weiter unten nicht zuerst
     hineingreift. */
  [/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/g,
    (ganz, tag, monat, jahr) => MONATE[+monat - 1] ? ` ${+tag} ${MONATE[+monat - 1]} ${jahr} ` : ganz],
  [/\bv\.?\s*chr\.?/gi, ' vor christus '], [/\bn\.?\s*chr\.?/gi, ' nach christus '],
  [/\bz\.\s*b\./gi, ' zum beispiel '], [/\bd\.\s*h\./gi, ' das heisst '],
  [/\bu\.\s*a\./gi, ' unter anderem '], [/\bu\.\s*ae\./gi, ' und aehnliches '],
  [/\bmrd\.?(?=\s|$)/gi, ' milliarden '], [/\bmio\.?(?=\s|$)/gi, ' millionen '],
  [/\bjh\.(?=\s|$)/gi, ' jahrhundert '], [/\bjt\.(?=\s|$)/gi, ' jahrtausend '],
  [/\bjhd?\.(?=\s|$)/gi, ' jahrhundert '], [/\bnr\.(?=\s|$)/gi, ' nummer '],
  [/\bzw\.(?=\s|$)/gi, ' zwischen '], [/\bwg\.(?=\s|$)/gi, ' wegen '],
  [/\bggf\.(?=\s|$)/gi, ' gegebenenfalls '], [/\bevtl\.(?=\s|$)/gi, ' eventuell '],
  [/\binkl\.(?=\s|$)/gi, ' inklusive '], [/\bexkl\.(?=\s|$)/gi, ' exklusive '],
  [/\bmind\.(?=\s|$)/gi, ' mindestens '], [/\bmax\.(?=\s|$)/gi, ' maximal '],
  [/\bca\.(?=\s|$)/gi, ' etwa '], [/\busw\.(?=\s|$)/gi, ' und so weiter '],
  /* Einbuchstabige Kuerzel ganz zum Schluss: „u." nach „u. a.", sonst bliebe
     dort ein „und a" stehen. Alle vier stehen fuer Fuellwoerter und fallen
     unten in FUELLWOERTER ohnehin weg - sie muessen nur aufhoeren, als
     ueberzaehliges Wort zu zaehlen. */
  [/\bu\.(?=\s|$)/gi, ' und '], [/\bv\.(?=\s|$)/gi, ' von '],
  [/\bd\.(?=\s|$)/gi, ' der '], [/\bz\.(?=\s|$)/gi, ' zu '],
];

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
  /* Der Schlusspunkt eines Satzes ist keine Abkuerzung. Er faellt weiter unten
     mit allen Satzzeichen ohnehin weg - nur muss er VOR der Kuerzelliste weg
     sein, sonst las die „VO₂max." als „VO₂ maximal" und „Vitamin D." als
     „Vitamin der". Nur genau einer, damit „753 v. Chr." seinen behaelt. */
  t = t.replace(/\.\s*$/, '');
  for (const [re, ersatz] of ABKUERZUNGEN) t = t.replace(re, ersatz);
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
export const OHNE_ZUSATZ = /\s+\([^()]*\)\s*$/;

/* Dasselbe gilt fuer ein einleitendes Verhaeltniswort. „Woraus wird Tofu
   hergestellt?" hat die Loesung „Aus Sojabohnen" – wer „Sojabohnen" tippt, hat
   recht und bekam trotzdem nur 0,60. Artikel erledigt schon FUELLWOERTER, die
   Verhaeltniswoerter fehlten dort; gemessen waren davon 75 Karten betroffen.

   Warum hier und nicht in FUELLWOERTER: Dort wuerde das Wort ueberall im Satz
   verschwinden, auch in der Eingabe. „Vor Christus" und „Nach Christus" waeren
   dann dasselbe. Hier faellt nur das ERSTE Wort der Loesung weg, und auch das
   nur als zusaetzliche Vergleichsfassung – die volle Loesung zaehlt weiter. */
/* „A = π · r²": Der Kopf benennt die Groesse, die Formel ist die Antwort. Wer
   „π·r²" tippt, hat die Kreisflaeche gewusst - und bekam 0,50. Nur ein bis zwei
   Buchstaben vor dem Gleichheitszeichen zaehlen als Kopf; „x = (−b ± …)/(2a)"
   verliert dadurch nichts, denn die Loesungsformel ohne „x =" ist dieselbe. */
export const OHNE_FORMELKOPF = /^[A-Za-z]{1,2}\s*=\s*(?=\S)/;
export const OHNE_VORWORT = /^(aus|an|am|auf|bei|beim|mit|nach|seit|über|um|unter|vor|für|gegen|durch|ohne|hinter|neben|zwischen|entlang|gegenüber)\s+/i;

/* Bewertet eine getippte Eingabe gegen eine ganze Karte statt gegen eine
   einzelne Zeichenkette: Zugelassene Nebenschreibweisen zaehlen mit, und bei
   Karten mit ug (ungeordnet) zaehlt die Reihenfolge nicht.

   Diese Stelle gab es vorher dreimal – in der App, im Test und in jeder Messung.
   Jede Kopie konnte eine Regel verpassen. */
/* ---------- Der Nachname allein ---------- */

/* Auf „Wer schrieb den Faust?" antwortet man „Goethe" und nicht „Johann
   Wolfgang von Goethe". Bei einer Personenfrage ist der Nachname die Antwort.

   Verlockend waere die allgemeine Regel „das letzte Wort einer Antwort aus
   lauter grossgeschriebenen Woertern zaehlt". Gemessen ist sie unbrauchbar: Sie
   traefe auf 659 Karten zu und wuerde 86 Ablenker des Bestands durchwinken -
   „Rechter Winkel" fuer „Stumpfer Winkel", „Das Rote Meer" fuer „Das Tote
   Meer", „Fuenf Jahre" fuer „Vier Jahre". Im Deutschen steht die Unterscheidung
   vorn, genau wie es die Kopfregel in gleichesWort() sagt.

   Es braucht also drei Bedingungen zugleich, und uebrig bleiben 185 Karten:
   die Frage fragt nach einer Person, die Antwort hat die Gestalt eines Namens,
   und der Nachname ist eindeutig - weder trennt er die Karte von einem ihrer
   eigenen Ablenker noch steht er im Bestand fuer zwei verschiedene Menschen
   („Alexander Fleming" und „Ian Fleming", „Gerd Mueller" und „Herta Mueller"). */
const NAMENSPARTIKEL = new Set(['von', 'van', 'de', 'del', 'della', 'di', 'du',
  'la', 'le', 'dos', 'da', 'den', 'ter', 'ibn', 'al', 'zu']);
const ROEMISCHE_ZAHL = /^[IVXLCDM]+\.?$/;
/* „Wer …?" ist der klare Fall. Daneben fragt die Sammlung oft ueber die
   Rolle - und dann stehen bis zu zwei Eigenschaftswoerter dazwischen:
   „Welche BRITISCHE PREMIERMINISTERIN …", „Welcher DEUTSCHE AUTOR …". Ohne die
   Luecke im Muster fiel „Thatcher" durch. */
const ROLLEN = ['autor', 'dichter', 'komponist', 'maler', 'forscher', 'wissenschaftler',
  'erfinder', 'philosoph', 'regisseur', 'schriftsteller', 'physiker', 'mathematiker',
  'trainer', 'spieler', 'kanzler', 'praesident', 'präsident', 'premierminister',
  'politiker', 'herrscher', 'feldherr', 'unternehmer', 'astronaut', 'entdecker',
  'sportler', 'musiker', 'saenger', 'sänger', 'bildhauer', 'architekt', 'denker',
  'kuenstler', 'künstler', 'nobelpreistraeger', 'nobelpreisträger', 'dramatiker',
  'lyriker', 'journalist', 'moderator', 'dirigent', 'pianist', 'psychologe',
  'paedagoge', 'pädagoge', 'biologe', 'chemiker', 'mediziner', 'reformator'];
const PERSONENFRAGE = new RegExp(
  `\\bwer\\b|\\bwelche[rsm]?\\s+(?:[a-zäöüß]+\\s+){0,2}(?:${ROLLEN.join('|')})(in|innen|s|en)?\\b`, 'i');
const letztesWort = (t) => String(t).trim().split(/\s+/).pop().replace(/[.,;:]+$/, '');

/* Die Gestalt eines Namens: zwei bis fuenf grossgeschriebene Woerter, dazwischen
   hoechstens ein Partikel wie „von". Keine Ziffern (dann ist es eine Jahres-
   oder Mengenangabe), keine roemische Zahl (sonst waere „Heinrich" die Antwort
   auf jeden Heinrich), kein Komma (das ist eine Aufzaehlung und kein Name) und
   kein Artikel am Anfang (dann traegt schon FUELLWOERTER den Rest). */
function namensform(a) {
  const t = String(a).trim();
  if (/[,\d]/.test(t)) return null;
  const w = t.split(/\s+/);
  if (w.length < 2 || w.length > 5) return null;
  if (/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer)$/i.test(w[0])) return null;
  for (const teil of w) {
    if (NAMENSPARTIKEL.has(teil.toLowerCase())) continue;
    if (ROEMISCHE_ZAHL.test(teil)) return null;
    if (!/^[A-ZÄÖÜ]/.test(teil)) return null;
  }
  const letzt = letztesWort(t);
  return letzt.length >= 3 && !NAMENSPARTIKEL.has(letzt.toLowerCase()) ? letzt : null;
}

/* Gezaehlt wird ueber die Antworten des Bestands, nicht ueber die Ablenker: Ein
   erfundener Ablenker wie „Americus Magellan" ist kein zweiter Magellan und
   duerfte die Kurzform nicht sperren. Die eigenen Ablenker der Karte pruefen
   wir stattdessen einzeln - dort ist der Vorname ja gerade der Pruefstein. */
let mehrdeutig = null;
function mehrdeutigeNachnamen() {
  if (mehrdeutig) return mehrdeutig;
  const nach = new Map();
  /* Ueber ALLE Antworten, nicht nur die namensfoermigen: „Muenchen" ist die
     Antwort einer eigenen Karte, und deshalb darf es nicht zugleich die
     Kurzform von „Bayern Muenchen" sein - eine Stadt ist kein Verein. */
  for (const c of CARDS) {
    const k = letztesWort(c.a).toLowerCase();
    if (k.length < 3) continue;
    if (!nach.has(k)) nach.set(k, new Set());
    nach.get(k).add(String(c.a).trim());
  }
  mehrdeutig = new Set([...nach].filter(([, s]) => s.size > 1).map(([k]) => k));
  return mehrdeutig;
}

export function nachnameAllein(card) {
  if (!card || !card.q || !PERSONENFRAGE.test(card.q)) return null;
  const n = namensform(card.a);
  if (!n) return null;
  const k = n.toLowerCase();
  if (mehrdeutigeNachnamen().has(k)) return null;
  for (const w of card.w || []) if (letztesWort(w).toLowerCase() === k) return null;
  return n;
}

export function bewerte(card, eingabe) {
  const txt = String(eingabe || '').trim();
  if (!txt) return 0;
  const kurz = nachnameAllein(card);
  const listen = [card.a, ...(card.az || []), ...(kurz ? [kurz] : [])];
  let beste = Math.max(...listen.map(l => similarity(txt, l, card.q)));
  if (card.ug) beste = Math.max(beste, ...listen.map(l => similarity(sortiert(txt), sortiert(l), card.q)));
  return beste;
}

/* Fuer Mengenantworten: normalisieren, in Woerter zerlegen, sortieren. Damit
   ist „Thymin Adenin Guanin Cytosin" dasselbe wie „Adenin, Thymin, Guanin,
   Cytosin" – und zwar unabhaengig davon, ob der Nutzer Kommas tippt. */
const sortiert = (t) => normalize(t).split(' ').filter(Boolean).sort().join(' ');

/* Ein Bindestrich zwischen zwei Ziffern ist echt mehrdeutig: „1618-1648" ist
   eine Spanne, „b^2-4ac" eine Differenz. Beim Tippen sieht beides gleich aus,
   und keine Regel kann von aussen entscheiden, was gemeint war. Statt zu raten
   liest der Vergleich die Eingabe zweimal - einmal als Spanne (so steht es in
   ZEICHEN), einmal als Rechenzeichen - und nimmt die bessere Lesart. Eine
   zusaetzliche Lesart kann eine Bewertung nur anheben; dass dadurch nichts
   Falsches durchgeht, sichern die Gegenproben in check-content.mjs ab. */
const SPANNE = /(\d)[-–](?=\d)/;

/* Am Handy kuerzt man ab, wo es gerade passt: „unterschiedl. Hebelarme",
   „syst. Fehler", „Distributivges.". Eine feste Liste kann das nicht fangen,
   denn abgekuerzt wird nach Bequemlichkeit und nicht nach Duden.

   Aufgeloest wird deshalb am einzigen Kontext, der zur Verfuegung steht: an der
   Loesung selbst. Steht dort ein laengeres Wort, das mit dem abgekuerzten Stamm
   beginnt, war es gemeint. Das kann keine Uebereinstimmung erfinden - der volle
   Wortlaut muss in der Loesung schon vorhanden sein -, und es bleibt streng
   genug, weil mindestens drei Buchstaben stehen bleiben muessen. Bei einem
   einzelnen Buchstaben waere „B." auf eine Loesung mit „Bundesrat" ein Treffer,
   und damit haette ein Tastendruck die Antwort ersetzt. */
const KUERZEL = /\b([a-zäöüß]{3,})\.(?![a-zäöüß])/gi;
function aufgeloest(eingabe, antwort) {
  const t = String(eingabe);
  if (!/[a-zäöüß]{3,}\./i.test(t)) return null;
  const vokabular = String(antwort).split(/[^a-zäöüßA-ZÄÖÜ]+/).filter(Boolean);
  let getroffen = false;
  const out = t.replace(KUERZEL, (ganz, stamm) => {
    /* Roemische Zahlen sehen aus wie abgekuerzte Woerter und stehen mit Punkt:
       „Heinrich VII." Als Kuerzel gelesen waere „VII." ein Anfang von „VIII" -
       und der falsche Heinrich galt als richtige Antwort (gemessen 1,00). */
    if (/^[ivxlcdm]+$/i.test(stamm)) return ganz;
    const wort = vokabular.find(w => w.length > stamm.length
      && w.toLowerCase().startsWith(stamm.toLowerCase()));
    if (!wort) return ganz;
    getroffen = true;
    return wort;
  });
  return getroffen ? out : null;
}

/* Ein nachgestellter Klammerzusatz darf in der LOESUNG fehlen (OHNE_ZUSATZ) –
   umgekehrt gilt dasselbe: Wer „Scherbengericht (Ostrakismos)" tippt, hat die
   Antwort gewusst und den zweiten Namen dazugeschrieben. */
const ZUSATZ_GETIPPT = /\s+\([^()]*\)\s*$/;

/* Alle Lesarten einer Eingabe. Eine zusaetzliche Lesart kann eine Bewertung nur
   anheben; dass dadurch nichts Falsches durchgeht, sichern die Gegenproben in
   check-content.mjs ab. */
function lesarten(eingabe, antwort) {
  const menge = new Set([String(eingabe)]);
  for (const t of [...menge]) {
    /* Ein Bindestrich zwischen zwei Ziffern ist echt mehrdeutig: „1618-1648"
       ist eine Spanne, „b^2-4ac" eine Differenz. Beim Tippen sieht beides
       gleich aus, und keine Regel kann von aussen entscheiden, was gemeint war.
       Statt zu raten wird beides gelesen und die bessere Lesart genommen. */
    if (SPANNE.test(t)) menge.add(t.replace(new RegExp(SPANNE, 'g'), '$1 − '));
  }
  for (const t of [...menge]) {
    const ohne = t.replace(ZUSATZ_GETIPPT, '').trim();
    /* Nur wenn die Loesung selbst keinen Klammerzusatz hat. Sonst faellt die
       Klammer auf BEIDEN Seiten weg und es vergleichen sich zwei Ruempfe:
       „3 · (2x + 9)" wurde so zur richtigen Antwort auf „3 · (2x + 3)". Und was
       stehen bleibt, muss noch ein Wort sein - „3 ·" ist keines. */
    if (ohne.length >= 3 && ohne !== t
        && !ZUSATZ_GETIPPT.test(antwort) && /[a-zäöüß]{3}/i.test(ohne)) menge.add(ohne);
    const lang = aufgeloest(t, antwort);
    if (lang) menge.add(lang);
  }
  return [...menge];
}

/* Woerter, die schon in der Frage stehen, wiederholt beim Antworten niemand.
   Auf „Wie viele Runden hat ein 5000-Meter-Lauf?" tippt man „12,5" und nicht
   „12,5 Runden" – und bekam dafuer 0,36. Sie duerfen deshalb in der Eingabe
   fehlen, so wie einordnende Woerter („Satz des Pythagoras") es schon durften.

   Fehlen duerfen sie, mehr nicht: Ein ueberzaehliges Wort wiegt unveraendert
   schwer. Wer auf „Was ist schwerer, Blei oder Eisen?" das falsche der beiden
   tippt, hat weiterhin ein Wort zu viel und ein Wort zu wenig. */
/* Nur richtige Woerter, keine Formelzeichen: In „log(a) + log(b)" stehen „a",
   „b" und „log" auch in der Frage, und durften sie fehlen, galt „log(a + b)"
   als richtig (gemessen 0,95). Vier Buchstaben, keine Ziffern - damit bleibt
   die Regel bei dem, wofuer sie gedacht ist: dem wiederholten Hauptwort. */
const ausDerFrage = (frage) => new Set(
  (frage ? woerter(normalize(frage)) : []).filter(w => /^[a-zäöü]{4,}$/.test(w)));

export function similarity(input, answer, frage) {
  const voll = String(answer).trim();
  const fassungen = new Set([voll]);
  for (const f of [voll, voll.replace(OHNE_ZUSATZ, '').trim()]) {
    if (f.length >= 3) fassungen.add(f);
    const kurz = f.replace(OHNE_VORWORT, '').trim();
    if (kurz.length >= 3) fassungen.add(kurz);
    const formel = f.replace(OHNE_FORMELKOPF, '').trim();
    if (formel !== f && formel.length >= 3) fassungen.add(formel);
  }
  const eingaben = lesarten(input, voll);
  const bekannt = ausDerFrage(frage);
  return Math.max(...[...fassungen].flatMap(f => eingaben.map(e => vergleich(e, f, bekannt))));
}

/* „ein" und „eine" sind im Deutschen beides zugleich: der unbestimmte Artikel
   und die Zahl. Als Artikel wirft FUELLWOERTER sie weg, eine getippte „1" blieb
   dagegen stehen und galt dann als abweichende Zahl – „Nicht alles auf 1 Karte
   setzen" fiel auf 0,50.

   Weggelassen wird die einzelne Eins deshalb nur, wenn auf der anderen Seite
   ueberhaupt keine Zahl steht. Genau dann kann sie kein Zahlwert sein. Ohne
   diese Einschraenkung galt „e^π + i = 0" als Eulersche Identitaet und „Etwa
   5 Liter" als „Etwa 1,5 Liter" – dort ist die Eins die Vorkommastelle. */
const ohneEinzelneEins = (t) => woerter(t).filter(w => w !== '1').join(' ');

function vergleich(input, answer, bekannt = new Set()) {
  let a = normalize(input), b = normalize(answer);
  if (!a || !b) return 0;
  /* Und nur ausserhalb einer Formel: In „y = 1/(mx + b)" steht die Eins im
     Zaehler und nicht vor einem Hauptwort. Weil dort sonst keine Ziffer
     vorkommt, waere sie sonst weggefallen und der Ablenker haette 1,00
     bekommen. Rechenzeichen auf einer der beiden Seiten genuegen als Hinweis;
     dass „durch" und „mal" auch gewoehnliche Woerter sind, schadet hier nicht -
     sie machen die Regel nur vorsichtiger. */
  const formel = [a, b].some(t => woerter(t).some(w => OPERATOR.has(w)));
  const zahlLinks = /\d/.test(a), zahlRechts = /\d/.test(b);
  if (!formel && !zahlRechts) a = ohneEinzelneEins(a);
  if (!formel && !zahlLinks) b = ohneEinzelneEins(b);
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

  const fehlt = fehlend.filter(w => traegtBedeutung(w) && !bekannt.has(w));
  const extra = ueberzaehlig.filter(w => traegtBedeutung(w) && !KLASSIFIKATOREN.has(w));
  // Bindewörter dürfen fehlen, aber nicht ausgetauscht werden: „mit haben" und
  // „mit werden" unterscheiden sich genau in so einem Wort.
  const bindungGetauscht = fehlend.some(w => !traegtBedeutung(w))
                        && ueberzaehlig.some(w => !traegtBedeutung(w));
  // Wer viel mehr schreibt als die Lösung lang ist, hat nicht dieselbe Antwort gegeben,
  // sondern drumherum geredet – sonst ginge „Bayern ist es nicht, sondern Hessen" durch.
  const zuLang = a.length > b.length * 1.7 + 10;

  // Beide Filter zusammen konnten eine Uebereinstimmung aus dem Nichts erzeugen:
  // Getippt „Lehre" gegen die Loesung „Mit werden" fiel links als Klassifikator
  // weg und rechts als Bindewort - uebrig blieb auf beiden Seiten nichts, und
  // die Abkuerzung unten meldete trotzdem 0,95. Gemessen galten so zehn
  // Unsinnseingaben auf „Nur eine" als richtig. Eine Abkuerzung braucht einen
  // Beleg: Mindestens ein getipptes Wort muss in der Loesung wiedergefunden
  // worden sein. „Pythagoras" auf „Satz des Pythagoras" erfuellt das, „Lehre"
  // auf „Mit werden" nicht.
  const etwasErkannt = ueberzaehlig.length < woerter(a).length;

  // Eine kürzere Eingabe zählt nur, wenn sie nichts Bedeutungstragendes auslässt
  // und nichts Fremdes hinzufügt. Einordnende Wörter wie „Satz" dürfen fehlen.
  if (etwasErkannt && !zuLang && !extra.length && !bindungGetauscht && fehlt.every(w => KLASSIFIKATOREN.has(w))) {
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

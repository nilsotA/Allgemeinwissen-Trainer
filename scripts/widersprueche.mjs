/* Zwei Karten, die dieselbe Groesse verschieden beziffern - und Karten, deren
   Antwort mit der Zeit falsch wird.

   Aufruf: npm run widersprueche

   Der eine bekannte Widerspruch (Kreatinphosphat-Speicher: „6 bis 10 Sekunden"
   gegen „10 bis 20 Sekunden") wurde beim Gegenlesen von Hand gefunden. Seither
   sind Hunderte Karten dazugekommen, und niemand liest den Bestand noch einmal
   paarweise durch.

   Die erste Fassung dieser Sonde fand nichts - und das war wertlos, denn sie
   fand auch den bekannten Fall nicht, als er zum Gegenbeweis wieder eingebaut
   wurde. Zwei Fehler: Sie verlangte ZWEI gemeinsame seltene Woerter (der Fall
   teilt nur „kreatinphosphat", das dafuer in genau zwei Karten steht), und sie
   sprang ab, sobald die Antworten EINE Zahl gemeinsam hatten - „6 bis 10"
   gegen „10 bis 20" ist genau so ein Fall.

   Damit das nicht wieder unbemerkt passiert, prueft das Werkzeug sich selbst:
   Es haengt ein erfundenes Widerspruchspaar an den Bestand und faellt durch,
   wenn es das nicht unter die ersten Zehn bringt. Ein Bericht, der nichts
   findet, ist erst dann eine Aussage. */
import { CARDS } from '../data/index.js';
import { normalize } from '../assets/js/quiz.js';

const STOPP = new Set(('der die das den dem des ein eine einer eines einem einen und oder aber '
 + 'ist sind war waren wird werden wurde wurden hat haben hatte kann koennen man sich '
 + 'in im am an auf aus bei bis fuer mit nach von vor zu zum zur ueber unter zwischen als wie '
 + 'was welche welcher welches wer wo wann warum wieviel viel viele wieviele nicht kein keine '
 + 'sie er es ich du wir ihr sein seine ihre dessen deren dieser diese dieses so dass durch '
 + 'gibt heisst nennt bezeichnet beschreibt bedeutet steht liegt gilt etwa rund '
 + 'jahr jahre jahren mehr weniger etwas alle beim ohne gegen um her hin noch nur schon auch '
 + 'welchen welchem lange lang hoch hohe soll sollte lautet').split(' '));

const woerter = (t) => normalize(t).split(' ')
  .filter(w => w.length >= 4 && !STOPP.has(w) && !/^\d+$/.test(w));

/* Zahlen deutsch gelesen: Tausenderpunkt weg, Komma als Dezimaltrenner. Als
   MENGE verglichen, nicht auf Ueberschneidung geprueft - sonst faellt genau
   der Fall durch, bei dem zwei Bereiche sich an einem Wert beruehren. */
const zahlen = (t) => {
  const roh = String(t).match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) || [];
  return [...new Set(roh.map(s => parseFloat(s.replace(/\./g, '').replace(',', '.'))))].sort((a, b) => a - b);
};

/* Die Woerter einer Antwort ohne ihre Zahlen. Zwei Antworten, die dieselbe
   EINHEIT tragen („Sekunden", „Prozent", „Grad"), reden mit hoher
   Wahrscheinlichkeit ueber dieselbe Groesse - „776 v. Chr." und „1896 in
   Athen" tun das nicht. Ohne dieses zweite Signal traegt ein Paar, das nur ein
   einziges seltenes Wort teilt, zu wenig Gewicht, um oben zu landen: genau der
   bekannte Fall. */
const einheit = (t) => new Set(normalize(String(t).replace(/[\d.,]+/g, ' ')).split(' ').filter(w => w.length >= 3));

/* Ein erfundenes Paar, an dem sich das Werkzeug misst. Es ist dem bekannten
   Fall nachgebaut und faellt genau in dessen beide Fallen: Die Fragen teilen
   NUR das erfundene Wort (die erste Fassung verlangte zwei), und die Antworten
   haben die 10 gemeinsam (die erste Fassung sprang dann ab). */
const PROBE = [
  { id: 'probe-1', cat: 'xxx', sub: 'Probe', q: 'Wie lange haelt ein Flunkerphosphat?', a: 'Etwa 6 bis 10 Sekunden', t: '' },
  { id: 'probe-2', cat: 'xxx', sub: 'Probe', q: 'Wie viele Sekunden dauert ein Flunkerphosphat?', a: 'Etwa 10 bis 20 Sekunden', t: '' },
];

function suche(bestand) {
  const N = bestand.length;
  const df = new Map();
  /* Nur die FRAGE, nicht der Kontexttext: Der nennt oft Nachbarthemen und
     verwaessert die Marken. */
  const tok = bestand.map(c => {
    const w = new Set(woerter(c.q));
    for (const x of w) df.set(x, (df.get(x) || 0) + 1);
    return w;
  });
  const gruppen = new Map();
  bestand.forEach((c, i) => {
    for (const w of tok[i]) {
      // Einmalige Woerter verbinden nichts, haeufige verbinden alles.
      if (df.get(w) < 2 || df.get(w) > 20) continue;
      if (!gruppen.has(w)) gruppen.set(w, []);
      gruppen.get(w).push(i);
    }
  });
  const paare = new Map();
  for (const [w, idx] of gruppen) {
    const g = Math.log(N / df.get(w));          // seltener zaehlt schwerer
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
      const k = idx[a] + ':' + idx[b];
      if (!paare.has(k)) paare.set(k, { A: bestand[idx[a]], B: bestand[idx[b]], marken: [], punkte: 0 });
      const e = paare.get(k);
      e.marken.push(w); e.punkte += g;
    }
  }
  const funde = [];
  for (const p of paare.values()) {
    const za = zahlen(p.A.a), zb = zahlen(p.B.a);
    if (!za.length || !zb.length) continue;
    if (za.length === zb.length && za.every((x, k) => x === zb[k])) continue;
    const ea = einheit(p.A.a), eb = einheit(p.B.a);
    const gleich = [...ea].filter(w => eb.has(w));
    /* Je Einheitswort so viel wie ein mittelseltenes Frageword. Ohne Deckel
       zoege eine lange gemeinsame Formulierung das Paar sonst nach oben. */
    const bonus = Math.min(3, gleich.length) * 4;
    funde.push({ ...p, za, zb, einheiten: gleich, punkte: p.punkte + bonus });
  }
  return { funde: funde.sort((a, b) => b.punkte - a.punkte), paare: paare.size };
}

/* ---- Selbstprobe ---- */
const mitProbe = suche([...CARDS, ...PROBE]);
const rang = mitProbe.funde.findIndex(f => f.A.cat === 'xxx' && f.B.cat === 'xxx');
if (rang < 0 || rang >= 10) {
  console.error('Selbstprobe fehlgeschlagen: Das erfundene Widerspruchspaar landet '
    + (rang < 0 ? 'gar nicht in der Liste' : `erst auf Platz ${rang + 1}`)
    + ' – dieser Bericht kann nichts finden und darf nicht als „nichts gefunden" gelesen werden.');
  process.exit(1);
}

/* ---- Der wirkliche Bericht ---- */
const { funde, paare } = suche(CARDS);
const ZEIGE = Number(process.env.ZEIGE || 25);
console.log(`Selbstprobe bestanden: das erfundene Paar steht auf Platz ${rang + 1}.\n`);
console.log(`${paare} Kartenpaare teilen ein seltenes Wort, ${funde.length} davon nennen`
  + ` verschiedene Zahlen. Die ${Math.min(ZEIGE, funde.length)} auffaelligsten:\n`);
for (const f of funde.slice(0, ZEIGE)) {
  console.log(`[${f.punkte.toFixed(1)}] ${f.marken.slice(0, 5).join(', ')}`
    + (f.einheiten.length ? ` · gleiche Einheit: ${f.einheiten.slice(0, 3).join(', ')}` : ''));
  console.log(`   ${f.A.cat}/${f.A.sub}: ${f.A.q.slice(0, 70)}`);
  console.log(`      -> ${f.A.a.slice(0, 55)}`);
  console.log(`   ${f.B.cat}/${f.B.sub}: ${f.B.q.slice(0, 70)}`);
  console.log(`      -> ${f.B.a.slice(0, 55)}\n`);
}

/* ---- Zweiter Bericht: was mit der Zeit falsch wird ---- */
/* „Naechste" taugt nur im ZEITLICHEN Sinn als Warnzeichen. Ohne diese
   Einschraenkung stand „Welcher Planet ist der Sonne am naechsten?" in der
   Liste, dazu die naechste Galaxie, der naechste Reiz im Training und das
   naechste Leben im Karma - sechs von neunzehn Zeilen waren Unsinn, und eine
   Liste mit einem Drittel Unsinn liest beim dritten Mal niemand mehr. */
const ZEITWORT = new RegExp(
  '\\baktuell|\\bderzeit|\\bmomentan|\\bzurzeit|\\bamtierend'
  + '|Weltrekord|Rekord(?:sieger|meister|weltmeister|nationalspieler|halter)\\b'
  + '|\\bden Rekord\\b|\\bden Weltrekord\\b'
  + '|n[äa]chste[nrs]?\\s+(?:Olympisch\\w*|Sommerspiele|Winterspiele|Wahl|Saison'
  + '|Weltmeisterschaft|Jahr\\w*|Monat\\w*|Woche\\w*)', 'i');
const zeitlich = CARDS.filter(c => ZEITWORT.test(c.q) || ZEITWORT.test(c.a));
console.log(`\n--- Karten, deren Antwort mit der Zeit falsch werden kann: ${zeitlich.length} ---`);
console.log('Die App hat keinen Server und kann nichts nachladen; diese Karten altern still.\n');
for (const c of zeitlich) {
  console.log(`  [${c.cat}/${c.sub}] ${c.q.slice(0, 68)}`);
  console.log(`      -> ${c.a.slice(0, 55)}`);
}

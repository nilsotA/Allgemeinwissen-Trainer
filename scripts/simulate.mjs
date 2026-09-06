/* Simuliert Nutzung ueber ein halbes Jahr, um Arbeitslast, Rueckstand und
   Behaltensquote zu pruefen. Treibt bewusst den ECHTEN Code: den Scheduler aus
   srs.js, die Warteschlangen aus session.js und den Speicher aus store.js.
   Eine nachgebaute Simulation prueft sonst nur sich selbst - die Bremse gegen den
   Rueckstau etwa kam in der frueheren Fassung ueberhaupt nicht vor.

   Aufruf:  node scripts/simulate.mjs [--tage 180] [--neu 12] [--deckel 90] [--pausen] [--saat 20260105]
            --pausen legt zwei Abwesenheiten von je zwei Wochen ein. */

const RealDate = Date;
let NOW = RealDate.UTC(2026, 0, 5, 9, 0, 0);
globalThis.Date = class extends RealDate {
  constructor(...a) { super(...(a.length ? a : [NOW])); }
  static now() { return NOW; }
};
const speicher = new Map();
globalThis.localStorage = {
  getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k),
};

/* Ein eigener Zufall mit fester Saat statt Math.random(). Die Simulation ist
   ein Messgeraet, und zwei Laeufe gaben bisher verschiedene Antworten: 132 und
   138 Spitzenlast, 1584 und 1632 angefangene Karten. Das README nannte davon
   einen Lauf als Tatsache. Wer eine Zahl mit einer frueheren vergleichen will,
   braucht denselben Wuerfel - genauso, wie die Pruefsaetze eingefroren sind.

   Mit --saat laesst sich der Wuerfel wechseln; mehrere Saaten zeigen, wie weit
   die Zahlen streuen, und genau das gehoert ins README statt einer Nachkomma-
   genauigkeit, die es nicht gibt. Der Algorithmus ist mulberry32: klein,
   nachlesbar, und ohne Abhaengigkeit. */
const argZahl = (name, standard) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : standard;
};
const SAAT = argZahl('saat', 20260105);
const wuerfel = (() => {
  let a = SAAT >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

/* Auch der Wuerfel der App wird ersetzt, nicht nur der dieser Datei: Der
   Scheduler streut die Intervalle (srs.js) und die Optionen werden gemischt
   (quiz.js). Beides laeuft ueber Math.random, und ohne diese Zeile blieb die
   Simulation trotz fester Saat von Lauf zu Lauf verschieden - gemessen 143 und
   135 Spitzenlast. Muss vor den Importen weiter unten stehen. */
Math.random = wuerfel;

const arg = (name, standard) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : standard;
};
const TAGE = arg('tage', 180);
const NEU = arg('neu', 12);
const DECKEL = arg('deckel', 90);
const PAUSEN = process.argv.includes('--pausen') ? [[45, 58], [110, 123]] : [];

const store = await import('../assets/js/store.js');
const sess = await import('../assets/js/session.js');
const { schedule, strength, fresh, AGAIN, HARD, GOOD, EASY } = await import('../assets/js/srs.js');
const { CARDS } = await import('../data/index.js');

store.setSetting('newPerDay', NEU);
store.setSetting('maxReviews', DECKEL);

/* Wie gut erinnert sich die Person? Grob an der Vergessenskurve orientiert. */
function abruf(cs, t) {
  if (!cs || !cs.reps) return 0.55;                     // erster Kontakt, Auswahlfrage
  const her = Math.max(0, t - (cs.due - cs.iv));
  return Math.min(0.97, 0.55 + 0.42 * Math.exp(-her / (Math.max(1, cs.iv) * 3.2)));
}

const zeilen = [];
for (let tag = 0; tag < TAGE; tag++) {
  const t = store.todayNum();
  const offen = sess.dueCards().length;
  const pause = PAUSEN.some(([von, bis]) => tag >= von && tag <= bis);

  let antworten = 0, richtig = 0;
  if (!pause) {
    const plan = sess.buildDaily();
    const warteschlange = plan.slice();
    for (let i = 0; i < warteschlange.length && i < 400; i++) {
      const { card, fresh: istNeu } = warteschlange[i];
      const cs = store.cardState(card.id) || fresh();
      const ok = wuerfel() < abruf(cs, t);
      const g = !ok ? AGAIN : wuerfel() < 0.18 ? HARD : wuerfel() < 0.2 ? EASY : GOOD;
      store.putCard(card.id, schedule(cs, g));
      antworten++; if (ok) richtig++;
      const d = store.today();
      d.done++; if (ok) d.correct++;
      if (istNeu) d.newC = (d.newC || 0) + 1;
      // Falsch beantwortete Karten kommen innerhalb der Einheit noch einmal dran
      if (g === AGAIN) warteschlange.splice(Math.min(warteschlange.length, i + 5), 0, { card, fresh: false });
    }
  }

  const uebersicht = sess.overview();
  zeilen.push({ tag: tag + 1, pause, rueckstand: offen, antworten,
    quote: antworten ? richtig / antworten : 0, angefangen: uebersicht.learned, fest: uebersicht.mature });
  NOW += 86400000;
}

const bei = (d) => zeilen[d - 1];
console.log(`${TAGE} Tage · ${NEU} neue Karten/Tag · Deckel ${DECKEL}` + (PAUSEN.length ? ' · mit zwei Pausen von je 14 Tagen' : ''));
console.log('\nTag | Rueckstand | Antworten | Trefferquote | angefangen | gefestigt');
for (const d of [1, 7, 14, 30, 45, 60, 90, 120, 150, 180].filter(x => x <= TAGE)) {
  const r = bei(d);
  console.log(String(r.tag).padStart(3), '|', String(r.rueckstand).padStart(10), '|',
    String(r.antworten).padStart(9) + (r.pause ? ' P' : '  '), '|',
    (r.quote * 100).toFixed(0).padStart(10) + ' %', '|',
    String(r.angefangen).padStart(10), '|', String(r.fest).padStart(9));
}
const aktiv = zeilen.filter(r => !r.pause);
const spitzeLast = Math.max(...aktiv.map(r => r.antworten));
const spitzeStau = Math.max(...zeilen.map(r => r.rueckstand));
const schnitt = aktiv.reduce((a, r) => a + r.antworten, 0) / aktiv.length;
console.log(`\nSpitzenlast   : ${spitzeLast} Karten an einem Tag`);
console.log(`Spitzenrueckstand: ${spitzeStau} faellige Karten`);
/* Wie lange dauert es nach einer Pause, bis der Berg wieder abgetragen ist?
   Das README behauptete „etwa vier Wochen", und die Tabelle springt in
   Dreissig-Tage-Schritten – belegt war es damit nicht. Als abgetragen gilt der
   Rueckstand, wenn er wieder unter dem Deckel liegt: Ab da schafft ein
   normaler Tag ihn weg, und die Bremse laesst neue Karten wieder durch. */
for (const [von, bis] of PAUSEN) {
  const nach = zeilen.filter(r => r.tag > bis);
  const frei = nach.find(r => r.rueckstand < DECKEL);
  const dauer = frei ? frei.tag - bis : null;
  const hoch = Math.max(...nach.slice(0, 40).map(r => r.rueckstand));
  console.log(`Pause Tag ${von}-${bis}: Rueckstand danach bis ${hoch}, `
    + (dauer === null ? 'nie wieder unter dem Deckel' : `nach ${dauer} Tagen wieder unter dem Deckel (${DECKEL})`));
}
console.log(`Schnitt       : ${schnitt.toFixed(1)} Karten/Tag · rund ${Math.round(schnitt * 7 / 60)} Minuten (7 s je Karte)`);
console.log(`Nach ${TAGE} Tagen: ${bei(TAGE).fest} von ${CARDS.length} Karten gefestigt, ${bei(TAGE).angefangen} angefangen.`);

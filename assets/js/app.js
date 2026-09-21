/* Wissenswerk – UI und Ablaufsteuerung */
import { CATS, CAT_BY_ID, CARDS, LEVELS } from '../../data/index.js';
import FACTS from '../../data/facts.js';
import * as store from './store.js';
import { S, settings, setSetting, save, cardState, putCard, today, todayNum, dayKey,
         numToKey, liveStreak, touchStreak, isFlagged, toggleFlag, setSaveErrorHandler,
         installFlush, setBusyCheck, setFremdStandHandler, merkeQuizRunde } from './store.js';
import { schedule, strength, preview, isLeech, nachDuellFehler, fresh as freshState, AGAIN, HARD, GOOD, EASY } from './srs.js';
import { options, bewerte, normalize, shuffle } from './quiz.js';
import { FASSUNG } from './fassung.js';
import * as sess from './session.js';
import { punkte, auswertung, rundenEintrag, schwaechstesFeld,
         FRIST_MS, BLITZ_MS, MAX_JE_FRAGE, PUNKTE_BLITZ, FRAGEN_JE_RUNDE } from './quizmodus.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const topbar = document.getElementById('topbar');
const live = document.getElementById('live');
/* Die Antwortknoepfe tragen A bis D, die Bewertungsknoepfe stehen in einer Reihe.
   Wer die Buchstaben sieht, tippt auch die Buchstaben - deshalb gelten beide. */
const tastenIndex = (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return -1;
  const z = '1234'.indexOf(e.key);
  if (z >= 0) return z;
  return 'abcd'.indexOf(String(e.key).toLowerCase());
};

/* Deutsche Schreibweise: Komma, nicht Punkt. toFixed liefert immer einen
   Punkt - in einer deutschsprachigen Oberflaeche ist das schlicht falsch. */
const sekunden = (ms) => (ms / 1000).toLocaleString('de-DE',
  { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const esc = (s) => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

/* Grobe Umrechnung: etwa acht Karten je Minute */
const SHORT = [{ n: 20, label: '3 Min' }, { n: 40, label: '5 Min' }, { n: 80, label: '10 Min' }];

/* Symbole: ein Strichstil fuer alles. Die Formen liegen als <g> im Dokument,
   hier wird nur noch darauf verwiesen – kein Emoji, keine fremde Bibliothek. */
const ico = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const catIcon = (id, cls = '') => ico(id, cls);

/* Sperrt die Optionen nach der Antwort und markiert sie. Neben der Farbe
   bekommt die richtige Option einen Haken, die falsch gewaehlte ein Kreuz:
   Rot und Gruen allein unterscheiden rund acht Prozent der Maenner nicht. */
function markiereOptionen(wurzel, richtig, gewaehlt) {
  wurzel.querySelectorAll('.opt').forEach(x => {
    x.disabled = true;
    const k = x.querySelector('.k');
    if (x.dataset.v === richtig) {
      x.classList.add('right');
      if (k) k.innerHTML = ico('haken', 's');
    } else if (x.dataset.v === gewaehlt) {
      x.classList.add('wrong');
      if (k) k.innerHTML = ico('schliessen', 's');
    } else {
      x.classList.add('dim');
    }
  });
}

let view = 'home';
let run = null;          // laufende Lerneinheit
let rueckblickOffen = false;   // der Rueckblick nach einer Runde steht (kein Ansichtenwechsel)
let neuLadenNachRunde = false; // ein Worker-Wechsel wartet auf einen ruhigen Moment
let onKey = null;        // Tastaturbelegung des aktuellen Bildschirms

document.addEventListener('keydown', (e) => {
  if (!onKey) return;
  if (e.target.matches('input, textarea, select')) return;
  // Cmd+1 wechselt den Browser-Tab, Alt+2 springt im Verlauf – solche Kürzel gehören nicht uns
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  onKey(e);
});

/* ================= Chrome ================= */
function paintChrome() {
  document.getElementById('streakNum').textContent = liveStreak();
  // Die Detailansicht eines Themas gehoert in der Leiste weiter zu „Themen".
  const leiste = view === 'topic' ? 'topics' : view;
  [...nav.querySelectorAll('.nav-btn')].forEach(b =>
    b.setAttribute('aria-current', String(b.dataset.view === leiste)));
}
function show(v) {
  view = v;
  run = null;
  rueckblickOffen = false;
  onKey = null;
  stopDuelTimer();
  app.classList.remove('full');
  // Die untere Leiste ist wieder da – der Hinweisbalken sitzt wieder darueber.
  document.documentElement.style.removeProperty('--toast-b');
  app.hidden = false; topbar.hidden = false; nav.hidden = false;
  render();
  window.scrollTo(0, 0);
  /* Eine ohne einzige Antwort abgebrochene Runde geht ueber show(), nicht ueber
     endRun() - ein waehrend der Runde zurueckgehaltenes Update-Angebot blieb
     dabei bis zum naechsten Start liegen. Hier statt beim Beenden-Knopf, damit
     jeder Weg aus einer Runde heraus es nachholt. */
  holeUpdateNach();
  /* Ein Worker-Wechsel aus einem zweiten Tab wurde waehrend der Runde
     zurueckgestellt. Hier ist der ruhige Moment dafuer - nicht schon im
     Rueckblick, der sonst mitsamt der Fehlerliste verschwaende. */
  if (neuLadenNachRunde) location.reload();
}
nav.addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (b) show(b.dataset.view);
});
document.getElementById('searchBtn').onclick = () => show('lookup');

/* Farbschema anwenden: leerer Wert = Systemeinstellung folgen.
   Die Leiste oben faerbt iOS nach theme-color, deshalb wird auch die mitgezogen. */
function applyTheme() {
  const t = settings().theme || 'system';
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.setAttribute('content', dark ? '#17120e' : '#f6f1e9');
  }
  root.style.colorScheme = t === 'system' ? 'light dark' : t;
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if ((settings().theme || 'system') === 'system') applyTheme();
});

function toast(msg, ms = 2200) {
  /* Nur die eigene Kurzmeldung ersetzen. Der Update-Balken traegt dieselbe
     Klasse und bleibt stehen, bis der Nutzer entscheidet – vorher loeschte ihn
     jede beliebige Meldung endgueltig, sogar die eigene Antwort des Balkens
     („Erst die Runde zu Ende") raeumte den Balken weg, zu dem sie gehoerte. */
  document.querySelector('.toast:not(.aktion)')?.remove();
  const d = document.createElement('div');
  d.className = 'toast';
  // Steht der Balken, rueckt die Meldung ueber ihn, statt ihn zu verdecken.
  // Gemessen statt geschaetzt: Die Hoehe des Balkens haengt vom Textumbruch ab.
  const balken = document.querySelector('.toast.aktion');
  if (balken) d.style.bottom = `${Math.round(window.innerHeight - balken.getBoundingClientRect().top + 10)}px`;
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}
function announce(msg) { if (live) live.textContent = msg; }

/* Der einzige Pfad, auf dem Antworten still verschwinden: Schlaegt das
   Schreiben fehl, kam bisher genau eine Kurzmeldung – danach konnte man eine
   Stunde weiterlernen, ohne dass etwas ankam. Der Aktionsbalken bleibt stehen,
   bis der Stand gesichert ist, und bietet das Sichern gleich an. */
setSaveErrorHandler((e) => speicherBalken(e));
startFehlerBalken();

/* Zwei offene Tabs: Der Speicher wird zusammengefuehrt, nicht ueberschrieben.
   Waehrend einer laufenden Einheit bleibt der Zustand unangetastet - sonst
   verschluckte der Tausch die gerade gegebene Antwort. */
setBusyCheck(() => run !== null);
setFremdStandHandler((uebernommen, sichtbar) => {
  if (run) return;
  /* Der Rueckblick nach einer Runde steht nicht im Ansichtenwechsel: render()
     zeichnet die zuletzt gewaehlte Ansicht und loeschte ihn dabei weg - mitsamt
     der Liste der Karten, die man gerade falsch hatte. Die Meldung kommt
     trotzdem, nur ohne Neuzeichnen. */
  if (!rueckblickOffen) render();
  // Ein Folge-Ereignis ohne sichtbare Aenderung bleibt stumm – sonst
  // ueberschreibt es die Meldung, die zum eigentlichen Ereignis gehoert.
  if (!sichtbar) return;
  toast(uebernommen
    ? 'Ein anderer Tab hat den Stand ersetzt – hier übernommen'
    : 'In einem anderen Tab gelernt – Stand zusammengeführt');
});

/* Die App liegt auf dem iPhone stunden- oder tagelang im Hintergrund und kommt
   mit einem Tipp aufs Symbol zurueck – ohne Neuladen. Ist dabei die Tagesgrenze
   (4 Uhr) ueberschritten worden, stand auf der Startseite noch der Stand von
   gestern: „Heute ist alles erledigt", „0 faellig", und der Knopf hiess
   „Extra-Runde ueben". Ein Tipp darauf startete 15 nicht faellige
   Wackelkandidaten statt des Tagesplans.
   Neu gezeichnet wird unter derselben Bedingung wie beim fremden Stand: nicht
   waehrend einer Einheit und nicht ueber einen offenen Rueckblick hinweg. */
let gezeichnetAmTag = dayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const jetzt = dayKey();
  if (jetzt === gezeichnetAmTag) return;
  gezeichnetAmTag = jetzt;
  if (run || rueckblickOffen) return;
  render();
});

/* ================= Views ================= */
function render() {
  gezeichnetAmTag = dayKey();   // damit der Sichtbarkeitshorcher nicht doppelt zeichnet
  paintChrome();
  ({ home: renderHome, topics: renderTopics, duel: renderDuelStart,
     stats: renderStats, settings: renderSettings, lookup: renderLookup,
     topic: renderTopicDetail }[view] || renderHome)();
}

/* Fortschritt als Ring – nur noch im Rueckblick nach einer Runde. */
function ring(pct) {
  const r = 41, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<div class="done-badge">
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--ring-bg)" stroke-width="7"/>
      <circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--acc)" stroke-width="7"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg><b>${Math.round(pct * 100)}%</b></div>`;
}

/* Der Tagesbogen: zwanzig Marken, die sich im Lauf des Tages fuellen.
   Fortschritt zum Ansehen statt einer nackten Zahl. */
function tagesbogen(done, offen) {
  const N = 20;
  const ganz = done + offen;
  const voll = ganz ? Math.round((done / ganz) * N) : N;
  let s = '';
  for (let i = 0; i < N; i++) s += `<i class="${i < voll ? 'on' : i === voll && offen ? 'now' : ''}"></i>`;
  return `<div class="seg" aria-hidden="true">${s}</div>`;
}

/* Die Woche als Reihe: was liegt hinter dir, was ist heute. */
function wochenstreifen() {
  const st = S();
  const t = todayNum();
  const dowMon = (d) => ((d + 3) % 7 + 7) % 7;      // Montag = 0; der 1.1.1970 war ein Donnerstag
  const start = t - dowMon(t);
  const NAMEN = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  let s = '';
  for (let i = 0; i < 7; i++) {
    const tag = start + i;
    /* done zaehlt nur das Tagestraining. Ein Tag, an dem nur Quiz oder Duell
       lief, stand damit als „nichts gelernt" im Streifen – direkt unter der
       Ueberschrift, die denselben Tag als Serientag fuehrt, und neben dem Satz
       „12 Fragen unter Zeitdruck heute". Die Statistikseite bildet laengst
       dieselbe Summe. */
    const rec = st.days[numToKey(tag)];
    const n = (rec?.done || 0) + (rec?.duel || 0);
    const cls = tag > t ? 'fut' : tag === t ? 'today' : '';
    // Vorgelesen wurde bisher nur "Mo Di Mi Do Fr Sa So" - der eigentliche
    // Inhalt, naemlich was an welchem Tag gelaufen ist, steckte allein in der
    // Farbe des Kaestchens.
    const sagt = tag > t ? `${LANG[i]}: noch nicht`
      : n > 0 ? `${LANG[i]}${tag === t ? ' (heute)' : ''}: ${n} ${n === 1 ? 'Karte' : 'Karten'}`
      : `${LANG[i]}${tag === t ? ' (heute)' : ''}: nichts gelernt`;
    s += `<span class="wd ${cls}"><i class="${n > 0 ? 'done' : ''}" aria-hidden="true"></i>`
      + `<span aria-hidden="true">${NAMEN[i]}</span><span class="sr-only">${sagt}</span></span>`;
  }
  return `<div class="week" role="group" aria-label="Diese Woche">${s}</div>`;
}

/* Kurzrunden nur anbieten, wenn sie tatsaechlich kuerzer sind als der Plan.
   „5 Min" neben einem Plan von 25 Karten waere kein Angebot, sondern eine
   Irrefuehrung: die Runde umfasste dann denselben Stapel. */
function kurzeRunden(plan) {
  const passend = SHORT.filter(o => o.n < plan);
  if (!passend.length) return '';
  return `<div class="row wrap" style="gap:7px;justify-content:center">
    ${passend.map(o => `<button type="button" class="chip" data-short="${o.n}">${ico('uhr', 's')}${o.label}</button>`).join('')}
  </div>`;
}

function dailyFact() {
  const st = S();
  const k = dayKey();
  if (st.factDay !== k) {
    st.factDay = k;
    st.factIdx = (st.factIdx + 1) % FACTS.length;
    st.factSeen = (st.factSeen || 0) + 1;
    /* Die letzten acht Anzeigetage mitschreiben: Nur damit laesst sich sagen,
       wie lange der zurueckgeholte Anker wirklich her ist. */
    st.factTage = [...(Array.isArray(st.factTage) ? st.factTage : []), k].slice(-(RUECKSCHAU + 1));
    save();
  }
  return FACTS[st.factIdx % FACTS.length];
}

/* Ein Merkanker von vor sieben Anzeigetagen kommt noch einmal – als Abruffrage,
   nicht zum Nachlesen. Gemessen haben 51 der 141 Merkanker keine Entsprechung
   unter den Karten; ohne Rueckschau werden sie genau einmal gelesen und nie
   wieder abgerufen. Gezaehlt werden Anzeigetage, nicht Kalendertage: Wer eine
   Woche aussetzt, bekommt trotzdem den siebten Anker zurueck und keinen, den er
   nie gesehen hat.

   Die Ueberschrift nennt deshalb den WIRKLICHEN Abstand. „Vor sieben Tagen"
   stand frueher fest da - wer die App nur alle paar Wochen aufmacht, las das
   ueber einem Anker von vor 196 Tagen. */
const RUECKSCHAU = 7;
function factRecap() {
  const st = S();
  if ((st.factSeen || 0) <= RUECKSCHAU) return null;
  const n = FACTS.length;
  const tage = Array.isArray(st.factTage) ? st.factTage : [];
  const damals = tage.length > RUECKSCHAU ? tage[tage.length - 1 - RUECKSCHAU] : null;
  const her = damals ? store.keyToNum(dayKey()) - store.keyToNum(damals) : null;
  return { fakt: FACTS[(((st.factIdx - RUECKSCHAU) % n) + n) % n], her };
}

/* Die Frage, die den Abruf ausloest. Die meisten Ueberschriften taugen selbst
   als Hinweisreiz („Warum Eis schwimmt"); wo sie zu blass ist, traegt der
   Merkanker ein eigenes Feld f. */
const factFrage = (f) => f.f || f.t;

function merkankerKarte(f, kennung, ueber) {
  return `<div class="card fact">
    ${ueber ? `<p class="tiny">${esc(ueber)}</p>` : ''}
    <h3>${esc(factFrage(f))}</h3>
    <p class="merk-loesung" id="${kennung}" hidden>${esc(f.x)}</p>
    <button class="btn ghost auf" data-merk="${kennung}" aria-expanded="false"
      aria-controls="${kennung}">Erst überlegen – dann aufdecken</button>
  </div>`;
}

/* „Erst überlegen – dann aufdecken" gibt es an zwei Stellen: beim Merkanker
   auf der Startseite und im Rueckblick nach einer Runde. */
function bindeAufdecken() {
  app.querySelectorAll('[data-merk]').forEach(b => b.onclick = () => {
    const ziel = document.getElementById(b.dataset.merk);
    ziel.hidden = false;
    b.setAttribute('aria-expanded', 'true');
    /* Frueher b.remove(): Das fokussierte Element verschwand aus dem Dokument,
       der Fokus fiel auf <body>, und der Lesecursor sprang an den Seitenanfang
       – die gerade aufgedeckte Loesung wurde nie angesagt. Jetzt wandert der
       Fokus mit in den aufgedeckten Block, und der Knopf bleibt als stillgelegte
       Marke stehen, damit die Stelle im Baum erhalten bleibt. */
    ziel.setAttribute('tabindex', '-1');
    ziel.focus({ preventScroll: true });
    b.disabled = true;
    b.hidden = true;
  });
}

function renderHome() {
  const o = sess.overview();
  const d = today();
  const tagesplan = sess.buildDaily();
  const plan = tagesplan.length;
  // Aus dem Plan gezaehlt, nicht aus der Differenz zum Rueckstand: sobald mehr
  // faellig ist als der Deckel zulaesst, wird die Differenz null und die
  // Auskunft „davon neu" verschwand, obwohl neue Karten im Plan standen.
  const neuImPlan = tagesplan.filter(x => x.fresh).length;
  const stau = sess.imRueckstau() && !settings().trotzdemNeu;
  const pct = Math.min(1, d.done / (d.done + plan || 1));
  const f = dailyFact();
  const rueck = factRecap();
  const flags = sess.flaggedCount();
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Servus' : 'Guten Abend';
  /* Die App rechnet ueberall mit der Tagesgrenze um 4 Uhr (dayKey) – die
     Datumszeile las die rohe Ortszeit. Zwischen Mitternacht und 4 Uhr nannte
     die Kopfzeile deshalb schon den neuen Kalendertag, waehrend die Wochenreihe
     direkt darunter noch den gestrigen als „heute" markierte und die vorige
     Woche zeigte. Die Begruessung darf an der Uhr bleiben – wer um 1 Uhr lernt,
     hoert „Guten Abend", und das stimmt. */
  const heuteDatum = new Date();
  if (heuteDatum.getHours() < 4) heuteDatum.setDate(heuteDatum.getDate() - 1);
  const datum = heuteDatum.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const streak = liveStreak();
  // Die Ueberschrift traegt die Auskunft, nicht die Begruessung: Wer die App
  // oeffnet, will wissen, was ansteht - „Guten Abend" sagt darueber nichts.
  app.innerHTML = `
  <section class="hero fade">
    <p class="tag-zeile">${greet} · ${esc(datum)}</p>
    <h1>${plan
      ? `${plan} ${plan === 1 ? 'Karte steht' : 'Karten stehen'} an`
      : 'Heute ist alles erledigt'}</h1>
    <p class="muted">${plan
      ? `Etwa ${Math.max(2, Math.round(plan * 0.13))} Minuten${
          neuImPlan ? ` · ${neuImPlan} davon neu` : ''}`
      : 'Stark. Eine Extra-Runde geht trotzdem.'}</p>
    ${stau ? `<div class="hinweis">
      <b>Erst mal aufholen.</b> ${o.due} Wiederholungen warten – neue Karten pausieren,
      bis der Rückstand kleiner ist. So wächst der Berg nicht weiter.
      <button class="btn sm ghost" id="trotzdem" style="margin-top:9px">Trotzdem neue Karten</button>
    </div>` : ''}
    ${tagesbogen(d.done, plan)}
    <div class="seg-lab">
      <span class="tiny">${d.done
        ? `${d.done} heute geschafft · ${Math.round((d.correct / Math.max(1, d.done)) * 100)} % richtig${
            d.duel ? ` · dazu ${d.duel} unter Zeitdruck` : ''}`
        : d.duel
          // „Noch nichts gelernt" waere gelogen, wenn schon vierzig Duellfragen
          // beantwortet sind - der Tagesplan steht nur eben noch offen.
          ? `${d.duel} Fragen unter Zeitdruck heute – der Tagesplan wartet noch.`
          : 'Noch nichts gelernt heute – die erste Karte ist die leichteste.'}</span>
      ${d.done ? `<b>${Math.round(pct * 100)} %</b>` : ''}
    </div>
    <div class="btn-stack" style="margin-top:15px">
      <button class="btn primary" data-go="daily">${ico('play')}${plan ? 'Tagestraining starten' : 'Extra-Runde üben'}</button>
      ${kurzeRunden(plan)}
    </div>
  </section>

  <h2 class="sec">Deine Woche${streak ? ` · ${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge` : ''}</h2>
  <div class="card">
    ${wochenstreifen()}
  </div>

  ${/* Beide Knoepfe nur, wenn sie etwas zu tun haben. „Markierte" hielt sich
        daran laengst; „Wackelkandidaten" stand auch am ersten Tag da, an dem
        es keine einzige abgefragte Karte gibt - ein Tipp darauf brachte nur
        „Nichts zu ueben". Ein Knopf, der nichts kann, ist ein Versprechen,
        das die App nicht haelt. */ ''}
  ${o.seen || flags ? `
  <div class="${o.seen && flags ? 'duo' : 'btn-stack'}" style="margin-top:11px">
    ${o.seen ? '<button class="btn" data-go="weak">Wackelkandidaten</button>' : ''}
    ${flags ? `<button class="btn" data-go="flag">${ico('stern', 's')}Markierte · ${flags}</button>` : ''}
  </div>` : ''}

  <h2 class="sec">Wissen des Tages</h2>
  ${merkankerKarte(f, 'merkHeute', '')}
  ${rueck ? merkankerKarte(rueck.fakt, 'merkRueck', rueck.her
      ? `Vor ${rueck.her} ${rueck.her === 1 ? 'Tag' : 'Tagen'} – weißt du es noch?`
      : 'Schon einmal gelesen – weißt du es noch?') : ''}

  <h2 class="sec">Dein Bestand</h2>
  <div class="kpis">
    <div class="kpi"><b>${o.due}</b><span>fällig</span></div>
    <div class="kpi"><b>${o.newLeft}</b><span>neu frei</span></div>
    <div class="kpi"><b>${o.mature}</b><span>sitzt fest</span></div>
  </div>
  <div class="card" style="margin-top:10px">
    <div class="row between"><span>Karten insgesamt</span><b>${o.total}</b></div>
    <div class="bar" style="margin:10px 0 7px"><i style="width:${((o.seen / o.total) * 100).toFixed(1)}%"></i></div>
    <p class="tiny">${o.seen} angefangen · ${o.mature} gefestigt · ${o.total - o.seen} noch unberührt</p>
  </div>
  ${sicherungsHinweis()}`;

  const sich = document.getElementById('sichernJetzt');
  if (sich) sich.onclick = async () => { if (await sichern()) render(); };

  bindeAufdecken();

  // Genau den Plan starten, der oben angesagt wurde. buildDaily() wuerfelt die
  // Kategorien-Reihenfolge bei jedem Aufruf neu – ein zweiter Aufruf lieferte
  // eine andere Warteschlange, und „N Karten, davon M neu" beschrieb eine
  // Runde, die beim Tippen verworfen wurde. Am deutlichsten bei den Kurzrunden:
  // slice(0, 20) schnitt aus einem frisch gemischten Plan.
  /* Die Anschlussrunde behaelt die gewaehlte Laenge. Wer auf „3 Min" tippt, hat
     sich fuer drei Minuten entschieden - „Weitermachen" reichte ihm danach den
     GANZEN Tagesplan nach: aus einer Runde von 20 Karten wurde eine von 90. Der
     grosse Startknopf bekommt keine Grenze, dort ist der ganze Plan gewollt. */
  const weiterTag = (grenze = 0) => () => {
    const h = sess.buildDaily();
    const q = h.length ? h : sess.buildWeak(15);
    return grenze ? q.slice(0, grenze) : q;
  };
  app.querySelector('[data-go="daily"]').onclick = () => {
    startRun(tagesplan.length ? tagesplan : sess.buildWeak(15), 'daily', weiterTag());
  };
  document.getElementById('trotzdem')?.addEventListener('click', () => {
    setSetting('trotzdemNeu', true);
    toast('Neue Karten laufen weiter – abschaltbar unter Mehr');
    renderHome();
  });
  app.querySelectorAll('[data-short]').forEach(b => b.onclick = () => {
    const n = Number(b.dataset.short);
    startRun(tagesplan.slice(0, n), 'daily', weiterTag(n));
  });
  /* Mit Fragezeichen wie beim Stern-Knopf daneben: Beide Knoepfe stehen nur da,
     wenn sie etwas zu tun haben, und am ersten Tag gibt es keinen von beiden. */
  const wackelKnopf = app.querySelector('[data-go="weak"]');
  if (wackelKnopf) wackelKnopf.onclick = () => {
    const q = sess.buildWeak(20);
    q.length ? startRun(q, 'weak', () => sess.buildWeak(20)) : toast('Erst ein paar Karten lernen');
  };
  app.querySelector('[data-go="flag"]')?.addEventListener('click', () => {
    startRun(sess.buildFlagged(20), 'flag', () => sess.buildFlagged(20));
  });
}

function renderTopics() {
  const p = sess.catProgress();
  const active = settings().cats;
  app.innerHTML = `
    <h1 class="vh">Themen</h1>
    <p class="muted">Gezielt ein Gebiet üben – oder in den Einstellungen ganze Themen abschalten.</p>
    <div class="tlist" style="margin-top:16px">
      ${CATS.map(c => {
        const s = p[c.id] || { pct: 0, n: 0, due: 0, fresh: 0 };
        const off = active && active.length && !active.includes(c.id);
        /* h2 und nicht h3: Auf diesem Bildschirm gibt es keine
           Abschnittsueberschrift dazwischen, die Themen sind die Abschnitte.
           Mit h3 sprang die Ueberschriftenfolge von 1 auf 3, und wer mit
           VoiceOver von Ueberschrift zu Ueberschrift geht, haelt das fuer
           uebersprungenen Inhalt. Die anderen Listen derselben Bauart stehen
           unter einer h2 und bleiben deshalb bei h3. */
        return `<button class="trow" data-cat="${c.id}" ${off ? 'style="opacity:.5"' : ''}>
          <span class="tico">${catIcon(c.id)}</span>
          <span class="grow">
            <h2>${esc(c.name)}</h2>
            <span class="tiny">${s.n} Karten${s.due ? ` · ${s.due} fällig` : ''}${s.fresh ? ` · ${s.fresh} neu` : ''}${off ? ' · pausiert' : ''}</span>
            <span class="bar"><i style="width:${(s.pct * 100).toFixed(0)}%"></i></span>
          </span>
          <span class="pct">${Math.round(s.pct * 100)}%</span>
        </button>`;
      }).join('')}
    </div>`;
  app.querySelectorAll('[data-cat]').forEach(b => {
    b.onclick = () => { offenesThema = b.dataset.cat; show('topic'); };
  });
}

/* Ein Thema von innen: die Teilgebiete einzeln. Vorher startete ein Tippen auf
   „Sport" sofort 20 zufällige Karten aus 260 - wer für eine Klausur in
   Bewegungslehre lernt, kam an genau diese Karten nicht heran. */
let offenesThema = null;
function renderTopicDetail() {
  const cat = CAT_BY_ID[offenesThema];
  if (!cat) return show('topics');
  const subs = sess.subProgress(cat.id);
  const gesamt = subs.reduce((n, s) => n + s.n, 0);
  const aus = !sess.catAktiv(cat.id);
  app.innerHTML = `
    <div class="row" style="gap:10px;align-items:center;margin-bottom:4px">
      <button class="icon-btn sm" id="zurueckThemen" type="button" aria-label="Zurück zu den Themen">${ico('zurueck')}</button>
      <h1 class="vh" style="margin:0">${esc(cat.name)}</h1>
    </div>
    <p class="muted">${gesamt} Karten in ${subs.length} Teilgebieten${aus ? ' · im Tagestraining pausiert' : ''}</p>
    <div class="btn-stack" style="margin-top:14px">
      <button class="btn primary" id="ganzesThema">${ico('play')}Ganzes Thema üben</button>
      <button class="btn ghost" id="themaDuell">${ico('duell')}Thema im Duell</button>
    </div>
    <h2 class="sec">Teilgebiete</h2>
    <div class="tlist">
      ${subs.map(s => `<button class="trow schmal" data-sub="${esc(cat.id)}|${esc(s.sub)}">
        <span class="grow">
          <h3>${esc(s.sub)}</h3>
          <span class="tiny">${s.n} Karten${s.due ? ` · ${s.due} fällig` : ''}${s.fresh ? ` · ${s.fresh} neu` : ''}</span>
          <span class="bar"><i style="width:${(s.pct * 100).toFixed(0)}%"></i></span>
        </span>
        <span class="pct">${Math.round(s.pct * 100)}%</span>
      </button>`).join('')}
    </div>`;
  document.getElementById('zurueckThemen').onclick = () => show('topics');
  document.getElementById('ganzesThema').onclick = () => {
    const q = sess.buildTopic(cat.id, 20);
    q.length ? startRun(q, 'topic', () => sess.buildTopic(cat.id, 20))
      : toast('Keine Karten in diesem Thema');
  };
  /* Im Quizduell kennt man die Kategorie vor der Frage – genau diese Lage
     laesst sich hier proben: ein Thema, aber unter Zeitdruck. */
  document.getElementById('themaDuell').onclick = () => {
    const q = sess.buildDuel(10, cat.id);
    q.length ? startRun(q, 'duel', () => sess.buildDuel(10, cat.id))
      : toast('Keine Karten in diesem Thema');
  };
  bindeTeilgebiete();
}

/* Teilgebiets-Knöpfe gibt es in der Statistik und in der Themenansicht. */
function bindeTeilgebiete() {
  app.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => {
    const [cat, sub] = b.dataset.sub.split('|');
    const q = sess.buildSub(cat, sub, 20);
    q.length ? startRun(q, 'sub', () => sess.buildSub(cat, sub, 20)) : toast('Keine Karten gefunden');
  });
}

/* Quiz und Duell teilen sich den Bildschirm und die Uhr. Das Quiz ist der
   Pruefstand: zwoelf Fragen quer durch alles, auch Ungelerntes, mit Punkten.
   Das Duell bleibt die Probe aufs Gelernte - zehn Fragen aus dem Bekannten. */
const QUIZ_MAX = FRAGEN_JE_RUNDE * MAX_JE_FRAGE;
function renderDuelStart() {
  const st = S();
  const runden = st.quizRunden || [];
  const letzte = runden.slice(-10);
  const best = st.quizBest || 0;
  const schwach = schwaechstesFeld(runden);
  const mittel = letzte.length ? Math.round(letzte.reduce((a, r) => a + r.p, 0) / letzte.length) : 0;
  app.innerHTML = `
    <h1 class="vh">Quiz</h1>
    <p class="muted">Zwölf Fragen quer durch alle Themen, 15 Sekunden pro Frage. Zehn Punkte für jeden Treffer, fünf dazu, wenn die Antwort in den ersten fünf Sekunden kommt.${
      settings().quizLehrerwissen ? '' : ' Gefragt wird wie am Spieleabend – Lehrerwissen bleibt dem Tagestraining vorbehalten.'}</p>
    <div class="card" style="margin-top:16px">
      <div class="row between"><span>Bestwert</span><b id="quizBest">${best} / ${QUIZ_MAX}</b></div>
      ${letzte.length ? `
      <div class="runden" aria-hidden="true">${letzte.map((r, i) =>
        `<i style="height:${Math.max(6, Math.round((r.p / Math.max(1, r.m)) * 100))}%" class="${best > 0 && r.p === best ? 'best' : ''} ${i === letzte.length - 1 ? 'last' : ''}"></i>`).join('')}</div>
      <p class="tiny" style="margin-top:7px">Letzte Runde ${letzte[letzte.length - 1].p} von ${letzte[letzte.length - 1].m}${
        letzte.length > 1 ? ` · im Schnitt ${mittel} über die letzten ${letzte.length}` : ''}</p>
      ${schwach ? `<p class="tiny" style="margin-top:6px">Die meisten Punkte lässt du zuletzt in <b>${esc(CAT_BY_ID[schwach.cat]?.name || schwach.cat)}</b> liegen.</p>
      <button class="btn ghost sm" id="quizNachlegen" data-cat="${esc(schwach.cat)}" style="margin-top:8px">${ico('duell')}${esc(CAT_BY_ID[schwach.cat]?.name || schwach.cat)} im Duell nachlegen</button>` : ''}`
      : `<p class="tiny" style="margin-top:9px">Noch keine Runde gespielt. Die erste zeigt dir, wo du stehst.</p>`}
    </div>
    <div class="btn-stack" style="margin-top:14px">
      <button class="btn primary" id="quizGo">${ico('duell')}Quizrunde starten</button>
      <button class="btn" id="duelGo">Duell – zehn Fragen aus dem Gelernten</button>
    </div>
    <h2 class="sec">Unter Zeitdruck</h2>
    <div class="card">
      <div class="row between"><span>Bestes Duell</span><b>${st.duelBest || 0} / 10</b></div>
      <div class="row between" style="margin-top:8px"><span>Trefferquote unter Zeitdruck</span><b>${st.duelAnswers ? Math.round(st.duelCorrect / st.duelAnswers * 100) : 0} %</b></div>
      ${st.duelTimed ? `<div class="row between" style="margin-top:8px"><span>Ø Zeit bis zur richtigen Antwort</span><b>${sekunden(st.duelMs / st.duelTimed)} s</b></div>` : ''}
      <p class="tiny" style="margin-top:9px">Quiz und Duell zählen hier zusammen – und getrennt vom Tagestraining, weil unter Zeitdruck naturgemäß geraten wird.</p>
    </div>
    <p class="tiny center" style="margin-top:14px">Falsche und abgelaufene Fragen landen in deinem nächsten Tagestraining – so schließt sich die Lücke sofort.</p>`;
  document.getElementById('quizGo').onclick = () =>
    startRun(sess.buildQuiz(), 'quiz', () => sess.buildQuiz());
  document.getElementById('duelGo').onclick = () =>
    startRun(sess.buildDuel(10), 'duel', () => sess.buildDuel(10));
  bindeNachlegen();
}

/* Der Pruefstand sagt, wo die Punkte liegen bleiben - und fuehrt von dort in die
   Werkstatt: zehn Fragen im Duell, genau in diesem Thema. Vorher stand das
   schwaechste Thema als Satz da, und der Weg dorthin fuehrte ueber Themen,
   Thema suchen, „Thema im Duell". */
function bindeNachlegen() {
  document.getElementById('quizNachlegen')?.addEventListener('click', (e) => {
    const cat = e.currentTarget.dataset.cat;
    startRun(sess.buildDuel(10, cat), 'duel', () => sess.buildDuel(10, cat));
  });
}

/* Trefferquoten liegen fast immer zwischen 60 und 85 Prozent. Als Balken ab
   null gezeichnet sehen acht solche Wochen identisch aus - das Bild sagte
   nichts. Ein Linienzug ueber dem beobachteten Bereich zeigt die Bewegung, und
   weil die Achse nicht bei null steht, sind es bewusst Punkte und keine Balken:
   Balken mit abgeschnittener Achse wuerden Unterschiede uebertreiben. */
function verlaufKarte(wochen, trendText) {
  const werte = wochen.map(w => w.pct);
  const lo = Math.max(0, Math.min(...werte) - 4);
  const hi = Math.min(100, Math.max(...werte) + 4);
  const spanne = Math.max(1, hi - lo);
  const SCHRITT = 40, OBEN = 16, HOEHE = 52;
  const breite = wochen.length * SCHRITT;
  const x = (i) => i * SCHRITT + SCHRITT / 2;
  const y = (v) => OBEN + HOEHE - ((v - lo) / spanne) * HOEHE;
  const schnitt = werte.reduce((a, b) => a + b, 0) / werte.length;
  const punkte = wochen.map((w, i) => `${x(i)},${y(w.pct).toFixed(1)}`).join(' ');
  return `
    <h2 class="sec">Trefferquote je Woche</h2>
    <div class="card">
      <svg class="spark" viewBox="0 0 ${breite} 96" width="100%" height="96"
           role="img" aria-label="Trefferquote der letzten ${wochen.length} Wochen: ${werte.join(', ')} Prozent">
        <line class="mittel" x1="0" y1="${y(schnitt).toFixed(1)}" x2="${breite}" y2="${y(schnitt).toFixed(1)}"/>
        <polyline class="zug" points="${punkte}"/>
        ${wochen.map((w, i) => `
          <circle class="pkt ${i === wochen.length - 1 ? 'jetzt' : ''}" cx="${x(i)}" cy="${y(w.pct).toFixed(1)}" r="4"/>
          <text class="wert" x="${x(i)}" y="${(y(w.pct) - 10).toFixed(1)}">${w.pct}%</text>
          <text class="marke" x="${x(i)}" y="92">${esc(w.label)}</text>`).join('')}
      </svg>
      <p class="tiny" style="margin-top:8px">${trendText}</p>
    </div>`;
}

/* Wie gut trifft die eigene Einschaetzung? Gezaehlt werden nur die Faelle, in
   denen vor der Aufloesung „Hab ich" gedrueckt wurde und danach trotzdem
   „Nochmal" – also die Faelle, in denen man sich sicher war und es nicht war.
   Unter 15 Festlegungen sagt die Quote nichts, dann bleibt die Karte weg. */
function selbsteinschaetzung() {
  const st = S();
  const n = st.claims || 0;
  if (n < 15) return '';
  const daneben = st.claimsMiss || 0;
  const quote = Math.round((daneben / n) * 100);
  const text = quote <= 10
    ? 'Deine Einschätzung ist verlässlich – wenn du „Hab ich" sagst, stimmt es fast immer.'
    : quote <= 25
      ? 'Solide Einschätzung. Ein Viertel Fehlgriff ist normal; wer tippt statt nur zu denken, drückt den Wert weiter.'
      : 'Deutlich zu optimistisch. Vertrautheit fühlt sich wie Können an – tipp die Antwort, dann entscheidet der Vergleich und nicht das Gefühl.';
  return `
    <h2 class="sec">Selbsteinschätzung</h2>
    <div class="card">
      <div class="row between"><span>„Hab ich" gesagt, danach doch nicht</span><b>${daneben} / ${n}</b></div>
      <div class="bar" style="margin:10px 0 7px"><i style="width:${Math.min(100, quote)}%"></i></div>
      <p class="tiny">${text}</p>
    </div>`;
}

function renderStats() {
  const stufen = sess.levelProgress();
  const st = S();
  const o = sess.overview();
  const WEEKS = 12;
  const t = todayNum();
  const dowMon = (d) => ((d + 3) % 7 + 7) % 7;      // Montag = 0; der 1.1.1970 war ein Donnerstag
  const start = t + (6 - dowMon(t)) - (WEEKS * 7 - 1);
  /* Die Stufen richten sich nach dem eigenen Pensum, nicht nach festen Zahlen.
     Vorher lag die oberste Stufe bei 40 Antworten - bei den rund 90 Antworten,
     die ein voller Tag mit sich bringt, war damit jeder aktive Tag die hoechste
     Stufe und der Verlauf sagte nur noch „gelernt oder nicht". Bezug ist der
     Mittelwert der aktiven Tage; solange es zu wenige gibt, bleiben feste
     Schwellen fuer den Anfang. */
  // Ein Tag mit drei Duellen war Lernen, auch wenn keine geplante Karte dran war:
  // fuer die Aktivitaetskarte zaehlen beide Arten von Antworten.
  const tagesSumme = (d) => (d?.done || 0) + (d?.duel || 0);
  const aktive = Object.values(st.days).map(tagesSumme).filter(n => n > 0).sort((a, b) => a - b);
  const bezug = aktive.length >= 5 ? aktive[Math.floor(aktive.length / 2)] : 0;
  const stufe = (n) => {
    if (n === 0) return 0;
    if (!bezug) return n < 8 ? 1 : n < 20 ? 2 : n < 40 ? 3 : 4;
    return n < bezug * 0.45 ? 1 : n < bezug * 0.85 ? 2 : n < bezug * 1.25 ? 3 : 4;
  };
  let cells = '';
  let aktiveTage = 0, vergangeneTage = 0, imFenster = 0;
  for (let i = 0; i < WEEKS * 7; i++) {
    const day = start + i;
    if (day > t) { cells += '<i class="future"></i>'; continue; }
    const k = numToKey(day);
    const n = tagesSumme(st.days[k]);
    vergangeneTage++;
    imFenster += n;
    if (n > 0) aktiveTage++;
    cells += `<i data-l="${stufe(n)}" class="${day === t ? 'today' : ''}" title="${k}: ${n} Antworten"></i>`;
  }
  const p = sess.catProgress();
  const totalDone = Object.values(st.days).reduce((a, d) => a + tagesSumme(d), 0);
  const fc = sess.forecast(7);
  const fcMax = Math.max(1, ...fc);
  const names = ['heute', 'morgen', '+2', '+3', '+4', '+5', '+6'];
  const weak = sess.weakSubs();

  /* Trefferquote der letzten acht Wochen: zeigt, ob das Lernen greift.
     Steigende Quote bei wachsendem Bestand heisst, die Wiederholungen wirken. */
  const wochen = [];
  for (let w = 7; w >= 0; w--) {
    let done = 0, correct = 0;
    for (let d = 0; d < 7; d++) {
      const rec = st.days[numToKey(t - (w * 7 + d))];
      if (rec) { done += rec.done || 0; correct += rec.correct || 0; }
    }
    if (done >= 10) wochen.push({ label: w === 0 ? 'jetzt' : `−${w}`, done, pct: Math.round((correct / done) * 100) });
  }
  const trendText = wochen.length >= 3
    ? (() => {
        const alt = wochen.slice(0, Math.ceil(wochen.length / 2));
        const neu = wochen.slice(-Math.ceil(wochen.length / 2));
        const m = (a) => a.reduce((x, y) => x + y.pct, 0) / a.length;
        const diff = Math.round(m(neu) - m(alt));
        return diff >= 3 ? `Aufwärtstrend: ${diff} Prozentpunkte besser als zu Beginn dieses Zeitraums.`
          : diff <= -3 ? `Zuletzt ${Math.abs(diff)} Prozentpunkte schwächer – oft ein Zeichen, dass viele neue Karten dazugekommen sind.`
          : 'Stabil. Bei wachsendem Bestand ist das ein gutes Zeichen.';
      })()
    : 'Wochen mit mindestens zehn Antworten.';

  app.innerHTML = `
    <h1 class="vh">Statistik</h1>
    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><b>${liveStreak()}</b><span>Tage in Folge</span></div>
      <div class="kpi"><b>${st.best || 0}</b><span>Rekord</span></div>
      <div class="kpi"><b>${totalDone}</b><span>Antworten</span></div>
    </div>

    <h2 class="sec">Letzte 12 Wochen</h2>
    <div class="card">
      <!-- Die 84 Zellen tragen ihre Auskunft nur im title-Attribut. Auf iOS
           wird das nie angezeigt und von VoiceOver unzuverlaessig gelesen –
           fuer Hilfsmittel war die Karte damit leer. Das Bild wird deshalb
           ausgeblendet und durch einen Satz ersetzt, der dasselbe sagt. -->
      <div class="heat-wrap" aria-hidden="true">
        <div class="heat-days"><span>Mo</span><span></span><span>Mi</span><span></span><span>Fr</span><span></span><span>So</span></div>
        <div class="heat grow">${cells}</div>
      </div>
      <!-- imFenster, nicht totalDone: Der Satz ersetzt genau diese 84 Zellen.
           Mit der Gesamtzahl stand dort fuer einen Stand mit sieben Monaten
           Verlauf „56 von 78 Tagen gelernt, zusammen 4.800 Antworten", waehrend
           in den gezeigten Tagen 2.334 steckten - mehr als das Doppelte. Die
           Gesamtzahl hat ihren Platz in der Kachel „Antworten" darueber. -->
      <p class="sr-only">${aktiveTage} von ${vergangeneTage} Tagen gelernt, zusammen ${imFenster} Antworten.</p>
      <div class="legend" aria-hidden="true">wenig <i></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i> viel</div>
    </div>

    <h2 class="sec">Was kommt auf dich zu</h2>
    <div class="card">
      ${fc.some(n => n > 0) ? `
      <div class="fc" aria-hidden="true">${fc.map((n, i) => `
        <div class="fc-col" title="${n} Wiederholungen">
          <span class="fc-n">${n || ''}</span>
          <i style="height:${Math.max(3, (n / fcMax) * 72).toFixed(0)}px"></i>
          <span class="fc-l">${names[i]}</span>
        </div>`).join('')}</div>
      <p class="sr-only">${fc.map((n, i) => `${names[i]}: ${n}`).join(', ')} Wiederholungen.</p>
      <p class="tiny" style="margin-top:10px">Fällige Wiederholungen der nächsten sieben Tage – neue Karten kommen noch dazu.</p>`
      : `<p class="muted">Noch nichts eingeplant. Sobald du Karten gelernt hast, siehst du hier, wie viele Wiederholungen an den nächsten Tagen anstehen.</p>`}
    </div>

    ${weak.length ? `
    <h2 class="sec">Deine Schwachstellen</h2>
    <div class="tlist">
      ${weak.map(w => `<button class="trow" data-sub="${esc(w.cat)}|${esc(w.sub)}">
        <span class="tico">${catIcon(w.cat)}</span>
        <span class="grow">
          <h3>${esc(w.sub)}</h3>
          <span class="tiny">${esc(CAT_BY_ID[w.cat].name)} · ${Math.round(w.rate * 100)} % richtig bei ${w.seen} Abfragen</span>
          <span class="bar"><i style="width:${(w.rate * 100).toFixed(0)}%"></i></span>
        </span>
        <span class="pct">üben</span>
      </button>`).join('')}
    </div>` : ''}

    ${wochen.length >= 2 ? verlaufKarte(wochen, trendText) : ''}
    ${selbsteinschaetzung()}

    <h2 class="sec">Wissensstand</h2>
    <div class="card">
      <div class="row between"><span>Trefferquote gesamt</span><b>${Math.round(o.accuracy * 100)} %</b></div>
      <div class="row between" style="margin-top:9px"><span>Karten gefestigt</span><b>${o.mature} / ${o.total}</b></div>
      <div class="row between" style="margin-top:9px"><span>Noch nie gesehen</span><b>${o.total - o.seen}</b></div>
    </div>

    ${(st.quizRunden || []).length ? (() => {
      const runden = st.quizRunden.slice(-5);
      const schnitt = Math.round(runden.reduce((a, r) => a + r.p, 0) / runden.length);
      const schwach = schwaechstesFeld(st.quizRunden);
      return `
    <h2 class="sec">Quiz</h2>
    <div class="card">
      <div class="row between"><span>Bestwert</span><b>${st.quizBest || 0} / ${QUIZ_MAX}</b></div>
      <div class="row between" style="margin-top:9px"><span>${runden.length === 1 ? 'Letzte Runde' : `Ø der letzten ${runden.length} Runden`}</span><b>${schnitt}</b></div>
      ${schwach ? `<div class="row between" style="margin-top:9px"><span>Meiste Punkte verloren</span><b>${esc(CAT_BY_ID[schwach.cat]?.name || schwach.cat)}</b></div>` : ''}
    </div>`; })() : ''}

    <h2 class="sec">Nach Stufe</h2>
    <div class="tlist">
      ${[1, 2, 3].map(d => {
        const l = stufen[d] || { n: 0, pct: 0, seen: 0, mature: 0 };
        return `<div class="trow schmal" style="pointer-events:none">
          <span class="grow">
            <h3>${esc(LEVELS[d].name)}</h3>
            <span class="tiny">${esc(LEVELS[d].hint)}<br>${l.n} Karten · ${l.seen} begonnen · ${l.mature} sitzen fest</span>
            <span class="bar"><i style="width:${(l.pct * 100).toFixed(0)}%"></i></span>
          </span>
          <span class="pct">${Math.round(l.pct * 100)}%</span></div>`;
      }).join('')}
    </div>

    <h2 class="sec">Nach Thema</h2>
    <div class="tlist">
      ${CATS.map(c => {
        const s = p[c.id] || { pct: 0, n: 0 };
        // Ein abgeschaltetes Thema zaehlt weiter mit (die Karten bleiben ja gelernt),
        // aber ohne Hinweis wundert man sich, warum der Balken tagelang stehenbleibt.
        const aus = !sess.catAktiv(c.id);
        return `<div class="trow${aus ? ' aus' : ''}" style="pointer-events:none">
          <span class="tico">${catIcon(c.id)}</span>
          <span class="grow"><h3>${esc(c.name)}${aus ? ' <span class="merk">pausiert</span>' : ''}</h3><span class="bar"><i style="width:${(s.pct * 100).toFixed(0)}%"></i></span></span>
          <span class="pct">${Math.round(s.pct * 100)}%</span></div>`;
      }).join('')}
    </div>`;

  bindeTeilgebiete();
}

/* Der Fortschritt liegt allein im Browserspeicher. Safari raeumt den Speicher
   von Websites nach laengerer Nichtnutzung auf, ein neues Handy hat ihn ohnehin
   nicht - und die App kann von sich aus nichts hochladen. Also erinnert sie,
   sobald genug Arbeit drinsteckt, um den Verlust zu spueren. */
function sicherungsHinweis() {
  const st = S();
  const seit = store.tageSeitSicherung();
  if ((st.totalAnswers || 0) < 120) return '';          // vorher lohnt der Hinweis nicht
  if (seit !== null && seit < 30) return '';
  const text = seit === null
    ? 'Dein Fortschritt liegt nur in diesem Browser. Sichere ihn einmal als Datei – dann übersteht er auch ein neues Handy.'
    : `Die letzte Sicherung ist ${seit} Tage her. Ein geleerter Websitespeicher würde den Fortschritt mitnehmen.`;
  return `<div class="hinweis" style="margin-top:12px">
    <b>Fortschritt sichern.</b> ${text}
    <button class="btn sm ghost" id="sichernJetzt" style="margin-top:9px">Jetzt als Datei sichern</button>
  </div>`;
}

/* Sichern als Datei. Der Zeitpunkt wird vermerkt, damit die Startseite
   erinnern kann, bevor Monate an Fortschritt an einem geloeschten
   Websitespeicher haengen. */
async function sichern() {
  const name = `wissenswerk-${dayKey()}.json`;
  const datei = new File([store.exportJSON()], name, { type: 'application/json' });

  /* Als installierte App vom Home-Bildschirm kennt iOS keinen Download-Ordner:
     ein <a download> verpufft dort still - der Knopf saehe kaputt aus, und
     schlimmer, der Nutzer glaubte gesichert zu haben. Das Teilen-Blatt ist der
     Weg, den iOS fuer Dateien vorsieht; "In Dateien sichern" liegt direkt darin. */
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: name });
      store.merkeSicherung();
      toast('Gesichert');
      return true;
    } catch (e) {
      // Abbruch im Teilen-Blatt heisst: NICHT gesichert - nichts vermerken.
      if (e.name === 'AbortError') return false;
      // Alles andere (Teilen dieser Datei doch nicht moeglich): Download versuchen.
    }
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(datei);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  store.merkeSicherung();
  toast('Gesichert – die Datei liegt in „Downloads“');
  return true;
}

/* ---- Nachschlagen: suchen, lesen, markieren ---- */
let lookupQuery = '';

/* Suchindex einmal aufbauen statt bei jedem Tastendruck über alle Karten zu normalisieren.
   Bei über tausend Karten macht das den Unterschied zwischen ruckelnder und flüssiger Eingabe.

   In Scheiben aufbaubar, nicht nur am Stueck: normalize() ueber alle 2.323
   Karten in einem Zug kostete auf einem vierfach gedrosselten Handy 711 ms und
   auf einem sechsfach gedrosselten 1.099 ms - gemessen genau in dem Moment, in
   dem der Nachschlage-Bildschirm aufgeht, weil der Leerlauf-Aufbau direkt nach
   dem ersten Zeichnen anlief. indexTeil() fuellt nur, was noch fehlt; wer vor
   dem Ende des Vorwaermens tippt, zahlt den Rest und nicht alles noch einmal. */
let SEARCH_INDEX = null;
function indexTeil(von, bis) {
  if (!SEARCH_INDEX) SEARCH_INDEX = new Array(CARDS.length);
  const ende = Math.min(bis, CARDS.length);
  for (let i = von; i < ende; i++) {
    if (SEARCH_INDEX[i]) continue;
    const c = CARDS[i];
    // Genau der Text von vorher: Was frueher gefunden wurde, wird weiter gefunden.
    SEARCH_INDEX[i] = { alles: normalize(`${c.q} ${c.a} ${c.sub} ${CAT_BY_ID[c.cat].name} ${c.t}`) };
  }
}
function searchIndex() {
  indexTeil(0, CARDS.length);
  return SEARCH_INDEX;
}

/* Den Suchindex in der Leerlaufzeit aufbauen, nicht beim ersten Tastendruck:
   normalize() ueber alle Karten kostet 128 ms, auf einem gedrosselten iPhone
   rund eine halbe Sekunde - lang genug, dass die ersten Zeichen verschluckt
   werden.

   Die Einzelfelder gehoeren in denselben Leerlauf. felder() rechnet sie
   aufgeschoben, „nur fuer Karten, die ueberhaupt treffen" - und genau diese
   Annahme faellt beim ERSTEN Buchstaben um: 'e' trifft alle Karten, 'v' noch
   1.538. In Scheiben zu 150 Karten bleibt die laengste Luecke bei 169 ms, und
   felder() traegt den aufgeschobenen Pfad weiter, falls jemand vor dem Ende
   des Vorwaermens tippt.

   Angestossen wird das schon VOR dem Oeffnen der Suche - aber mit Abstand zum
   Start. Der Weg dahin ist gemessen, und der naheliegende war falsch:

     (a) erst beim Oeffnen der Suche (vorher): Start 581 ms, Suche kalt 1.580 ms
     (b) sofort beim Start:                    Start 1.021 ms, Suche kalt 916 ms
     (c) zwei Sekunden nach dem Start:         Start 578 ms, Suche kalt 1.567 ms

   (Median aus je sieben Laeufen bei vierfacher Drosselung; bei sechsfacher
   dasselbe Bild mit 853 / 1.485 / 861 ms Start.) Variante (b) kauft eine
   halbe Sekunde in der Suche fuer eine halbe Sekunde bei JEDEM Start - ein
   schlechter Tausch, denn die Suche erreicht man selten sofort, die Startseite
   immer. Variante (c) kostet am Start nichts und hat den Index warm, sobald
   jemand die Lupe antippt: Wer nach drei Sekunden auf der Startseite sucht,
   wartet 246 statt 1.523 ms. Nur wer die App oeffnet und binnen zwei Sekunden
   tippt, zahlt wie vorher - renderLookup() stoesst das Waermen dann mit an. */
const WAERMEN_NACH_MS = 2000;
let waermeLaeuft = false, waermeFertig = false;
function waermeIndex() {
  if (waermeLaeuft || waermeFertig) return;
  waermeLaeuft = true;
  const leerlauf = window.requestIdleCallback || ((f) => setTimeout(f, 0));
  const haeppchen = (i) => {
    const bis = Math.min(CARDS.length, i + 150);
    indexTeil(i, bis);
    for (let k = i; k < bis; k++) felder(k);
    if (bis < CARDS.length) leerlauf(() => haeppchen(bis));
    else { waermeLaeuft = false; waermeFertig = true; }
  };
  leerlauf(() => haeppchen(0));
}

/* Die Einzelfelder braucht nur die Reihenfolge, also nur fuer Karten, die
   ueberhaupt treffen – und dann einmal. Sie beim Aufbau des Index gleich
   mitzurechnen kostete auf einem gedrosselten Handy fast eine Sekunde extra
   beim ersten Suchlauf, fuer Karten, die meist gar nicht in der Liste landen. */
function felder(i) {
  indexTeil(i, i + 1);            // der Eintrag kann noch fehlen, wenn erst ein Teil warm ist
  const e = SEARCH_INDEX[i];
  if (e.frage === undefined) {
    const c = CARDS[i];
    e.frage = normalize(c.q);
    e.antwort = normalize(c.a);
    e.gebiet = normalize(`${c.sub} ${CAT_BY_ID[c.cat].name}`);
    e.kontext = normalize(c.t);
  }
  return e;
}

/* Gesucht wird nach Teilzeichenketten – das ist absichtlich grosszuegig, damit
   „integr" auch „Integral" findet. Ohne Reihenfolge stand dadurch aber Unsinn
   oben: „dna" steckt in „schuldnachweis", „standardnah" und
   „rekordnationalspieler", und die beiden echten DNA-Karten landeten auf Platz
   drei und vier. Bei „Grundgesetz" gewann die Goldene Bulle, weil das Wort in
   ihrem Kontexttext vorkommt.

   Deshalb zaehlt jetzt, WO der Treffer sitzt: Frage vor Antwort vor Teilgebiet
   vor Kontext – und ein ganzes Wort vor einem Wortteil. */
/* Die Ausdruecke werden einmal je Suchbegriff gebaut, nicht je Karte und Feld:
   Bei einer breiten Suche waeren das sonst Tausende pro Tastendruck. */
const wortMuster = (terms) => terms.map(t => ({
  t, re: new RegExp(`(^| )${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`),
}));

function trefferGewicht(e, muster) {
  let punkte = 0;
  for (const { t, re } of muster) {
    if (re.test(e.frage)) punkte += 8;
    else if (e.frage.includes(t)) punkte += 4;
    if (re.test(e.antwort)) punkte += 6;
    else if (e.antwort.includes(t)) punkte += 3;
    if (re.test(e.gebiet)) punkte += 4;
    if (re.test(e.kontext)) punkte += 2;
  }
  return punkte;
}
function renderLookup() {
  app.innerHTML = `
    <h1 class="vh">Nachschlagen</h1>
    <input class="recall-in" id="q" type="search" inputmode="search" autocomplete="off"
           aria-label="Karten durchsuchen" placeholder="Suchen – Frage, Antwort oder Thema" value="${esc(lookupQuery)}">
    <p class="tiny" style="margin:8px 2px 0">Tippe auf eine Karte, um Antwort und Kontext zu sehen. Mit dem Stern markierst du sie fürs gezielte Üben.</p>
    <div id="res"></div>`;
  const input = document.getElementById('q');
  const res = document.getElementById('res');

  const paint = () => {
    const q = normalize(lookupQuery);
    const terms = q.split(' ').filter(Boolean);
    /* Ob das Feld leer ist, entscheidet das Getippte - nicht das, was
       normalize() davon uebrig laesst. Ein ∫, ∑ oder schlicht „???" ergibt
       keinen Suchbegriff; vorher fiel die Suche dann in den Zweig fuers leere
       Feld und legte markierte oder zufaellige Karten vor, als waeren sie das
       Ergebnis - waehrend das Zeichen sichtbar im Feld stand. */
    const getippt = lookupQuery.trim() !== '';
    let list;
    if (!terms.length) {
      /* Markierte zuletzt zuerst: Die Liste wird bei 60 abgeschnitten, und
         CARDS steht nach Themen sortiert - bei 85 Markierungen fielen immer
         die der hinteren Themen weg, also ausgerechnet die zuletzt gesetzten. */
      const marken = S().flags || {};
      list = getippt ? [] : CARDS.filter(c => isFlagged(c.id))
        .sort((a, b) => (Number(marken[b.id]) || 0) - (Number(marken[a.id]) || 0));
      if (!getippt && !list.length) list = shuffle(CARDS).slice(0, 20);
    } else {
      const idx = searchIndex();
      const muster = wortMuster(terms);
      const treffer = [];
      CARDS.forEach((c, i) => {
        if (terms.every(t => idx[i].alles.includes(t))) treffer.push([c, trefferGewicht(felder(i), muster)]);
      });
      treffer.sort((a, b) => b[1] - a[1]);          // gleiche Punktzahl behaelt die Reihenfolge
      list = treffer.map(x => x[0]);
    }
    const shown = list.slice(0, 60);
    res.innerHTML = `
      <p class="tiny" style="margin:14px 2px 8px">${
        !terms.length && !getippt && list.some(c => isFlagged(c.id))
          ? `Deine ${list.length} markierten Karten${list.length > 60 ? ' – die ersten 60' : ''}`
        : !terms.length && !getippt ? 'Zufällige Auswahl – tippe etwas ein zum Suchen'
        : `${list.length} Treffer${list.length > 60 ? ', die ersten 60' : ''}`}</p>
      ${shown.map(c => {
        const cs = cardState(c.id);
        const st = cs ? Math.round(strength(cs) * 100) : 0;
        const markiert = isFlagged(c.id);
        return `<div class="lk" data-id="${c.id}">
          <div class="lk-head">
            <button type="button" class="grow lk-btn" data-auf="${c.id}"
                    aria-expanded="false" aria-controls="lkb-${c.id}">
              <span class="qcat">${catIcon(c.cat, 's')}<span>${esc(c.sub)}</span></span>
              <span class="lk-q">${esc(c.q)}</span>
            </button>
            <button type="button" class="star ${markiert ? 'on' : ''}" data-flag="${c.id}"
                    aria-pressed="${markiert}" aria-label="Karte markieren">${ico('stern')}</button>
          </div>
          <div class="lk-body" id="lkb-${c.id}" hidden>
            <div class="answer">
              <div class="lab">Antwort</div>
              <div class="val">${esc(c.a)}</div>
              ${c.t ? `<p class="expl">${esc(c.t)}</p>` : ''}
            </div>
            <p class="tiny" style="margin-top:8px">${cs && cs.seen ? `${st} % gefestigt · ${cs.seen}× abgefragt` : 'Noch nicht gelernt'} · Stufe ${LEVELS[c.d].name}</p>
          </div>
        </div>`;
      }).join('') || '<p class="empty">Nichts gefunden. Andere Wörter probieren?</p>'}`;

    // Ein echter Knopf statt eines anklickbaren Kastens: nur so laesst sich
    // die Antwort auch mit Tastatur oder Sprachsteuerung aufdecken.
    res.querySelectorAll('[data-auf]').forEach(kn => kn.onclick = () => {
      const el = kn.closest('.lk');
      const b = el.querySelector('.lk-body');
      b.hidden = !b.hidden;
      el.classList.toggle('open', !b.hidden);
      kn.setAttribute('aria-expanded', String(!b.hidden));
    });
    res.querySelectorAll('[data-flag]').forEach(b => b.onclick = () => {
      const on = toggleFlag(b.dataset.flag);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      toast(on ? 'Markiert' : 'Markierung entfernt', 1200);
    });
  };

  let timer;
  input.addEventListener('input', () => {
    lookupQuery = input.value;
    clearTimeout(timer);
    timer = setTimeout(paint, 120);
  });
  paint();
  waermeIndex();
}

function renderSettings() {
  const s = settings();
  /* Nur Kuerzel, die es wirklich gibt. Eine Sicherungsdatei kann 'sprache'
     statt 'spr' tragen; session.js laesst solche Eintraege beim Rechnen aussen
     vor, also darf dieser Bildschirm sie auch nicht als wirksam ausgeben.
     Frueher stand hier zusaetzlich CAT_BY_ID[id].name ohne Fragezeichen - ein
     erfundenes Kuerzel im Schwerpunkt liess den Bildschirm werfen, und mit ihm
     waren die drei Notausgaenge (Einlesen, Rueckgaengig, Zuruecksetzen)
     dauerhaft unerreichbar. */
  const echte = (s.cats || []).filter(id => CAT_BY_ID[id]);
  const sel = echte.length ? echte : CATS.map(c => c.id);
  /* Nur aktive Themen koennen Schwerpunkt sein - ein abgeschaltetes zu
     bevorzugen waere ein Widerspruch, den die App nicht anzeigen sollte. Und
     deckt der Schwerpunkt ALLE aktiven Themen ab, ist er keiner: Jedes Thema
     bekaeme zwei Zuege statt einem, rechnerisch dasselbe wie ohne Schwerpunkt.
     Dieser Zustand entsteht von hinten - Schwerpunkt bei neun aktiven Themen
     setzen, spaeter die uebrigen sieben abschalten -, und danach stand hier
     „Zurzeit sind Mathematik und Sport bevorzugt", waehrend die Ziehung sie
     gleich behandelte (gemessen: 6,00 / 6,00 neue Karten, wie ohne
     Schwerpunkt). focusCats() in session.js rechnet mit derselben Regel. */
  const gewaehlt = (s.focus || []).filter(id => CAT_BY_ID[id] && sel.includes(id));
  const fok = gewaehlt.length < sel.length ? gewaehlt : [];
  const flags = sess.flaggedCount();
  const f = fassungGemerkt();
  const wartet = !!(swReg && swReg.waiting);
  app.innerHTML = `
    <h1 class="vh">Einstellungen</h1>
    <h2 class="sec">Tagespensum</h2>
    <div class="card">
      <div class="setrow">
        <div><label for="npd">Neue Karten pro Tag</label><p class="tiny">Mehr heißt schneller – aber auch mehr Wiederholungen später.</p></div>
        <select id="npd">${[4, 6, 8, 10, 12, 15, 20, 25, 30].map(n => `<option value="${n}" ${n === s.newPerDay ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </div>
      <div class="setrow">
        <div><label for="mrv">Wiederholungen max.</label><p class="tiny">Deckel für volle Tage.</p></div>
        <select id="mrv">${[30, 50, 70, 90, 120, 200].map(n => `<option value="${n}" ${n === s.maxReviews ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </div>
      <div class="setrow">
        <div><label for="rec">Abfrage-Art</label><p class="tiny">Freies Abrufen sitzt tiefer als Ankreuzen.</p></div>
        <select id="rec">
          <option value="auto" ${s.recallMode === 'auto' ? 'selected' : ''}>Automatisch</option>
          <option value="mc" ${s.recallMode === 'mc' ? 'selected' : ''}>Immer Auswahl</option>
          <option value="recall" ${s.recallMode === 'recall' ? 'selected' : ''}>Immer frei</option>
        </select>
      </div>
      <div class="setrow">
        <div><label for="lvl">Reihenfolge neuer Karten</label><p class="tiny">Grundlagen zuerst schließt Schullücken – Fachliches wie Analysis oder Bewegungslehre kommt dann erst nach etwa sechs Wochen. Bunt gemischt bringt beides von Anfang an.</p></div>
        <select id="lvl">
          <option value="ladder" ${s.level === 'ladder' ? 'selected' : ''}>Grundlagen zuerst</option>
          <option value="mixed" ${s.level === 'mixed' ? 'selected' : ''}>Bunt gemischt</option>
        </select>
      </div>
      <div class="setrow">
        <div><label for="snd">Ton bei Antwort</label></div>
        <span class="switch"><input type="checkbox" id="snd" ${s.sound ? 'checked' : ''}><i></i></span>
      </div>
      <div class="setrow">
        <div><label for="tnk">Neue Karten trotz Rückstand</label><p class="tiny">Aus: Bei vielen offenen Wiederholungen pausieren neue Karten, damit der Berg nicht wächst.</p></div>
        <span class="switch"><input type="checkbox" id="tnk" ${s.trotzdemNeu ? 'checked' : ''}><i></i></span>
      </div>
      <div class="setrow">
        <div><label for="qlw">Lehrerwissen in der Quizrunde</label><p class="tiny">Aus: Die Quizrunde fragt wie ein Spieleabend – Analysis, Stochastik, Trainingslehre und Sportdidaktik bleiben dem Tagestraining vorbehalten.</p></div>
        <span class="switch"><input type="checkbox" id="qlw" ${s.quizLehrerwissen ? 'checked' : ''}><i></i></span>
      </div>
      <div class="setrow">
        <div><label for="thm">Farbschema</label><p class="tiny">Hell ist draußen bei Sonne besser lesbar.</p></div>
        <select id="thm">
          <option value="system" ${(s.theme || 'system') === 'system' ? 'selected' : ''}>Wie das System</option>
          <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Immer dunkel</option>
          <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Immer hell</option>
        </select>
      </div>
    </div>

    <h2 class="sec">Aktive Themen</h2>
    <div class="card">
      <div class="row wrap" style="gap:8px">
        ${CATS.map(c => `<button type="button" class="chip ${sel.includes(c.id) ? 'on' : ''}" data-tog="${c.id}" aria-pressed="${sel.includes(c.id)}">${catIcon(c.id, 's')}${esc(c.name)}</button>`).join('')}
      </div>
      <p class="tiny" style="margin-top:10px">Abgeschaltete Themen tauchen im Tagestraining nicht mehr auf.</p>
    </div>

    ${sel.length > 1 ? `
    <h2 class="sec">Schwerpunkt</h2>
    <div class="card">
      <div class="row wrap" style="gap:8px">
        ${CATS.filter(c => sel.includes(c.id)).map(c => `<button type="button" class="chip ${fok.includes(c.id) ? 'on' : ''}" data-fok="${c.id}" aria-pressed="${fok.includes(c.id)}">${catIcon(c.id, 's')}${esc(c.name)}</button>`).join('')}
      </div>
      <p class="tiny" style="margin-top:10px">Schwerpunktthemen bekommen doppelt so viele neue Karten pro Tag.
        ${fok.length ? `Zurzeit ${fok.length === 1 ? 'ist' : 'sind'} ${fok.map(id => esc(CAT_BY_ID[id]?.name || id)).join(' und ')} bevorzugt.`
          : 'Ohne Auswahl kommen alle Themen gleich oft dran.'}</p>
    </div>` : ''}

    <h2 class="sec">Auf dem iPhone installieren</h2>
    <div class="card">
      <p class="muted">Safari öffnen → <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Danach startet Wissenswerk wie eine echte App, auch offline.</p>
    </div>

    <h2 class="sec">Fassung</h2>
    <div class="card">
      <div class="setrow">
        <div>
          <label>Installierte Fassung</label>
          <p class="tiny">${esc(fassungKurz(FASSUNG)) || '—'}${f && f.seit ? ` · seit ${new Date(f.seit).toLocaleDateString('de-DE')}` : ''}</p>
        </div>
        <button class="btn" id="updSuch">Suchen</button>
      </div>
      ${wartet
        ? `<div class="btn-stack" style="margin-top:11px"><button class="btn primary" id="updNun">Neue Fassung laden</button></div>
           <p class="tiny" style="margin-top:9px">Eine neue Fassung liegt bereit. Beim Laden startet die App einmal neu – dein Lernfortschritt bleibt.</p>`
        : `<p class="tiny" style="margin-top:11px">Wissenswerk meldet sich, sobald eine neue Fassung da ist – ausgetauscht wird erst, wenn du zustimmst.</p>`}
    </div>

    <h2 class="sec">Daten</h2>
    <div class="card">
      <div class="btn-stack">
        <button class="btn" id="exp">Fortschritt sichern (Datei)</button>
        <button class="btn" id="imp">Fortschritt einlesen</button>
        <input type="file" id="impFile" accept="application/json" hidden>
        ${flags ? `<button class="btn" id="clrFlags">Alle ${flags} Markierungen löschen</button>` : ''}
        <button class="btn danger" id="rst">Alles zurücksetzen</button>
        ${(() => {
          /* Die Beschriftung nennt, worauf der Knopf zurueckgeht. „Letztes
             Einlesen rueckgaengig" stand auch noch Monate spaeter da, ohne
             Datum und ohne Zahlen, zehn Pixel unter dem roten Knopf. */
          const n = store.sicherungKennzahlen();
          return n ? `<button class="btn" id="undoImp">Gesicherten Stand zurückholen (${n.karten} Karten)</button>` : '';
        })()}
      </div>
      <p class="tiny" style="margin-top:10px">Alles liegt nur auf diesem Gerät – kein Konto, kein Server. Löschst du in Safari die Website-Daten, ist der Fortschritt weg. Sichere ihn gelegentlich.</p>
    </div>
    <p class="tiny center" style="margin-top:18px">${CARDS.length} Karten · Wissenswerk</p>`;

  const bind = (id, key, cast = v => v) => {
    document.getElementById(id).onchange = e => setSetting(key, cast(e.target.value));
  };
  bind('npd', 'newPerDay', Number);
  bind('mrv', 'maxReviews', Number);
  bind('rec', 'recallMode');
  bind('lvl', 'level');
  document.getElementById('snd').onchange = e => setSetting('sound', e.target.checked);
  document.getElementById('thm').onchange = e => { setSetting('theme', e.target.value); applyTheme(); };
  document.getElementById('tnk').onchange = e => setSetting('trotzdemNeu', e.target.checked);
  document.getElementById('qlw').onchange = e => setSetting('quizLehrerwissen', e.target.checked);

  app.querySelectorAll('[data-fok]').forEach(b => b.onclick = () => {
    /* Aus den aktiven Themen aufbauen, nicht aus der rohen Einstellung: Ein
       abgeschaltetes Thema, das noch in focus stand, zaehlte sonst mit – bei
       einem einzigen aktiven Thema war cur.size damit nie kleiner als
       sel.length, und der Knopf liess sich ueberhaupt nicht einschalten. */
    const cur = new Set((settings().focus || []).filter(x => sel.includes(x)));
    const id = b.dataset.fok;
    cur.has(id) ? cur.delete(id) : cur.add(id);
    // Alle als Schwerpunkt zu setzen hiesse: keiner. Dann lieber leeren.
    setSetting('focus', cur.size && cur.size < sel.length ? [...cur] : null);
    renderSettings();
  });

  app.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    /* sel und nicht die rohe Einstellung: Ein erfundenes Kuerzel aus einer
       Sicherungsdatei ueberlebte sonst jedes Umschalten, und die Knopfreihe
       zeigte etwas anderes an, als gespeichert wurde. */
    const cur = new Set(sel);
    const id = b.dataset.tog;
    cur.has(id) ? cur.delete(id) : cur.add(id);
    if (!cur.size) return toast('Mindestens ein Thema muss aktiv bleiben');
    setSetting('cats', cur.size === CATS.length ? null : [...cur]);
    renderSettings();
  });

  document.getElementById('exp').onclick = () => sichern();
  const file = document.getElementById('impFile');
  document.getElementById('imp').onclick = () => file.click();
  file.onchange = () => {
    const f = file.files[0];
    file.value = '';                       // sonst loest dieselbe Datei kein change mehr aus
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      // Erst lesen und beschreiben, dann fragen, dann erst ersetzen. Der Fortschritt
      // liegt nur auf diesem Geraet - ein Fehlgriff im Dateiwaehler darf ihn nicht kosten.
      let neu;
      try { neu = store.pruefeBackup(r.result); }
      catch (e) { return toast('Das ist kein Wissenswerk-Backup'); }
      const a = store.kennzahlen(neu), b = store.kennzahlen(S());
      const tag = (d) => (d ? new Date(d).toLocaleDateString('de-DE') : 'noch nie');
      const frage = `Diese Datei ersetzt deinen ganzen Fortschritt.\n\n`
        + `Aus der Datei:   ${a.karten} Karten, ${a.antworten} Antworten, zuletzt ${tag(a.letzterTag)}\n`
        + `Jetzt gespeichert: ${b.karten} Karten, ${b.antworten} Antworten, zuletzt ${tag(b.letzterTag)}\n\n`
        + `Wirklich ersetzen?`;
      if (!confirm(frage)) return toast('Nichts geändert');
      /* importJSON meldet jetzt, ob geschrieben wurde. Frueher stand bei vollem
         Speicher „Fortschritt geladen" neben „Speicher voll" – und beim
         naechsten Oeffnen war das Backup wieder weg. */
      let geschrieben;
      try { geschrieben = store.importJSON(r.result); }
      catch (e) { return toast('Das ist kein Wissenswerk-Backup'); }
      applyTheme();
      toast(geschrieben
        ? 'Fortschritt geladen – rückgängig unter „Mehr“'
        : 'Der Speicher ist voll – der Stand konnte nicht abgelegt werden');
      show('home');
    };
    r.onerror = () => toast('Datei ließ sich nicht lesen');
    r.readAsText(f);
  };
  document.getElementById('undoImp')?.addEventListener('click', () => {
    /* Das Netz unter Einlesen und Zuruecksetzen. Die Rueckfrage nannte frueher
       keine Zahlen – und der Knopf steht Monate nach dem Einlesen unveraendert
       da. Wer ihn dann antippt, warf drei Monate Lernen weg. Jetzt stellt die
       Rueckfrage beide Staende gegenueber, genau wie der Einlesen-Dialog, und
       der Griff ist umkehrbar: ein zweiter Tipp holt den jetzigen zurueck. */
    const netz = store.sicherungKennzahlen();
    if (!netz) return toast('Keine Sicherung vorhanden');
    const jetzt = store.kennzahlen(S());
    const tag = (d) => (d ? new Date(d).toLocaleDateString('de-DE') : 'noch nie');
    const frage = 'Den gesicherten Stand wiederherstellen?\n\n'
      + `Wiederhergestellt wird: ${netz.karten} Karten, ${netz.antworten} Antworten, zuletzt ${tag(netz.letzterTag)}\n`
      + `Jetzt gespeichert:      ${jetzt.karten} Karten, ${jetzt.antworten} Antworten, zuletzt ${tag(jetzt.letzterTag)}\n\n`
      + 'Der jetzige Stand wandert dabei in die Sicherung – du kommst also zurück.';
    if (!confirm(frage)) return toast('Nichts geändert');
    if (store.sicherungZurueck()) { applyTheme(); toast('Gesicherter Stand wiederhergestellt'); show('home'); }
    else toast('Keine Sicherung vorhanden');
  });
  document.getElementById('clrFlags')?.addEventListener('click', () => {
    // Nicht S().flags leeren: Der zweite offene Tab holte die Sterne sonst zurueck.
    store.loescheAlleMarkierungen(); toast('Markierungen gelöscht'); renderSettings();
  });
  document.getElementById('updSuch')?.addEventListener('click', async () => {
    if (!swReg) return toast('Der Offline-Speicher wird noch eingerichtet');
    toast('Wird geprüft …');
    try { await swReg.update(); }
    catch (e) { return toast('Keine Verbindung – später noch einmal versuchen'); }
    /* update() stoesst bei einer neuen Fassung erst das Installieren an; das
       Ergebnis steht nicht sofort fest. Deshalb kurz warten, statt vorschnell
       „alles aktuell" zu behaupten. */
    setTimeout(() => {
      const bereit = swReg.waiting || swReg.installing;
      /* Nur neu zeichnen, wenn der Nutzer ueberhaupt noch hier ist. Ohne diese
         Bedingung zeichnete der Nachlauf die Einstellungen ueber eine inzwischen
         gestartete Runde: Die Runde verschwand mitsamt Rueckblick, und weil
         startRun() Leiste und Kopfzeile ausblendet, stand der Nutzer ohne jede
         Navigation da - herauszukommen war nur ueber Neuladen oder die
         zerstoerenden Knoepfe. Der Balken holt das Angebot ohnehin nach. */
      if (view === 'settings' && !run) renderSettings();
      toast(bereit ? 'Neue Fassung gefunden' : 'Du hast bereits die neueste Fassung');
    }, 1500);
  });
  document.getElementById('updNun')?.addEventListener('click', () => {
    const w = swReg && swReg.waiting;
    if (!w) { renderSettings(); return toast('Die neue Fassung ist nicht mehr bereit'); }
    w.postMessage('jetzt-uebernehmen');
    toast('Wird geladen …');
  });
  document.getElementById('rst').onclick = () => {
    if (confirm('Wirklich den gesamten Lernfortschritt löschen?')) {
      store.resetAll(); applyTheme(); toast('Zurückgesetzt'); show('home');
    }
  };
}

/* ================= Lerneinheit ================= */
/* Laufender Zeitgeber der Duellfrage – muss beim Verlassen der Ansicht enden,
   sonst feuert er weiter und ruft finish() auf einem längst ersetzten Bildschirm auf. */
let duelTimer = null;
function stopDuelTimer() { if (duelTimer) { clearInterval(duelTimer); duelTimer = null; } }

/* Wie lange steht diese Frage schon da – gerechnet nur fuer die Zeit, in der die
   App tatsaechlich sichtbar war.

   Gerechnet wird mit der Uhrzeit und nicht mit Zeitgeber-Ticks, damit gedrosselte
   Intervalle die Messung nicht verfaelschen. Die Uhrzeit laeuft aber auch weiter,
   waehrend das Handy klingelt oder gesperrt ist, und daran haengen zwei
   Entscheidungen: die Frist im Duell und die Note im Tagestraining. Ohne diese
   Rechnung kostete ein Anruf im Duell die Frage – und im Tagestraining wurde eine
   sofortige richtige Antwort als „Schwer" gewertet, was den Leichtigkeitsfaktor
   der Karte dauerhaft senkt.

   Es laeuft immer hoechstens eine Messung: Die naechste beendet die vorige, damit
   kein Horcher am Dokument haengen bleibt, wenn eine Frage ohne Antwort verlassen
   wird. */
let laufendeMessung = null;
/* eigenstaendig: eine Messung, die NICHT den Platz der laufenden Fragenmessung
   einnimmt. Die Runde als Ganzes braucht das - sonst beendete die naechste
   Frage die Rundenuhr, und ab da zaehlte sie auch die Zeit mit, in der die App
   im Hintergrund lag. */
function sichtbareZeit(eigenstaendig = false) {
  if (!eigenstaendig && laufendeMessung) laufendeMessung.beenden();
  const start = Date.now();
  let versteckt = 0;
  let seit = document.visibilityState === 'hidden' ? start : 0;
  const horcher = () => {
    if (document.visibilityState === 'hidden') seit = seit || Date.now();
    else if (seit) { versteckt += Date.now() - seit; seit = 0; }
  };
  document.addEventListener('visibilitychange', horcher);
  const messen = () => Date.now() - start - versteckt - (seit ? Date.now() - seit : 0);
  messen.beenden = () => {
    document.removeEventListener('visibilitychange', horcher);
    if (laufendeMessung === messen) laufendeMessung = null;
  };
  if (!eigenstaendig) laufendeMessung = messen;
  return messen;
}

/* weiter() baut die Anschlussrunde fuer „Weitermachen". Es steht hier und nicht
   im Rueckblick, weil nur die aufrufende Stelle weiss, WAS gerade geuebt wurde:
   Vorher las der Rueckblick nur den Modus und baute fuer alles ausser dem Duell
   einfach den Tagesplan - wer gezielt ein Thema, ein Teilgebiet, die
   Wackelkandidaten oder die Markierten uebte, bekam beim Weitermachen still
   etwas anderes, ohne dass es irgendwo stand. */
function startRun(queue, mode, weiter = null) {
  if (!queue.length) return toast('Nichts zu üben');
  // Die Uhr der vorigen Runde abmelden, damit ihr Horcher am Dokument nicht
  // haengen bleibt - abgebrochene Runden laufen nicht durch endRun().
  run?.uhr?.beenden?.();
  rueckblickOffen = false;
  stopDuelTimer();
  run = {
    queue: queue.slice(), i: 0, mode, weiter,   // weiter(): Anschlussrunde fuer „Weitermachen"
    done: 0, correct: 0,
    /* Die Runde mit derselben sichtbarkeitsbewussten Uhr messen, die die
       einzelnen Fragen schon benutzen. Mit der Wanduhr wurde aus einer Runde
       von fuenfzehn Sekunden, unterbrochen von drei Stunden Pause, ein
       Rueckblick „1 von 3 richtig · 180 Min." - und days[heute].sec bekam
       10.803 Sekunden Lernzeit gutgeschrieben. */
    uhr: sichtbareZeit(true),
    total: queue.length, added: 0,
    wrong: [], undo: null,
    nochmal: new Map(),         // Karte -> wie oft in dieser Einheit schon nachgereicht
    quiz: mode === 'quiz' ? { antworten: [], punkte: 0 } : null   // Punktestand der Quizrunde
  };
  topbar.hidden = true; nav.hidden = true;
  app.classList.add('full');
  /* Ein bereits stehender Update-Balken blieb ueber der ersten Karte liegen.
     .toast.aktion laesst Tipper zwar durch, sein Knopf aber nicht: Ein Tipp auf
     die oberste Antwortmoeglichkeit landete auf „Laden". updateAnbieten() haelt
     das Angebot waehrend einer Runde ohnehin zurueck – nur ein Balken, der
     schon dastand, kam nie weg. holeUpdateNach() bringt ihn nach der Runde. */
  const angebot = document.querySelector('.toast.aktion:not(.speicher)');
  if (angebot) { angebot.remove(); updateWartet = true; }
  // Waehrend einer Runde traegt der Fuss die Knoepfe – der Hinweisbalken rueckt hoch.
  document.documentElement.style.setProperty('--toast-b', 'calc(var(--safe-b) + 128px)');
  sperreStart();          // der zweite Tipp des Startknopfs trifft sonst die erste Antwort
  step();
}

function endRun() {
  document.documentElement.style.removeProperty('--toast-b');
  stopDuelTimer();
  const r = run;
  const secs = Math.round(r.uhr() / 1000);
  r.uhr.beenden();
  store.zaehle('sec', secs);
  if (r.mode === 'duel') S().duelBest = Math.max(S().duelBest || 0, r.correct);
  if (r.mode === 'quiz') {
    r.quiz.aw = auswertung(r.quiz.antworten, CATS.map(c => c.id));
    /* Nur eine ZU ENDE gespielte Runde wird abgelegt. Eine nach einer Frage
       abgebrochene ergab sonst den Eintrag {p:15, m:15}: Der Rueckblick lobte
       „Fehlerfrei und schnell", der Balkenverlauf zeigte sie voll ausgeschlagen
       neben einer echten 145/180, und der Schnitt mittelte rohe Punkte ueber
       Runden mit verschiedenem Maximum. Das Ergebnisbild erscheint weiter - nur
       in die Wertung geht es nicht, so wie ein abgebrochenes Duell auch nicht
       in duelBest wandert.
       Der Bestwert wird NACH dem Ablegen gelesen: merkeQuizRunde holt ueber
       holeFremdenStand() erst den Stand des anderen Tabs ein, und der kann
       einen hoeheren Bestwert tragen als der, den dieser Tab noch kennt. */
    r.quiz.vollstaendig = r.quiz.antworten.length === r.queue.length;
    r.quiz.vorherBest = r.quiz.vollstaendig
      ? merkeQuizRunde(rundenEintrag(r.quiz.aw, Date.now()))
      : (S().quizBest || 0);
  }
  save(true);

  const pctv = r.done ? Math.round(r.correct / r.done * 100) : 0;
  const min = Math.max(1, Math.round(secs / 60));
  topbar.hidden = false; nav.hidden = false;
  app.classList.remove('full');
  onKey = null;
  const praise = pctv >= 90 ? 'Stark!' : pctv >= 70 ? 'Solide Runde.' : 'Genau dafür ist Üben da.';
  // Doppelte entfernen: dieselbe Karte kann mehrfach falsch gewesen sein
  const missed = [...new Map(r.wrong.map(c => [c.id, c])).values()];

  app.innerHTML = r.mode === 'quiz' ? quizRueckblick(r, missed, min) : `
    <div class="done-wrap fade">
      ${ring(pctv / 100)}
      <h1>${praise}</h1>
      <p class="muted">${r.correct} von ${r.done} richtig · ${min} Min.</p>
    </div>
    <div class="card">${wochenstreifen()}</div>
    <div class="kpis" style="margin-top:11px">
      <div class="kpi"><b>${liveStreak()}</b><span>Tage in Folge</span></div>
      <div class="kpi"><b>${today().done}</b><span>heute gelernt</span></div>
      <div class="kpi"><b>${sess.overview().due}</b><span>noch fällig</span></div>
    </div>
    ${fehlerListe(missed)}
    <div class="btn-stack" style="margin-top:18px">
      <button class="btn primary" id="again">Weitermachen</button>
      <button class="btn ghost" id="home">Zur Übersicht</button>
    </div>`;
  /* Der Rueckblick zeigte Frage, Antwort und Kontext offen nebeneinander. Nach
     der eigenen Regel dieser App ist blosses Lesen die schwaechste Lernform –
     also steht die Loesung auch hier hinter einem Griff. */
  bindeAufdecken();
  document.getElementById('again').onclick = () => {
    const q = r.weiter ? r.weiter() : [];
    q.length ? startRun(q, r.mode, r.weiter) : show('home');
  };
  document.getElementById('home').onclick = () => show('home');
  bindeNachlegen();
  run = null;
  rueckblickOffen = true;
  holeUpdateNach();
  paintChrome();
}

/* Die verfehlten Karten nach einer Runde - hinter einem Griff, siehe endRun. */
function fehlerListe(missed) {
  if (!missed.length) return '';
  return `
      <h2 class="sec">Das saß noch nicht (${missed.length})</h2>
      <div class="tlist">
        ${missed.slice(0, 12).map(c => `<div class="card" style="padding:13px 14px">
          <span class="qcat">${catIcon(c.cat, 's')}<span>${esc(c.sub)}</span></span>
          <p style="font-weight:650;margin:5px 0 4px;font-size:15px">${esc(c.q)}</p>
          <div id="rb-${esc(c.id)}" hidden>
            <p class="muted" style="color:var(--ok);font-weight:650">${esc(c.a)}</p>
            ${c.t ? `<p class="tiny" style="margin-top:5px">${esc(c.t)}</p>` : ''}
          </div>
          <button class="btn ghost sm" style="margin-top:8px" data-merk="rb-${esc(c.id)}"
            aria-expanded="false" aria-controls="rb-${esc(c.id)}">Erst überlegen – dann aufdecken</button>
        </div>`).join('')}
      </div>
      <p class="tiny center" style="margin-top:10px">Diese Karten kommen morgen wieder – sie sind schon eingeplant.</p>`;
}

/* Das Ergebnisbild einer Quizrunde. Die Frage danach ist nicht „wie gut war
   ich", sondern „wo habe ich verloren": erst die drei Verlustarten, dann die
   Themen nach verlorenen Punkten, dann die Karten selbst. */
function quizRueckblick(r, missed, min) {
  const aw = r.quiz.aw;
  const n = r.quiz.antworten.length;
  /* Nur eine ZU ENDE gespielte Runde wird abgelegt (siehe endRun) – gefeiert
     wurde der Bestwert aber unabhaengig davon. Eine nach einer Frage
     abgebrochene Runde schrieb „Neuer Bestwert!" ueber „1 von 12 richtig", und
     eine Beruehrung spaeter stand im Quizbildschirm wieder der alte Wert. */
  const neuerBestwert = r.quiz.vollstaendig && aw.punkte > r.quiz.vorherBest && aw.punkte > 0;
  const satz = aw.punkte === aw.max ? 'Fehlerfrei und schnell – das ist Quizform.'
    : neuerBestwert ? 'Neuer Bestwert!'
    : aw.langsam > aw.falsch ? 'Du weißt mehr, als die Uhr zuließ – Tempo ist die Baustelle.'
    : aw.falsch ? 'Die Lücken stehen unten – sie kommen im nächsten Training.'
    : 'Alles richtig – nur ein paar Sekunden zu langsam für den Bonus.';
  return `
    <div class="done-wrap fade">
      <p class="quiz-punkte" id="quizPunkte">${aw.punkte}<small>/ ${aw.max}</small></p>
      <h1>${satz}</h1>
      <p class="muted">${aw.richtig} von ${n} richtig · ${min} Min.${r.quiz.vorherBest ? ` · Bestwert ${neuerBestwert ? aw.punkte : r.quiz.vorherBest}` : ''}</p>
    </div>
    <h2 class="sec">Wo die Punkte blieben</h2>
    <div class="verlust" id="quizVerlust">
      <div class="kpi"><b>${aw.verlorenFalsch}</b><span>falsch</span></div>
      <div class="kpi"><b>${aw.verlorenLangsam}</b><span>zu langsam</span></div>
      <div class="kpi"><b>${aw.verlorenBlitz}</b><span>ohne Blitz</span></div>
    </div>
    <div class="tlist" style="margin-top:11px" id="quizFelder">
      ${aw.felder.map(f => `<div class="trow schmal quiz-feld" style="pointer-events:none" data-cat="${esc(f.cat)}">
        <span class="tico">${catIcon(f.cat)}</span>
        <span class="grow">
          <h3>${esc(CAT_BY_ID[f.cat]?.name || f.cat)}</h3>
          <span class="marken">${f.richtig ? `<span class="marke ok">${f.richtig} richtig</span>` : ''}${
            f.falsch ? `<span class="marke falsch">${f.falsch} falsch</span>` : ''}${
            f.langsam ? `<span class="marke langsam">${f.langsam} zu langsam</span>` : ''}</span>
          <span class="bar${f.verloren ? '' : ' ok'}"><i style="width:${((f.punkte / Math.max(1, f.max)) * 100).toFixed(0)}%"></i></span>
        </span>
        <span class="pct">${f.punkte}/${f.max}</span>
      </div>`).join('')}
    </div>
    ${aw.felder[0] && aw.felder[0].verloren > 0 ? `
    <button class="btn" id="quizNachlegen" data-cat="${esc(aw.felder[0].cat)}" style="margin-top:11px">${ico('duell')}${esc(CAT_BY_ID[aw.felder[0].cat]?.name || aw.felder[0].cat)} im Duell nachlegen</button>` : ''}
    ${fehlerListe(missed)}
    <div class="btn-stack" style="margin-top:18px">
      <button class="btn primary" id="again">Noch eine Runde</button>
      <button class="btn ghost" id="home">Zur Übersicht</button>
    </div>`;
}

function beep(ok) {
  if (!settings().sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = beep.ctx || (beep.ctx = new AC());
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    o.type = 'sine';
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.18);
  } catch (e) { /* Ton ist Beiwerk */ }
}

function useRecall(card, cs) {
  const m = settings().recallMode;
  // Manche Antworten lassen sich getippt nicht von ihrem Ablenker trennen
  // („ss" gegen „ß"). Solche Karten laufen nur als Auswahlfrage.
  if (card.mc) return false;
  if (m === 'mc') return false;
  if (m === 'recall') return true;
  /* Erst erkennen, dann frei abrufen. Die Schwelle bleibt bei zwei Wiederholungen,
     und das ist gemessen: Ueber 180 simulierte Tage sind damit bereits 48,2 % aller
     Abrufe freie Abrufe, weil eine Karte den groessten Teil ihres Lebens jenseits
     der Schwelle verbringt. Ab reps>=1 waeren es 66,2 % – erkauft damit, dass die
     zweite Begegnung mit einer voellig neuen Karte schon getippt werden muss.
     Genau dort traegt die Stuetze noch. */
  return !!cs && cs.reps >= 2;
}

function shell(inner, foot) {
  const r = run;
  const total = r.total + r.added;
  const pct = (r.done / Math.max(1, total)) * 100;
  app.innerHTML = `
    <div class="sess">
      <div class="sess-top">
        <button class="icon-btn" id="quit" aria-label="Einheit beenden">${ico('schliessen')}</button>
        <div class="bar"><i style="width:${Math.min(100, pct).toFixed(0)}%"></i></div>
        <span class="tiny" style="min-width:42px;text-align:right">${r.done}/${total}</span>
        <button class="icon-btn" id="undo" aria-label="Letzte Antwort zurücknehmen" ${r.undo ? '' : 'disabled'}>${ico('zurueck')}</button>
      </div>
      <div class="sess-body fade">${inner}</div>
      <div class="sess-foot">${foot}</div>
    </div>`;
  document.getElementById('quit').onclick = () => {
    if (run.done) return endRun();
    run.uhr?.beenden?.();       // ohne eine einzige Antwort gibt es nichts zu zaehlen
    show('home');
  };
  document.getElementById('undo').onclick = undoLast;
  /* Jedes innerHTML zerstoert das fokussierte Element, der Fokus faellt auf
     body. Mit VoiceOver landete der Lesecursor damit bei JEDER Karte wieder
     ganz oben und musste ueber Beenden-Knopf, Balken und Zuruecknehmen
     hinweggewischt werden, bis die Frage kam. Wir setzen ihn auf das letzte
     Fokusziel: beim Fragen auf die Frage, nach dem Aufdecken auf die Loesung.
     preventScroll, damit fuer alle anderen optisch nichts passiert. */
  const ziele = app.querySelectorAll('[data-fokus]');
  ziele[ziele.length - 1]?.focus({ preventScroll: true });
}

/* Der Fuss wechselt beim Aufdecken den Inhalt: Wo eben noch „Loesung zeigen"
   stand, stehen danach die Bewertungsknoepfe. Ein zweiter, schneller Tipp landet
   dann auf einem davon und bewertet eine Karte, die der Nutzer nie gesehen hat.
   Deshalb sind die frisch erschienenen Knoepfe einen Moment lang taub. */
const ENTPRELLZEIT = 350;
let entprelltBis = 0;
function entprellen() {
  entprelltBis = Date.now() + ENTPRELLZEIT;
}
function zuFrueh() {
  return Date.now() < entprelltBis;
}

/* Eine eigene Uhr fuer den Start einer Runde. Der Zaehler oben gilt den
   Fussknoepfen: Er laeuft bei jedem „Weiter" neu an, und die Antwortknoepfe
   daran zu haengen machte sie nach JEDER Karte taub – ein Preis, den niemand
   zahlen will. Geschuetzt werden muss nur der eine Fall: Der zweite Tipp eines
   Doppeltipps auf „Tagestraining starten" landete auf der ersten
   Antwortmoeglichkeit der nie gelesenen Karte. Die Loesung deckte auf, „Leider
   falsch", und der einzige Weg vorwaerts buchte AGAIN – nachgestellt ef 2,5 auf
   2,3, lapses 0 auf 1, und ein Platz des Tagesbudgets war verbraucht. */
let startSperreBis = 0;
const sperreStart = () => { startSperreBis = Date.now() + ENTPRELLZEIT; };
const nachStart = () => Date.now() < startSperreBis;

/* Die Frage liegt als eigenes Blatt auf dem Grund. Der Rest der Flaeche ist
   damit Buehne und nicht Leere – und der Knopf bleibt unten im Daumenbereich. */
const qkarte = (inner, solo) => `<div class="qcard${solo ? ' solo' : ''}">${inner}</div>`;

/* Eine Zeile Herkunft, dann die Frage. Mehr Beiwerk braucht es vor dem Inhalt nicht:
   Nur „neu" und „hartnäckig" aendern etwas an der Haltung beim Beantworten. */
function head(card, isFresh) {
  const cat = CAT_BY_ID[card.cat];
  const zaeh = isLeech(cardState(card.id));
  return `<div class="qmeta">
      <span class="qcat">${catIcon(card.cat, 's')}<span>${esc(cat.name)} · ${esc(card.sub)}</span></span>
      ${isFresh ? '<span class="pill new">neu</span>' : ''}
      ${zaeh ? '<span class="pill zaeh">hartnäckig</span>' : ''}
    </div>
    <h1 class="q" tabindex="-1" data-fokus>${esc(card.q)}</h1>`;
}

function step() {
  if (!run) return;
  if (run.i >= run.queue.length) return endRun();
  /* Auch in dieser Richtung entprellen. Die Kollision ist immer Fuss auf Fuss:
     Wo eben die Bewertungsknoepfe standen, stehen bei der naechsten Karte
     „Hab ich" und „Hab ich nicht". Ein zweiter, schneller Tipp legte sich sonst
     fuer eine Karte fest, die der Nutzer nie gelesen hat, und deckte sie gleich
     auf - die Karte war verbraucht, und die Note ging ueber schedule() dauerhaft
     in den Plan ein. Die Antwortoptionen liegen im Rumpf und sind nicht
     betroffen; sie bleiben sofort tippbar, damit im Duell keine Zeit verfaellt. */
  entprellen();
  const item = run.queue[run.i];
  const card = item.card;
  const cs = cardState(card.id);
  if (run.mode === 'duel' || run.mode === 'quiz') return askDuel(card);
  if (useRecall(card, cs)) return askRecall(card, item.fresh, cs);
  return askChoice(card, item.fresh, cs);
}

/* ---- Multiple Choice ---- */
function askChoice(card, isFresh, cs) {
  const opts = options(card);
  // Nur die Zeit zaehlen, in der die Frage auch sichtbar war – sonst macht ein
  // Anruf aus einer sofortigen richtigen Antwort ein „Schwer".
  const verstrichen = sichtbareZeit();
  shell(
    qkarte(head(card, isFresh)) + `<div class="opts" id="opts">${
      opts.map((o, i) => `<button class="opt" data-v="${esc(o)}">
        <span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')
    }</div>`,
    isFresh ? `<p class="tiny center">Neue Karte – rate ruhig, der Versuch selbst hilft beim Behalten.</p>` : ''
  );
  const pick = (b) => {
    if (nachStart()) return;        // der zweite Tipp des Startknopfs
    const ok = b.dataset.v === card.a;
    const dt = verstrichen();
    verstrichen.beenden();
    markiereOptionen(app, card.a, b.dataset.v);
    beep(ok);
    const grade = !ok ? AGAIN
      : (cs && cs.reps >= 2 && dt < 4000) ? EASY
      : dt > 14000 ? HARD : GOOD;
    showFeedback(card, ok, grade, isFresh);
  };
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(b));
  onKey = (e) => {
    const n = tastenIndex(e);
    const l = 'abcd'.indexOf(e.key.toLowerCase());
    const idx = n >= 0 ? n : l;
    const btns = app.querySelectorAll('.opt:not([disabled])');
    if (idx >= 0 && btns[idx]) { e.preventDefault(); pick(btns[idx]); }
  };
}

/* ---- Freies Abrufen mit Selbstbewertung ---- */
/* Wer die Loesung sieht und erst danach urteilt, haelt fuer gewusst, was er
   gerade gelesen hat. Dagegen hilft nur, sich festzulegen, BEVOR die Antwort
   sichtbar wird. Eine getippte Antwort ist so eine Festlegung und wird ausserdem
   automatisch verglichen. Wer nichts tippt, bekam bisher einen Knopf „Loesung
   zeigen" und durfte hinterher urteilen – das ist die Falle. Jetzt stehen dort
   zwei Knoepfe: „Hab ich" und „Hab ich nicht". Gleich viele Tipper, aber das
   Urteil faellt ohne Netz. */
function askRecall(card, isFresh, cs) {
  shell(
    qkarte(head(card, isFresh) + `
      <input class="recall-in" id="rin" type="text" inputmode="text" autocomplete="off"
             autocapitalize="sentences" spellcheck="false" enterkeyhint="go"
             placeholder="Antwort tippen (empfohlen)">
      <p class="tiny">Erst selbst denken – der Abruf ist der eigentliche Lerneffekt.</p>`, true),
    ''
  );
  const input = document.getElementById('rin');
  const foot = app.querySelector('.sess-foot');
  const go = (behauptet) => {
    if (zuFrueh()) return;
    const typed = input.value.trim();
    // Gegen jede zugelassene Schreibweise pruefen und die beste nehmen: Wer
    // „1/x" tippt, hat die Frage nach der Ableitung des Logarithmus richtig
    // beantwortet, auch wenn auf der Karte „Eins durch x" steht.
    const beste = bewerte(card, typed);
    revealRecall(card, typed, beste, cs, isFresh, behauptet);
  };

  /* Der Fuss wird nur beim Wechsel leer/nicht leer neu gesetzt, nicht bei jedem
     Anschlag – sonst verliert das Feld auf dem Handy die Schreibmarke. */
  let warLeer = null;
  const fussSetzen = () => {
    const leer = !input.value.trim();
    if (leer === warLeer) return;
    warLeer = leer;
    if (leer) {
      foot.innerHTML = `<p class="tiny center" style="margin-bottom:5px">Erst festlegen – dann kommt die Lösung</p>
        <div class="festlegen">
          <button class="btn" data-hab="1">Hab ich</button>
          <button class="btn" data-hab="0">Hab ich nicht</button>
        </div>`;
      foot.querySelectorAll('[data-hab]').forEach(b => b.onclick = () => go(b.dataset.hab === '1'));
    } else {
      foot.innerHTML = `<button class="btn primary" id="reveal">Lösung zeigen</button>`;
      document.getElementById('reveal').onclick = () => go(null);
    }
  };
  fussSetzen();
  input.addEventListener('input', fussSetzen);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()) go(null); });
  /* Ohne Eingabe gibt es keine Sammeltaste: Die Festlegung soll eine Entscheidung
     sein und nicht der Reflex auf die Leertaste. */
  onKey = (e) => {
    if (!input.value.trim()) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(null); }
  };
}

function revealRecall(card, typed, sim, cs, isFresh, behauptet) {
  const near = sim >= 0.8;
  // Dazwischen liegt das Feld, in dem der Vergleich bewusst streng ist: ein
  // vertauschter Wortanfang oder ein fehlendes tragendes Wort. Das als glatt
  // falsch abzustempeln wäre unfair – als richtig durchzuwinken schädlich.
  const knapp = !near && sim >= 0.6;
  if (typed) beep(near);
  announce(near ? 'Deine Eingabe passt.' : `Die Antwort lautet: ${card.a}`);
  /* Ohne Eingabe wird die Festlegung von vorhin zurueckgespiegelt. Sie steht
     damit neben der Loesung – wer „Hab ich" gesagt hat und jetzt etwas anderes
     liest, sieht den Unterschied, statt ihn sich wegzuerinnern. */
  const hint = !typed
    ? (behauptet === true
        ? `<p class="verdict fast">${ico('uhr')}<span>Du hattest gesagt: hab ich – jetzt genau vergleichen.</span></p>`
        : behauptet === false
          ? `<p class="verdict bad">${ico('schliessen')}<span>Du hattest gesagt: hab ich nicht.</span></p>`
          : '')
    : near
      ? `<p class="verdict good">${ico('haken')}<span>Deine Eingabe passt: „${esc(typed)}“</span></p>`
      : knapp
        ? `<p class="verdict fast">${ico('uhr')}<span>Knapp daneben: „${esc(typed)}“ – vergleich genau.</span></p>`
        : `<p class="verdict bad">${ico('schliessen')}<span>Du hattest: „${esc(typed)}“</span></p>`;
  const g = (grade, label, cls) =>
    `<button class="btn ${cls}" data-g="${grade}"><span>${label}</span><small>${preview(cs, grade)}</small></button>`;
  shell(
    qkarte(head(card, isFresh) + hint + answerBlock(card), true),
    `<p class="tiny center" style="margin-bottom:2px">Wie gut saß die Antwort?</p>
     <div class="grades">
       ${g(AGAIN, 'Nochmal', 'g0')}${g(HARD, 'Schwer', 'g1')}${g(GOOD, 'Gut', 'g2')}${g(EASY, 'Leicht', 'g3')}
     </div>`
  );
  lockUndo();
  const grade = (n) => { if (!zuFrueh()) commit(card, n, n !== AGAIN, isFresh, behauptet); };
  entprellen();
  app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => grade(Number(b.dataset.g)));
  onKey = (e) => {
    const idx = tastenIndex(e);
    if (idx >= 0) { e.preventDefault(); grade(idx); }
  };
}

/* Solange die Lösung der aktuellen Karte steht, würde „Rückgängig" die
   VORHERIGE Antwort zurücknehmen – das versteht niemand. Also sperren. */
function lockUndo() {
  const b = document.getElementById('undo');
  if (b) b.disabled = true;
}

const KNACK_TIPPS = [
  'Baue eine eigene Eselsbrücke – selbst erfundene halten am besten.',
  'Verknüpfe die Karte mit etwas, das du schon sicher weißt.',
  'Sag die Antwort einmal laut. Der zusätzliche Kanal hilft messbar.',
  'Stell dir ein Bild dazu vor, je absurder desto haltbarer.',
  'Frag dich: Warum ist das so? Erklären schlägt Auswendiglernen.',
];

function answerBlock(card) {
  const cs = cardState(card.id);
  const zaeh = isLeech(cs);
  return `<div class="answer" tabindex="-1" data-fokus>
      <div class="lab">Antwort</div>
      <div class="val">${esc(card.a)}</div>
      ${card.t ? `<p class="expl">${esc(card.t)}</p>` : ''}
      ${zaeh ? `<p class="knack">Diese Karte ist dir schon ${cs.lapses}-mal entfallen.
        ${esc(KNACK_TIPPS[cs.lapses % KNACK_TIPPS.length])}</p>` : ''}
    </div>`;
}

/* Die Antwort muss nach dem Aufdecken sichtbar sein - auch auf einem kleinen
   iPhone, wo die Karte hoeher ist als das Fenster. Ein blosses scrollTop am
   Kasten reicht nicht: scrollt in dem Moment die Seite und nicht der Kasten,
   passiert gar nichts. scrollIntoView zieht jeden beteiligten Rahmen mit. */
function zurAntwort(body, div) {
  body.scrollTop = body.scrollHeight;
  // Die Loesung wird angehaengt, nicht neu gerendert - der Fokus aus shell()
  // steht also noch auf der Frage. Fuer Screenreader muss er mitwandern,
  // sonst liest der Cursor weiter oben und die Aufloesung bleibt ungehoert.
  div.querySelector('[data-fokus]')?.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    try { div.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    catch (e) { div.scrollIntoView(false); }
  });
}

function showFeedback(card, ok, grade, isFresh) {
  announce(ok ? 'Richtig.' : `Falsch. Die Antwort lautet: ${card.a}`);
  const body = app.querySelector('.sess-body');
  const div = document.createElement('div');
  div.className = 'fade';
  div.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ico(ok ? 'haken' : 'schliessen')}<span>${ok ? 'Richtig' : 'Leider falsch'}</span></p>${answerBlock(card)}`;
  body.appendChild(div);
  zurAntwort(body, div);
  app.querySelector('.sess-foot').innerHTML = `<button class="btn primary" id="next">Weiter</button>`;
  lockUndo();
  const next = () => commit(card, grade, ok, isFresh);
  document.getElementById('next').onclick = next;
  onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } };
}

/* Zustand vor der Antwort festhalten, damit ein Fehlgriff rückgängig gemacht werden kann. */
function snapshot(card) {
  const st = S();
  const k = dayKey();
  const tagVorhanden = !!st.days[k];        // today() legt den Eintrag sonst nebenbei an
  return {
    id: card.id,
    tagVorhanden,
    cs: cardState(card.id) ? { ...cardState(card.id) } : null,
    dayKey: k,
    /* Tief kopieren: Das Tagesbuch traegt seit der Tab-Trennung ein
       verschachteltes Feld je. Eine flache Kopie teilte es mit dem Original –
       das Zuruecknehmen setzte danach die sichtbaren Zaehler zurueck, waehrend
       der Beitrag dieses Tabs stehen blieb. Beim naechsten zaehle() rechnete
       summiere() die Tageszahl aus der Beitragsliste neu, und der
       zurueckgenommene Treffer war wieder da – samt verbrauchtem Budget fuer
       neue Karten. */
    day: structuredClone(today()),
    totalAnswers: st.totalAnswers, totalCorrect: st.totalCorrect,
    claims: st.claims, claimsMiss: st.claimsMiss,
    streak: st.streak, best: st.best, lastDay: st.lastDay,
    i: run.i, done: run.done, correct: run.correct,
    added: run.added, wrongLen: run.wrong.length,
    insertedAt: -1, nochmalVorher: null
  };
}

function undoLast() {
  const u = run?.undo;
  if (!u) return;
  const st = S();
  if (u.cs) st.cards[u.id] = u.cs; else delete st.cards[u.id];
  if (u.tagVorhanden) st.days[u.dayKey] = u.day;
  else delete st.days[u.dayKey];            // der Tag hatte vorher keinen Eintrag
  /* Der Ablage sagen, dass dieser Tab seinen Beitrag VERKLEINERT hat. Ohne
     diese Zeile holte der zweite offene Tab die zurueckgenommene Antwort
     wieder hervor: Sein abgelegter Stand trug den Beitrag von vorher, und beim
     Zusammenfuehren gewinnt sonst die groessere Zahl. */
  store.beitragZurueck(u.dayKey);
  st.totalAnswers = u.totalAnswers; st.totalCorrect = u.totalCorrect;
  st.claims = u.claims; st.claimsMiss = u.claimsMiss;
  st.streak = u.streak; st.best = u.best; st.lastDay = u.lastDay;
  if (u.insertedAt >= 0) run.queue.splice(u.insertedAt, 1);
  if (u.nochmalVorher === 0) run.nochmal.delete(u.id);
  else if (u.nochmalVorher !== null) run.nochmal.set(u.id, u.nochmalVorher);
  run.i = u.i; run.done = u.done; run.correct = u.correct;
  run.added = u.added; run.wrong.length = u.wrongLen;
  run.undo = null;
  save(true);
  toast('Antwort zurückgenommen', 1400);
  step();
}

function commit(card, grade, ok, isFresh, behauptet) {
  const undo = snapshot(card);

  /* Die Karte ist in dieser Einheit schon einmal umgefallen und kommt gerade
     zum zweiten Mal - man hat die Loesung eine Minute vorher gelesen. */
  const wiedervorlage = (run.nochmal.get(card.id) || 0) > 0;
  // Kippt sie dabei erneut, ist das Nachlernen und kein zweiter Aussetzer – siehe schedule().
  const nachlernen = grade === AGAIN && wiedervorlage;
  putCard(card.id, schedule(cardState(card.id) || freshState(), grade, { nachlernen }));

  const st = S();
  const d = today();
  store.zaehle('done'); if (ok) store.zaehle('correct');
  if (isFresh) store.zaehle('newC');
  st.totalAnswers++; if (ok) st.totalCorrect++;
  /* Wer sich vor der Aufloesung festgelegt hat, bekommt gezaehlt, wie gut das
     Urteil war. Erst diese Rueckmeldung macht aus der Festlegung etwas Lernbares:
     „Ich dachte, ich hab's" ist eine Beobachtung, die man sonst sofort vergisst. */
  /* Nicht beim Nachlernen: Faellt eine Karte um, schiebt commit() sie rund
     fuenf Karten spaeter erneut in die Warteschlange. Bei „Immer frei" ist das
     wieder ein freier Abruf mit denselben zwei Knoepfen - nur hat man die
     Loesung eine Minute vorher gelesen. Voll mitgezaehlt brachte jeder
     Aussetzer verlaesslich eine zusaetzliche, geschenkte Festlegung: Wer oft
     umkippt, sammelte damit die beste Quote ein, und die Karte kehrte ihren
     Zweck um. schedule() kennt die Unterscheidung laengst, die Zaehlung nicht.
     Ueber zaehle(), damit zwei offene Tabs sich nicht gegenseitig ueberschreiben. */
  if (behauptet === true && !wiedervorlage) {
    st.claims = (st.claims || 0) + 1;
    store.zaehle('claim');
    if (grade === AGAIN) { st.claimsMiss = (st.claimsMiss || 0) + 1; store.zaehle('claimMiss'); }
  }
  touchStreak();

  run.done++; if (ok) run.correct++; else run.wrong.push(card);
  run.i++;

  /* Falsch beantwortete Karten kommen innerhalb der Einheit noch einmal dran –
     aber hoechstens zweimal. Ohne Deckel schob sich eine Karte, die man schlicht
     nicht weiss, bei jedem Versuch erneut ein: Gemessen wurde dieselbe Karte in
     einer Runde von zwoelf Karten 49-mal gestellt, und die Runde endete nie.
     Nachgewiesen ist ohnehin nur der Nutzen der ersten Wiederholungen; danach
     bringt Massieren im selben Zeitfenster kaum noch etwas. Die Karte ist auf
     heute faellig gesetzt und kommt in der naechsten Runde ohnehin wieder.

     Der zweite Anlauf kommt spaeter als der erste: erst rund fuenf Karten
     Abstand, dann ans Ende der Einheit. Ein groesserer Abstand haelt laenger vor
     als eine Wiederholung im selben Atemzug. */
  const NACHREICHEN_MAX = 2;
  if (grade === AGAIN) {
    const bisher = run.nochmal.get(card.id) || 0;
    undo.nochmalVorher = bisher;
    if (bisher < NACHREICHEN_MAX) {
      // Beim ersten Mal fuenf Karten Abstand, beim zweiten ans Ende der Einheit.
      const pos = bisher === 0
        ? Math.min(run.queue.length, run.i + 5)
        : run.queue.length;
      run.queue.splice(pos, 0, { card, fresh: false });
      run.nochmal.set(card.id, bisher + 1);
      run.added++;
      undo.insertedAt = pos;
    } else {
      toast('Die Karte kommt in der nächsten Runde wieder', 1800);
    }
  }
  run.undo = undo;
  save();
  step();
}

/* ---- Duell: schnell, mit Zeitdruck ---- */
/* Der Punktestand ueber der Frage, rechts die Blitz-Pille: Sie verblasst nach
   fuenf Sekunden - so sieht man die Formel beim Spielen, nicht erst im Ergebnis. */
const quizStand = () => `<div class="quiz-stand"><span>Punkte <b id="quizStand">${run.quiz.punkte}</b></span><span class="pill blitz" id="blitz">Blitz +${PUNKTE_BLITZ}</span></div>`;

function askDuel(card) {
  const opts = options(card);
  const LIMIT = FRIST_MS;
  const quiz = run.mode === 'quiz';
  shell(
    (quiz ? quizStand() : '') + qkarte(head(card, false)) + `<div class="opts">${
      opts.map((o, i) => `<button class="opt" data-v="${esc(o)}">
        <span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')
    }</div>`,
    /* Der Balken traegt keine Auskunft fuer Hilfsmittel – ohne Sicht bekam man
       weder mit, dass die Zeit laeuft, noch dass sie fast um ist; die Frage
       loeste sich einfach auf. Der Hinweis unten und die Fuenf-Sekunden-Ansage
       im Takt ersetzen das. */
    `<div class="bar" id="clock" aria-hidden="true"><i style="width:100%;transition:width .1s linear"></i></div>
     <p class="sr-only">15 Sekunden Zeit für diese Frage.</p>`
  );
  document.getElementById('undo').disabled = true;   // im Duell zählt die Zeit
  const bar = app.querySelector('#clock i');
  let finished = false;
  stopDuelTimer();
  const verstrichen = sichtbareZeit();
  let gewarnt = false;
  const blitz = document.getElementById('blitz');
  let blitzAus = false;
  duelTimer = setInterval(() => {
    if (!run || !document.getElementById('clock')) return stopDuelTimer();
    const left = Math.max(0, 1 - verstrichen() / LIMIT);
    bar.style.width = (left * 100).toFixed(1) + '%';
    bar.style.background = left < 0.3 ? 'linear-gradient(90deg,#ff6b6b,#ffb454)' : '';
    if (blitz && !blitzAus && verstrichen() > BLITZ_MS) {
      blitzAus = true;
      blitz.classList.add('aus');
      // Verblasst heisst weg: Sonst versprach die Pille im Zugaenglichkeitsbaum
      // weiter einen Bonus, den es nicht mehr gibt.
      blitz.setAttribute('aria-hidden', 'true');
    }
    // Einmalig, nicht im Takt: eine Live-Region, die zehnmal je Sekunde
    // schreibt, macht das Vorlesen der Frage unmoeglich.
    if (!gewarnt && left > 0 && verstrichen() > LIMIT - 5000) { gewarnt = true; announce('Noch fünf Sekunden.'); }
    if (left <= 0) finish(null);
  }, 100);

  function finish(chosen) {
    if (finished || !run) return;
    if (chosen && nachStart()) return;    // Zeitablauf (chosen === null) zaehlt immer

    finished = true;
    stopDuelTimer();
    // Zeit vor dem Stoppen ablesen; abgelaufene Fragen zaehlen mit vollem Limit.
    const gebraucht = Math.min(LIMIT, verstrichen());
    verstrichen.beenden();
    const ok = chosen === card.a;
    /* Nur ausrechnen, noch nicht buchen. Gebucht wird die Antwort in next(),
       zusammen mit allem anderen - Fehlerliste, Faelligstellung, Zaehler.
       Vorher stand die Punktebuchung hier oben und alles Uebrige in next():
       Wer die letzte Frage falsch beantwortete und dann auf X tippte statt auf
       „Weiter", bekam ein Ergebnisbild mit „165 von 180" und dem Satz „Die
       Luecken stehen unten" - waehrend die Liste leer blieb, die Karte nie
       faellig gestellt wurde und die Zaehler elf statt zwoelf Antworten sahen. */
    const pts = quiz ? punkte(ok, gebraucht) : 0;
    markiereOptionen(app, card.a, chosen);
    beep(ok);
    /* Wer nicht sieht, hoerte bei abgelaufener Zeit „Falsch" - genau die
       Unterscheidung, die das Ergebnisbild aufmacht, fiel in der Ansage weg. */
    announce((ok ? 'Richtig.' : `${chosen === null ? 'Zeit abgelaufen' : 'Falsch'}. Die Antwort lautet: ${card.a}`)
      + (quiz ? ` ${pts} Punkte.` : ''));
    const body = app.querySelector('.sess-body');
    const div = document.createElement('div');
    div.className = 'fade';
    const urteil = ok ? 'Richtig' : chosen === null ? 'Zeit abgelaufen' : 'Leider falsch';
    const punkteText = quiz ? ` · ${pts ? '+' + pts : '0'} Punkte${pts === MAX_JE_FRAGE ? ' · Blitz' : ''}` : '';
    /* Der Stand oben zeigte bis zur naechsten Frage noch den alten Wert -
       ueber der Rueckmeldung „Richtig · +15 Punkte" stand „Punkte 0". */
    const standAnzeige = document.getElementById('quizStand');
    if (standAnzeige) standAnzeige.textContent = run.quiz.punkte + pts;
    div.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ico(ok ? 'haken' : chosen === null ? 'uhr' : 'schliessen')}<span>${urteil}${punkteText}</span></p>${answerBlock(card)}`;
    body.appendChild(div);
    zurAntwort(body, div);
    app.querySelector('.sess-foot').innerHTML = `<button class="btn primary" id="next">Weiter</button>`;
    const next = () => {
      if (quiz) {
        run.quiz.punkte += pts;
        run.quiz.antworten.push({ card, ok, abgelaufen: chosen === null, ms: gebraucht, punkte: pts });
      }
      const st = S(), d = today();
      // Duell-Antworten zaehlen getrennt. Sie in denselben Topf zu werfen hiess:
      // Drei Duelle lassen den Tagesfortschritt auf 71 Prozent springen, obwohl
      // keine einzige geplante Karte dran war - und die Trefferquote sinkt,
      // weil unter fuenfzehn Sekunden Zeitdruck naturgemaess geraten wird.
      // Fuer die Serie zaehlt ein Duell trotzdem: geuebt ist geuebt.
      store.zaehle('duel'); if (ok) store.zaehle('duelOk');
      st.duelAnswers = (st.duelAnswers || 0) + 1; if (ok) st.duelCorrect = (st.duelCorrect || 0) + 1;
      // Tempo ist im Quizduell die eigentliche Waehrung – es wurde bisher
      // gemessen und weggeworfen. Nur richtige Antworten zaehlen: Wie schnell
      // jemand danebengreift, sagt nichts ueber Fortschritt.
      if (ok) { st.duelMs = (st.duelMs || 0) + gebraucht; st.duelTimed = (st.duelTimed || 0) + 1; }
      touchStreak();
      if (!ok) {
        run.wrong.push(card);
        // Fehler im Duell holt das Tagestraining sofort nach. Nur bei bereits
        // gelernten Karten – eine unberührte Karte steht ohnehin in der Neu-Liste,
        // und ein Zustand mit seen=0 würde sie in beide Listen bringen.
        const cs = cardState(card.id);
        // Termin auf heute, Intervall auf die wirklich verstrichene Zeit
        /* gedeckelt – Begruendung bei nachDuellFehler in srs.js. Ueber
           aendereKarte, nicht ueber putCard: Die Deckelung traegt eine frische
           last-Marke, und beim Zusammenfuehren gewinnt der juengere Stand als
           GANZES. Auf einem veralteten Kartenzustand angewandt haette sie damit
           eine im anderen Tab bereits gezaehlte Wiederholung geloescht - reps,
           ok und das gewachsene Intervall waeren weg gewesen. aendereKarte holt
           erst den abgelegten Stand ein und deckelt dann diesen. */
        if (cs && cs.seen > 0) {
          store.aendereKarte(card.id, (aktuell) => {
            const grund = (aktuell && aktuell.seen > 0) ? aktuell : cs;
            return nachDuellFehler(grund);
          });
        } else if (quiz) {
          /* Im Quiz ist eine nie gelernte Karte, die fehlt, eine ENTDECKTE
             Luecke - sie kommt ins naechste Tagestraining und nicht erst,
             wenn die Leiter der neuen Karten sie irgendwann erreicht. Das
             Duell laesst solche Karten liegen, weil es ohnehin aus dem
             Gelernten zieht. seen: 1 und nicht ein Zustand mit seen 0: Der
             stuende in beiden Listen zugleich (siehe dueCards). Keine Note,
             kein Aussetzer - man kann nicht vergessen, was man nie gelernt
             hat. Ueber aendereKarte, falls der andere Tab sie inzwischen
             gelernt hat: dann gilt die Deckelung wie bei jeder Bekannten. */
          const warUnberuehrt = !cardState(card.id) || cardState(card.id).seen === 0;
          store.aendereKarte(card.id, (aktuell) => (aktuell && aktuell.seen > 0)
            ? nachDuellFehler(aktuell)
            : { ...freshState(), seen: 1, due: todayNum(), last: Date.now() });
          /* Die Karte gilt ab jetzt als begonnen und steht damit unter den
             faelligen, nicht unter den neuen. Ohne diese Zeile umginge sie das
             Tagesbudget newPerDay vollstaendig: Mehrere Quizrunden koennten
             dutzende unberuehrte Karten in den Plan schieben, ohne dass der
             Zaehler fuer neue Karten sie je gesehen haette. */
          if (warUnberuehrt) store.zaehle('newC');
        }
      }
      save();
      run.done++; if (ok) run.correct++;
      run.i++;
      step();
    };
    document.getElementById('next').onclick = next;
    onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } };
  }
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => finish(b.dataset.v));
  onKey = (e) => {
    const n = tastenIndex(e);
    const btns = app.querySelectorAll('.opt:not([disabled])');
    if (n >= 0 && btns[n]) { e.preventDefault(); finish(btns[n].dataset.v); }
  };
}

/* ================= Start ================= */
function boot() {
  applyTheme();
  installFlush();
  document.getElementById('boot')?.remove();
  app.hidden = false;
  show('home');
  /* Mit Abstand zum Start, damit die ersten Tipper eine freie Hauptschleife
     finden: Wer die Startseite liest, waermt nebenbei die Suche vor.
     Siehe waermeIndex(). */
  setTimeout(waermeIndex, WAERMEN_NACH_MS);
  /* Vor dem Service Worker und unabhaengig von ihm: Die Fassungskennung steht in
     der App selbst, also gibt es die Auskunft auch im privaten Tab und beim
     allerersten Aufruf. */
  pruefeFassung();
  if ('serviceWorker' in navigator) starteServiceWorker();
}

/* Der Service Worker uebernimmt bewusst nicht von selbst: waehrend einer
   laufenden Runde die halbe App auszutauschen, waere der schlechteste
   denkbare Moment. Stattdessen fragt die App einmal nach. */
function starteServiceWorker() {
  /* Beim allerersten Besuch uebernimmt der Worker die Seite ganz normal - das
     ist kein Update und darf kein Neuladen ausloesen. Frueher stand dieser
     Zustand als Konstante fest, einmal beim Start abgelesen. Wurde in DERSELBEN
     Sitzung danach wirklich eine neue Fassung veroeffentlicht, blieb es beim
     „hatte keinen Worker": „Laden" bewirkte nichts Sichtbares, waehrend der
     neue Worker den alten Bestand laengst geloescht hatte. Jetzt zaehlt nur
     noch, ob es der erste Wechsel dieser Sitzung ist. */
  let hatWorker = !!navigator.serviceWorker.controller;
  let laedtNeu = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatWorker) { hatWorker = true; return; }
    if (laedtNeu) return;
    laedtNeu = true;
    /* Nicht mitten in einer Runde: Der Wechsel kann auch aus einem zweiten Tab
       kommen, in dem jemand „Laden" getippt hat. Hier schluckte das Neuladen
       dann die offene Frage - und zwar ohne Vorwarnung, weil dieser Tab gar
       nichts getippt hat. Der Austausch wartet, bis eine Ansicht gewechselt
       wird. Die Module laufen so lange aus dem Speicher der Seite weiter. */
    /* Auch der Rueckblick ist schuetzenswert: endRun() setzt run bereits auf
       null, bevor die Liste der falsch beantworteten Karten stehenbleibt. Ohne
       rueckblickOffen lud ein Wechsel aus dem zweiten Tab genau diese Liste weg,
       ohne dass hier jemand etwas getippt haette. */
    if (run || rueckblickOffen) { neuLadenNachRunde = true; return; }
    location.reload();
  });
  // updateViaCache 'none': das Skript selbst darf nie aus dem HTTP-Cache
  // kommen, sonst bemerkt der Browser eine neue Fassung tagelang nicht.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    swReg = reg;
    const pruefen = () => { if (reg.waiting && navigator.serviceWorker.controller) updateAnbieten(); };
    pruefen();
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      if (neu) neu.addEventListener('statechange', () => { if (neu.state === 'installed') pruefen(); });
    });
  }).catch(() => { /* offline ist Kür */ });
}

/* ---- Welche Fassung laeuft gerade, und ist eine neue da? ----------------
   Bisher meldete sich nach einem Update niemand: Der Nutzer tippte „Laden", die
   Seite lud neu - und nichts sagte ihm, ob es geklappt hat. Der Worker kennt
   seine Fassung, die Seite konnte sie nur nicht erfragen. Jetzt tut sie es beim
   Start, merkt sich die Antwort und vergleicht beim naechsten Mal. */
const FASSUNG_KEY = 'wissenswerk.fassung';
const fassungKurz = (v) => String(v || '').replace(/^wissenswerk-/, '').slice(0, 7);

function fassungGemerkt() {
  try { return JSON.parse(localStorage.getItem(FASSUNG_KEY) || 'null'); }
  catch (e) { return null; }          // privater Modus, geleerter Speicher
}

/* Die Kennung kommt aus der App selbst, nicht mehr vom Service Worker. Der
   Umweg ueber ihn scheiterte genau dort, wo die Auskunft am wichtigsten ist:
   Im privaten Tab steuert kein Worker, beim allerersten Aufruf noch keiner, und
   eine aeltere Fassung beantwortet die Frage gar nicht. In all diesen Faellen
   stand in den Einstellungen „wird eingerichtet" statt einer Antwort - also
   ausgerechnet dann, wenn man nachsehen will, ob ueberhaupt das Neue ankommt.
   Der Build schreibt die Kennung jetzt in assets/js/fassung.js. */
function pruefeFassung() {
  const jetzt = FASSUNG;
  if (!jetzt) return;
  const alt = fassungGemerkt();
  const gewechselt = !!(alt && alt.v && alt.v !== jetzt);
  // „seit" nur mitfuehren, wenn sich nichts geaendert hat - sonst stuende dort
  // nach jedem Start das heutige Datum, und die Angabe waere wertlos.
  const seit = (alt && alt.v === jetzt && alt.seit) ? alt.seit : Date.now();
  try { localStorage.setItem(FASSUNG_KEY, JSON.stringify({ v: jetzt, seit })); }
  catch (e) { /* dann eben keine Meldung beim naechsten Mal */ }
  if (gewechselt) {
    toast('Aktualisiert – Wissenswerk läuft jetzt in der neuen Fassung', 3600);
    announce('Wissenswerk wurde aktualisiert.');
  }
  if (view === 'settings') renderSettings();
}

/* Waehrend einer laufenden Runde wird das Angebot zurueckgehalten. Es liegt sonst
   als fester Balken ueber den Antwortknoepfen und schluckt dort die Tipper – im
   Durchlauf ueber mehrere Monate blieb genau daran eine Runde haengen. Bewirken
   koennte es mitten in der Runde ohnehin nichts: Das Neuladen wird bis zum Ende
   der Runde verweigert, weil es die offene Frage schlucken wuerde. */
let updateWartet = false;
let swReg = null;
function updateAnbieten() {
  if (neuLadenNachRunde) return;      // schon uebernommen, nur noch nicht geladen
  if (run) { updateWartet = true; return; }
  updateBalken();
}

/** Ein zurueckgehaltenes Angebot nachholen, sobald keine Runde mehr laeuft. */
function holeUpdateNach() {
  if (!updateWartet || run) return;
  updateWartet = false;
  /* Hat inzwischen ein zweiter Tab die neue Fassung angenommen, ist sie laengst
     aktiv und es gibt nichts mehr anzubieten. Vorher stand danach der Balken
     „Neue Fassung bereit" ueber dem Rueckblick, und ein Tipp darauf antwortete
     „ist nicht mehr bereit" - obwohl sie eine Beruehrung spaeter geladen wurde. */
  if (neuLadenNachRunde) return;
  updateBalken();
}

/* Wird auch aus show() und endRun aufgerufen, wenn das Angebot zurueckgehalten wurde. */
function updateBalken() {
  /* Der Speicherhinweis ist dringender und belegt denselben Platz. Das
     Update-Angebot wird dann zurueckgestellt statt verworfen - sonst waere es
     nach einem einzigen Speicherfehler bis zum naechsten Start verschwunden. */
  if (document.querySelector('.toast.aktion.speicher')) { updateWartet = true; return; }
  if (document.querySelector('.toast.aktion')) return;
  document.querySelector('.toast')?.remove();
  const d = document.createElement('div');
  d.className = 'toast aktion';
  d.setAttribute('role', 'status');
  d.innerHTML = '<span>Neue Fassung bereit</span>';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Laden';
  b.onclick = () => {
    /* Eine Runde kann gestartet werden, waehrend der Balken schon steht. Dann
       wird das Angebot zurueckgestellt wie beim Eintreffen waehrend einer Runde:
       Balken weg, Vormerkung setzen – endRun holt ihn nach. */
    if (run) {
      d.remove();
      updateWartet = true;
      toast('Erst die Runde zu Ende – danach kommt das Angebot zurück');
      return;
    }
    /* Die wartende Fassung wird erst beim Tippen abgefragt. Der Balken hielt
       frueher eine feste Worker-Referenz: Wurde waehrend er stand ein zweites
       Mal veroeffentlicht, zeigte sie auf einen laengst ueberholten Worker,
       und „Laden" verpuffte ohne jede Rueckmeldung. */
    const w = swReg && swReg.waiting;
    d.remove();
    if (!w) { toast('Die neue Fassung ist nicht mehr bereit – sie kommt beim nächsten Start'); return; }
    w.postMessage('jetzt-uebernehmen');
  };
  d.appendChild(b);
  document.body.appendChild(d);
}

/* Bleibender Hinweis bei vollem Speicher – anders als das Update-Angebot darf
   er eine laufende Runde nicht abwarten: Ab jetzt geht jede Antwort verloren,
   also muss der Nutzer es sofort erfahren. Ein bereits stehender Balken wird
   ersetzt, damit die dringendere Meldung gewinnt. */
/* Ein unlesbarer Speicher war bisher unsichtbar: Die App startete mit einer
   ganz normalen Startseite bei null. Jetzt sagt sie es, und die Rohdaten liegen
   unter wissenswerk.v1.kaputt noch da. */
function startFehlerBalken() {
  const p = store.startProblem();
  if (!p) return;
  const d = document.createElement('div');
  d.className = 'toast aktion speicher';
  d.setAttribute('role', 'alert');
  /* Dieselbe Unterscheidung wie unten: Ist der Speicher gesperrt, war nichts
     „unlesbar" - es gab schlicht keinen Zugriff, und der Nutzer hat auch
     nichts verloren. Er soll nur wissen, dass nichts bleibt. */
  d.innerHTML = p.art && p.art !== 'QuotaExceededError' && /security|denied|insecure/i.test(p.art + ' ' + p.grund)
    ? '<span>Dieser Browser gibt den Speicher nicht frei – der Fortschritt hält nur bis zum Schließen</span>'
    : '<span>Der gespeicherte Stand war beim Start unlesbar – '
      + (p.bytes ? 'die Rohdaten sind aufgehoben' : 'er liess sich nicht aufheben') + '</span>';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Verstanden';
  b.onclick = () => d.remove();
  d.appendChild(b);
  document.body.appendChild(d);
}

function speicherBalken(grund) {
  document.querySelector('.toast.aktion.speicher')?.remove();
  /* Zwei Aktionsbalken liegen sonst gleichzeitig da – beide fixiert am selben
     unteren Rand, beide z-index 60. Der spaeter angehaengte deckte den anderen
     vollstaendig zu, und dessen unsichtbarer „Laden"-Knopf fing die Tipper ab,
     die dem sichtbaren „Sichern" galten. Das Angebot wird deshalb
     zurueckgestellt, nicht ueberdeckt; holeUpdateNach() bringt es wieder. */
  const angebot = document.querySelector('.toast.aktion:not(.speicher)');
  if (angebot) { angebot.remove(); updateWartet = true; }
  const d = document.createElement('div');
  d.className = 'toast aktion speicher';
  d.setAttribute('role', 'alert');
  /* „Voll" nur, wenn es wirklich voll ist. Hat Safari die Website-Daten
     gesperrt (Einstellung „Alle Cookies blockieren", oder ein privates
     Fenster), wirft schon der Zugriff einen SecurityError - dann hilft
     Platzschaffen nicht, und der Satz schickte den Nutzer auf die falsche
     Suche. Der Knopf bleibt in beiden Faellen richtig: Der Stand liegt im
     Arbeitsspeicher und laesst sich als Datei sichern. */
  d.innerHTML = store.speicherVoll(grund)
    ? '<span>Speicher voll – neue Antworten gehen verloren</span>'
    : '<span>Dieser Browser darf nichts speichern – neue Antworten gehen verloren</span>';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Sichern';
  b.onclick = async () => {
    if (!await sichern()) return;
    d.remove();
    holeUpdateNach();          // ein waehrenddessen zurueckgestelltes Angebot
  };
  d.appendChild(b);
  document.body.appendChild(d);
}
boot();

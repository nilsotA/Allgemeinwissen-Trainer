/* Wissenswerk – UI und Ablaufsteuerung */
import { CATS, CAT_BY_ID, CARDS, LEVELS } from '../../data/index.js';
import FACTS from '../../data/facts.js';
import * as store from './store.js';
import { S, settings, setSetting, save, cardState, putCard, today, todayNum, dayKey,
         numToKey, liveStreak, touchStreak, isFlagged, toggleFlag, setSaveErrorHandler,
         installFlush, setBusyCheck, setFremdStandHandler } from './store.js';
import { schedule, strength, preview, isLeech, nachDuellFehler, fresh as freshState, AGAIN, HARD, GOOD, EASY } from './srs.js';
import { options, bewerte, normalize, shuffle } from './quiz.js';
import * as sess from './session.js';

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
setSaveErrorHandler(() => speicherBalken());

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

/* ================= Views ================= */
function render() {
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
    const n = st.days[numToKey(tag)]?.done || 0;
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
    save();
  }
  return FACTS[st.factIdx % FACTS.length];
}

/* Ein Merkanker von vor sieben Anzeigetagen kommt noch einmal – als Abruffrage,
   nicht zum Nachlesen. Gemessen haben 51 der 141 Merkanker keine Entsprechung
   unter den Karten; ohne Rueckschau werden sie genau einmal gelesen und nie
   wieder abgerufen. Gezaehlt werden Anzeigetage, nicht Kalendertage: Wer eine
   Woche aussetzt, bekommt trotzdem den siebten Anker zurueck und keinen, den er
   nie gesehen hat. */
const RUECKSCHAU = 7;
function factRecap() {
  const st = S();
  if ((st.factSeen || 0) <= RUECKSCHAU) return null;
  const n = FACTS.length;
  return FACTS[(((st.factIdx - RUECKSCHAU) % n) + n) % n];
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
    b.remove();
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
  const datum = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const streak = liveStreak();
  // Die Ueberschrift traegt die Auskunft, nicht die Begruessung: Wer die App
  // oeffnet, will wissen, was ansteht - „Guten Abend" sagt darueber nichts.
  app.innerHTML = `
  <section class="hero fade">
    <p class="tag-zeile">${greet} · ${esc(datum)}</p>
    <h1>${plan
      ? `${plan} Karten stehen an`
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
            d.duel ? ` · dazu ${d.duel} im Duell` : ''}`
        : d.duel
          // „Noch nichts gelernt" waere gelogen, wenn schon vierzig Duellfragen
          // beantwortet sind - der Tagesplan steht nur eben noch offen.
          ? `${d.duel} Duellfragen heute – der Tagesplan wartet noch.`
          : 'Noch nichts gelernt heute – die erste Karte ist die leichteste.'}</span>
      ${d.done ? `<b>${Math.round(pct * 100)} %</b>` : ''}
    </div>
    <div class="btn-stack" style="margin-top:15px">
      <button class="btn primary" data-go="daily">${ico('play')}${plan ? 'Tagestraining starten' : 'Extra-Runde üben'}</button>
      ${kurzeRunden(plan)}
    </div>
  </section>

  <h2 class="sec">Deine Woche${streak ? ` · ${streak} Tage in Folge` : ''}</h2>
  <div class="card">
    ${wochenstreifen()}
  </div>

  <div class="${flags ? 'duo' : 'btn-stack'}" style="margin-top:11px">
    <button class="btn" data-go="weak">Wackelkandidaten</button>
    ${flags ? `<button class="btn" data-go="flag">${ico('stern', 's')}Markierte · ${flags}</button>` : ''}
  </div>

  <h2 class="sec">Wissen des Tages</h2>
  ${merkankerKarte(f, 'merkHeute', '')}
  ${rueck ? merkankerKarte(rueck, 'merkRueck', 'Vor sieben Tagen – weißt du es noch?') : ''}

  <h2 class="sec">Dein Bestand</h2>
  <div class="kpis">
    <div class="kpi"><b>${o.due}</b><span>fällig</span></div>
    <div class="kpi"><b>${o.newLeft}</b><span>neu frei</span></div>
    <div class="kpi"><b>${o.mature}</b><span>sitzt fest</span></div>
  </div>
  <div class="card" style="margin-top:10px">
    <div class="row between"><span>Karten insgesamt</span><b>${o.total}</b></div>
    <div class="bar" style="margin:10px 0 7px"><i style="width:${((o.learned / o.total) * 100).toFixed(1)}%"></i></div>
    <p class="tiny">${o.learned} angefangen · ${o.mature} gefestigt · ${o.total - o.seen} noch unberührt</p>
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
  const weiterTag = () => { const h = sess.buildDaily(); return h.length ? h : sess.buildWeak(15); };
  app.querySelector('[data-go="daily"]').onclick = () => {
    startRun(tagesplan.length ? tagesplan : sess.buildWeak(15), 'daily', weiterTag);
  };
  document.getElementById('trotzdem')?.addEventListener('click', () => {
    setSetting('trotzdemNeu', true);
    toast('Neue Karten laufen weiter – abschaltbar unter Mehr');
    renderHome();
  });
  app.querySelectorAll('[data-short]').forEach(b => b.onclick = () => {
    startRun(tagesplan.slice(0, Number(b.dataset.short)), 'daily', weiterTag);
  });
  app.querySelector('[data-go="weak"]').onclick = () => {
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
        return `<button class="trow" data-cat="${c.id}" ${off ? 'style="opacity:.5"' : ''}>
          <span class="tico">${catIcon(c.id)}</span>
          <span class="grow">
            <h3>${esc(c.name)}</h3>
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

function renderDuelStart() {
  const st = S();
  app.innerHTML = `
    <h1 class="vh">Duell-Modus</h1>
    <p class="muted">Zehn Fragen, 15 Sekunden pro Frage. Trainiert genau das, was im Quizduell zählt: schnelles Erkennen unter Druck.</p>
    <div class="card" style="margin-top:16px">
      <div class="row between"><span>Bestleistung</span><b>${st.duelBest || 0} / 10</b></div>
      <div class="row between" style="margin-top:8px"><span>Trefferquote im Duell</span><b>${st.duelAnswers ? Math.round(st.duelCorrect / st.duelAnswers * 100) : 0} %</b></div>
      ${st.duelTimed ? `<div class="row between" style="margin-top:8px"><span>Ø Zeit bis zur richtigen Antwort</span><b>${sekunden(st.duelMs / st.duelTimed)} s</b></div>` : ''}
      <p class="tiny" style="margin-top:9px">Unter Zeitdruck liegt sie naturgemäß unter der Quote im Tagestraining – deshalb wird sie getrennt geführt.</p>
    </div>
    <div class="btn-stack" style="margin-top:14px">
      <button class="btn primary" id="duelGo">${ico('duell')}Duell starten</button>
    </div>
    <p class="tiny center" style="margin-top:14px">Fehler aus dem Duell landen automatisch im nächsten Tagestraining – so schließt sich die Lücke sofort.</p>`;
  document.getElementById('duelGo').onclick = () =>
    startRun(sess.buildDuel(10), 'duel', () => sess.buildDuel(10));
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
  let aktiveTage = 0, vergangeneTage = 0;
  for (let i = 0; i < WEEKS * 7; i++) {
    const day = start + i;
    if (day > t) { cells += '<i class="future"></i>'; continue; }
    const k = numToKey(day);
    const n = tagesSumme(st.days[k]);
    vergangeneTage++;
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
      <p class="sr-only">${aktiveTage} von ${vergangeneTage} Tagen gelernt, zusammen ${totalDone} Antworten.</p>
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
   Bei über tausend Karten macht das den Unterschied zwischen ruckelnder und flüssiger Eingabe. */
let SEARCH_INDEX = null;
function searchIndex() {
  if (!SEARCH_INDEX) {
    // Genau der Text von vorher: Was frueher gefunden wurde, wird weiter gefunden.
    SEARCH_INDEX = CARDS.map(c => ({
      alles: normalize(`${c.q} ${c.a} ${c.sub} ${CAT_BY_ID[c.cat].name} ${c.t}`),
    }));
  }
  return SEARCH_INDEX;
}

/* Die Einzelfelder braucht nur die Reihenfolge, also nur fuer Karten, die
   ueberhaupt treffen – und dann einmal. Sie beim Aufbau des Index gleich
   mitzurechnen kostete auf einem gedrosselten Handy fast eine Sekunde extra
   beim ersten Suchlauf, fuer Karten, die meist gar nicht in der Liste landen. */
function felder(i) {
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
    let list;
    if (!terms.length) {
      list = CARDS.filter(c => isFlagged(c.id));
      if (!list.length) list = shuffle(CARDS).slice(0, 20);
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
        !terms.length && list.some(c => isFlagged(c.id)) ? 'Deine markierten Karten'
        : !terms.length ? 'Zufällige Auswahl – tippe etwas ein zum Suchen'
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
  // Den Suchindex in der Leerlaufzeit aufbauen, nicht beim ersten Tastendruck:
  // normalize() ueber alle Karten kostet hier 128 ms, auf einem gedrosselten
  // iPhone rund eine halbe Sekunde - lang genug, dass die ersten Zeichen
  // verschluckt werden. Bis zum ersten Buchstaben ist der Index jetzt warm.
  (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(() => searchIndex());
}

function renderSettings() {
  const s = settings();
  const sel = s.cats && s.cats.length ? s.cats : CATS.map(c => c.id);
  // Nur aktive Themen koennen Schwerpunkt sein - ein abgeschaltetes zu bevorzugen
  // waere ein Widerspruch, den die App nicht anzeigen sollte.
  const fok = (s.focus || []).filter(id => sel.includes(id));
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
        <div><label for="lvl">Reihenfolge neuer Karten</label><p class="tiny">Grundlagen zuerst schließt Schullücken.</p></div>
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

    <h2 class="sec">Schwerpunkt</h2>
    <div class="card">
      <div class="row wrap" style="gap:8px">
        ${CATS.filter(c => sel.includes(c.id)).map(c => `<button type="button" class="chip ${fok.includes(c.id) ? 'on' : ''}" data-fok="${c.id}" aria-pressed="${fok.includes(c.id)}">${catIcon(c.id, 's')}${esc(c.name)}</button>`).join('')}
      </div>
      <p class="tiny" style="margin-top:10px">Schwerpunktthemen bekommen doppelt so viele neue Karten pro Tag.
        ${fok.length ? `Zurzeit ${fok.length === 1 ? 'ist' : 'sind'} ${fok.map(id => esc(CAT_BY_ID[id].name)).join(' und ')} bevorzugt.`
          : 'Ohne Auswahl kommen alle Themen gleich oft dran.'}</p>
    </div>

    <h2 class="sec">Auf dem iPhone installieren</h2>
    <div class="card">
      <p class="muted">Safari öffnen → <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Danach startet Wissenswerk wie eine echte App, auch offline.</p>
    </div>

    <h2 class="sec">Fassung</h2>
    <div class="card">
      <div class="setrow">
        <div>
          <label>Installierte Fassung</label>
          <p class="tiny">${f ? `${esc(fassungKurz(f.v))}${f.seit ? ` · seit ${new Date(f.seit).toLocaleDateString('de-DE')}` : ''}`
                             : 'wird beim ersten Start eingerichtet'}</p>
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
        ${store.hatSicherung() ? `<button class="btn" id="undoImp">Letztes Einlesen rückgängig</button>` : ''}
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

  app.querySelectorAll('[data-fok]').forEach(b => b.onclick = () => {
    const cur = new Set(settings().focus || []);
    const id = b.dataset.fok;
    cur.has(id) ? cur.delete(id) : cur.add(id);
    // Alle als Schwerpunkt zu setzen hiesse: keiner. Dann lieber leeren.
    setSetting('focus', cur.size && cur.size < sel.length ? [...cur] : null);
    renderSettings();
  });

  app.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    const cur = new Set(settings().cats && settings().cats.length ? settings().cats : CATS.map(c => c.id));
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
      try { store.importJSON(r.result); } catch (e) { return toast('Das ist kein Wissenswerk-Backup'); }
      applyTheme(); toast('Fortschritt geladen – rückgängig unter „Mehr“'); show('home');
    };
    r.onerror = () => toast('Datei ließ sich nicht lesen');
    r.readAsText(f);
  };
  document.getElementById('undoImp')?.addEventListener('click', () => {
    // Das Netz unter Einlesen und Zuruecksetzen: der Stand davor liegt noch da.
    if (!confirm('Den Stand von vor dem letzten Einlesen oder Zurücksetzen wiederherstellen?')) return;
    if (store.sicherungZurueck()) { applyTheme(); toast('Vorheriger Stand wiederhergestellt'); show('home'); }
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
      if (swReg.waiting || swReg.installing) { renderSettings(); toast('Neue Fassung gefunden'); }
      else toast('Du hast bereits die neueste Fassung');
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
function sichtbareZeit() {
  if (laufendeMessung) laufendeMessung.beenden();
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
  laufendeMessung = messen;
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
  rueckblickOffen = false;
  stopDuelTimer();
  run = {
    queue: queue.slice(), i: 0, mode, weiter,   // weiter(): Anschlussrunde fuer „Weitermachen"
    done: 0, correct: 0, start: Date.now(),
    total: queue.length, added: 0,
    wrong: [], undo: null,
    nochmal: new Map()          // Karte -> wie oft in dieser Einheit schon nachgereicht
  };
  topbar.hidden = true; nav.hidden = true;
  app.classList.add('full');
  step();
}

function endRun() {
  stopDuelTimer();
  const r = run;
  const secs = Math.round((Date.now() - r.start) / 1000);
  today().sec = (today().sec || 0) + secs;
  if (r.mode === 'duel') S().duelBest = Math.max(S().duelBest || 0, r.correct);
  save(true);

  const pctv = r.done ? Math.round(r.correct / r.done * 100) : 0;
  const min = Math.max(1, Math.round(secs / 60));
  topbar.hidden = false; nav.hidden = false;
  app.classList.remove('full');
  onKey = null;
  const praise = pctv >= 90 ? 'Stark!' : pctv >= 70 ? 'Solide Runde.' : 'Genau dafür ist Üben da.';
  // Doppelte entfernen: dieselbe Karte kann mehrfach falsch gewesen sein
  const missed = [...new Map(r.wrong.map(c => [c.id, c])).values()];

  app.innerHTML = `
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
    ${missed.length ? `
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
      <p class="tiny center" style="margin-top:10px">Diese Karten kommen morgen wieder – sie sind schon eingeplant.</p>` : ''}
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
  run = null;
  rueckblickOffen = true;
  holeUpdateNach();
  paintChrome();
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
  document.getElementById('quit').onclick = () => (run.done ? endRun() : show('home'));
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
  if (run.mode === 'duel') return askDuel(card);
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
    day: { ...today() },
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

  // Kippt dieselbe Karte in derselben Einheit erneut, ist das Nachlernen und
  // kein zweiter Aussetzer – siehe schedule().
  const nachlernen = grade === AGAIN && (run.nochmal.get(card.id) || 0) > 0;
  putCard(card.id, schedule(cardState(card.id) || freshState(), grade, { nachlernen }));

  const st = S();
  const d = today();
  d.done++; if (ok) d.correct++;
  if (isFresh) d.newC = (d.newC || 0) + 1;
  st.totalAnswers++; if (ok) st.totalCorrect++;
  /* Wer sich vor der Aufloesung festgelegt hat, bekommt gezaehlt, wie gut das
     Urteil war. Erst diese Rueckmeldung macht aus der Festlegung etwas Lernbares:
     „Ich dachte, ich hab's" ist eine Beobachtung, die man sonst sofort vergisst. */
  if (behauptet === true) {
    st.claims = (st.claims || 0) + 1;
    if (grade === AGAIN) st.claimsMiss = (st.claimsMiss || 0) + 1;
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
function askDuel(card) {
  const opts = options(card);
  const LIMIT = 15000;
  shell(
    qkarte(head(card, false)) + `<div class="opts">${
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
  duelTimer = setInterval(() => {
    if (!run || !document.getElementById('clock')) return stopDuelTimer();
    const left = Math.max(0, 1 - verstrichen() / LIMIT);
    bar.style.width = (left * 100).toFixed(1) + '%';
    bar.style.background = left < 0.3 ? 'linear-gradient(90deg,#ff6b6b,#ffb454)' : '';
    // Einmalig, nicht im Takt: eine Live-Region, die zehnmal je Sekunde
    // schreibt, macht das Vorlesen der Frage unmoeglich.
    if (!gewarnt && left > 0 && verstrichen() > LIMIT - 5000) { gewarnt = true; announce('Noch fünf Sekunden.'); }
    if (left <= 0) finish(null);
  }, 100);

  function finish(chosen) {
    if (finished || !run) return;
    finished = true;
    stopDuelTimer();
    // Zeit vor dem Stoppen ablesen; abgelaufene Fragen zaehlen mit vollem Limit.
    const gebraucht = Math.min(LIMIT, verstrichen());
    verstrichen.beenden();
    const ok = chosen === card.a;
    markiereOptionen(app, card.a, chosen);
    beep(ok);
    announce(ok ? 'Richtig.' : `Falsch. Die Antwort lautet: ${card.a}`);
    const body = app.querySelector('.sess-body');
    const div = document.createElement('div');
    div.className = 'fade';
    div.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ico(ok ? 'haken' : chosen === null ? 'uhr' : 'schliessen')}<span>${
      ok ? 'Richtig' : chosen === null ? 'Zeit abgelaufen' : 'Leider falsch'}</span></p>${answerBlock(card)}`;
    body.appendChild(div);
    zurAntwort(body, div);
    app.querySelector('.sess-foot').innerHTML = `<button class="btn primary" id="next">Weiter</button>`;
    const next = () => {
      const st = S(), d = today();
      // Duell-Antworten zaehlen getrennt. Sie in denselben Topf zu werfen hiess:
      // Drei Duelle lassen den Tagesfortschritt auf 71 Prozent springen, obwohl
      // keine einzige geplante Karte dran war - und die Trefferquote sinkt,
      // weil unter fuenfzehn Sekunden Zeitdruck naturgemaess geraten wird.
      // Fuer die Serie zaehlt ein Duell trotzdem: geuebt ist geuebt.
      d.duel = (d.duel || 0) + 1; if (ok) d.duelOk = (d.duelOk || 0) + 1;
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
        // gedeckelt – Begruendung bei nachDuellFehler in srs.js.
        if (cs && cs.seen > 0) putCard(card.id, nachDuellFehler(cs));
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
    // Beim allerersten Besuch gibt es hier zum ersten Mal einen Worker, den man
    // nach seiner Fassung fragen kann.
    if (!hatWorker) { hatWorker = true; pruefeFassung(); return; }
    if (laedtNeu) return;
    laedtNeu = true;
    /* Nicht mitten in einer Runde: Der Wechsel kann auch aus einem zweiten Tab
       kommen, in dem jemand „Laden" getippt hat. Hier schluckte das Neuladen
       dann die offene Frage - und zwar ohne Vorwarnung, weil dieser Tab gar
       nichts getippt hat. Der Austausch wartet, bis eine Ansicht gewechselt
       wird. Die Module laufen so lange aus dem Speicher der Seite weiter. */
    if (run) { neuLadenNachRunde = true; return; }
    location.reload();
  });
  // updateViaCache 'none': das Skript selbst darf nie aus dem HTTP-Cache
  // kommen, sonst bemerkt der Browser eine neue Fassung tagelang nicht.
  pruefeFassung();
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

function fassungVomWorker() {
  return new Promise((fertig) => {
    const ctrl = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!ctrl) return fertig(null);
    const kanal = new MessageChannel();
    /* Eine aeltere Fassung kennt die Frage nicht und antwortet nie - ohne
       diesen Wecker bliebe das Versprechen fuer immer offen. */
    const uhr = setTimeout(() => fertig(null), 2000);
    kanal.port1.onmessage = (e) => { clearTimeout(uhr); fertig(e.data ? String(e.data) : null); };
    try { ctrl.postMessage('welche-fassung', [kanal.port2]); }
    catch (e) { clearTimeout(uhr); fertig(null); }
  });
}

async function pruefeFassung() {
  const jetzt = await fassungVomWorker();
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
  if (run) { updateWartet = true; return; }
  updateBalken();
}

/** Ein zurueckgehaltenes Angebot nachholen, sobald keine Runde mehr laeuft. */
function holeUpdateNach() {
  if (!updateWartet || run) return;
  updateWartet = false;
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
function speicherBalken() {
  document.querySelector('.toast.aktion.speicher')?.remove();
  const d = document.createElement('div');
  d.className = 'toast aktion speicher';
  d.setAttribute('role', 'alert');
  d.innerHTML = '<span>Speicher voll – neue Antworten gehen verloren</span>';
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

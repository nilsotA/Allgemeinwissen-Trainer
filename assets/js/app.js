/* Wissenswerk – UI und Ablaufsteuerung */
import { CATS, CAT_BY_ID, CARDS, LEVELS } from '../../data/index.js';
import FACTS from '../../data/facts.js';
import * as store from './store.js';
import { S, settings, setSetting, save, cardState, putCard, today, todayNum, dayKey,
         numToKey, liveStreak, touchStreak, isFlagged, toggleFlag, setSaveErrorHandler,
         installFlush } from './store.js';
import { schedule, strength, preview, isLeech, fresh as freshState, AGAIN, HARD, GOOD, EASY } from './srs.js';
import { options, similarity, normalize, shuffle } from './quiz.js';
import * as sess from './session.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const topbar = document.getElementById('topbar');
const live = document.getElementById('live');
const esc = (s) => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

/* Grobe Umrechnung: etwa acht Karten je Minute */
const SHORT = [{ n: 20, label: '~3 Min' }, { n: 40, label: '~5 Min' }, { n: 80, label: '~10 Min' }];

let view = 'home';
let run = null;          // laufende Lerneinheit
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
  [...nav.querySelectorAll('.nav-btn')].forEach(b =>
    b.setAttribute('aria-current', String(b.dataset.view === view)));
}
function show(v) {
  view = v;
  run = null;
  onKey = null;
  stopDuelTimer();
  app.classList.remove('full');
  app.hidden = false; topbar.hidden = false; nav.hidden = false;
  render();
  window.scrollTo(0, 0);
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
    m.setAttribute('content', dark ? '#0e1116' : '#f5f7fa');
  }
  root.style.colorScheme = t === 'system' ? 'light dark' : t;
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if ((settings().theme || 'system') === 'system') applyTheme();
});

function toast(msg, ms = 2200) {
  document.querySelector('.toast')?.remove();
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}
function announce(msg) { if (live) live.textContent = msg; }

setSaveErrorHandler(() => toast('Speicher voll – Fortschritt sichern und Platz schaffen', 5000));

/* ================= Views ================= */
function render() {
  paintChrome();
  ({ home: renderHome, topics: renderTopics, duel: renderDuelStart,
     stats: renderStats, settings: renderSettings, lookup: renderLookup }[view] || renderHome)();
}

function ring(pct) {
  const r = 38, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<div class="dial-ring">
    <svg viewBox="0 0 88 88" width="88" height="88" aria-hidden="true">
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="var(--ring-bg)" stroke-width="8"/>
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="url(#g)" stroke-width="8"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:var(--grad1)"/><stop offset="1" style="stop-color:var(--mark2)"/>
      </linearGradient></defs>
    </svg><b>${Math.round(pct * 100)}%</b></div>`;
}

function dailyFact() {
  const st = S();
  const k = dayKey();
  if (st.factDay !== k) {
    st.factDay = k;
    st.factIdx = (st.factIdx + 1) % FACTS.length;
    save();
  }
  return FACTS[st.factIdx % FACTS.length];
}

function renderHome() {
  const o = sess.overview();
  const d = today();
  const plan = sess.buildDaily().length;
  const stau = sess.imRueckstau() && !settings().trotzdemNeu;
  const pct = Math.min(1, d.done / (d.done + plan || 1));
  const f = dailyFact();
  const flags = sess.flaggedCount();
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Servus' : 'Guten Abend';

  app.innerHTML = `
  <section class="hero fade">
    <h1>${greet}!</h1>
    <p class="muted">${plan
      ? `${plan} Karten stehen an – etwa ${Math.max(2, Math.round(plan * 0.13))} Minuten.`
      : 'Heute ist alles erledigt. Stark.'}</p>
    ${stau ? `<div class="hinweis">
      <b>Erst mal aufholen.</b> ${o.due} Wiederholungen warten – neue Karten pausieren,
      bis der Rückstand kleiner ist. So wächst der Berg nicht weiter.
      <button class="btn sm ghost" id="trotzdem" style="margin-top:9px">Trotzdem neue Karten</button>
    </div>` : ''}
    <div class="dial">
      ${ring(pct)}
      <div class="grow">
        <div class="row between"><span class="tiny">Heute beantwortet</span><b>${d.done}</b></div>
        <div class="bar ${plan === 0 ? 'ok' : ''}" style="margin:8px 0 10px"><i style="width:${(pct * 100).toFixed(0)}%"></i></div>
        <span class="tiny">${d.done ? `${Math.round((d.correct / Math.max(1, d.done)) * 100)} % richtig` : 'Noch nichts gelernt heute'}</span>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${o.due}</b><span>fällig</span></div>
      <div class="kpi"><b>${o.newLeft}</b><span>neu frei</span></div>
      <div class="kpi"><b>${o.mature}</b><span>sitzt fest</span></div>
    </div>
  </section>

  <div class="btn-stack" style="margin-top:14px">
    <button class="btn primary" data-go="daily">${plan ? '▶︎ Tagestraining starten' : '✓ Extra-Runde üben'}</button>
    ${plan > SHORT[0].n ? `<div class="row wrap" style="gap:8px;justify-content:center">
      <span class="tiny" style="width:100%;text-align:center;margin-bottom:2px">Wenig Zeit? Kürzere Runde:</span>
      ${SHORT.map(o => `<button class="chip" data-short="${o.n}">${o.label}</button>`).join('')}
    </div>` : ''}
    <div class="row" style="gap:10px">
      <button class="btn" data-go="weak" style="flex:1">Wackelkandidaten</button>
      ${flags ? `<button class="btn" data-go="flag" style="flex:1">★ Markierte (${flags})</button>` : ''}
    </div>
  </div>

  <div class="sec">Wissen des Tages</div>
  <div class="card fact">
    <h3>${esc(f.t)}</h3>
    <p class="muted">${esc(f.x)}</p>
  </div>

  <div class="sec">Dein Bestand</div>
  <div class="card">
    <div class="row between"><span>Karten insgesamt</span><b>${o.total}</b></div>
    <div class="bar" style="margin:10px 0 6px"><i style="width:${((o.learned / o.total) * 100).toFixed(1)}%"></i></div>
    <p class="tiny">${o.learned} angefangen · ${o.mature} gefestigt · ${o.total - o.seen} noch unberührt</p>
  </div>`;

  app.querySelector('[data-go="daily"]').onclick = () => {
    const q = sess.buildDaily();
    startRun(q.length ? q : sess.buildWeak(15), 'daily');
  };
  document.getElementById('trotzdem')?.addEventListener('click', () => {
    setSetting('trotzdemNeu', true);
    toast('Neue Karten laufen weiter – abschaltbar unter Mehr');
    renderHome();
  });
  app.querySelectorAll('[data-short]').forEach(b => b.onclick = () => {
    startRun(sess.buildDaily().slice(0, Number(b.dataset.short)), 'daily');
  });
  app.querySelector('[data-go="weak"]').onclick = () => {
    const q = sess.buildWeak(20);
    q.length ? startRun(q, 'weak') : toast('Erst ein paar Karten lernen 🙂');
  };
  app.querySelector('[data-go="flag"]')?.addEventListener('click', () => {
    startRun(sess.buildFlagged(20), 'flag');
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
          <span class="tico">${c.icon}</span>
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
    b.onclick = () => {
      const q = sess.buildTopic(b.dataset.cat, 20);
      q.length ? startRun(q, 'topic') : toast('Keine Karten in diesem Thema');
    };
  });
}

function renderDuelStart() {
  const st = S();
  app.innerHTML = `
    <h1 class="vh">Duell-Modus</h1>
    <p class="muted">Zehn Fragen, 15 Sekunden pro Frage. Trainiert genau das, was im Quizduell zählt: schnelles Erkennen unter Druck.</p>
    <div class="card" style="margin-top:16px">
      <div class="row between"><span>Bestleistung</span><b>${st.duelBest || 0} / 10</b></div>
      <div class="row between" style="margin-top:8px"><span>Trefferquote gesamt</span><b>${st.totalAnswers ? Math.round(st.totalCorrect / st.totalAnswers * 100) : 0} %</b></div>
    </div>
    <div class="btn-stack" style="margin-top:14px">
      <button class="btn primary" id="duelGo">⚡ Duell starten</button>
    </div>
    <div class="sec">Hinweis</div>
    <div class="card"><p class="tiny">Fehler aus dem Duell landen automatisch im nächsten Tagestraining – so schließt sich die Lücke sofort.</p></div>`;
  document.getElementById('duelGo').onclick = () => startRun(sess.buildDuel(10), 'duel');
}

function renderStats() {
  const st = S();
  const o = sess.overview();
  const WEEKS = 12;
  const t = todayNum();
  const dowMon = (d) => ((d + 3) % 7 + 7) % 7;      // Montag = 0; der 1.1.1970 war ein Donnerstag
  const start = t + (6 - dowMon(t)) - (WEEKS * 7 - 1);
  let cells = '';
  for (let i = 0; i < WEEKS * 7; i++) {
    const day = start + i;
    if (day > t) { cells += '<i class="future"></i>'; continue; }
    const k = numToKey(day);
    const n = st.days[k]?.done || 0;
    const l = n === 0 ? 0 : n < 8 ? 1 : n < 20 ? 2 : n < 40 ? 3 : 4;
    cells += `<i data-l="${l}" class="${day === t ? 'today' : ''}" title="${k}: ${n} Antworten"></i>`;
  }
  const p = sess.catProgress();
  const totalDone = Object.values(st.days).reduce((a, d) => a + (d.done || 0), 0);
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

    <div class="sec">Letzte 12 Wochen</div>
    <div class="card">
      <div class="heat-wrap">
        <div class="heat-days"><span>Mo</span><span></span><span>Mi</span><span></span><span>Fr</span><span></span><span>So</span></div>
        <div class="heat grow">${cells}</div>
      </div>
      <div class="legend">wenig <i style="background:#1b222c"></i><i data-l="1" style="background:#1e4d3c"></i><i data-l="2" style="background:#2a7a5c"></i><i data-l="3" style="background:#37b17f"></i><i data-l="4" style="background:#3ddc97"></i> viel</div>
    </div>

    <div class="sec">Was kommt auf dich zu</div>
    <div class="card">
      ${fc.some(n => n > 0) ? `
      <div class="fc">${fc.map((n, i) => `
        <div class="fc-col" title="${n} Wiederholungen">
          <span class="fc-n">${n || ''}</span>
          <i style="height:${Math.max(3, (n / fcMax) * 72).toFixed(0)}px"></i>
          <span class="fc-l">${names[i]}</span>
        </div>`).join('')}</div>
      <p class="tiny" style="margin-top:10px">Fällige Wiederholungen der nächsten sieben Tage – neue Karten kommen noch dazu.</p>`
      : `<p class="muted">Noch nichts eingeplant. Sobald du Karten gelernt hast, siehst du hier, wie viele Wiederholungen an den nächsten Tagen anstehen.</p>`}
    </div>

    ${weak.length ? `
    <div class="sec">Deine Schwachstellen</div>
    <div class="tlist">
      ${weak.map(w => `<button class="trow" data-sub="${esc(w.cat)}|${esc(w.sub)}">
        <span class="tico">${CAT_BY_ID[w.cat].icon}</span>
        <span class="grow">
          <h3>${esc(w.sub)}</h3>
          <span class="tiny">${esc(CAT_BY_ID[w.cat].name)} · ${Math.round(w.rate * 100)} % richtig bei ${w.seen} Abfragen</span>
          <span class="bar"><i style="width:${(w.rate * 100).toFixed(0)}%"></i></span>
        </span>
        <span class="pct">üben</span>
      </button>`).join('')}
    </div>` : ''}

    ${wochen.length >= 2 ? `
    <div class="sec">Trefferquote je Woche</div>
    <div class="card">
      <div class="fc">${wochen.map(w => `
        <div class="fc-col" title="${w.label}: ${w.done} Antworten">
          <span class="fc-n">${w.pct}%</span>
          <i class="quote" style="height:${Math.max(4, (w.pct / 100) * 72).toFixed(0)}px"></i>
          <span class="fc-l">${w.label}</span>
        </div>`).join('')}</div>
      <p class="tiny" style="margin-top:10px">${trendText}</p>
    </div>` : ''}

    <div class="sec">Wissensstand</div>
    <div class="card">
      <div class="row between"><span>Trefferquote gesamt</span><b>${Math.round(o.accuracy * 100)} %</b></div>
      <div class="row between" style="margin-top:9px"><span>Karten gefestigt</span><b>${o.mature} / ${o.total}</b></div>
      <div class="row between" style="margin-top:9px"><span>Noch nie gesehen</span><b>${o.total - o.seen}</b></div>
    </div>

    <div class="sec">Nach Thema</div>
    <div class="tlist">
      ${CATS.map(c => {
        const s = p[c.id] || { pct: 0, n: 0 };
        return `<div class="trow" style="pointer-events:none">
          <span class="tico">${c.icon}</span>
          <span class="grow"><h3>${esc(c.name)}</h3><span class="bar"><i style="width:${(s.pct * 100).toFixed(0)}%"></i></span></span>
          <span class="pct">${Math.round(s.pct * 100)}%</span></div>`;
      }).join('')}
    </div>`;

  app.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => {
    const [cat, sub] = b.dataset.sub.split('|');
    const q = sess.buildSub(cat, sub, 20);
    q.length ? startRun(q, 'sub') : toast('Keine Karten gefunden');
  });
}

/* ---- Nachschlagen: suchen, lesen, markieren ---- */
let lookupQuery = '';

/* Suchindex einmal aufbauen statt bei jedem Tastendruck über alle Karten zu normalisieren.
   Bei über tausend Karten macht das den Unterschied zwischen ruckelnder und flüssiger Eingabe. */
let SEARCH_INDEX = null;
function searchIndex() {
  if (!SEARCH_INDEX) {
    SEARCH_INDEX = CARDS.map(c => normalize(`${c.q} ${c.a} ${c.sub} ${CAT_BY_ID[c.cat].name} ${c.t}`));
  }
  return SEARCH_INDEX;
}
function renderLookup() {
  app.innerHTML = `
    <h1 class="vh">Nachschlagen</h1>
    <input class="recall-in" id="q" type="search" inputmode="search" autocomplete="off"
           aria-label="Karten durchsuchen" placeholder="Suchen – Frage, Antwort oder Thema" value="${esc(lookupQuery)}">
    <p class="tiny" style="margin:8px 2px 0">Tippe auf eine Karte, um Antwort und Kontext zu sehen. Mit ★ markierst du sie fürs gezielte Üben.</p>
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
      list = CARDS.filter((c, i) => terms.every(t => idx[i].includes(t)));
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
        return `<div class="lk" data-id="${c.id}">
          <div class="lk-head">
            <span class="grow">
              <span class="qcat">${CAT_BY_ID[c.cat].icon} ${esc(c.sub)}</span>
              <span class="lk-q">${esc(c.q)}</span>
            </span>
            <button class="star ${isFlagged(c.id) ? 'on' : ''}" data-flag="${c.id}" aria-label="Markieren">★</button>
          </div>
          <div class="lk-body" hidden>
            <div class="answer">
              <div class="lab">Antwort</div>
              <div class="val">${esc(c.a)}</div>
              ${c.t ? `<p class="expl">${esc(c.t)}</p>` : ''}
            </div>
            <p class="tiny" style="margin-top:8px">${cs && cs.seen ? `${st} % gefestigt · ${cs.seen}× abgefragt` : 'Noch nicht gelernt'} · Stufe ${LEVELS[c.d].name}</p>
          </div>
        </div>`;
      }).join('') || '<p class="empty">Nichts gefunden. Andere Wörter probieren?</p>'}`;

    res.querySelectorAll('.lk').forEach(el => {
      el.querySelector('.lk-head').onclick = (e) => {
        if (e.target.closest('[data-flag]')) return;
        const b = el.querySelector('.lk-body');
        b.hidden = !b.hidden;
        el.classList.toggle('open', !b.hidden);
      };
    });
    res.querySelectorAll('[data-flag]').forEach(b => b.onclick = () => {
      const on = toggleFlag(b.dataset.flag);
      b.classList.toggle('on', on);
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
}

function renderSettings() {
  const s = settings();
  const sel = s.cats && s.cats.length ? s.cats : CATS.map(c => c.id);
  const flags = sess.flaggedCount();
  app.innerHTML = `
    <h1 class="vh">Einstellungen</h1>
    <div class="sec">Tagespensum</div>
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

    <div class="sec">Aktive Themen</div>
    <div class="card">
      <div class="row wrap" style="gap:8px">
        ${CATS.map(c => `<button class="chip ${sel.includes(c.id) ? 'on' : ''}" data-tog="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}
      </div>
      <p class="tiny" style="margin-top:10px">Abgeschaltete Themen tauchen im Tagestraining nicht mehr auf.</p>
    </div>

    <div class="sec">Auf dem iPhone installieren</div>
    <div class="card">
      <p class="muted">Safari öffnen → Teilen-Symbol <b>⬆︎</b> → <b>Zum Home-Bildschirm</b>. Danach startet Wissenswerk wie eine echte App, auch offline.</p>
    </div>

    <div class="sec">Daten</div>
    <div class="card">
      <div class="btn-stack">
        <button class="btn" id="exp">Fortschritt sichern (Datei)</button>
        <button class="btn" id="imp">Fortschritt einlesen</button>
        <input type="file" id="impFile" accept="application/json" hidden>
        ${flags ? `<button class="btn" id="clrFlags">Alle ${flags} Markierungen löschen</button>` : ''}
        <button class="btn danger" id="rst">Alles zurücksetzen</button>
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

  app.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    const cur = new Set(settings().cats && settings().cats.length ? settings().cats : CATS.map(c => c.id));
    const id = b.dataset.tog;
    cur.has(id) ? cur.delete(id) : cur.add(id);
    if (!cur.size) return toast('Mindestens ein Thema muss aktiv bleiben');
    setSetting('cats', cur.size === CATS.length ? null : [...cur]);
    renderSettings();
  });

  document.getElementById('exp').onclick = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wissenswerk-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const file = document.getElementById('impFile');
  document.getElementById('imp').onclick = () => file.click();
  file.onchange = () => {
    const f = file.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { store.importJSON(r.result); toast('Fortschritt geladen'); show('home'); }
      catch (e) { toast('Datei passt nicht'); }
    };
    r.readAsText(f);
  };
  document.getElementById('clrFlags')?.addEventListener('click', () => {
    S().flags = {}; save(true); toast('Markierungen gelöscht'); renderSettings();
  });
  document.getElementById('rst').onclick = () => {
    if (confirm('Wirklich den gesamten Lernfortschritt löschen?')) {
      store.resetAll(); toast('Zurückgesetzt'); show('home');
    }
  };
}

/* ================= Lerneinheit ================= */
/* Laufender Zeitgeber der Duellfrage – muss beim Verlassen der Ansicht enden,
   sonst feuert er weiter und ruft finish() auf einem längst ersetzten Bildschirm auf. */
let duelTimer = null;
function stopDuelTimer() { if (duelTimer) { clearInterval(duelTimer); duelTimer = null; } }

function startRun(queue, mode) {
  if (!queue.length) return toast('Nichts zu üben');
  stopDuelTimer();
  run = {
    queue: queue.slice(), i: 0, mode,
    done: 0, correct: 0, start: Date.now(),
    total: queue.length, added: 0,
    wrong: [], undo: null
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
      <div class="done-emoji">${pctv >= 90 ? '🏅' : pctv >= 70 ? '💪' : '🌱'}</div>
      <h1 style="font-size:24px">${praise}</h1>
      <p class="muted">${r.correct} von ${r.done} richtig · ${min} Min.</p>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${pctv}%</b><span>Trefferquote</span></div>
      <div class="kpi"><b>${liveStreak()}</b><span>Tage in Folge</span></div>
      <div class="kpi"><b>${sess.overview().due}</b><span>noch fällig</span></div>
    </div>
    ${missed.length ? `
      <div class="sec">Das saß noch nicht (${missed.length})</div>
      <div class="tlist">
        ${missed.slice(0, 12).map(c => `<div class="card" style="padding:13px 14px">
          <span class="qcat">${CAT_BY_ID[c.cat].icon} ${esc(c.sub)}</span>
          <p style="font-weight:650;margin:5px 0 4px;font-size:15px">${esc(c.q)}</p>
          <p class="muted" style="color:var(--ok);font-weight:650">${esc(c.a)}</p>
          ${c.t ? `<p class="tiny" style="margin-top:5px">${esc(c.t)}</p>` : ''}
        </div>`).join('')}
      </div>
      <p class="tiny center" style="margin-top:10px">Diese Karten kommen morgen wieder – sie sind schon eingeplant.</p>` : ''}
    <div class="btn-stack" style="margin-top:18px">
      <button class="btn primary" id="again">Weitermachen</button>
      <button class="btn ghost" id="home">Zur Übersicht</button>
    </div>`;
  document.getElementById('again').onclick = () => {
    const q = r.mode === 'duel' ? sess.buildDuel(10)
      : sess.buildDaily().length ? sess.buildDaily() : sess.buildWeak(15);
    q.length ? startRun(q, r.mode) : show('home');
  };
  document.getElementById('home').onclick = () => show('home');
  run = null;
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
  return !!cs && cs.reps >= 2;              // erst erkennen, dann frei abrufen
}

function shell(inner, foot) {
  const r = run;
  const total = r.total + r.added;
  const pct = (r.done / Math.max(1, total)) * 100;
  app.innerHTML = `
    <div class="sess">
      <div class="sess-top">
        <button class="icon-btn" id="quit" aria-label="Einheit beenden">✕</button>
        <div class="bar"><i style="width:${Math.min(100, pct).toFixed(0)}%"></i></div>
        <span class="tiny" style="min-width:42px;text-align:right">${r.done}/${total}</span>
        <button class="icon-btn" id="undo" aria-label="Letzte Antwort zurücknehmen" ${r.undo ? '' : 'disabled'}>↶</button>
      </div>
      <div class="sess-body fade">${inner}</div>
      <div class="sess-foot">${foot}</div>
    </div>`;
  document.getElementById('quit').onclick = () => (run.done ? endRun() : show('home'));
  document.getElementById('undo').onclick = undoLast;
}

function head(card, isFresh) {
  const cat = CAT_BY_ID[card.cat];
  const zaeh = isLeech(cardState(card.id));
  return `<div class="qmeta">
      <span class="qcat">${cat.icon} ${esc(cat.name)}</span>
      <span class="pill">${esc(card.sub)}</span>
      ${isFresh ? '<span class="pill new">neu</span>' : '<span class="pill rep">Wiederholung</span>'}
      ${zaeh ? '<span class="pill zaeh" title="Diese Karte kippt immer wieder um">🔁 hartnäckig</span>' : ''}
      ${LEVELS[card.d].name === card.sub ? '' : `<span class="pill">${LEVELS[card.d].name}</span>`}
    </div>
    <h2 class="q">${esc(card.q)}</h2>`;
}

function step() {
  if (!run) return;
  if (run.i >= run.queue.length) return endRun();
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
  const t0 = Date.now();
  shell(
    head(card, isFresh) + `<div class="opts" id="opts">${
      opts.map((o, i) => `<button class="opt" data-v="${esc(o)}">
        <span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')
    }</div>`,
    isFresh ? `<p class="tiny center">Neue Karte – rate ruhig, der Versuch selbst hilft beim Behalten.</p>` : ''
  );
  const pick = (b) => {
    const ok = b.dataset.v === card.a;
    const dt = Date.now() - t0;
    app.querySelectorAll('.opt').forEach(x => {
      x.disabled = true;
      if (x.dataset.v === card.a) x.classList.add('right');
      else if (x === b) x.classList.add('wrong');
      else x.classList.add('dim');
    });
    beep(ok);
    const grade = !ok ? AGAIN
      : (cs && cs.reps >= 2 && dt < 4000) ? EASY
      : dt > 14000 ? HARD : GOOD;
    showFeedback(card, ok, grade, isFresh);
  };
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(b));
  onKey = (e) => {
    const n = '1234'.indexOf(e.key);
    const l = 'abcd'.indexOf(e.key.toLowerCase());
    const idx = n >= 0 ? n : l;
    const btns = app.querySelectorAll('.opt:not([disabled])');
    if (idx >= 0 && btns[idx]) { e.preventDefault(); pick(btns[idx]); }
  };
}

/* ---- Freies Abrufen mit Selbstbewertung ---- */
function askRecall(card, isFresh, cs) {
  shell(
    head(card, isFresh) + `
      <input class="recall-in" id="rin" type="text" inputmode="text" autocomplete="off"
             autocapitalize="sentences" spellcheck="false" placeholder="Antwort tippen (optional)">
      <p class="tiny">Erst selbst denken – der Abruf ist der eigentliche Lerneffekt.</p>`,
    `<button class="btn primary" id="reveal">Lösung zeigen</button>`
  );
  const input = document.getElementById('rin');
  const go = () => {
    const typed = input.value.trim();
    revealRecall(card, typed, typed ? similarity(typed, card.a) : 0, cs, isFresh);
  };
  document.getElementById('reveal').onclick = go;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
}

function revealRecall(card, typed, sim, cs, isFresh) {
  const near = sim >= 0.8;
  // Dazwischen liegt das Feld, in dem der Vergleich bewusst streng ist: ein
  // vertauschter Wortanfang oder ein fehlendes tragendes Wort. Das als glatt
  // falsch abzustempeln wäre unfair – als richtig durchzuwinken schädlich.
  const knapp = !near && sim >= 0.6;
  if (typed) beep(near);
  announce(near ? 'Deine Eingabe passt.' : `Die Antwort lautet: ${card.a}`);
  const hint = !typed ? '' : near
    ? `<p class="verdict good">✓ Deine Eingabe passt: „${esc(typed)}“</p>`
    : knapp
      ? `<p class="verdict fast">≈ Knapp daneben: „${esc(typed)}“ – vergleich genau.</p>`
      : `<p class="verdict bad">✕ Du hattest: „${esc(typed)}“</p>`;
  const g = (grade, label, cls) =>
    `<button class="btn ${cls}" data-g="${grade}"><span>${label}</span><small>${preview(cs, grade)}</small></button>`;
  shell(
    head(card, isFresh) + hint + answerBlock(card),
    `<p class="tiny center" style="margin-bottom:2px">Wie gut saß die Antwort?</p>
     <div class="grades">
       ${g(AGAIN, 'Nochmal', 'g0')}${g(HARD, 'Schwer', 'g1')}${g(GOOD, 'Gut', 'g2')}${g(EASY, 'Leicht', 'g3')}
     </div>`
  );
  lockUndo();
  const grade = (n) => commit(card, n, n !== AGAIN, isFresh);
  app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => grade(Number(b.dataset.g)));
  onKey = (e) => {
    const idx = '1234'.indexOf(e.key);
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
  return `<div class="answer">
      <div class="lab">Antwort</div>
      <div class="val">${esc(card.a)}</div>
      ${card.t ? `<p class="expl">${esc(card.t)}</p>` : ''}
      ${zaeh ? `<p class="knack">Diese Karte ist dir schon ${cs.lapses}-mal entfallen.
        ${esc(KNACK_TIPPS[cs.lapses % KNACK_TIPPS.length])}</p>` : ''}
    </div>`;
}

function showFeedback(card, ok, grade, isFresh) {
  announce(ok ? 'Richtig.' : `Falsch. Die Antwort lautet: ${card.a}`);
  const body = app.querySelector('.sess-body');
  const div = document.createElement('div');
  div.className = 'fade';
  div.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ok ? '✓ Richtig' : '✕ Leider falsch'}</p>${answerBlock(card)}`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
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
    streak: st.streak, best: st.best, lastDay: st.lastDay,
    i: run.i, done: run.done, correct: run.correct,
    added: run.added, wrongLen: run.wrong.length,
    insertedAt: -1
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
  st.streak = u.streak; st.best = u.best; st.lastDay = u.lastDay;
  if (u.insertedAt >= 0) run.queue.splice(u.insertedAt, 1);
  run.i = u.i; run.done = u.done; run.correct = u.correct;
  run.added = u.added; run.wrong.length = u.wrongLen;
  run.undo = null;
  save(true);
  toast('Antwort zurückgenommen', 1400);
  step();
}

function commit(card, grade, ok, isFresh) {
  const undo = snapshot(card);

  putCard(card.id, schedule(cardState(card.id) || freshState(), grade));

  const st = S();
  const d = today();
  d.done++; if (ok) d.correct++;
  if (isFresh) d.newC = (d.newC || 0) + 1;
  st.totalAnswers++; if (ok) st.totalCorrect++;
  touchStreak();

  run.done++; if (ok) run.correct++; else run.wrong.push(card);
  run.i++;

  // Falsch beantwortete Karten kommen innerhalb der Einheit noch einmal dran
  if (grade === AGAIN) {
    const pos = Math.min(run.queue.length, run.i + 4);
    run.queue.splice(pos, 0, { card, fresh: false });
    run.added++;
    undo.insertedAt = pos;
  }
  run.undo = undo;
  save();
  step();
}

/* ---- Duell: schnell, mit Zeitdruck ---- */
function askDuel(card) {
  const opts = options(card);
  const LIMIT = 15000;
  const t0 = Date.now();
  shell(
    head(card, false) + `<div class="opts">${
      opts.map((o, i) => `<button class="opt" data-v="${esc(o)}">
        <span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')
    }</div>`,
    `<div class="bar" id="clock"><i style="width:100%;transition:width .1s linear"></i></div>`
  );
  document.getElementById('undo').disabled = true;   // im Duell zählt die Zeit
  const bar = app.querySelector('#clock i');
  let finished = false;
  stopDuelTimer();
  duelTimer = setInterval(() => {
    if (!run || !document.getElementById('clock')) return stopDuelTimer();
    const left = Math.max(0, 1 - (Date.now() - t0) / LIMIT);
    bar.style.width = (left * 100).toFixed(1) + '%';
    bar.style.background = left < 0.3 ? 'linear-gradient(90deg,#ff6b6b,#ffb454)' : '';
    if (left <= 0) finish(null);
  }, 100);

  function finish(chosen) {
    if (finished || !run) return;
    finished = true;
    stopDuelTimer();
    const ok = chosen === card.a;
    app.querySelectorAll('.opt').forEach(x => {
      x.disabled = true;
      if (x.dataset.v === card.a) x.classList.add('right');
      else if (x.dataset.v === chosen) x.classList.add('wrong');
      else x.classList.add('dim');
    });
    beep(ok);
    announce(ok ? 'Richtig.' : `Falsch. Die Antwort lautet: ${card.a}`);
    const body = app.querySelector('.sess-body');
    const div = document.createElement('div');
    div.className = 'fade';
    div.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${
      ok ? '✓ Richtig' : chosen === null ? '⏱ Zeit abgelaufen' : '✕ Leider falsch'}</p>${answerBlock(card)}`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    app.querySelector('.sess-foot').innerHTML = `<button class="btn primary" id="next">Weiter</button>`;
    const next = () => {
      const st = S(), d = today();
      d.done++; if (ok) d.correct++;
      st.totalAnswers++; if (ok) st.totalCorrect++;
      touchStreak();
      if (!ok) {
        run.wrong.push(card);
        // Fehler im Duell holt das Tagestraining sofort nach. Nur bei bereits
        // gelernten Karten – eine unberührte Karte steht ohnehin in der Neu-Liste,
        // und ein Zustand mit seen=0 würde sie in beide Listen bringen.
        const cs = cardState(card.id);
        if (cs && cs.seen > 0) putCard(card.id, { ...cs, due: todayNum() });
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
    const n = '1234'.indexOf(e.key);
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline ist Kür */ });
  }
}
boot();

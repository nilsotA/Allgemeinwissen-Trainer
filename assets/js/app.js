/* Wissenswerk – UI und Ablaufsteuerung */
import { CATS, CAT_BY_ID, CARDS, LEVELS } from '../../data/index.js';
import FACTS from '../../data/facts.js';
import * as store from './store.js';
import { S, settings, setSetting, save, cardState, putCard, today, todayNum, dayKey, numToKey, liveStreak, touchStreak } from './store.js';
import { schedule, strength, preview, fresh as freshState, AGAIN, HARD, GOOD, EASY, isDue } from './srs.js';
import { options, similarity, shuffle } from './quiz.js';
import * as sess from './session.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const topbar = document.getElementById('topbar');
const esc = (s) => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

let view = 'home';
let run = null;          // laufende Lerneinheit

/* ================= Chrome ================= */
function paintChrome() {
  document.getElementById('streakNum').textContent = liveStreak();
  [...nav.querySelectorAll('.nav-btn')].forEach(b =>
    b.setAttribute('aria-current', String(b.dataset.view === view)));
}
function show(v) {
  view = v;
  run = null;
  app.classList.remove('full');
  app.hidden = false; topbar.hidden = false; nav.hidden = false;
  render();
  window.scrollTo(0, 0);
}
nav.addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (b) show(b.dataset.view);
});

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

/* ================= Views ================= */
function render() {
  paintChrome();
  if (view === 'home') return renderHome();
  if (view === 'topics') return renderTopics();
  if (view === 'duel') return renderDuelStart();
  if (view === 'stats') return renderStats();
  if (view === 'settings') return renderSettings();
}

function ring(pct) {
  const r = 38, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<div class="dial-ring">
    <svg viewBox="0 0 88 88" width="88" height="88" aria-hidden="true">
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="#222b37" stroke-width="8"/>
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="url(#g)" stroke-width="8"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#8b5cf6"/>
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
  const goal = settings().newPerDay + Math.min(o.due, settings().maxReviews);
  const pct = goal ? Math.min(1, d.done / goal) : 1;
  const f = dailyFact();
  const plan = sess.buildDaily().length;
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Servus' : 'Guten Abend';

  app.innerHTML = `
  <section class="hero fade">
    <h1>${greet}!</h1>
    <p class="muted">${plan ? `${plan} Karten stehen heute an – etwa ${Math.max(2, Math.round(plan * 0.35))} Minuten.` : 'Heute ist alles erledigt. Stark.'}</p>
    <div class="dial">
      ${ring(pct)}
      <div class="grow">
        <div class="row between"><span class="tiny">Heute beantwortet</span><b>${d.done}</b></div>
        <div class="bar ${pct >= 1 ? 'ok' : ''}" style="margin:8px 0 10px"><i style="width:${(pct * 100).toFixed(0)}%"></i></div>
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
    <button class="btn" data-go="weak">Wackelkandidaten üben</button>
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
  app.querySelector('[data-go="weak"]').onclick = () => {
    const q = sess.buildWeak(20);
    if (!q.length) return toast('Erst ein paar Karten lernen 🙂');
    startRun(q, 'weak');
  };
}

function renderTopics() {
  const p = sess.catProgress();
  const active = settings().cats;
  app.innerHTML = `
    <h1 style="font-size:22px;margin-bottom:4px">Themen</h1>
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
      if (!q.length) return toast('Keine Karten in diesem Thema');
      startRun(q, 'topic');
    };
  });
}

function renderDuelStart() {
  const st = S();
  app.innerHTML = `
    <h1 style="font-size:22px;margin-bottom:4px">Duell-Modus</h1>
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
  // Montag = 0; der 1.1.1970 war ein Donnerstag
  const dowMon = (d) => ((d + 3) % 7 + 7) % 7;
  const start = t + (6 - dowMon(t)) - (WEEKS * 7 - 1);   // erste Spalte beginnt an einem Montag
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

  app.innerHTML = `
    <h1 style="font-size:22px;margin-bottom:4px">Statistik</h1>
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
}

function renderSettings() {
  const s = settings();
  const sel = s.cats && s.cats.length ? s.cats : CATS.map(c => c.id);
  app.innerHTML = `
    <h1 style="font-size:22px;margin-bottom:4px">Einstellungen</h1>
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
        <button class="btn danger" id="rst">Alles zurücksetzen</button>
      </div>
      <p class="tiny" style="margin-top:10px">Alles liegt nur auf diesem Gerät – kein Konto, kein Server.</p>
    </div>
    <p class="tiny center" style="margin-top:18px">${CARDS.length} Karten · Wissenswerk</p>`;

  const bind = (id, key, cast = v => v) => {
    document.getElementById(id).onchange = e => { setSetting(key, cast(e.target.value)); };
  };
  bind('npd', 'newPerDay', Number);
  bind('mrv', 'maxReviews', Number);
  bind('rec', 'recallMode');
  bind('lvl', 'level');
  document.getElementById('snd').onchange = e => setSetting('sound', e.target.checked);

  app.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    let cur = new Set(settings().cats && settings().cats.length ? settings().cats : CATS.map(c => c.id));
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
  document.getElementById('rst').onclick = () => {
    if (confirm('Wirklich den gesamten Lernfortschritt löschen?')) {
      store.resetAll(); toast('Zurückgesetzt'); show('home');
    }
  };
}

/* ================= Lerneinheit ================= */
function startRun(queue, mode) {
  if (!queue.length) return toast('Nichts zu üben');
  run = {
    queue: queue.slice(), i: 0, mode,
    done: 0, correct: 0, start: Date.now(),
    total: queue.length, added: 0
  };
  topbar.hidden = true; nav.hidden = true;
  app.classList.add('full');
  step();
}

function endRun() {
  const r = run;
  const secs = Math.round((Date.now() - r.start) / 1000);
  today().sec = (today().sec || 0) + secs;
  if (r.mode === 'duel') {
    const st = S();
    st.duelBest = Math.max(st.duelBest || 0, r.correct);
  }
  save(true);
  const pctv = r.done ? Math.round(r.correct / r.done * 100) : 0;
  const min = Math.max(1, Math.round(secs / 60));
  topbar.hidden = false; nav.hidden = false;
  app.classList.remove('full');
  const praise = pctv >= 90 ? 'Stark!' : pctv >= 70 ? 'Solide Runde.' : 'Genau dafür ist Üben da.';
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
  if (m === 'mc') return false;
  if (m === 'recall') return true;
  return !!cs && cs.reps >= 2;              // erst erkennen, dann frei abrufen
}

function shell(inner, foot) {
  const r = run;
  const pct = (r.done / Math.max(1, r.total + r.added)) * 100;
  app.innerHTML = `
    <div class="sess">
      <div class="sess-top">
        <button class="icon-btn" id="quit" aria-label="Beenden">✕</button>
        <div class="bar"><i style="width:${Math.min(100, pct).toFixed(0)}%"></i></div>
        <span class="tiny" style="min-width:44px;text-align:right">${r.done}/${r.total + r.added}</span>
      </div>
      <div class="sess-body fade">${inner}</div>
      <div class="sess-foot">${foot}</div>
    </div>`;
  document.getElementById('quit').onclick = () => (run.done ? endRun() : show('home'));
}

function head(card, isFresh) {
  const cat = CAT_BY_ID[card.cat];
  return `<div class="qmeta">
      <span class="qcat">${cat.icon} ${esc(cat.name)}</span>
      <span class="pill">${esc(card.sub)}</span>
      ${isFresh ? '<span class="pill new">neu</span>' : '<span class="pill rep">Wiederholung</span>'}
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
  app.querySelectorAll('.opt').forEach(b => {
    b.onclick = () => {
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
  });
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
    const sim = typed ? similarity(typed, card.a) : 0;
    revealRecall(card, typed, sim, cs, isFresh);
  };
  document.getElementById('reveal').onclick = go;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

function revealRecall(card, typed, sim, cs, isFresh) {
  const near = sim >= 0.8;
  if (typed) beep(near);
  const hint = !typed ? '' : near
    ? `<p class="verdict good">✓ Deine Eingabe passt: „${esc(typed)}“</p>`
    : `<p class="verdict bad">✕ Du hattest: „${esc(typed)}“</p>`;
  const g = (grade, label, sub, cls) =>
    `<button class="btn ${cls}" data-g="${grade}"><span>${label}</span><small>${preview(cs, grade)}</small></button>`;
  shell(
    head(card, isFresh) + hint + answerBlock(card),
    `<p class="tiny center" style="margin-bottom:2px">Wie gut saß die Antwort?</p>
     <div class="grades">
       ${g(AGAIN, 'Nochmal', '', 'g0')}
       ${g(HARD, 'Schwer', '', 'g1')}
       ${g(GOOD, 'Gut', '', 'g2')}
       ${g(EASY, 'Leicht', '', 'g3')}
     </div>`
  );
  app.querySelectorAll('[data-g]').forEach(b => {
    b.onclick = () => commit(card, Number(b.dataset.g), Number(b.dataset.g) !== AGAIN, isFresh);
  });
}

function answerBlock(card) {
  return `<div class="answer">
      <div class="lab">Antwort</div>
      <div class="val">${esc(card.a)}</div>
      ${card.t ? `<p class="expl">${esc(card.t)}</p>` : ''}
    </div>`;
}

function showFeedback(card, ok, grade, isFresh) {
  const body = app.querySelector('.sess-body');
  const div = document.createElement('div');
  div.className = 'fade';
  div.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ok ? '✓ Richtig' : '✕ Leider falsch'}</p>${answerBlock(card)}`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  const foot = app.querySelector('.sess-foot');
  foot.innerHTML = `<button class="btn primary" id="next">Weiter</button>`;
  const next = () => commit(card, grade, ok, isFresh);
  document.getElementById('next').onclick = next;
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.removeEventListener('keydown', onKey); next(); }
  }, { once: true });
}

function commit(card, grade, ok, isFresh) {
  const before = cardState(card.id);
  const after = schedule(before || freshState(), grade);
  putCard(card.id, after);

  const st = S();
  const d = today();
  d.done++; if (ok) d.correct++;
  if (isFresh) d.newC = (d.newC || 0) + 1;
  st.totalAnswers++; if (ok) st.totalCorrect++;
  touchStreak();
  save();

  run.done++; if (ok) run.correct++;
  run.i++;

  // Falsch beantwortete Karten kommen innerhalb der Einheit noch einmal dran
  if (grade === AGAIN) {
    const pos = Math.min(run.queue.length, run.i + 4);
    run.queue.splice(pos, 0, { card, fresh: false });
    run.added++;
  }
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
  const bar = app.querySelector('#clock i');
  let finished = false;
  const tick = setInterval(() => {
    const left = Math.max(0, 1 - (Date.now() - t0) / LIMIT);
    bar.style.width = (left * 100).toFixed(1) + '%';
    bar.style.background = left < 0.3 ? 'linear-gradient(90deg,#ff6b6b,#ffb454)' : '';
    if (left <= 0) finish(null);
  }, 100);

  function finish(chosen) {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    const ok = chosen === card.a;
    app.querySelectorAll('.opt').forEach(x => {
      x.disabled = true;
      if (x.dataset.v === card.a) x.classList.add('right');
      else if (x.dataset.v === chosen) x.classList.add('wrong');
      else x.classList.add('dim');
    });
    beep(ok);
    const body = app.querySelector('.sess-body');
    const div = document.createElement('div');
    div.className = 'fade';
    div.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ok ? '✓ Richtig' : chosen === null ? '⏱ Zeit abgelaufen' : '✕ Leider falsch'}</p>${answerBlock(card)}`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    app.querySelector('.sess-foot').innerHTML = `<button class="btn primary" id="next">Weiter</button>`;
    document.getElementById('next').onclick = () => {
      const st = S(); const d = today();
      d.done++; if (ok) d.correct++;
      st.totalAnswers++; if (ok) st.totalCorrect++;
      touchStreak();
      // Fehler im Duell holt das Tagestraining sofort nach
      if (!ok) {
        const cs = cardState(card.id) || freshState();
        cs.due = todayNum();
        putCard(card.id, cs);
      }
      save();
      run.done++; if (ok) run.correct++;
      run.i++;
      step();
    };
  }
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => finish(b.dataset.v));
}

/* ================= Start ================= */
function boot() {
  document.getElementById('boot')?.remove();
  app.hidden = false;
  show('home');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline ist Kür */ });
  }
}
boot();

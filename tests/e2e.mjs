/* Durchlauftest im iPhone-Viewport.  Aufruf: npm run test:e2e
   Startet selbst einen lokalen Server und beendet ihn wieder. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8123;
const KEY = 'wissenswerk.v1';

let playwright;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { playwright = await import(p); break; } catch { /* nächsten Pfad probieren */ }
}
if (!playwright) {
  console.error('Playwright nicht gefunden – E2E-Test übersprungen. (npm i -D playwright)');
  process.exit(0);
}
const { chromium, devices } = playwright;

/* ---- Minimaler statischer Server, damit der Test ohne Vorbedingungen läuft ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    await stat(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('nicht gefunden');
  }
});
await new Promise(r => server.listen(PORT, r));
const URL_BASE = `http://localhost:${PORT}`;

/* ---- Kleines Prüfgerüst ---- */
let failed = 0, passed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.error(`  FAIL ${name}${extra ? ' – ' + extra : ''}`); }
};
const group = (t) => console.log(`\n${t}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'allow' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

/* Laeuft im Browser: sucht Textknoten, loest den tatsaechlichen Hintergrund ueber
   die Elternkette auf (Verlaeufe eingeschlossen) und meldet alles unter der Schwelle. */
const KONTRAST = () => {
  const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const ausVerlauf = (bi) => { const m = String(bi).match(/rgba?\([^)]+\)/g); return m ? m.map(rgb) : null; };
  const misch = (v, h) => ({ r: v.r * v.a + h.r * (1 - v.a), g: v.g * v.a + h.g * (1 - v.a), b: v.b * v.a + h.b * (1 - v.a), a: 1 });
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const verhaeltnis = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const grund = (el) => {
    let n = el; const stapel = [];
    while (n && n.nodeType === 1) {
      const st = getComputedStyle(n);
      if (st.backgroundImage && st.backgroundImage !== 'none') {
        const f = ausVerlauf(st.backgroundImage); if (f && f.length) stapel.push(...f);
      }
      const bc = rgb(st.backgroundColor);
      if (bc && bc.a > 0) { stapel.push(bc); if (bc.a === 1) break; }
      n = n.parentElement;
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stapel.length - 1; i >= 0; i--) out = misch(stapel[i], out);
    return out;
  };
  const treffer = [];
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.3) continue;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const vg = rgb(st.color); if (!vg) continue;
    const hg = grund(el);
    const v = verhaeltnis(misch(vg, hg), hg);
    const gross = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.66 && parseInt(st.fontWeight, 10) >= 700);
    if (v < (gross ? 3 : 4.5)) treffer.push({ txt: txt.slice(0, 40), v: +v.toFixed(2), farbe: st.color,
      grund: 'rgb(' + Math.round(hg.r) + ',' + Math.round(hg.g) + ',' + Math.round(hg.b) + ')',
      klasse: (el.className || '').toString().slice(0, 24) });
  }
  return treffer;
};

const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
const settle = () => page.waitForTimeout(400);          // Speichern ist um 250 ms gebündelt

try {
  group('Start und Tagestraining');
  await page.goto(`${URL_BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero', { timeout: 10000 });
  check('Startseite erscheint', await page.locator('.hero h1').count() === 1);
  // Die Auskunft steht in der Ueberschrift, nicht mehr in der Nebenzeile - deshalb
  // wird der ganze Block geprueft statt eines einzelnen Elements.
  check('Tagesplan wird angekündigt', /Karten stehen an|alles erledigt/.test(await page.locator('.hero').first().innerText()));

  await page.click('[data-go="daily"]');
  await page.waitForSelector('.opt, #reveal');
  const q1 = await page.locator('.q').innerText();
  check('Frage wird angezeigt', q1.length > 5);
  check('vier Antwortmöglichkeiten', await page.locator('.opt').count() === 4);

  group('Antwort, Rückmeldung, Fortschritt');
  await page.locator('.opt').first().click();
  await page.waitForSelector('#next');
  check('Lösung wird eingeblendet', await page.locator('.answer .val').count() > 0);
  check('richtige Option ist markiert', await page.locator('.opt.right').count() === 1);
  await page.click('#next');
  await settle();
  const s1 = await stored();
  check('Antwort wurde gespeichert', s1.totalAnswers === 1, `totalAnswers=${s1.totalAnswers}`);
  check('Kartenzustand wurde angelegt', Object.keys(s1.cards || {}).length === 1);

  group('Verklickt zurücknehmen');
  await page.click('#undo');
  await settle();
  const s2 = await stored();
  check('Zähler zurückgesetzt', s2.totalAnswers === 0, `totalAnswers=${s2.totalAnswers}`);
  check('Kartenzustand entfernt', Object.keys(s2.cards || {}).length === 0);
  check('dieselbe Frage steht wieder an', (await page.locator('.q').innerText()) === q1);
  check('Rückgängig ist danach gesperrt', await page.locator('#undo').isDisabled());

  group('Tastatursteuerung');
  await page.keyboard.press('2');
  await page.waitForSelector('#next');
  check('Zifferntaste wählt eine Option', await page.locator('.opt[disabled]').count() === 4);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.opt, #reveal, .done-wrap');
  check('Enter blättert weiter', true);

  group('Einheit beenden und Rückblick');
  for (let i = 0; i < 40 && !(await page.locator('.done-wrap').count()); i++) {
    if (await page.locator('.opt:not([disabled])').count()) {
      await page.locator('.opt:not([disabled])').first().click();
      await page.waitForSelector('#next'); await page.click('#next');
    } else if (await page.locator('#reveal').count()) {
      await page.click('#reveal'); await page.waitForSelector('[data-g]'); await page.click('[data-g="2"]');
    } else break;
    await page.waitForTimeout(30);
  }
  if (!(await page.locator('.done-wrap').count())) await page.click('#quit');
  await page.waitForSelector('.done-wrap');
  check('Abschlussbildschirm erscheint', await page.locator('.done-wrap').count() === 1);
  await page.click('#home');
  await page.waitForSelector('.hero');

  group('Nachschlagen');
  await page.click('#searchBtn');
  await page.waitForSelector('#q');
  await page.fill('#q', 'zugspitze');
  await page.waitForTimeout(300);
  check('Suche findet Treffer', await page.locator('.lk').count() > 0);
  // Mit der Tastatur, nicht mit der Maus: der Kasten war frueher nur klickbar.
  await page.locator('.lk-btn').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check('Antwort klappt per Tastatur auf', await page.locator('.lk .val').first().isVisible());
  check('Aufklapp-Knopf meldet seinen Zustand',
    await page.locator('.lk-btn').first().getAttribute('aria-expanded') === 'true');
  await page.locator('.star').first().click();
  await settle();
  check('Markierung wird gespeichert', Object.keys((await stored()).flags || {}).length === 1);
  check('Stern meldet seinen Zustand',
    await page.locator('.star').first().getAttribute('aria-pressed') === 'true');

  group('Vorlesbarkeit');
  await page.click('[data-view="home"]');
  await page.waitForSelector('.week');
  const wochenText = await page.evaluate(() => [...document.querySelectorAll('.week .wd')]
    .map(w => [...w.querySelectorAll('*')].filter(e => !e.closest('[aria-hidden="true"]')
      && e.getAttribute('aria-hidden') !== 'true').map(e => e.textContent).join(' ').trim()));
  check('Wochenstreifen nennt Tag und Ergebnis',
    wochenText.length === 7 && wochenText.every(t => /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)( \(heute\))?: \S/.test(t)),
    JSON.stringify(wochenText));

  group('Statistik');
  await page.click('[data-view="stats"]');
  await page.waitForSelector('.heat');
  check('Heatmap hat 12 Wochen', await page.locator('.heat i').count() === 84);
  check('Fortschrittsbalken sind sichtbar',
    (await page.evaluate(() => [...document.querySelectorAll('.trow .bar')].every(b => b.getBoundingClientRect().height > 4))));

  group('Themen und Einstellungen');
  await page.click('[data-view="topics"]');
  await page.waitForSelector('.trow');
  check('neun Themen gelistet', await page.locator('[data-cat]').count() === 9);
  // Ein Thema von innen: erst die Teilgebiete, dann gezielt eines üben.
  await page.locator('[data-cat="spo"]').click();
  await page.waitForSelector('[data-sub]');
  const teile = await page.locator('[data-sub]').count();
  check('Teilgebiete des Themas werden gelistet', teile >= 9, `${teile} Teilgebiete`);
  const gewaehlt = await page.locator('[data-sub]').first().getAttribute('data-sub');
  await page.locator('[data-sub]').first().click();
  await page.waitForSelector('.sess-body');
  const kat = await page.locator('.qcat').first().innerText();
  check('Übungsrunde kommt aus dem gewählten Teilgebiet',
    kat.includes(gewaehlt.split('|')[1]), `${kat} statt ${gewaehlt}`);
  await page.click('#quit');
  await page.waitForSelector('.hero, .tlist');

  await page.click('[data-view="settings"]');
  await page.waitForSelector('#npd');
  await page.locator('[data-fok="mat"]').click();
  await settle();
  check('Schwerpunkt wird gespeichert', ((await stored()).settings.focus || []).includes('mat'));
  check('Schwerpunkt-Schalter melden ihren Zustand',
    await page.locator('[data-fok="mat"]').getAttribute('aria-pressed') === 'true');
  await page.locator('[data-fok="mat"]').click();
  await settle();
  check('Schwerpunkt lässt sich wieder abwählen', !(await stored()).settings.focus);

  check('Themenschalter melden ihren Zustand',
    await page.evaluate(() => [...document.querySelectorAll('[data-tog]')]
      .every(b => b.getAttribute('aria-pressed') === String(b.classList.contains('on')))));
  await page.selectOption('#npd', '20');
  await settle();
  check('Einstellung wird sofort gespeichert', (await stored()).settings.newPerDay === 20);

  group('Duell zählt getrennt');
  /* Duell-Antworten in denselben Topf zu werfen liess den Tagesfortschritt
     springen, ohne dass eine geplante Karte dran war – und zog die Trefferquote
     nach unten, obwohl unter fünfzehn Sekunden naturgemäß geraten wird. */
  {
    const dctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const dp = await dctx.newPage();
    await dp.goto(URL_BASE, { waitUntil: 'networkidle' });
    const plan = await dp.locator('.hero h1').innerText();
    await dp.locator('.nav-btn[data-view="duel"]').click();
    await dp.locator('#duelGo').click();
    await dp.waitForSelector('.opt');
    for (let i = 0; i < 4; i++) {
      await dp.locator('.opt:not([disabled])').first().click();
      await dp.waitForSelector('#next', { timeout: 5000 });
      await dp.locator('#next').click();
      await dp.waitForTimeout(200);
    }
    await dp.locator('#quit').click().catch(() => {});
    await dp.waitForTimeout(600);
    const st = await dp.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    const tag = Object.values(st.days)[0] || {};
    check('Duell-Antworten landen im eigenen Zähler', (tag.duel || 0) >= 4, JSON.stringify(tag));
    check('das Tagestraining bleibt unberührt', (tag.done || 0) === 0, `done=${tag.done}`);
    check('die Wissensquote zählt Duelle nicht mit', (st.totalAnswers || 0) === 0,
      `totalAnswers=${st.totalAnswers}`);
    check('die Serie zählt ein Duell trotzdem', (st.streak || 0) === 1, `streak=${st.streak}`);
    await dp.locator('.nav-btn[data-view="home"]').click();
    await dp.waitForSelector('.hero h1');
    check('der Tagesplan schrumpft durch ein Duell nicht',
      (await dp.locator('.hero h1').innerText()) === plan);
    check('die Startseite behauptet nicht, es sei nichts gelernt worden',
      /Duellfragen heute/.test(await dp.locator('.seg-lab').innerText()),
      await dp.locator('.seg-lab').innerText());
    await dp.locator('.nav-btn[data-view="stats"]').click();
    await dp.waitForSelector('.heat');
    check('die Aktivitätskarte zeigt den Duelltag trotzdem',
      await dp.locator('.heat i.today').getAttribute('data-l') !== '0');
    await dctx.close();
  }

  group('Duell');
  await page.click('[data-view="duel"]');
  await page.click('#duelGo');
  await page.waitForSelector('#clock');
  check('Zeitbalken läuft', await page.locator('#clock').isVisible());
  check('Rückgängig ist im Duell gesperrt', await page.locator('#undo').isDisabled());
  await page.locator('.opt').first().click();
  await page.waitForSelector('#next');
  await page.click('#quit');
  await page.waitForSelector('.done-wrap, .hero');

  group('Dauerhaftigkeit und Offline');
  await page.goto(`${URL_BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero');
  check('Fortschritt übersteht das Neuladen', (await stored()).totalAnswers > 0);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  const sw = await page.evaluate(async () => {
    const keys = await caches.keys();
    const c = keys.length ? await caches.open(keys[0]) : null;
    return { keys: keys.length, entries: c ? (await c.keys()).length : 0 };
  });
  check('Service Worker hat den Bestand im Cache', sw.entries > 20, `${sw.entries} Einträge`);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const offline = await page.waitForSelector('.hero', { timeout: 8000 }).then(() => true).catch(() => false);
  check('App startet ohne Netz', offline);
  await ctx.setOffline(false);

  group('Bedienbarkeit auf dem Handy');
  /* Apple nennt 44 x 44 Punkt als kleinste sichere Flaeche fuer einen Finger.
     Der Stern zum Markieren war 32 px gross und traf sich entsprechend schlecht. */
  {
    const MESSEN = () => {
      const zuKlein = [];
      for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"]')) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.width < 44 || r.height < 44) zuKlein.push({
          klasse: (el.className || '').toString().slice(0, 24) || el.tagName.toLowerCase(),
          w: Math.round(r.width), h: Math.round(r.height) });
      }
      const namenlos = [...document.querySelectorAll('button, [role="button"]')].filter(el =>
        el.getBoundingClientRect().width >= 1 && !(el.textContent || '').trim()
        && !el.getAttribute('aria-label') && !el.getAttribute('title'))
        .map(el => (el.className || '').toString().slice(0, 24));
      return { zuKlein, namenlos };
    };
    const klein = new Map(); const ohneNamen = new Set();
    const wege = [
      async () => page.locator('.nav-btn[data-view="home"]').click(),
      async () => page.locator('.nav-btn[data-view="topics"]').click(),
      async () => page.locator('.nav-btn[data-view="duel"]').click(),
      async () => page.locator('.nav-btn[data-view="stats"]').click(),
      async () => page.locator('.nav-btn[data-view="settings"]').click(),
      async () => page.locator('#searchBtn').click(),
    ];
    for (const gehe of wege) {
      await gehe(); await page.waitForTimeout(280);
      const { zuKlein, namenlos } = await page.evaluate(MESSEN);
      for (const t of zuKlein) klein.set(t.klasse, t);
      namenlos.forEach(x => ohneNamen.add(x));
    }
    check('alle Tippziele sind mindestens 44 px gross', klein.size === 0,
      [...klein.values()].slice(0, 4).map(t => `.${t.klasse} ${t.w}x${t.h}`).join(' | '));
    check('jeder Knopf hat einen zugaenglichen Namen', ohneNamen.size === 0, [...ohneNamen].join(' | '));
    await page.locator('.nav-btn[data-view="home"]').click();
    await page.waitForTimeout(250);
  }

  group('Farbkontrast');
  /* Beide Paletten gegen WCAG AA pruefen (4,5:1, bei grosser Schrift 3:1). Eine feste
     Farbe im Blatt faellt im jeweils anderen Schema sofort auf: der Verlauf des
     Startblocks blieb hell wie dunkel derselbe, waehrend die Schrift umschlug - die
     Begruessung stand bei 1,15:1. Ebenso die Bewertungsknoepfe, deren helle
     Pastelltoene auf weissem Grund bei 1,3:1 landeten. */
  for (const schema of ['light', 'dark']) {
    const kctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', colorScheme: schema });
    const kpage = await kctx.newPage();
    await kpage.goto(URL_BASE, { waitUntil: 'networkidle' });
    await kpage.evaluate((k) => {
      const r = JSON.parse(localStorage.getItem(k) || '{}');
      r.days = {};
      const tag = (d) => d.toISOString().slice(0, 10);
      const heute = new Date();
      for (let i = 0; i < 40; i++) {
        const d = new Date(heute); d.setDate(d.getDate() - i);
        r.days[tag(d)] = { done: 20, correct: 15, newC: 6, sec: 400 };
      }
      r.streak = 9; r.best = 15; r.totalAnswers = 800; r.totalCorrect = 600;
      r.settings = { ...(r.settings || {}), recallMode: 'recall' };   // erzwingt die Bewertungsknoepfe
      localStorage.setItem(k, JSON.stringify(r));
    }, KEY);
    await kpage.reload({ waitUntil: 'networkidle' });
    const maengel = [];
    const wege = [
      async () => {},
      async () => kpage.locator('.nav-btn[data-view="topics"]').click(),
      async () => kpage.locator('.nav-btn[data-view="duel"]').click(),
      async () => kpage.locator('.nav-btn[data-view="stats"]').click(),
      async () => kpage.locator('.nav-btn[data-view="settings"]').click(),
      async () => { await kpage.locator('.nav-btn[data-view="home"]').click(); await kpage.waitForTimeout(200);
        await kpage.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click(); },
      async () => kpage.locator('.sess-foot button').first().click(),
    ];
    for (const gehe of wege) {
      await gehe();
      await kpage.waitForTimeout(300);
      maengel.push(...await kpage.evaluate(KONTRAST));
    }
    const eindeutig = [...new Map(maengel.map(m => [m.klasse + m.farbe + m.grund, m])).values()];
    check(`${schema === 'light' ? 'helles' : 'dunkles'} Schema erfuellt WCAG AA`, eindeutig.length === 0,
      eindeutig.slice(0, 4).map(m => `${m.v}:1 bei "${m.txt}"`).join(' | '));
    await kctx.close();
  }

  group('Satz und Umbruch');
  /* Zwei Fehlerbilder, die man auf dem Handy leicht uebersieht und die sich
     zuverlaessig messen lassen: waagerecht abgeschnittener Inhalt (der Schalter
     in den Einstellungen ragte 4 px aus seiner Zeile) und ein einzelnes
     Bruchstueck auf der letzten Zeile ("0" und "%" standen untereinander). */
  {
    const SATZ = () => {
      const raus = [];
      for (const el of document.querySelectorAll('body *')) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
        const kl = (el.className || '').toString().slice(0, 24) || el.tagName.toLowerCase();
        if (el.scrollWidth - el.clientWidth > 2 && st.overflowX !== 'auto' && st.overflowX !== 'scroll') {
          raus.push({ art: 'abgeschnitten', kl, txt: txt.slice(0, 30), n: el.scrollWidth - el.clientWidth });
        }
        if (!txt || txt.length <= 12) continue;
        const zeilen = Math.round(r.height / (parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.5));
        if (zeilen < 2) continue;
        const rng = document.createRange();
        rng.selectNodeContents(el);
        const kisten = [...rng.getClientRects()];
        if (kisten.length < 2) continue;
        const letzte = kisten[kisten.length - 1];
        const breiteste = Math.max(...kisten.map(k => k.width));
        if (letzte.width > 0 && letzte.width < breiteste * 0.13) {
          raus.push({ art: 'Bruchstueck', kl, txt: txt.slice(0, 30), n: Math.round(letzte.width) });
        }
      }
      return raus;
    };
    const funde = new Map();
    for (const schema of ['light', 'dark']) {
      const sctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', colorScheme: schema });
      const spage = await sctx.newPage();
      await spage.goto(URL_BASE, { waitUntil: 'networkidle' });
      const wege = [
        async () => {},
        async () => spage.locator('.nav-btn[data-view="topics"]').click(),
        async () => spage.locator('.nav-btn[data-view="duel"]').click(),
        async () => spage.locator('.nav-btn[data-view="stats"]').click(),
        async () => spage.locator('.nav-btn[data-view="settings"]').click(),
        async () => spage.locator('#searchBtn').click(),
        async () => { await spage.locator('.nav-btn[data-view="home"]').click(); await spage.waitForTimeout(200);
          await spage.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click(); },
        async () => { if (await spage.locator('.opt').count()) await spage.locator('.opt').first().click();
          else await spage.locator('.sess-foot button').first().click(); },
      ];
      for (const gehe of wege) {
        await gehe(); await spage.waitForTimeout(280);
        for (const t of await spage.evaluate(SATZ)) funde.set(schema + t.art + t.kl + t.txt, t);
      }
      await sctx.close();
    }
    check('nichts abgeschnitten, keine Bruchstuecke am Zeilenende', funde.size === 0,
      [...funde.values()].slice(0, 4).map(t => `${t.art} .${t.kl} (${t.n}px)`).join(' | '));
  }

  group('Nochmal-Karten zählen mit');
  /* „Nochmal" schiebt die Karte in derselben Einheit erneut ein. Waechst der
     Vorrat dabei nicht mit, zeigt der Balken einen Fortschritt, den es nicht
     gibt - und die Einheit ist laenger als angekuendigt. */
  {
    const nctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const np = await nctx.newPage();
    await np.goto(URL_BASE, { waitUntil: 'networkidle' });
    await np.evaluate((k) => {                       // freies Abrufen erzwingen
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.settings = { ...(st.settings || {}), recallMode: 'recall' };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await np.reload({ waitUntil: 'networkidle' });
    await np.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await np.waitForSelector('.sess-body');
    const stand = async () => (await np.locator('.sess-top .tiny').innerText()).split('/').map(Number);
    const [, vorrat] = await stand();
    const frage = await np.locator('.q').innerText();
    await np.locator('.sess-foot button').first().click();     // Lösung zeigen
    await np.waitForTimeout(500);
    await np.getByRole('button', { name: 'Nochmal' }).click();
    await np.waitForTimeout(400);
    const [erledigt, nachher] = await stand();
    check('Vorrat wächst um die eingeschobene Karte', nachher === vorrat + 1, `${vorrat} → ${nachher}`);
    check('erledigt zählt die Antwort', erledigt === 1, String(erledigt));
    // Die Karte kommt in derselben Einheit wieder - sonst waere „Nochmal" ein leeres Versprechen.
    let wieder = false;
    for (let i = 0; i < 6 && !wieder; i++) {
      if ((await np.locator('.q').innerText()) === frage && i > 0) { wieder = true; break; }
      await np.locator('.sess-foot button').first().click();
      await np.waitForTimeout(350);
      await np.getByRole('button', { name: 'Gut' }).click();
      await np.waitForTimeout(350);
      if (!(await np.locator('.q').count())) break;
      if ((await np.locator('.q').innerText()) === frage) wieder = true;
    }
    check('dieselbe Karte kommt in der Einheit wieder', wieder);
    await nctx.close();
  }

  group('Erster Start auf langsamer Leitung');
  /* Der Startbildschirm muss erklaeren, warum es dauert - sonst wirkt die App
     beim ersten Aufruf im Zug wie abgestuerzt. */
  {
    const lctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'block' });
    const lp = await lctx.newPage();
    const cdp = await lctx.newCDPSession(lp);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 300,
      downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8
    });
    await lp.goto(URL_BASE, { waitUntil: 'commit' });
    // Das Grundgeruest selbst braucht auf dieser Leitung schon rund zwei
    // Sekunden; der Zaehler laeuft erst danach los.
    await lp.waitForSelector('#bootHinweis', { state: 'attached', timeout: 30000 });
    await lp.waitForTimeout(2200);
    const hinweis = await lp.locator('#bootHinweis').isVisible().catch(() => false);
    check('Startbildschirm erklärt die Wartezeit', hinweis);
    await lp.waitForSelector('#app:not([hidden])', { timeout: 60000 });
    check('App erscheint auch auf langsamer Leitung', true);
    check('der Hinweis verschwindet mit dem Startbildschirm',
      await lp.locator('#bootHinweis').count() === 0);
    await lctx.close();
  }

  group('Erinnerung ans Sichern');
  /* Der Fortschritt liegt nur im Browserspeicher. Die Erinnerung darf weder zu
     früh nerven noch stehenbleiben, nachdem gesichert wurde. */
  {
    const sctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', acceptDownloads: true });
    const sp = await sctx.newPage();
    await sp.goto(URL_BASE, { waitUntil: 'networkidle' });
    const setze = (patch) => sp.evaluate(([k, p]) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      Object.assign(st, p);
      localStorage.setItem(k, JSON.stringify(st));
    }, [KEY, patch]);

    await setze({ totalAnswers: 40, totalCorrect: 30, lastExport: 0 });
    await sp.reload({ waitUntil: 'networkidle' });
    check('bei wenig Fortschritt keine Erinnerung', await sp.locator('#sichernJetzt').count() === 0);

    await setze({ totalAnswers: 400, totalCorrect: 300, lastExport: 0 });
    await sp.reload({ waitUntil: 'networkidle' });
    check('ohne je gesichert zu haben erscheint die Erinnerung',
      await sp.locator('#sichernJetzt').count() === 1);

    const heute = await sp.evaluate(() => Math.floor(Date.UTC(
      new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000));
    await setze({ lastExport: heute - 5 });
    await sp.reload({ waitUntil: 'networkidle' });
    check('kurz nach einer Sicherung ist Ruhe', await sp.locator('#sichernJetzt').count() === 0);

    await setze({ lastExport: heute - 45 });
    await sp.reload({ waitUntil: 'networkidle' });
    check('nach 45 Tagen erinnert die App wieder',
      await sp.locator('#sichernJetzt').count() === 1);
    check('die Erinnerung nennt die Zahl der Tage',
      /45 Tage/.test(await sp.locator('.hinweis').last().innerText()));

    const [download] = await Promise.all([
      sp.waitForEvent('download', { timeout: 10000 }),
      sp.locator('#sichernJetzt').click(),
    ]);
    check('das Sichern liefert eine Datei', /^wissenswerk-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()),
      download.suggestedFilename());
    await sp.waitForTimeout(500);
    check('nach dem Sichern verschwindet die Erinnerung', await sp.locator('#sichernJetzt').count() === 0);

    /* iOS-Pfad: Als installierte App gibt es keinen Download-Ordner, das Sichern
       laeuft ueber das Teilen-Blatt. Ein Abbruch dort darf NICHT als gesichert
       vermerkt werden - sonst glaubt der Nutzer, er habe eine Datei. */
    await setze({ lastExport: heute - 45 });
    await sp.addInitScript(() => {
      navigator.canShare = () => true;
      window.__geteilt = 0;
      navigator.share = () => { window.__geteilt++; return window.__teilenKlappt
        ? Promise.resolve()
        : Promise.reject(Object.assign(new Error('abgebrochen'), { name: 'AbortError' })); };
    });
    await sp.reload({ waitUntil: 'networkidle' });
    await sp.evaluate(() => { window.__teilenKlappt = false; });
    await sp.locator('#sichernJetzt').click();
    await sp.waitForTimeout(400);
    check('das Teilen-Blatt wird benutzt, wenn es eines gibt',
      await sp.evaluate(() => window.__geteilt) === 1);
    check('Abbruch im Teilen-Blatt zählt nicht als Sicherung',
      await sp.locator('#sichernJetzt').count() === 1);
    await sp.evaluate(() => { window.__teilenKlappt = true; });
    await sp.locator('#sichernJetzt').click();
    await sp.waitForTimeout(400);
    check('erfolgreiches Teilen zählt als Sicherung',
      await sp.locator('#sichernJetzt').count() === 0);
    await sctx.close();
  }

  group('Kleines Display');
  /* Ein iPhone SE ist 320 x 568 CSS-Pixel gross - die Lernkarte ist dort
     hoeher als das Fenster. Frueher scrollte in diesem Fall die Seite statt
     des Kastens, und Antwort wie Bewertungsknoepfe standen unter dem Rand. */
  {
    const kctx = await browser.newContext({
      viewport: { width: 320, height: 568 }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true, locale: 'de-DE',
      userAgent: devices['iPhone 13'].userAgent
    });
    const kp = await kctx.newPage();
    await kp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await kp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await kp.waitForSelector('.sess-body');
    if (await kp.locator('.opt').count()) await kp.locator('.opt').first().click();
    else await kp.locator('.sess-foot button').first().click();
    await kp.waitForTimeout(700);
    const sicht = await kp.evaluate(() => {
      const h = innerHeight;
      const box = (sel) => { const e = document.querySelector(sel); if (!e) return null;
        const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      return { antwort: box('.sess-body .val'), fuss: box('.sess-foot button'), seite: scrollY, h };
    });
    check('Antwort steht im sichtbaren Bereich',
      sicht.antwort && sicht.antwort.top >= 0 && sicht.antwort.top < sicht.h,
      JSON.stringify(sicht.antwort));
    check('Bewertung bleibt erreichbar',
      sicht.fuss && sicht.fuss.bottom <= sicht.h + 1, JSON.stringify(sicht.fuss));
    await kctx.close();
  }

  group('Layout');
  check('kein waagerechter Überlauf',
    (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  check('keine Fehler in der Konsole', errs.length === 0, errs.join(' | '));
} catch (e) {
  failed++;
  console.error('\nAbbruch:', e.message);
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);

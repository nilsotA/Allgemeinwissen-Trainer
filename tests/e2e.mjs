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
  check('Tagesplan wird angekündigt', /Karten stehen an|alles erledigt/.test(await page.locator('.hero .muted').first().innerText()));

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
  await page.locator('.lk-head').first().click();
  await page.waitForTimeout(150);
  check('Antwort klappt auf', await page.locator('.lk .val').first().isVisible());
  await page.locator('.star').first().click();
  await settle();
  check('Markierung wird gespeichert', Object.keys((await stored()).flags || {}).length === 1);

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
  await page.click('[data-view="settings"]');
  await page.waitForSelector('#npd');
  await page.selectOption('#npd', '20');
  await settle();
  check('Einstellung wird sofort gespeichert', (await stored()).settings.newPerDay === 20);

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

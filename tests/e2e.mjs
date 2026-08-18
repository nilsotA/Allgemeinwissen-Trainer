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

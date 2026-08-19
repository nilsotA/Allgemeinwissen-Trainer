/* Prüft den Service Worker: vollständiger Offline-Bestand, Update ohne
   Versionsmischung, und dass ein unvollständiges Update den alten Bestand
   nicht wegwirft.  Aufruf: npm run test:offline */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8124;

let playwright;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { playwright = await import(p); break; } catch { /* nächsten Pfad probieren */ }
}
if (!playwright) {
  console.error('Playwright nicht gefunden – Offline-Test übersprungen.');
  process.exit(0);
}
const { chromium, devices } = playwright;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

/* Der Server kann einzelne Pfade absichtlich scheitern lassen und sw.js
   umschreiben – so lässt sich eine Veröffentlichung nachstellen. */
let kaputt = new Set();
let swErsatz = null;
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  if (kaputt.has(p)) { res.writeHead(503).end('kaputt'); return; }
  if (p === '/sw.js' && swErsatz) {
    res.writeHead(200, { 'Content-Type': TYPES['.js'] }).end(swErsatz);
    return;
  }
  try {
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    await stat(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('nicht gefunden'); }
});
await new Promise(r => server.listen(PORT, r));
const BASIS = `http://localhost:${PORT}`;

let failed = 0, passed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.error(`  FAIL ${name}${extra ? ' – ' + extra : ''}`); }
};
const group = (t) => console.log(`\n${t}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'allow' });
const page = await ctx.newPage();

const bereit = () => page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
  return !!reg.active && !!navigator.serviceWorker.controller;
});
const bestand = () => page.evaluate(async () => {
  const namen = await caches.keys();
  const out = {};
  for (const n of namen) out[n] = (await (await caches.open(n)).keys()).length;
  return out;
});

try {
  group('Erster Start');
  await page.goto(BASIS + '/', { waitUntil: 'load' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  // Beim allerersten Aufruf steuert noch kein Worker; nach dem Neuladen schon.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });
  check('Service Worker steuert die Seite', await bereit());

  const b1 = await bestand();
  const namen1 = Object.keys(b1);
  check('genau ein Bestand angelegt', namen1.length === 1, JSON.stringify(b1));
  const swQuelle = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const anzahl = JSON.parse(swQuelle.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]).length;
  check(`alle ${anzahl} Dateien im Bestand`, b1[namen1[0]] >= anzahl, JSON.stringify(b1));

  group('Ohne Netz');
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  const nav = await page.locator('.nav-btn').count();
  check('App startet ohne Netz', nav === 5, `${nav} Navigationsknöpfe`);
  await ctx.setOffline(false);

  group('Unvollständiges Update');
  // Neue Fassung, bei der eine Datei nicht ausgeliefert wird: der alte
  // Bestand muss stehenbleiben, sonst steht die App ohne Netz halb da.
  swErsatz = swQuelle.replace(/wissenswerk-[0-9a-f]+/, 'wissenswerk-testfassung');
  kaputt = new Set(['/assets/js/quiz.js']);
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForFunction(async () => (await caches.keys()).some(k => k.endsWith('testfassung')), null, { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.getRegistration()
    .then(r => (r.waiting || r.installing)?.postMessage('jetzt-uebernehmen')));
  await page.waitForFunction(() => navigator.serviceWorker.controller
    && navigator.serviceWorker.controller.scriptURL.length > 0, null, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200));
  const b2 = await bestand();
  check('alter Bestand bleibt als Rückfall erhalten', Object.keys(b2).length === 2, JSON.stringify(b2));

  // Der eigentliche Zweck: die fehlende Datei kommt aus dem alten Bestand,
  // die App laeuft also auch nach einem halben Update ohne Netz.
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 }).catch(() => {});
  const navHalb = await page.locator('.nav-btn').count();
  check('App läuft trotz halbem Update ohne Netz', navHalb === 5, `${navHalb} Navigationsknöpfe`);
  await ctx.setOffline(false);

  kaputt = new Set();
  group('Vollständiges Update');
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await new Promise(r => setTimeout(r, 1500));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(async () => (await caches.keys()).length === 1, null, { timeout: 20000 })
    .then(() => check('nach vollständigem Update bleibt ein Bestand', true))
    .catch(async () => check('nach vollständigem Update bleibt ein Bestand', false, JSON.stringify(await bestand())));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);

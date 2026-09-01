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
/* Eine echte Veroeffentlichung tauscht IMMER beides: den Service Worker und den
   Fassungsstempel in assets/js/fassung.js, denn beide entstehen aus demselben
   Build. Die frueheren Tests tauschten nur sw.js - damit war die Nachstellung
   kein Deployment mehr, sondern nur ein neuer Cache-Schluessel. */
let swErsatz = null;
let fassungErsatz = null;
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  if (kaputt.has(p)) { res.writeHead(503).end('kaputt'); return; }
  if (p === '/sw.js' && swErsatz) {
    res.writeHead(200, { 'Content-Type': TYPES['.js'] }).end(swErsatz);
    return;
  }
  if (p === '/assets/js/fassung.js' && fassungErsatz) {
    res.writeHead(200, { 'Content-Type': TYPES['.js'] }).end(fassungErsatz);
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
/* Alle Eintraege, die als Geruest durchgehen koennten - zum Nachsehen, ob die
   Luecke wirklich geschlossen wurde. */
const geruestPfade = () => page.evaluate(async () => {
  const out = [];
  for (const n of await caches.keys()) {
    for (const r of await (await caches.open(n)).keys()) {
      const p = new URL(r.url).pathname;
      if (p === '/' || p.endsWith('index.html')) out.push(n + ' ' + p);
    }
  }
  return out;
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
  const fassungQuelle = await readFile(join(ROOT, 'assets/js/fassung.js'), 'utf8');
  /* Stellt eine Veroeffentlichung nach: Service Worker UND Fassungsstempel
     bekommen dieselbe neue Kennung, so wie der Build es tut. Nur sw.js zu
     tauschen ergaebe einen neuen Cache-Schluessel bei unveraenderter App - die
     Meldung „Aktualisiert" bliebe dann zu Recht aus, und der Test haette daraus
     den falschen Schluss gezogen. */
  const stelleFassung = (marke) => {
    const ersetzen = (t) => t.replace(/wissenswerk-[0-9a-f]+/, 'wissenswerk-' + marke);
    swErsatz = marke ? ersetzen(swQuelle) : null;
    fassungErsatz = marke ? ersetzen(fassungQuelle) : null;
  };
  const anzahl = JSON.parse(swQuelle.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]).length;
  check(`alle ${anzahl} Dateien im Bestand`, b1[namen1[0]] >= anzahl, JSON.stringify(b1));

  group('Ohne Netz');
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  const nav = await page.locator('.nav-btn').count();
  check('App startet ohne Netz', nav === 5, `${nav} Navigationsknöpfe`);
  await ctx.setOffline(false);

  group('Lücke beim Gerüst');
  /* Ein Bestand kann unvollstaendig sein: Der Browser raeumt bei Platzmangel
     einzelne Eintraege weg, oder eine Veroeffentlichung blieb auf halbem Weg
     stehen. Fehlt ausgerechnet das Geruest, muss der naechste Aufruf mit Netz
     die Luecke schliessen - sonst startet die App nie wieder ohne Netz. */
  await page.evaluate(async () => {
    for (const n of await caches.keys()) {
      const c = await caches.open(n);
      for (const r of await c.keys()) {
        const pfad = new URL(r.url).pathname;
        if (pfad === '/index.html' || pfad === '/') await c.delete(r);
      }
    }
  });
  await page.reload({ waitUntil: 'load' });                 // mit Netz: die Luecke soll heilen
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 600));
  check('das Gerüst liegt danach wieder unter seinem eigenen Namen im Bestand',
    (await geruestPfade()).some(p => p.endsWith('/index.html')),
    JSON.stringify(await geruestPfade()));

  /* Und der Nachweis, dass es auch etwas nuetzt. Das Netz wird hier am Server
     abgeklemmt, nicht ueber setOffline: Abrufe, die der Service Worker selbst
     absetzt, gehen an der Offline-Nachstellung des Browsers vorbei - die Luecke
     bliebe damit unsichtbar. */
  kaputt = new Set(['/index.html']);
  const status = await page.evaluate(async () => {
    try { return (await fetch('./index.html')).status; } catch (e) { return 'Ausnahme'; }
  });
  check('das Gerüst kommt ohne Netz aus dem Bestand', status === 200, `Status ${status}`);
  kaputt = new Set();

  group('Unvollständiges Update');
  // Neue Fassung, bei der eine Datei nicht ausgeliefert wird: der alte
  // Bestand muss stehenbleiben, sonst steht die App ohne Netz halb da.
  stelleFassung('testfassung');
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

  group('Update-Angebot waehrend einer Runde');
  /* Der Balken „Neue Fassung bereit" bleibt stehen, bis der Nutzer entscheidet –
     und liegt dabei ueber den Antwortknoepfen. Mitten in einer Runde kann er
     ohnehin nichts bewirken, weil das Neuladen bis zum Ende verweigert wird.
     Also wird er zurueckgehalten und danach nachgeholt. */
  {
    kaputt = new Set();
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    await page.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await page.waitForSelector('.sess-body', { timeout: 10000 });
    stelleFassung('rundenfassung');
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.waitForFunction(async () => (await caches.keys()).some(k => k.endsWith('rundenfassung')),
      null, { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    check('waehrend der Runde erscheint kein Balken',
      await page.locator('.toast.aktion').count() === 0);

    // Runde zu Ende bringen: Karten beantworten, bis die Zusammenfassung steht
    for (let i = 0; i < 60 && await page.locator('.sess-body').count(); i++) {
      const o = page.locator('.opt:not([disabled])').first();
      if (await o.count()) { await o.click(); await new Promise(r => setTimeout(r, 420)); }
      const w = page.locator('.sess-foot button:not([disabled])').first();
      if (await w.count()) { await w.click(); await new Promise(r => setTimeout(r, 420)); }
      else break;
    }
    await new Promise(r => setTimeout(r, 800));
    check('nach der Runde wird der Balken nachgeholt',
      await page.locator('.toast.aktion').count() === 1,
      `sess-body noch da: ${await page.locator('.sess-body').count()}`);
  }

  /* Zwei Wege, auf denen das Angebot bisher stillschweigend verpuffte. Beide
     bekommen einen eigenen Browserkontext: Ein aus dem vorigen Abschnitt
     stehengebliebener Balken oder Worker wuerde das Ergebnis sonst faerben. */
  group('Update-Angebot: Abbruch und zweite Veroeffentlichung');

  /* Eigener Kontext, frisch eingerichtet, Worker steuert die Seite. */
  const frischerTab = async () => {
    const c = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'allow' });
    const pg = await c.newPage();
    await pg.goto(BASIS + '/', { waitUntil: 'load' });
    await pg.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    return [c, pg];
  };
  const veroeffentliche = async (pg, marke) => {
    stelleFassung(marke);
    await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await pg.waitForFunction(async (m) => (await caches.keys()).some(k => k.endsWith(m)),
      marke, { timeout: 25000 });
  };
  /* Nach dem Tippen laedt die Seite neu - eine waitForFunction stuerbe dabei am
     zerstoerten Ausfuehrungskontext. Deshalb von aussen nachfragen. */
  const wartetAufBestand = async (pg, marke) => {
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500));
      const da = await pg.evaluate(async (m) => {
        const k = await caches.keys();
        return k.length === 1 && k[0].endsWith(m);
      }, marke).catch(() => false);
      if (da) return true;
    }
    return false;
  };

  {
    // 1. Eine Runde ohne einzige Antwort abbrechen: Der Balken wurde
    //    zurueckgehalten, aber nur endRun() holte ihn nach - der Abbruch geht
    //    ueber show(). Das Angebot blieb bis zum naechsten Start liegen.
    kaputt = new Set(); stelleFassung(null);
    const [actx, ap] = await frischerTab();
    await ap.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await ap.waitForSelector('.sess-body', { timeout: 10000 });
    await veroeffentliche(ap, 'abbruchfassung');
    await new Promise(r => setTimeout(r, 900));
    check('waehrend der abgebrochenen Runde erscheint kein Balken',
      await ap.locator('.toast.aktion').count() === 0);
    await ap.click('#quit');                       // ohne eine einzige Antwort
    await new Promise(r => setTimeout(r, 900));
    check('nach dem Abbruch wird der Balken nachgeholt',
      await ap.locator('.toast.aktion').count() === 1);
    await actx.close();
  }

  {
    // 2. Waehrend der Balken steht, erscheint eine ZWEITE neue Fassung. Der
    //    Balken hielt eine feste Worker-Referenz auf die erste, die inzwischen
    //    ueberholt (redundant) ist - „Laden" schickte seine Nachricht ins Leere.
    kaputt = new Set(); stelleFassung(null);
    const [zctx, zp] = await frischerTab();
    await veroeffentliche(zp, 'erstfassung');
    await zp.waitForSelector('.toast.aktion', { timeout: 20000 });
    await veroeffentliche(zp, 'zweitfassung');
    await new Promise(r => setTimeout(r, 900));
    check('der Balken steht noch, wenn die zweite Fassung eintrifft',
      await zp.locator('.toast.aktion').count() === 1);
    await zp.locator('.toast.aktion button').click();
    check('„Laden" erreicht auch die zweite neue Fassung',
      await wartetAufBestand(zp, 'zweitfassung'));
    await zctx.close();
  }

  {
    /* 3. Der Sonderfall erster Besuch: Beim Start steuert noch kein Worker, er
       uebernimmt erst waehrend die Seite offen ist. Dieser normale Vorgang darf
       kein Neuladen ausloesen - eine spaetere, echte neue Fassung aber schon.
       Frueher stand „hatte beim Start keinen Worker" als Konstante fest: In der
       ersten Sitzung bewirkte „Laden" nichts, waehrend der neue Worker den
       alten Bestand schon geloescht hatte. */
    kaputt = new Set(); stelleFassung(null);
    const ectx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'allow' });
    const ep = await ectx.newPage();
    await ep.goto(BASIS + '/', { waitUntil: 'load' });      // KEIN Neuladen: wie beim ersten Besuch
    await ep.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    /* Die Marke MUSS vor der Uebernahme gesetzt werden - sie soll ja beweisen,
       dass die Uebernahme sie nicht wegraeumt. Vorher stand sie danach: Der Test
       las eine Zeile spaeter zurueck, was er eine Zeile vorher selbst gesetzt
       hatte, und konnte gar nicht fehlschlagen. */
    await ep.evaluate(() => { window.__marke = 'erste Sitzung'; });
    await ep.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
    await new Promise(r => setTimeout(r, 1200));
    check('die erste Uebernahme laedt die Seite nicht neu',
      await ep.evaluate(() => window.__marke).catch(() => null) === 'erste Sitzung');

    await veroeffentliche(ep, 'erstsitzungfassung');
    await ep.waitForSelector('.toast.aktion', { timeout: 20000 });
    await ep.locator('.toast.aktion button').click();
    let neugeladen = false;
    for (let i = 0; i < 30 && !neugeladen; i++) {
      await new Promise(r => setTimeout(r, 500));
      neugeladen = await ep.evaluate(() => window.__marke === undefined).catch(() => false);
    }
    check('in der ersten Sitzung laedt „Laden" die Seite trotzdem neu', neugeladen);
    await ectx.close();
  }

  {
    /* 4. Der Wechsel muss nicht aus diesem Tab kommen: Tippt jemand im zweiten
       Tab auf „Laden", uebernimmt der neue Worker fuer alle. Dieser Tab lud
       daraufhin mitten in der Runde neu und schluckte die offene Frage - ohne
       Vorwarnung, denn hier hatte niemand etwas getippt. Nachgestellt wird der
       zweite Tab, indem die Nachricht am Balken vorbei geschickt wird. */
    kaputt = new Set(); stelleFassung(null);
    const [rctx, rp] = await frischerTab();
    await rp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await rp.waitForSelector('.sess-body', { timeout: 10000 });
    await rp.evaluate(() => { window.__marke = 'laufende Runde'; });
    await veroeffentliche(rp, 'fremdfassung');
    // Warten und Zustellen in einem Zug: Zwischen zwei evaluate-Aufrufen kann
    // sich der wartende Worker aendern, und die Nachricht ginge ins Leere.
    const zugestellt = await rp.evaluate(async () => {
      for (let i = 0; i < 60; i++) {
        const r = await navigator.serviceWorker.getRegistration();
        if (r && r.waiting) { r.waiting.postMessage('jetzt-uebernehmen'); return true; }
        await new Promise(res => setTimeout(res, 250));
      }
      return false;
    });
    check('der zweite Tab erreicht den wartenden Worker', zugestellt);
    await new Promise(r => setTimeout(r, 2500));
    check('waehrend der Runde wird nicht neu geladen',
      await rp.evaluate(() => window.__marke).catch(() => null) === 'laufende Runde'
      && await rp.locator('.sess-body').count() === 1);

    await rp.click('#quit');                                // Ansicht gewechselt
    let neugeladen = false;
    for (let i = 0; i < 30 && !neugeladen; i++) {
      await new Promise(r => setTimeout(r, 400));
      neugeladen = await rp.evaluate(() => window.__marke === undefined).catch(() => false);
    }
    check('nach der Runde wird der Wechsel nachgeholt', neugeladen);
    await rctx.close();
  }

  group('Die App sagt, welche Fassung laeuft');
  {
    /* Nach einem Update meldete sich bisher niemand: „Laden" tippen, die Seite
       laedt neu - und nichts sagte dem Nutzer, ob es geklappt hat. Und nirgends
       stand nachzulesen, welche Fassung ueberhaupt laeuft. */
    kaputt = new Set(); stelleFassung(null);
    const [fctx, fp] = await frischerTab();

    await fp.click('[data-view="settings"]');
    await fp.waitForSelector('#updSuch', { timeout: 10000 });
    const zeile = await fp.locator('#updSuch').locator('xpath=../..').innerText();
    check('die Einstellungen nennen die laufende Fassung',
      /[0-9a-f]{7}/.test(zeile) && /seit/.test(zeile), zeile.replace(/\n/g, ' | '));
    check('kein Ladeknopf, solange nichts bereitsteht',
      await fp.locator('#updNun').count() === 0);

    await veroeffentliche(fp, 'fassungsanzeige');
    await fp.waitForSelector('#updNun', { timeout: 20000 }).catch(() => {});
    // Die Einstellungen werden nicht von selbst neu gezeichnet – einmal hin und zurück.
    await fp.click('[data-view="home"]');
    await fp.click('[data-view="settings"]');
    await fp.waitForSelector('#updSuch', { timeout: 10000 });
    check('bei einer neuen Fassung erscheint der Ladeknopf',
      await fp.locator('#updNun').count() === 1);

    await fp.locator('#updNun').click();
    // Nach dem Neuladen muss die App sagen, dass sie jetzt neu ist.
    let gemeldet = '';
    for (let i = 0; i < 40 && !gemeldet; i++) {
      await new Promise(r => setTimeout(r, 400));
      gemeldet = await fp.locator('.toast:not(.aktion)').innerText().catch(() => '');
    }
    check('nach dem Update meldet die App den Erfolg', /Aktualisiert/.test(gemeldet),
      gemeldet || '(keine Meldung)');

    // Und die Fassung in den Einstellungen ist danach eine andere.
    await fp.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    await fp.click('[data-view="settings"]');
    await fp.waitForSelector('#updSuch', { timeout: 10000 });
    const danach = await fp.locator('#updSuch').locator('xpath=../..').innerText();
    check('die angezeigte Fassung hat sich geändert', danach !== zeile,
      `${zeile.replace(/\n/g, ' ')} -> ${danach.replace(/\n/g, ' ')}`);
    await fctx.close();
  }

  group('Was unter dem Geruest-Schluessel landen darf');
  {
    /* Der Handler liest das Geruest unter './index.html'. Schrieb er dorthin die
       Antwort auf die ANGEFRAGTE Adresse, genuegte bei einer Luecke im Bestand
       ein einziger Aufruf von /sw.js als Seite - eine Navigation wie jede andere,
       Antwort gueltig -, um Quelltext dauerhaft als Grundgeruest abzulegen. Die
       App lieferte danach nur noch JavaScript und heilte nie wieder, weil der
       Eintrag ja vorhanden war. Die README fordert genau diesen Aufruf. */
    kaputt = new Set(); stelleFassung(null);
    const [gctx, gp] = await frischerTab();
    await gp.evaluate(async () => {                       // Luecke reissen
      for (const n of await caches.keys()) {
        const c = await caches.open(n);
        for (const r of await c.keys()) {
          const pfad = new URL(r.url).pathname;
          if (pfad === '/index.html' || pfad === '/') await c.delete(r);
        }
      }
    });
    /* Nicht /sw.js aufrufen: Anfragen an das Worker-Skript selbst faengt der
       Worker nach Spezifikation NICHT ab - dieser Aufruf ginge am Handler
       vorbei und bewiese nichts. Eine gewoehnliche Datei tut es. */
    await gp.goto(BASIS + '/manifest.webmanifest', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 800));
    /* JEDEN Bestand pruefen, nicht den erstbesten: Der Rueckfall im Handler sucht
       ueber alle Bestaende, ein vergifteter Eintrag in irgendeinem von ihnen kann
       also ausgeliefert werden. Und den ganzen Text ansehen - id="app" steht
       weit unten in index.html. */
    const schlecht = await gp.evaluate(async () => {
      const raus = [];
      for (const n of await caches.keys()) {
        const t = await (await caches.open(n)).match('./index.html');
        if (!t) continue;
        const txt = await t.text();
        if (!txt.includes('id="app"')) raus.push(n + ': ' + txt.slice(0, 70).replace(/\s+/g, ' '));
      }
      return raus;
    });
    check('in keinem Bestand steht Fremdes unter dem Gerüst-Schlüssel',
      schlecht.length === 0, schlecht.join(' | '));

    await gp.goto(BASIS + '/', { waitUntil: 'load' });
    await gp.waitForSelector('#app:not([hidden])', { timeout: 15000 }).catch(() => {});
    check('die App startet danach unveraendert', await gp.locator('.nav-btn').count() === 5);
    await gctx.close();
  }

  group('Der Nachlauf des Suchen-Knopfs');
  {
    /* „Suchen" prueft nach und zeichnet 1,5 s spaeter die Einstellungen neu.
       Startet der Nutzer in dieser Zeit eine Runde, zeichnete der Nachlauf die
       Einstellungen darueber: Runde und Rueckblick weg, und weil startRun()
       Leiste und Kopfzeile ausblendet, stand er ohne jede Navigation da. */
    kaputt = new Set(); stelleFassung(null);
    const [sctx, sp] = await frischerTab();
    await veroeffentliche(sp, 'suchfassung');            // damit „Suchen" faendig wird
    await sp.click('[data-view="settings"]');
    await sp.waitForSelector('#updSuch', { timeout: 10000 });
    await sp.click('#updSuch');
    await sp.click('[data-view="home"]');                 // sofort weiter, nicht warten
    await sp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await sp.waitForSelector('.sess-body', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2500));          // der Nachlauf feuert
    check('die laufende Runde steht noch', await sp.locator('.sess-body').count() === 1,
      `#npd da: ${await sp.locator('#npd').count()}`);
    check('der Beenden-Knopf ist erreichbar', await sp.locator('#quit').count() === 1);
    await sctx.close();
  }

  kaputt = new Set();
  stelleFassung(null);
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

/* Durchlauftest im iPhone-Viewport.  Aufruf: npm run test:e2e
   Startet selbst einen lokalen Server und beendet ihn wieder. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { CARDS, CAT_BY_ID } from '../data/index.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8123;
const KEY = 'wissenswerk.v1';
/* Frisch erschienene Knoepfe im Fuss sind 350 ms taub: Sonst beantwortet ein
   zweiter schneller Tipp die naechste, ungelesene Karte. Tests muessen sich
   daran halten wie ein Mensch. */
const FUSS_TAUB = 400;

/* Der Wachposten hat frueher mit process.exit(0) geendet – also mit „bestanden".
   In package.json haengen die drei Laeufe mit && aneinander; fehlte Playwright,
   meldete `npm run test:all` gruen, ohne dass eine einzige der 188 Pruefungen
   gelaufen waere. Der Unterschied zwischen „alles geprueft" und „nichts geprueft"
   war eine Zeile auf stderr, und stderr liest bei gruenem Lauf niemand.
   Ueberspringen ist jetzt eine Entscheidung, die jemand ausdruecklich trifft. */
let playwright, importFehler;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { playwright = await import(p); break; } catch (e) { importFehler = e; }
}
if (!playwright) {
  const erlaubt = process.env.OHNE_BROWSER === '1';
  console.log(`Playwright nicht gefunden – ${erlaubt ? 'übersprungen (OHNE_BROWSER=1)' : 'KEINE der 199 Prüfungen gelaufen'}.`);
  if (importFehler && importFehler.code !== 'ERR_MODULE_NOT_FOUND') {
    console.log(`  Der Import scheiterte nicht am fehlenden Paket: ${importFehler.message}`);
  }
  if (!erlaubt) console.log('  npm i -D playwright – oder OHNE_BROWSER=1 setzen, wenn das Überspringen gewollt ist.');
  process.exit(erlaubt ? 0 : 1);
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
const errs = [], absichtlicheFehler = [];
/* Die beiden Horcher hingen frueher nur an der ersten Seite. Die Pruefung „keine
   Fehler in der Konsole" am Dateiende sah damit 1 von 30 Seiten – jeder Fehler in
   einem der Nebenkontexte blieb ungesehen. horche() haengt sie ueberall an.
   Gleich beim ersten Lauf hat das zwei Meldungen ans Licht geholt, die beide
   gewollt sind: Ein Abschnitt liefert absichtlich kaputtes JavaScript aus und
   einer eine 404. Solche Seiten sagen das mit dem zweiten Argument an – und
   werden dann daran gemessen, dass sie wirklich brechen. */
const horche = (p, absichtlich = false) => {
  const ziel = absichtlich ? absichtlicheFehler : errs;
  p.on('pageerror', (e) => ziel.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') ziel.push('console: ' + m.text()); });
  return p;
};
let failed = 0, passed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.error(`  FAIL ${name}${extra ? ' – ' + extra : ''}`); }
};
const group = (t) => console.log(`\n${t}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'allow' });
const page = horche(horche(await ctx.newPage()));

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

  /* Die Startseite sagt eine Kartenzahl an – genau die Runde muss auch
     starten. buildDaily() wuerfelt bei jedem Aufruf neu, ein zweiter Aufruf
     beim Tippen ergab eine andere Warteschlange als die angekuendigte. */
  const angesagt = Number((await page.locator('.hero h1').innerText()).match(/\d+/)?.[0] || 0);
  await page.click('[data-go="daily"]');
  await page.waitForSelector('.opt, #reveal');
  await page.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
  const gestartet = Number((await page.locator('.sess-top .tiny').innerText()).split('/')[1]);
  check('gestartete Runde entspricht der Ansage', gestartet === angesagt,
    `${gestartet} Karten statt angesagter ${angesagt}`);
  const q1 = await page.locator('.q').innerText();
  check('Frage wird angezeigt', q1.length > 5);
  check('vier Antwortmöglichkeiten', await page.locator('.opt').count() === 4);
  /* Ohne gesetzten Fokus faellt er nach jedem innerHTML auf body – mit
     VoiceOver beginnt der Lesecursor dann bei jeder Karte wieder ganz oben. */
  check('Fokus steht auf der Frage',
    await page.evaluate(() => document.activeElement?.classList.contains('q')));

  group('Antwort, Rückmeldung, Fortschritt');
  await page.locator('.opt').first().click();
  await page.waitForSelector('#next');
  check('Lösung wird eingeblendet', await page.locator('.answer .val').count() > 0);
  check('Fokus wandert auf die Lösung',
    await page.evaluate(() => document.activeElement?.classList.contains('answer')));
  check('richtige Option ist markiert', await page.locator('.opt.right').count() === 1);
  /* Die Rueckmeldung darf nicht nur an der Farbe haengen: Haken bzw. Kreuz
     ersetzen den Buchstaben, damit auch Rot-Gruen-Blinde sie erkennen. */
  check('richtige Option traegt einen Haken',
    await page.locator('.opt.right .k use[href="#i-haken"]').count() === 1);
  const falschMark = await page.locator('.opt.wrong').count()
    ? await page.locator('.opt.wrong .k use[href="#i-schliessen"]').count() === 1
    : true;
  check('falsch gewaehlte Option traegt ein Kreuz', falschMark);
  /* every() ueber eine leere Liste ist wahr. Findet der Waehler .opt.dim
     nichts mehr – umbenannte Klasse, geaenderte Rueckmeldung –, bestand die
     Pruefung, ohne einen einzigen Buchstaben angesehen zu haben. */
  const uebrig = await page.locator('.opt.dim .k').allInnerTexts();
  check('uebrige Optionen behalten ihren Buchstaben',
    uebrig.length >= 2 && uebrig.every(t => /^[ABCD]$/.test(t.trim())),
    `${uebrig.length} gedimmte Optionen: ${uebrig.join(', ')}`);
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

  /* Der Fehler zeigte sich erst ab der ZWEITEN Antwort des Tages: snapshot()
     kopierte das Tagesbuch flach, und das traegt seit der Tab-Trennung eine
     verschachtelte Beitragsliste. Die Kopie teilte sie mit dem Original – das
     Zuruecknehmen setzte die sichtbaren Zaehler zurueck, der Beitrag dieses Tabs
     blieb stehen, und beim naechsten Zaehlen rechnete die App die Tageszahl aus
     der Liste neu. Der zurueckgenommene Treffer war wieder da, samt verbrauchtem
     Budget fuer neue Karten. */
  for (let i = 0; i < 3; i++) {
    if (!(await page.locator('.opt:not([disabled])').count())) break;
    await page.locator('.opt:not([disabled])').first().click();
    await page.waitForSelector('#next');
    await page.click('#next');
    await page.waitForTimeout(FUSS_TAUB);
  }
  const vorUndo = await stored();
  await page.click('#undo');
  await settle();
  const nachUndo = await stored();
  check('Zurücknehmen nimmt die Antwort wirklich aus der Tageszählung',
    nachUndo.totalAnswers === vorUndo.totalAnswers - 1,
    `${vorUndo.totalAnswers} -> ${nachUndo.totalAnswers}`);
  const tagNach = Object.values(nachUndo.days || {})[0] || {};
  const jeSumme = Object.values(tagNach.je || {}).reduce((n, b) => n + (b.done || 0), 0);
  check('und auch aus der Beitragsliste dieses Tabs',
    !tagNach.je || jeSumme === tagNach.done,
    `Tag ${tagNach.done}, Beitraege ${jeSumme}`);
  // Und die naechste Antwort darf den zurueckgenommenen Treffer nicht zurueckholen.
  if (await page.locator('.opt:not([disabled])').count()) {
    await page.locator('.opt:not([disabled])').first().click();
    await page.waitForSelector('#next');
    await page.click('#next');
    await page.waitForTimeout(FUSS_TAUB);
    const danach = await stored();
    check('die naechste Antwort holt ihn nicht zurueck',
      danach.totalAnswers === nachUndo.totalAnswers + 1,
      `${nachUndo.totalAnswers} -> ${danach.totalAnswers}`);
  } else {
    check('die naechste Antwort holt ihn nicht zurueck', true, 'keine Karte mehr in der Einheit');
  }

  group('Tastatursteuerung');
  await page.keyboard.press('2');
  await page.waitForSelector('#next');
  check('Zifferntaste wählt eine Option', await page.locator('.opt[disabled]').count() === 4);
  /* Hier stand check('Enter blättert weiter', true) – eine Konstante. Die
     Tastensteuerung konnte vollstaendig tot sein: waitForSelector fand die
     Auswahl der GERADE beantworteten Karte und lief sofort durch. Jetzt wird
     gefragt, was gemeint war: Hat sich der Bildschirm bewegt? */
  const qVorTaste = await page.locator('.q').innerText();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.opt, #reveal, .done-wrap');
  await page.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
  await settle();
  const weiter = await page.locator('.done-wrap').count() === 1
    || (await page.locator('.q').innerText()) !== qVorTaste;
  check('Enter blättert weiter', weiter, `Frage vorher und nachher: „${qVorTaste.slice(0, 40)}"`);

  group('Einheit beenden und Rückblick');
  for (let i = 0; i < 40 && !(await page.locator('.done-wrap').count()); i++) {
    if (await page.locator('.opt:not([disabled])').count()) {
      await page.locator('.opt:not([disabled])').first().click();
      await page.waitForSelector('#next'); await page.click('#next');
    } else if (await page.locator('#reveal').count()) {
      await page.waitForTimeout(FUSS_TAUB);
      await page.click('#reveal'); await page.waitForSelector('[data-g]'); await page.click('[data-g="2"]');
    } else break;
    await page.waitForTimeout(30);
  }
  if (!(await page.locator('.done-wrap').count())) await page.click('#quit');
  await page.waitForSelector('.done-wrap');
  check('Abschlussbildschirm erscheint', await page.locator('.done-wrap').count() === 1);
  /* Der Rueckblick zeigte Frage, Antwort und Kontext offen nebeneinander -
     blosses Lesen ist nach der eigenen Regel dieser App die schwaechste
     Lernform. Die Loesung steht jetzt hinter einem Griff. */
  const verfehlt = await page.locator('[data-merk^="rb-"]').count();
  if (verfehlt) {
    check('verfehlte Karten decken ihre Loesung nicht von selbst auf',
      !await page.locator('[data-merk^="rb-"]').first()
        .evaluate(b => document.getElementById(b.dataset.merk).checkVisibility?.()
          ?? !document.getElementById(b.dataset.merk).hidden));
    await page.locator('[data-merk^="rb-"]').first().click();
    check('Aufdecken im Rueckblick zeigt die Loesung',
      await page.locator('[id^="rb-"]:not([hidden])').count() >= 1);
  } else {
    /* Hier stand check(..., true) – eine Konstante, die als bestandene Pruefung
       gezaehlt wurde und im Protokoll von einer echten nicht zu unterscheiden
       war. Ob dieser Zweig ueberhaupt laeuft, haengt am Zufall: Die Schleife
       darueber klickt blind. Jetzt stehen hier zwei echte Pruefungen, und zwar
       genau zwei – sonst schwankt die Gesamtzahl zwischen den Durchlaeufen und
       der Boden am Dateiende wuerde mal greifen, mal nicht. */
    check('ohne verfehlte Karten fuehrt der Rueckblick keine Loesungszeile',
      await page.locator('[id^="rb-"]').count() === 0);
    check('der Abschlussbildschirm steht trotzdem',
      await page.locator('.done-wrap').count() === 1);
  }
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
  /* 84 Zellen mit title-Attribut sind fuer Hilfsmittel wertlos - auf iOS wird
     title nie gezeigt. Bild ausblenden, Text danebenstellen. */
  check('Heatmap ist fuer Hilfsmittel ausgeblendet',
    await page.locator('.heat-wrap[aria-hidden="true"]').count() === 1);
  check('Heatmap hat eine Textfassung',
    await page.evaluate(() => [...document.querySelectorAll('.sr-only')]
      .some(n => /Tagen gelernt/.test(n.textContent))));
  check('Fortschrittsbalken sind sichtbar',
    (await page.evaluate(() => {
      const b = [...document.querySelectorAll('.trow .bar')];
      // Ohne die Mindestzahl ist die Behauptung bei null Balken trivial wahr.
      return b.length >= 9 && b.every(x => x.getBoundingClientRect().height > 4);
    })));

  group('Themen und Einstellungen');
  await page.click('[data-view="topics"]');
  await page.waitForSelector('.trow');
  check('neun Themen gelistet', await page.locator('[data-cat]').count() === 9);
  // Ein Thema von innen: erst die Teilgebiete, dann gezielt eines üben.
  await page.locator('[data-cat="spo"]').click();
  await page.waitForSelector('[data-sub]');
  const teile = await page.locator('[data-sub]').count();
  check('Teilgebiete des Themas werden gelistet', teile >= 9, `${teile} Teilgebiete`);
  /* Im Quizduell steht die Kategorie vor der Frage fest – dieselbe Lage muss
     sich unter Zeitdruck proben lassen, nicht nur in Ruhe. */
  check('Thema laesst sich auch im Duell ueben', await page.locator('#themaDuell').count() === 1);
  await page.click('#themaDuell');
  await page.waitForSelector('#clock');
  const duellKat = await page.locator('.qcat').first().innerText();
  check('Themen-Duell bleibt beim gewaehlten Thema',
    duellKat.includes('Sport'), `${duellKat} statt Sport`);
  await page.click('#quit');
  await page.click('[data-view="topics"]');
  await page.waitForSelector('[data-cat]');
  await page.locator('[data-cat="spo"]').click();
  await page.waitForSelector('[data-sub]');
  const gewaehlt = await page.locator('[data-sub]').first().getAttribute('data-sub');
  await page.locator('[data-sub]').first().click();
  await page.waitForSelector('.sess-body');
  await page.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
  const kat = await page.locator('.qcat').first().innerText();
  check('Übungsrunde kommt aus dem gewählten Teilgebiet',
    kat.includes(gewaehlt.split('|')[1]), `${kat} statt ${gewaehlt}`);
  await page.click('#quit');
  await page.waitForSelector('.hero, .tlist');

  /* „Weitermachen" nach einer Themenrunde baute die Anschlussrunde aus dem
     Tagesplan - also aus allen Themen. Wer gezielt Sport uebte, bekam beim
     Weitermachen still etwas anderes, ohne dass irgendwo stand, dass das Thema
     gewechselt hat. Dasselbe galt fuer Teilgebiete, Wackelkandidaten und
     Markierte. */
  {
    const wctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const wp = horche(await wctx.newPage());
    await wp.goto(URL_BASE, { waitUntil: 'networkidle' });
    /* Das Tagespensum hochsetzen, sonst ist der Tagesplan nach zwanzig Karten
       aufgebraucht - „Weitermachen" fiele auf die Wackelkandidaten zurueck, und
       die waeren hier zufaellig auch alle aus Sport. Der Test haette den Fehler
       dann nicht gesehen. */
    await wp.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.settings = { ...(st.settings || {}), newPerDay: 120 };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await wp.reload({ waitUntil: 'networkidle' });
    await wp.click('[data-view="topics"]');
    await wp.waitForSelector('[data-cat="spo"]');
    await wp.locator('[data-cat="spo"]').click();
    await wp.waitForSelector('#ganzesThema');
    await wp.click('#ganzesThema');
    await wp.waitForSelector('.sess-body');
    await wp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    const ANTWORT = new Map(CARDS.map(c => [c.q.trim(), c.a]));
    let ausSport = 0, karten = 0;
    for (let i = 0; i < 40 && await wp.locator('.q').count(); i++) {
      const kopf = await wp.locator('.qcat').first().innerText();
      if (kopf.includes('Sport')) ausSport++;
      karten++;
      const q = (await wp.locator('.q').innerText()).trim();
      const opts = await wp.locator('.opt').evaluateAll(ns => ns.map(n => n.dataset.v));
      if (!opts.length) break;
      const richtig = ANTWORT.get(q);
      const wahl = opts.includes(richtig) ? richtig : opts[0];
      await wp.locator(`.opt[data-v="${wahl.replace(/"/g, '&quot;')}"]`).first().click();
      await wp.waitForTimeout(FUSS_TAUB);
      const weiter = wp.locator('.sess-foot button');
      if (await weiter.count()) { await weiter.first().click(); await wp.waitForTimeout(FUSS_TAUB); }
    }
    check('die Themenrunde bleibt beim Thema', karten > 0 && ausSport === karten,
      `${ausSport} von ${karten} aus Sport`);
    await wp.waitForSelector('#again', { timeout: 10000 });
    await wp.click('#again');
    await wp.waitForSelector('.sess-body', { timeout: 10000 });
    await wp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    /* Mehrere Karten ansehen, nicht nur die erste: Ein gemischter Tagesplan
       faengt in einem von neun Faellen zufaellig auch mit Sport an - eine
       einzelne Karte beweist gar nichts. */
    const kopfe = [];
    for (let i = 0; i < 5 && await wp.locator('.q').count(); i++) {
      kopfe.push(await wp.locator('.qcat').first().innerText());
      const q = (await wp.locator('.q').innerText()).trim();
      const opts = await wp.locator('.opt').evaluateAll(ns => ns.map(n => n.dataset.v));
      if (!opts.length) break;
      const richtig = ANTWORT.get(q);
      const wahl = opts.includes(richtig) ? richtig : opts[0];
      await wp.locator(`.opt[data-v="${wahl.replace(/"/g, '&quot;')}"]`).first().click();
      await wp.waitForTimeout(FUSS_TAUB);
      const weiter = wp.locator('.sess-foot button');
      if (await weiter.count()) { await weiter.first().click(); await wp.waitForTimeout(FUSS_TAUB); }
    }
    check('„Weitermachen" bleibt beim gewählten Thema',
      kopfe.length >= 5 && kopfe.every(k => k.includes('Sport')), kopfe.join(' | '));
    await wctx.close();
  }

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
    await page.locator('[data-tog]').count() === 9 &&
    await page.evaluate(() => [...document.querySelectorAll('[data-tog]')]
      .every(b => b.getAttribute('aria-pressed') === String(b.classList.contains('on')))),
    `${await page.locator('[data-tog]').count()} Schalter gefunden, erwartet 9`);
  await page.selectOption('#npd', '20');
  await settle();
  check('Einstellung wird sofort gespeichert', (await stored()).settings.newPerDay === 20);

  /* Die Fassungskennung muss OHNE Service Worker dastehen. Genau daran scheiterte
     die erste Umsetzung: Sie fragte den Worker, und im privaten Tab, beim
     allerersten Aufruf oder bei abgeschaltetem Worker gab es keinen - dort stand
     dann „wird eingerichtet" statt einer Auskunft. Ausgerechnet dann will man
     nachsehen, ob ueberhaupt die neue Fassung ankommt. Dieser Kontext laeuft
     ohne Worker, wie ein privater Tab. */
  {
    const octx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE',
      serviceWorkers: 'block' });
    const op = horche(await octx.newPage());
    await op.goto(URL_BASE, { waitUntil: 'networkidle' });
    await op.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    check('die App startet auch ohne Service Worker',
      await op.locator('.nav-btn').count() === 5);
    await op.click('[data-view="settings"]');
    await op.waitForSelector('#updSuch', { timeout: 10000 });
    const zeile = await op.locator('#updSuch').locator('xpath=../..').innerText();
    check('die Fassung steht auch ohne Service Worker da', /[0-9a-f]{7}/.test(zeile),
      zeile.replace(/\n/g, ' | '));
    check('und behauptet nicht, sie werde noch eingerichtet',
      !/wird beim ersten Start eingerichtet/.test(zeile));
    await octx.close();
  }

  group('Duell zählt getrennt');
  /* Duell-Antworten in denselben Topf zu werfen liess den Tagesfortschritt
     springen, ohne dass eine geplante Karte dran war – und zog die Trefferquote
     nach unten, obwohl unter fünfzehn Sekunden naturgemäß geraten wird. */
  {
    const dctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const dp = horche(await dctx.newPage());
    await dp.goto(URL_BASE, { waitUntil: 'networkidle' });
    const plan = await dp.locator('.hero h1').innerText();
    await dp.locator('.nav-btn[data-view="duel"]').click();
    await dp.locator('#duelGo').click();
    await dp.waitForSelector('.opt');
    await dp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
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
      /unter Zeitdruck heute/.test(await dp.locator('.seg-lab').innerText()),
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
    const kpage = horche(await kctx.newPage());
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
      const spage = horche(await sctx.newPage());
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
    const np = horche(await nctx.newPage());
    await np.goto(URL_BASE, { waitUntil: 'networkidle' });
    await np.evaluate((k) => {                       // freies Abrufen erzwingen
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.settings = { ...(st.settings || {}), recallMode: 'recall' };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await np.reload({ waitUntil: 'networkidle' });
    await np.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await np.waitForSelector('.sess-body');
    await np.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    const stand = async () => (await np.locator('.sess-top .tiny').innerText()).split('/').map(Number);
    const [, vorrat] = await stand();
    const frage = await np.locator('.q').innerText();
    // Frisch erschienene Fussknoepfe sind kurz taub (siehe entprellen()) -
    // ein Mensch braucht die Zeit ohnehin zum Lesen der Frage.
    await np.waitForTimeout(FUSS_TAUB);
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

  group('Eine Unterbrechung verdirbt die Note nicht');
  /* Die Note im Tagestraining haengt auch daran, wie lange man gebraucht hat:
     ueber 14 Sekunden gilt als „Schwer". Gerechnet wurde mit der Uhrzeit, und die
     laeuft auch waehrend eines Anrufs weiter – eine sofortige richtige Antwort
     wurde danach als „Schwer" gewertet und senkte den Leichtigkeitsfaktor der
     Karte dauerhaft. Anders als im Duell trifft das den Scheduler. */
  {
    const ANTWORT = new Map(CARDS.map(c => [c.q.trim(), c.a]));
    const uctx2 = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const up2 = horche(await uctx2.newPage());
    await up2.goto(URL_BASE, { waitUntil: 'networkidle' });
    await up2.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await up2.waitForSelector('.opts');
    await up2.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    const frage = (await up2.locator('.q').innerText()).trim();
    const richtig = ANTWORT.get(frage);

    const sichtbarkeit = (wert) => up2.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { get: () => v, configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => v === 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, wert);

    await sichtbarkeit('hidden');
    await new Promise(r => setTimeout(r, 16000));    // laenger als die 14-Sekunden-Schwelle
    await sichtbarkeit('visible');
    await up2.waitForTimeout(200);
    await up2.locator(`.opt[data-v="${String(richtig).replace(/"/g, '&quot;')}"]`).first().click();
    await up2.waitForTimeout(400);
    await up2.locator('#next').click();
    await up2.waitForTimeout(500);

    const zustand = await up2.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    const karte = Object.values(zustand.cards || {})[0];
    check('die Karte wurde ueberhaupt bewertet', !!karte);
    check('der Leichtigkeitsfaktor bleibt unberuehrt', karte && karte.ef === 2.5,
      karte ? `ef=${karte.ef} (2,35 hiesse: als „Schwer" gewertet)` : 'keine Karte');
    check('die Antwort zaehlt als richtig', karte && karte.ok === 1);
    await uctx2.close();
  }

  group('Zwei Tabs: ein Reset wird uebernommen, nicht eingesammelt');
  /* Der Unit-Test faehrt zwei Modulinstanzen ueber den save()-Pfad gegeneinander.
     Echte Nutzer treffen aber den storage-Horcher: Tab B liegt offen auf der
     Startseite, Tab A setzt zurueck. Ohne Generationsnummer fuellte B den
     geleerten Stand wieder auf, und ein Folge-Ereignis (Tab A speichert beim
     Rendern den Merkanker-Tag) ueberschrieb die ehrliche Meldung. */
  {
    const zctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const A = horche(await zctx.newPage());
    await A.goto(URL_BASE, { waitUntil: 'networkidle' });
    await A.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.cards = { 'probe-1': { ef: 2.5, iv: 3, due: 5, reps: 2, lapses: 0, seen: 4, ok: 3, last: 111 } };
      st.totalAnswers = 42; st.totalCorrect = 30; st.streak = 17; st.rev = 5;
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await A.reload({ waitUntil: 'networkidle' });
    const B = horche(await zctx.newPage());
    await B.goto(URL_BASE, { waitUntil: 'networkidle' });

    await A.bringToFront();
    A.on('dialog', (d) => d.accept());
    await A.locator('nav button[data-view="settings"]').click();
    await A.waitForTimeout(400);
    await A.locator('#rst').click();
    await A.waitForTimeout(700);

    await B.bringToFront();
    await B.waitForTimeout(700);
    const meldung = await B.locator('.toast').innerText().catch(() => '(keine)');
    check('Tab B meldet die Uebernahme ehrlich', /ersetzt – hier übernommen/.test(meldung), meldung);

    // Der kritische Moment: Tab B speichert etwas – der Altbestand darf nicht zurueckkommen.
    await B.locator('#searchBtn').click();
    await B.waitForTimeout(500);
    const stern = B.locator('.star').first();
    if (await stern.count()) { await stern.click(); await B.waitForTimeout(600); }
    const danach = await B.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      return { karten: Object.keys(st.cards).length, antworten: st.totalAnswers };
    }, KEY);
    check('der Reset ueberlebt das Speichern in Tab B',
      danach.karten === 0 && danach.antworten === 0, JSON.stringify(danach));
    await zctx.close();
  }

  /* Nach einer Runde steht der Rueckblick - und mit ihm die Liste der Karten,
     die man gerade falsch hatte. Er ist keine Ansicht, die render() kennt:
     Schrieb der zweite Tab in diesem Moment, zeichnete der Horcher die zuletzt
     gewaehlte Ansicht und der Rueckblick war weg, ohne dass der Nutzer etwas
     getan haette. */
  {
    const rctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const R = horche(await rctx.newPage());
    await R.goto(URL_BASE, { waitUntil: 'networkidle' });
    const ANTWORT = new Map(CARDS.map(c => [c.q.trim(), c.a]));
    await R.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await R.waitForSelector('.sess-body', { timeout: 10000 });
    await R.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    // Eine Karte falsch beantworten, damit der Rueckblick etwas zu zeigen hat,
    // dann die Runde ueber den Beenden-Knopf abschliessen (run.done > 0).
    const q = (await R.locator('.q').innerText()).trim();
    const opts = await R.locator('.opt').evaluateAll(ns => ns.map(n => n.dataset.v));
    const falsch = opts.find(o => o !== ANTWORT.get(q)) || opts[0];
    await R.locator(`.opt[data-v="${falsch.replace(/"/g, '&quot;')}"]`).first().click();
    await R.waitForTimeout(FUSS_TAUB);
    await R.locator('.sess-foot button').first().click();
    await R.waitForTimeout(FUSS_TAUB);
    await R.click('#quit');
    await R.waitForSelector('#again', { timeout: 10000 });
    check('der Rueckblick steht nach der Runde', await R.locator('#again').count() === 1);

    const Z = horche(await rctx.newPage());                 // zweiter Tab schreibt
    await Z.goto(URL_BASE, { waitUntil: 'networkidle' });
    await Z.locator('#searchBtn').click();
    await Z.waitForTimeout(400);
    const stern = Z.locator('.star').first();
    if (await stern.count()) { await stern.click(); await Z.waitForTimeout(600); }
    await R.bringToFront();
    await R.waitForTimeout(800);
    check('ein zweiter Tab loescht den Rueckblick nicht',
      await R.locator('#again').count() === 1);
    await rctx.close();
  }

  group('Duell: Zeit im Hintergrund zaehlt nicht');
  /* Der Zeitgeber rechnet mit Date.now(), damit gedrosselte Intervalle ihn nicht
     verfaelschen – nur laeuft Date.now() auch weiter, waehrend das Handy klingelt
     oder gesperrt ist. Vorher fand man die Frage nach einem Anruf abgelaufen vor,
     ohne sie je gesehen zu haben.

     Geprueft wird der Zeitbalken, nicht der Endzustand der Frage: Wie viel von den
     fuenfzehn Sekunden bis hierher schon verbraucht war, haengt davon ab, wie lange
     der gesamte Testlauf bis zu dieser Stelle gebraucht hat. Der Balken zeigt
     dagegen unmittelbar, ob die Pause angerechnet wurde. */
  {
    const dctx2 = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const dp2 = horche(await dctx2.newPage());
    await dp2.goto(URL_BASE, { waitUntil: 'networkidle' });
    await dp2.locator('nav button[data-view="duel"]').click();
    await dp2.waitForTimeout(300);
    await dp2.locator('#duelGo').click();
    await dp2.waitForSelector('.opts');
    await dp2.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz

    const balken = async () => Number(
      /width:\s*([\d.]+)%/.exec(await dp2.locator('#clock i').getAttribute('style') || '')?.[1] ?? -1);
    const sichtbarkeit = (wert) => dp2.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { get: () => v, configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => v === 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, wert);

    const vorher = await balken();
    check('der Zeitbalken laeuft ueberhaupt', vorher > 0, `${vorher} %`);
    await sichtbarkeit('hidden');
    await new Promise(r => setTimeout(r, 6000));      // 6 von 15 Sekunden = 40 Prozentpunkte
    await sichtbarkeit('visible');
    await dp2.waitForTimeout(400);
    const nachher = await balken();

    check('die Frage ist nach der Rueckkehr noch offen',
      await dp2.locator('.verdict').count() === 0,
      await dp2.locator('.verdict').innerText().catch(() => ''));
    check('sechs Sekunden im Hintergrund kosten kaum Zeit',
      nachher >= 0 && vorher - nachher < 12,
      `${vorher} % -> ${nachher} % (ohne die Pause waeren es rund 40 Punkte weniger)`);
    await dctx2.close();
  }

  group('Nachschlagen: der richtige Treffer steht oben');
  /* Gesucht wird nach Teilzeichenketten – absichtlich grosszuegig, damit
     „integr" auch „Integral" findet. Ohne Reihenfolge stand dadurch Unsinn oben:
     „dna" steckt in „schuldnachweis" und „rekordnationalspieler", und die echten
     DNA-Karten landeten auf Platz drei und vier. */
  {
    const sctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const sp = horche(await sctx.newPage());
    await sp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await sp.locator('#searchBtn').click();
    await sp.waitForSelector('#q');
    for (const [begriff, erwartet] of [
      ['DNA', /Abkürzung DNA|Basen bilden die DNA/],
      ['Grundgesetz', /Grundgesetz/],
      ['Bundesrat', /Bundesrat/],
      ['Kettenregel', /Kettenregel/],
    ]) {
      await sp.locator('#q').fill(begriff);
      await sp.waitForTimeout(450);
      const treffer = await sp.locator('.lk-q').count();
      check(`„${begriff}" findet etwas`, treffer > 0);
      const erste = await sp.locator('.lk-q').first().innerText();
      check(`„${begriff}": der erste Treffer passt`, erwartet.test(erste), erste.slice(0, 55));
    }
    // Die Suche darf nichts verlieren: derselbe Bestand wie ohne Reihenfolge
    await sp.locator('#q').fill('ableitung');
    await sp.waitForTimeout(450);
    const kopf = await sp.locator('#res .tiny').first().innerText();
    check('die Trefferzahl wird genannt', /\d+ Treffer/.test(kopf), kopf);

    /* Zeichen, die kein deutsches Tastenfeld hat, stehen auf echten Karten.
       Vorher liess normalize() sie ersatzlos fallen, die Suche hielt das Feld
       fuer leer und legte zwanzig zufaellige Karten unter „Zufaellige Auswahl"
       vor - waehrend das Zeichen sichtbar im Feld stand. */
    await sp.locator('#q').fill('∫');
    await sp.waitForTimeout(450);
    const intKopf = await sp.locator('#res .tiny').first().innerText();
    check('das Integralzeichen findet Integralkarten',
      /[1-9]\d* Treffer/.test(intKopf) && await sp.locator('.lk-q').count() > 0, intKopf);
    const intErste = await sp.locator('.lk-q').first().innerText();
    check('und zwar der Sache nach', /[Ii]ntegr|∫/.test(intErste), intErste.slice(0, 55));

    /* Eine Eingabe, von der nichts Suchbares uebrig bleibt, ist kein leeres
       Feld: Die App darf nicht behaupten, man habe nichts eingetippt. */
    await sp.locator('#q').fill('???');
    await sp.waitForTimeout(450);
    const nixKopf = await sp.locator('#res .tiny').first().innerText();
    check('„???" behauptet nicht, das Feld sei leer',
      !/Zufällige Auswahl|markierten Karten/.test(nixKopf), nixKopf);
    check('„???" zeigt keine fremden Karten als Treffer',
      await sp.locator('.lk').count() === 0, `${await sp.locator('.lk').count()} Karten`);
    await sctx.close();
  }

  group('Die Rueckschau nennt den wahren Abstand');
  /* Der zurueckgeholte Merkanker ist der von vor sieben ANZEIGETAGEN - das ist
     Absicht, sonst bekaeme man nach einer Pause einen, den man nie gesehen hat.
     Die Ueberschrift sagte aber fest „Vor sieben Tagen". Wer die App nur alle
     paar Wochen aufmacht, las das ueber einem Anker von vor 196 Tagen. */
  {
    const rctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const rp = horche(await rctx.newPage());
    await rp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await rp.waitForSelector('.hero');
    const abstand = await rp.evaluate((k) => {
      const z = JSON.parse(localStorage.getItem(k));
      // Acht Anzeigetage im Abstand von vier Wochen, der letzte ist heute.
      const tage = [];
      const heute = Math.floor(Date.now() / 86400000);
      const schluessel = (n) => {
        const d = new Date(n * 86400000);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };
      for (let i = 7; i >= 0; i--) tage.push(schluessel(heute - i * 28));
      z.factSeen = 8; z.factIdx = 8; z.factDay = tage[tage.length - 1]; z.factTage = tage;
      localStorage.setItem(k, JSON.stringify(z));
      return 196;
    }, KEY);
    await rp.reload({ waitUntil: 'networkidle' });
    await rp.waitForSelector('.hero');
    const ueber = await rp.evaluate(() => {
      const el = document.getElementById('merkRueck');
      return el ? (el.closest('.card.fact')?.querySelector('p.tiny')?.innerText || '') : '(keine Rueckschau)';
    });
    check('die Rueckschau steht auf der Startseite', /weißt du es noch/.test(ueber), ueber);
    check('und nennt den wahren Abstand, nicht „sieben Tagen"',
      ueber.includes(String(abstand)), `„${ueber}" bei ${abstand} Tagen Abstand`);
    await rctx.close();
  }

  group('Die 12-Wochen-Karte sagt vorgelesen dasselbe wie gezeichnet');
  /* Das Bild ist aria-hidden - fuer Hilfsmittel ist der Satz darunter die
     ganze Karte. Er nannte aber die Antworten ALLER Zeiten: Bei sieben Monaten
     Verlauf stand dort „zusammen 4.800 Antworten", waehrend in den 84 gezeigten
     Zellen 1.896 steckten. */
  {
    const wctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const wp = horche(await wctx.newPage());
    await wp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await wp.waitForSelector('[data-go="daily"]');
    const imFenster = await wp.evaluate(async () => {
      const store = await import('/assets/js/store.js');
      const heute = store.todayNum();
      for (let i = 0; i < 200; i++) {
        store.S().days[store.numToKey(heute - i)] = { done: 24, correct: 20, newC: 0, sec: 600 };
      }
      store.save(true);
      // Dasselbe Fenster wie renderStats: 84 Zellen, die Zukunft zaehlt nicht.
      const dowMon = (n) => (((n % 7) + 7) % 7 + 3) % 7;
      const start = heute + (6 - dowMon(heute)) - 83;
      let summe = 0;
      for (let i = 0; i < 84; i++) {
        const tag = start + i;
        if (tag > heute) continue;
        summe += store.S().days[store.numToKey(tag)]?.done || 0;
      }
      return summe;
    });
    await wp.reload({ waitUntil: 'networkidle' });
    await wp.click('[data-view="stats"]');
    await wp.waitForSelector('.heat');
    const satz = await wp.evaluate(() => {
      const p = [...document.querySelectorAll('.sr-only')].find(e => /Tagen gelernt/.test(e.innerText));
      return p ? p.innerText.trim() : '';
    });
    const genannt = Number((satz.match(/zusammen (\d+) Antworten/) || [])[1]);
    check('der Vorlesesatz nennt die Antworten der gezeigten Wochen',
      genannt === imFenster, `„${satz}" – im Fenster stecken ${imFenster}`);
    check('und nicht die des ganzen Verlaufs', genannt !== 4800, satz);
    await wctx.close();
  }

  group('Eine Pause mitten in der Runde ist keine Lernzeit');
  /* endRun() rechnete mit der Wanduhr: Wer die App mitten in der Runde
     verlaesst und spaeter zurueckkommt, bekam die Pause als Lernzeit
     gutgeschrieben - „1 von 3 richtig · 180 Min." fuer eine Runde von fuenfzehn
     Sekunden. Die einzelnen Fragen rechnen laengst mit sichtbarer Zeit. */
  {
    const pctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const pp = horche(await pctx.newPage());
    await pp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await pp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await pp.waitForSelector('.sess-body');
    await pp.waitForTimeout(FUSS_TAUB);
    const antworte = async () => {
      if (await pp.locator('.opt').count()) await pp.locator('.opt').first().click();
      else if (await pp.locator('[data-hab]').count()) await pp.locator('[data-hab="1"]').click();
      else await pp.click('#reveal');
      await pp.waitForTimeout(400);
      if (await pp.locator('[data-g="3"]').count()) await pp.locator('[data-g="3"]').click();
      else if (await pp.locator('#next').count()) await pp.click('#next');
      await pp.waitForTimeout(400);
    };
    const verstecken = (wie) => pp.evaluate((zustand) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => zustand });
      document.dispatchEvent(new Event('visibilitychange'));
    }, wie);
    await antworte();
    await verstecken('hidden');
    await pp.waitForTimeout(3000);          // drei Sekunden Anruf
    await verstecken('visible');
    await antworte();
    await pp.click('#quit');
    await pp.waitForTimeout(600);
    const sek = await pp.evaluate((k) => {
      const z = JSON.parse(localStorage.getItem(k) || '{}');
      const tag = Object.values(z.days || {}).find(d => (d.sec || 0) > 0);
      return tag ? tag.sec : 0;
    }, KEY);
    check('die Pause zaehlt nicht als Lernzeit', sek > 0 && sek < 3,
      `${sek} s fuer eine Runde mit drei Sekunden Pause`);
    await pctx.close();
  }

  group('Die Bestandsrechnung auf der Startseite geht auf');
  /* „x angefangen · y gefestigt · z noch unberuehrt": Die erste und die dritte
     Zahl muessen zusammen die Gesamtzahl ergeben. Frueher zaehlte „angefangen"
     ueber reps/ok, „noch unberuehrt" aber ueber seen. Eine neue Karte, die beim
     ersten Mal umfiel, steht danach mit {seen:1, reps:0, ok:0} im Speicher -
     weder angefangen noch unberuehrt. Nach einer Runde ueber zwanzig neue
     Karten meldete die Startseite „10 angefangen · 0 gefestigt · 2.301 noch
     unberuehrt" bei 2.321 Karten. */
  {
    const bctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const bp = horche(await bctx.newPage());
    await bp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await bp.waitForSelector('[data-go="daily"]');
    // Zwanzig neue Karten, die Haelfte faellt beim ersten Mal um - ueber die
    // App selbst, damit genau der Zustand entsteht, den „Nochmal" schreibt.
    await bp.evaluate(async () => {
      const daten = await import('/data/index.js');
      const store = await import('/assets/js/store.js');
      const srs = await import('/assets/js/srs.js');
      for (let i = 0; i < 20; i++) {
        store.putCard(daten.CARDS[i].id, srs.schedule(srs.fresh(), i % 2 === 0 ? srs.AGAIN : srs.GOOD, {}));
      }
      store.save(true);
    });
    await bp.reload({ waitUntil: 'networkidle' });
    await bp.waitForSelector('.hero');
    const zeile = await bp.evaluate(() => {
      const p = [...document.querySelectorAll('p.tiny')].find(e => /angefangen/.test(e.innerText));
      return p ? p.innerText : '';
    });
    const zahlen = (zeile.match(/\d+/g) || []).map(Number);
    const gesamt = await bp.evaluate(async () => (await import('/data/index.js')).CARDS.length);
    check('die Zeile nennt drei Zahlen', zahlen.length === 3, zeile);
    check('angefangen und noch unberuehrt ergeben zusammen den ganzen Bestand',
      zahlen.length === 3 && zahlen[0] + zahlen[2] === gesamt,
      `${zeile} – zusammen ${zahlen[0] + zahlen[2]} von ${gesamt}`);
    check('die zwanzig abgefragten Karten stehen auch drin', zahlen[0] === 20, zeile);
    await bctx.close();
  }

  group('Der erste Buchstabe in der Suche friert nichts ein');
  /* felder() rechnet die Einzelfelder aufgeschoben, „nur fuer Karten, die
     ueberhaupt treffen". Beim ERSTEN Buchstaben trifft aber fast alles: 'e'
     alle 2.321 Karten, 'v' noch 1.538 - also wurde die ganze Rechnung in einem
     Zug auf dem Hauptthread nachgeholt. Gemessen bei vierfacher Drosselung
     (dieselbe Groessenordnung, die app.js selbst als „gedrosseltes iPhone"
     ansetzt): 1.348 ms Stillstand, die Zeichen zwei bis sieben kamen danach im
     Schwall. Mit dem Vorwaermen in Scheiben sind es 146-179 ms. */
  {
    const fctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const fp = horche(await fctx.newPage());
    const cdp = await fctx.newCDPSession(fp);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await fp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await fp.locator('#searchBtn').click();
    await fp.waitForSelector('#q');
    await fp.waitForTimeout(2500);            // das Vorwaermen im Leerlauf abwarten
    await fp.evaluate(() => {
      window.__takt = []; let letzte = performance.now();
      const schlag = () => { const t = performance.now(); window.__takt.push(t - letzte);
        letzte = t; requestAnimationFrame(schlag); };
      requestAnimationFrame(schlag);
    });
    await fp.locator('#q').click();
    for (const ch of 'energie') { await fp.keyboard.type(ch); await fp.waitForTimeout(120); }
    await fp.waitForTimeout(900);
    const luecke = await fp.evaluate(() => Math.round(Math.max(...window.__takt)));
    check('der Bildschirm steht beim Tippen nie lange still', luecke < 700,
      `laengste Bildluecke ${luecke} ms (vorher 1348 ms, jetzt rund 160 ms)`);
    /* Dasselbe gilt fuers Aufgehen des Bildschirms: Der Leerlauf-Aufbau laeuft
       direkt nach dem ersten Zeichnen an, und solange er den Index am Stueck
       baute, stand das Bild 711 ms (4x) bzw. 1.099 ms (6x) still - bevor der
       Nutzer ueberhaupt getippt hatte. */
    const zctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const zp = horche(await zctx.newPage());
    const zcdp = await zctx.newCDPSession(zp);
    await zcdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await zp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await zp.waitForSelector('#searchBtn');
    await zp.evaluate(() => {
      window.__takt2 = []; let letzte = performance.now();
      const schlag = () => { const t = performance.now(); window.__takt2.push(t - letzte);
        letzte = t; requestAnimationFrame(schlag); };
      requestAnimationFrame(schlag);
    });
    await zp.locator('#searchBtn').click();
    await zp.waitForSelector('#q');
    await zp.waitForTimeout(2500);          // das Vorwaermen mitlaufen lassen
    const auf = await zp.evaluate(() => Math.round(Math.max(...window.__takt2)));
    check('auch das Oeffnen der Suche blockiert nicht', auf < 400,
      `laengste Bildluecke beim Oeffnen ${auf} ms (vorher 711 ms)`);
    await zctx.close();
    const gefunden = await fp.locator('#res .tiny').first().innerText();
    check('und das Wort ist trotzdem ganz angekommen',
      (await fp.locator('#q').inputValue()) === 'energie' && /\d+ Treffer/.test(gefunden), gefunden);
    await fctx.close();
  }

  group('Markierte Karten: die Liste sagt, wie viele es sind');
  /* Der Nachschlage-Bildschirm ist der einzige Ort, an dem Markierungen wieder
     wegzunehmen sind. Bei 85 Markierungen zeigte er stumm 60 Zeilen, waehrend
     die Einstellungen „Alle 85 Markierungen loeschen" anboten - und weil CARDS
     nach Themen sortiert ist, fielen immer dieselben hinteren Themen weg. */
  {
    const mctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const mp = horche(await mctx.newPage());
    await mp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await mp.waitForSelector('#searchBtn');
    /* Ueber die App selbst markieren, nicht ueber den Speicher: Beim Neuladen
       schriebe der Ausstieg sonst den alten Stand wieder darueber. */
    const zuletzt = await mp.evaluate(async () => {
      const daten = await import('/data/index.js');
      const store = await import('/assets/js/store.js');
      const ids = daten.CARDS.map(c => c.id);
      const schritt = Math.floor(ids.length / 85);
      let letzte = null;
      for (let i = 0; i < 85; i++) { store.toggleFlag(ids[i * schritt]); letzte = ids[i * schritt]; }
      store.save(true);
      return letzte;
    });
    await mp.locator('#searchBtn').click();
    await mp.waitForSelector('#q');
    await mp.waitForTimeout(400);
    const mKopf = await mp.locator('#res .tiny').first().innerText();
    check('die Kopfzeile nennt die volle Zahl', /85 markierte/.test(mKopf), mKopf);
    check('und sagt, dass sie abschneidet', /ersten 60/.test(mKopf), mKopf);
    const obenId = await mp.locator('.lk').first().getAttribute('data-id');
    check('die zuletzt markierte Karte steht oben', obenId === zuletzt, `${obenId} statt ${zuletzt}`);
    await mctx.close();
  }

  group('Wenn die App nicht laedt');
  /* Ohne Ausweg blieb „Wissenswerk wird geladen …" fuer immer stehen – samt dem
     Hinweis, dass es gleich losgeht. Ein abgebrochener Download, eine kaputte
     Datendatei oder ein zu alter Browser sahen aus wie ein Haenger. */
  {
    for (const [name, muster, erwartet] of [
      ['fehlende Datei', '**/assets/js/app.js', /nicht geladen/],
      ['kaputte Kartendatei', '**/data/spo.js', /nicht geladen/],
    ]) {
      const bctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'block' });
      const bp = horche(await bctx.newPage(), true);   // bricht mit Absicht
      const fehlerVorher = absichtlicheFehler.length;
      await bp.route(muster, (route) => {
        if (name === 'fehlende Datei') return route.fulfill({ status: 404, body: 'weg' });
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: 'export default [ kein gueltiges JS' });
      });
      await bp.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
      await bp.waitForTimeout(2000);
      const txt = await bp.locator('#boot').innerText().catch(() => '');
      check(`${name}: der Startbildschirm sagt Bescheid`, erwartet.test(txt), txt.slice(0, 60));
      check(`${name}: es gibt einen Knopf zum Neuladen`, await bp.locator('#bootNeu').count() === 1);
      check(`${name}: kein falsches Versprechen mehr`, !/startet die App sofort/.test(txt));
      /* Der Fehler wurde bisher nur verschluckt. Dass die Vorrichtung ueberhaupt
         etwas kaputt macht, hat niemand geprueft – faellt die Umleitung eines
         Tages aus, laedt die App normal und alle drei Pruefungen darueber messen
         den Normalfall. */
      check(`${name}: die Vorrichtung bricht wirklich etwas`,
        absichtlicheFehler.length > fehlerVorher,
        'kein einziger Konsolen- oder Seitenfehler – die Umleitung greift nicht');
      await bctx.close();
    }
  }

  group('Hinweise schlucken keine Tipper');
  /* Der Hinweisbalken liegt fest ueber dem unteren Rand – also ueber den
     Antwortknoepfen. Ohne pointer-events:none nahm sein Rechteck jeden Tipper
     entgegen, der darunter zielte; in einem Durchlauf ueber Monate blieb genau
     daran eine Runde haengen. Das Update-Angebot wird ausserdem bis zum Ende der
     Runde zurueckgehalten: Mitten in der Runde kann es ohnehin nichts bewirken. */
  {
    const tctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const tp = horche(await tctx.newPage());
    await tp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await tp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await tp.waitForSelector('.sess-body');
    await tp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz

    // Einen bleibenden Hinweisbalken erzeugen, wie ihn eine neue Fassung zeigt
    await tp.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'toast aktion';
      d.setAttribute('role', 'status');
      d.innerHTML = '<span>Neue Fassung bereit</span><button type="button">Laden</button>';
      document.body.appendChild(d);
    });
    await tp.waitForTimeout(200);
    check('der Balken liegt ueber dem Antwortbereich',
      await tp.locator('.toast.aktion').isVisible());
    // Trifft ein Tipper in der Mitte des Balkens den Balken oder das, was darunter liegt?
    const durch = await tp.evaluate(() => {
      const t = document.querySelector('.toast.aktion');
      const r = t.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + 12, r.top + r.height / 2);
      return !t.contains(el);
    });
    check('ein Tipper auf den Balken erreicht, was darunter liegt', durch);
    const knopf = await tp.evaluate(() => {
      const b = document.querySelector('.toast.aktion button');
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return b.contains(el);
    });
    check('der Knopf des Balkens bleibt bedienbar', knopf);

    // Antworten muss trotz Balken moeglich sein
    const opts = await tp.locator('.opt').evaluateAll(ns => ns.map(n => n.dataset.v));
    await tp.locator(`.opt[data-v="${opts[0].replace(/"/g, '&quot;')}"]`).first()
      .click({ timeout: 4000 });
    await tp.waitForTimeout(300);
    check('antworten geht trotz stehendem Hinweis', await tp.locator('.verdict').count() > 0);
    await tctx.close();
  }

  /* Der Balken bleibt stehen, bis der Nutzer entscheidet – also muss er auch
     jede Kurzmeldung ueberleben. Vorher loeschte toast() schlicht das erste
     Element mit der Klasse .toast, und das war der Balken: Ein Stern im
     Nachschlagen, ein „Gesichert", irgendeine Meldung – und das Update-Angebot
     war bis zum naechsten vollstaendigen Neuladen verschwunden. */
  {
    const bctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const bp = horche(await bctx.newPage());
    await bp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await bp.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'toast aktion';
      d.innerHTML = '<span>Neue Fassung bereit</span><button type="button">Laden</button>';
      document.body.appendChild(d);
    });
    // Ein frisches Profil hat keine Wackelkandidaten – der Knopf zeigt nur eine Meldung.
    await bp.getByRole('button', { name: 'Wackelkandidaten' }).click();
    await bp.waitForTimeout(400);
    check('eine Kurzmeldung erscheint', await bp.locator('.toast:not(.aktion)').count() === 1);
    check('der Update-Balken ueberlebt die Kurzmeldung', await bp.locator('.toast.aktion').count() === 1);
    const oben = await bp.evaluate(() => {
      const t = document.querySelector('.toast:not(.aktion)');
      const b = document.querySelector('.toast.aktion');
      return t && b && t.getBoundingClientRect().bottom <= b.getBoundingClientRect().top + 1;
    });
    check('die Meldung steht ueber dem Balken statt darauf', oben);
    await bctx.close();
  }

  group('Festlegen vor der Aufloesung');
  /* Wer die Loesung sieht und erst danach urteilt, haelt fuer gewusst, was er
     gerade gelesen hat. Ohne Eingabe muss deshalb vorher eine Festlegung fallen. */
  {
    const fctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const fp = horche(await fctx.newPage());
    await fp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await fp.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.settings = { ...(st.settings || {}), recallMode: 'recall' };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await fp.reload({ waitUntil: 'networkidle' });
    await fp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await fp.waitForSelector('.sess-body');
    await fp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz

    check('ohne Eingabe gibt es keinen blossen Aufdeck-Knopf',
      await fp.locator('#reveal').count() === 0);
    check('stattdessen stehen zwei Festlegungen bereit',
      await fp.locator('[data-hab]').count() === 2);
    check('die Loesung ist noch nicht sichtbar',
      await fp.locator('.answer .val').count() === 0);

    // Tippen ist selbst eine Festlegung – dann genuegt ein Knopf.
    await fp.locator('#rin').fill('irgendeine Antwort');
    await fp.waitForTimeout(250);
    check('mit Eingabe wird daraus wieder „Lösung zeigen"',
      await fp.locator('#reveal').count() === 1 && await fp.locator('[data-hab]').count() === 0);
    check('der getippte Text bleibt beim Umschalten stehen',
      (await fp.locator('#rin').inputValue()) === 'irgendeine Antwort');
    await fp.locator('#rin').fill('');
    await fp.waitForTimeout(250);
    check('leert man wieder, kommt die Festlegung zurueck',
      await fp.locator('[data-hab]').count() === 2);

    await fp.locator('[data-hab="1"]').click();
    await fp.waitForTimeout(350);
    const spiegel = await fp.locator('.verdict').innerText();
    check('die Festlegung steht neben der Loesung', /hab ich/i.test(spiegel), spiegel);
    check('danach stehen alle vier Noten bereit', await fp.locator('[data-g]').count() === 4);

    // „Hab ich" und dann doch „Nochmal" – genau das zaehlt die Selbsteinschaetzung.
    // Die Frage JETZT lesen: Gleich ist diese Karte weg, und spaeter stuende
    // hier die naechste - die Wiedervorlage waere dann nicht wiederzuerkennen.
    const ersteFrage = (await fp.locator('.q').first().innerText()).trim();
    await fp.getByRole('button', { name: 'Nochmal' }).click();
    await fp.waitForTimeout(350);
    const z = await fp.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    check('die Festlegung wird gezaehlt', z.claims === 1, `claims=${z.claims}`);
    check('der Fehlgriff wird gezaehlt', z.claimsMiss === 1, `claimsMiss=${z.claimsMiss}`);

    /* Die umgefallene Karte kommt in derselben Einheit noch einmal - und man
       hat die Loesung eine Minute vorher gelesen. Voll mitgezaehlt brachte
       jeder Aussetzer eine zusaetzliche, geschenkte Festlegung: Wer oft
       umkippt, sammelte damit die beste Quote ein, und die Karte
       „Selbsteinschaetzung" kehrte ihren Zweck um. */
    /* Auf einen FRAGEbildschirm warten, nicht nur auf ein .q: Die Aufloesung
       zeigt dieselbe Frage weiter. Ohne diesen Schritt las die Pruefung die
       stehende Aufloesung als Wiedervorlage - und ging durch, ohne etwas
       geprueft zu haben (gegengeprobt: sie bestand auch gegen den alten Stand). */
    const frageAbwarten = async () => {
      try {
        await fp.waitForFunction(() => !!document.querySelector('.q') &&
          !!(document.querySelector('[data-hab]') || document.querySelector('#reveal')),
          null, { timeout: 4000 });
      } catch { return null; }
      return (await fp.locator('.q').first().innerText()).trim();
    };
    const aufdecken = async () => {
      if (await fp.locator('[data-hab]').count()) await fp.locator('[data-hab="1"]').click();
      else await fp.click('#reveal');
      await fp.waitForSelector('[data-g]', { timeout: 4000 });
      await fp.waitForTimeout(FUSS_TAUB);
    };
    const claims = () => fp.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}').claims || 0, KEY);
    let davor = null, danach = null;
    for (let i = 0; i < 14; i++) {
      const frage = await frageAbwarten();
      if (!frage) break;
      const wiedervorlage = frage === ersteFrage;
      if (wiedervorlage) davor = await claims();
      await aufdecken();
      await fp.locator('[data-g="3"]').click();        // „Leicht" – damit ist sie durch
      await fp.waitForTimeout(400);
      if (wiedervorlage) { danach = await claims(); break; }
    }
    check('die umgefallene Karte kam in derselben Einheit wieder', davor !== null,
      'sie tauchte in vierzehn Karten nicht wieder auf');
    check('der zweite Anlauf zaehlt nicht als weitere Festlegung', davor !== null && danach === davor,
      `claims ${davor} -> ${danach}`);
    await fctx.close();
  }

  group('Merkanker sind Abrufaufgaben');
  /* Ein Merkanker, den man nur liest, ist die schwaechste Lernform ueberhaupt.
     Deshalb steht oben der Hinweisreiz und die Aufloesung kommt erst auf
     Tastendruck – und ein Anker von vor sieben Anzeigetagen kommt zurueck. */
  {
    const mctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const mp = horche(await mctx.newPage());
    await mp.goto(URL_BASE, { waitUntil: 'networkidle' });
    check('nur ein Merkanker, solange die Rueckschau nicht reicht',
      await mp.locator('.card.fact').count() === 1);
    // Existenz mitpruefen: Ein umbenanntes Element waere sonst „unsichtbar"
    // und der Test gruen, obwohl er nichts mehr findet.
    check('die Aufloesung ist vorhanden, aber verdeckt',
      await mp.locator('.card.fact .merk-loesung').count() === 1
      && !await mp.locator('.card.fact .merk-loesung').first().isVisible());
    await mp.locator('[data-merk="merkHeute"]').click();
    await mp.waitForTimeout(200);
    check('Aufdecken zeigt die Aufloesung',
      await mp.locator('.card.fact .merk-loesung').first().isVisible());
    /* Der Knopf war frueher wirklich entfernt (b.remove()). Damit verschwand das
       FOKUSSIERTE Element aus dem Dokument, der Fokus fiel auf <body> und der
       Lesecursor sprang an den Seitenanfang – die gerade aufgedeckte Loesung
       wurde nie angesagt. Jetzt bleibt er stillgelegt und unsichtbar stehen,
       und der Fokus wandert in den aufgedeckten Block. Geprueft wird also die
       Absicht: aus dem Weg und nicht mehr bedienbar – aber der Lesecursor steht
       auf der Loesung. */
    check('der Knopf ist nach dem Aufdecken aus dem Weg',
      !await mp.locator('[data-merk="merkHeute"]').isVisible()
      && await mp.locator('[data-merk="merkHeute"]').isDisabled());
    check('und der Fokus steht auf der aufgedeckten Loesung',
      await mp.evaluate(() => document.activeElement?.classList.contains('merk-loesung')
        || document.activeElement?.closest('.merk-loesung') !== null));

    // Genug Anzeigetage – jetzt muss die Rueckschau dazukommen
    await mp.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.factSeen = 30; st.factIdx = 30; st.factDay = '2000-01-01';
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await mp.reload({ waitUntil: 'networkidle' });
    await mp.waitForTimeout(300);
    check('ab dem achten Anzeigetag kommt die Rueckschau dazu',
      await mp.locator('.card.fact').count() === 2);
    const rueck = await mp.locator('.card.fact').nth(1).innerText();
    /* Ohne Tagebuch der Anzeigetage (hier von Hand gesetzt, und so sieht auch
       ein Stand aus, der von einer aelteren Fassung kommt) kann die Karte den
       Abstand nicht beziffern - dann sagt sie das, statt „Vor sieben Tagen" zu
       behaupten. Mit Tagebuch nennt sie die Zahl; das prueft die Gruppe
       „Die Rueckschau nennt den wahren Abstand". */
    check('die Rueckschau ist als solche beschriftet',
      /weißt du es noch/.test(rueck) && !/Vor sieben Tagen/.test(rueck), rueck.slice(0, 44));
    check('auch die Rueckschau ist zuerst verdeckt',
      !(await mp.locator('#merkRueck').isVisible()));
    await mctx.close();
  }

  group('Nochmal hat einen Deckel');
  /* Ohne Deckel schob sich eine Karte, die man nicht weiss, bei jedem Versuch
     erneut ein - gemessen wurde dieselbe Karte in einer Runde von zwoelf Karten
     49-mal gestellt, und die Runde endete nie. Hoechstens zwei Nachreichungen. */
  {
    const ANTWORT = new Map(CARDS.map(c => [c.q.trim(), c.a]));
    const dctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const dp = horche(await dctx.newPage());
    await dp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await dp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await dp.waitForSelector('.sess-body');
    await dp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    const ziel = (await dp.locator('.q').innerText()).trim();
    let gezeigt = 0, antworten = 0, fertig = false;
    for (let i = 0; i < 40; i++) {
      if (!(await dp.locator('.q').count())) { fertig = true; break; }
      const q = (await dp.locator('.q').innerText()).trim();
      const richtig = ANTWORT.get(q);
      const opts = await dp.locator('.opt').evaluateAll(ns => ns.map(n => n.dataset.v));
      if (!opts.length) break;
      // Die Zielkarte immer falsch, alle anderen richtig beantworten
      const wahl = q === ziel ? opts.find(o => o !== richtig)
        : (opts.includes(richtig) ? richtig : opts[0]);
      await dp.locator(`.opt[data-v="${wahl.replace(/"/g, '&quot;')}"]`).first().click();
      antworten++;
      if (q === ziel) gezeigt++;
      await dp.waitForTimeout(260);
      const weiter = dp.locator('.sess-foot button');
      if (await weiter.count()) { await weiter.first().click(); await dp.waitForTimeout(260); }
    }
    check('die Runde endet trotz immer falscher Karte', fertig, `${antworten} Antworten`);
    check('die Karte wird hoechstens dreimal gestellt', gezeigt <= 3, `${gezeigt}-mal`);
    check('die Karte wird ueberhaupt nachgereicht', gezeigt >= 2, `${gezeigt}-mal`);
    await dctx.close();
  }

  /* Zuruecknehmen muss auch den Nachreich-Zaehler zuruecksetzen - sonst gilt der
     naechste Fehlversuch faelschlich als zweiter und die Karte landete am Ende
     der Runde statt fuenf Karten weiter. */
  {
    const ANTWORT = new Map(CARDS.map(c => [c.q.trim(), c.a]));
    const uctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const up = horche(await uctx.newPage());
    await up.goto(URL_BASE, { waitUntil: 'networkidle' });
    await up.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await up.waitForSelector('.sess-body');
    await up.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    const vorrat = async () => Number((await up.locator('.sess-top .tiny').innerText()).split('/')[1]);
    const start = await vorrat();
    const frage = (await up.locator('.q').innerText()).trim();
    const falschTippen = async () => {
      const opts = await up.locator('.opt').evaluateAll(ns => ns.map(n => n.dataset.v));
      const w = opts.find(o => o !== ANTWORT.get((up.__q = frage)));
      await up.locator(`.opt[data-v="${w.replace(/"/g, '&quot;')}"]`).first().click();
      await up.waitForTimeout(260);
      await up.locator('#next').click();
      await up.waitForTimeout(260);
    };
    await falschTippen();
    check('falsche Antwort schiebt eine Karte ein', (await vorrat()) === start + 1);
    await up.click('#undo');
    await up.waitForTimeout(400);
    check('Zuruecknehmen entfernt die eingeschobene Karte', (await vorrat()) === start,
      `${await vorrat()} statt ${start}`);
    check('dieselbe Frage steht wieder an', (await up.locator('.q').innerText()).trim() === frage);
    /* Entscheidend ist nicht, dass ueberhaupt wieder eingeschoben wird, sondern
       dass der Zaehler bei null anfaengt: Nach dem Zuruecknehmen muss die Karte
       noch zweimal nachgereicht werden koennen, also insgesamt dreimal drankommen.
       Bliebe der Zaehler stehen, waere es nur zweimal. */
    let zeigt = 0;
    for (let i = 0; i < 40; i++) {
      if (!(await up.locator('.q').count())) break;
      const q = (await up.locator('.q').innerText()).trim();
      const richtig = ANTWORT.get(q);
      const opts = await up.locator('.opt').evaluateAll(ns => ns.map(n => n.dataset.v));
      if (!opts.length) break;
      const wahl = q === frage ? opts.find(o => o !== richtig)
        : (opts.includes(richtig) ? richtig : opts[0]);
      await up.locator(`.opt[data-v="${wahl.replace(/"/g, '&quot;')}"]`).first().click();
      if (q === frage) zeigt++;
      await up.waitForTimeout(260);
      const w = up.locator('.sess-foot button');
      if (await w.count()) { await w.first().click(); await up.waitForTimeout(260); }
    }
    check('nach dem Zuruecknehmen faengt der Nachreich-Zaehler wieder bei null an',
      zeigt === 3, `${zeigt} statt 3 Aufrufe`);
    await uctx.close();
  }

  group('Erster Start auf langsamer Leitung');
  /* Der Startbildschirm muss erklaeren, warum es dauert - sonst wirkt die App
     beim ersten Aufruf im Zug wie abgestuerzt. */
  {
    const lctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'block' });
    const lp = horche(await lctx.newPage());
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
    const sp = horche(await sctx.newPage());
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

    /* Genau wie die App rechnen: Der App-Tag beginnt um 4 Uhr (Nachteule-Schutz).
       Die alte Rechnung nahm den Kalendertag ab Mitternacht – zwischen 0 und
       4 Uhr war „heute" damit einen Tag voraus, die App sagte korrekt
       „44 Tage her" und der Test bestand auf 45. */
    const heute = await sp.evaluate(() => {
      const d = new Date();
      if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    });
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

  group('Doppeltipp verbrennt keine Karte');
  /* Bewertungsknoepfe und die Festlegen-Knoepfe der naechsten Karte stehen an
     derselben Stelle im Fuss. Ein zweiter, schneller Tipp legte sich sonst fuer
     eine ungelesene Karte fest und deckte sie gleich auf. */
  {
    const dctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const dp = horche(await dctx.newPage());
    await dp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await dp.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.settings = { ...(st.settings || {}), recallMode: 'recall' };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await dp.reload({ waitUntil: 'networkidle' });
    await dp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await dp.waitForSelector('.sess-body');
    await dp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    await dp.waitForTimeout(FUSS_TAUB);
    await dp.locator('[data-hab="0"]').click();          // erste Karte: festlegen
    await dp.waitForSelector('[data-g]');
    await dp.waitForTimeout(FUSS_TAUB);
    // Jetzt der Doppeltipp: Note geben und sofort noch einmal an dieselbe Stelle
    const note = dp.locator('[data-g="2"]');
    const kasten = await note.boundingBox();
    await note.click();
    await dp.mouse.click(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2);
    await dp.waitForTimeout(250);
    check('die zweite Karte ist nach dem Doppeltipp noch verdeckt',
      await dp.locator('.answer .val').count() === 0);
    check('und wartet weiter auf die Festlegung',
      await dp.locator('[data-hab]').count() === 2);
    const st2 = await dp.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    check('nur die erste Karte wurde bewertet', st2.totalAnswers === 1, `totalAnswers=${st2.totalAnswers}`);
    await dctx.close();
  }

  group('Deutsche Zahlenschreibweise');
  /* toFixed liefert immer einen Punkt - in einer deutschsprachigen Oberflaeche
     ist „10.3 s" schlicht falsch. */
  {
    const zctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const zp = horche(await zctx.newPage());
    await zp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await zp.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.duelAnswers = 40; st.duelCorrect = 25; st.duelMs = 412000; st.duelTimed = 25;
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await zp.reload({ waitUntil: 'networkidle' });
    await zp.click('[data-view="duel"]');
    await zp.waitForSelector('#duelGo');
    const zeile = await zp.locator('.card .row', { hasText: 'Ø Zeit' }).innerText();
    check('Antwortzeit steht mit Komma', /\d,\d\s*s/.test(zeile), zeile);
    check('Antwortzeit steht nicht mit Punkt', !/\d\.\d/.test(zeile), zeile);
    await zctx.close();
  }

  group('Voller Speicher meldet sich dauerhaft');
  /* Der einzige Pfad, auf dem Antworten still verschwinden. Eine Kurzmeldung
     reichte nicht: Nach fuenf Sekunden lernte man ahnungslos weiter. */
  {
    const vctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const vp = horche(await vctx.newPage());
    await vp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await vp.waitForSelector('[data-go="daily"]');
    await vp.evaluate((k) => {
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key, val) => {
        if (key === k) throw new DOMException('voll', 'QuotaExceededError');
        return orig(key, val);
      };
    }, KEY);
    await vp.click('[data-go="daily"]');
    await vp.waitForSelector('.opt, #reveal');
    await vp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    if (await vp.locator('.opt').count()) await vp.locator('.opt').first().click();
    else await vp.click('#reveal');
    // Geschrieben wird erst beim Weitergehen, nicht schon beim Antworten.
    await vp.waitForSelector('#next, .grades .btn');
    if (await vp.locator('#next').count()) await vp.click('#next');
    else await vp.locator('.grades .btn').first().click();
    await vp.waitForSelector('.toast.aktion.speicher', { timeout: 5000 });
    check('Speicherhinweis erscheint', await vp.locator('.toast.aktion.speicher').count() === 1);
    check('Speicherhinweis bietet das Sichern an',
      (await vp.locator('.toast.aktion.speicher button').innerText()).includes('Sichern'));
    await vp.waitForTimeout(6000);
    check('Speicherhinweis verschwindet nicht von selbst',
      await vp.locator('.toast.aktion.speicher').count() === 1);
    await vctx.close();
  }

  group('Ein erfundenes Themenkuerzel sperrt die Notausgaenge nicht');
  /* Eine von Hand bearbeitete Sicherung kann 'sprache' statt 'spr' tragen. Die
     Ablage laesst das durch - sie weiss nichts ueber Themen. Vorher warf der
     Einstellungsbildschirm daran, und genau dort liegen die drei Notausgaenge:
     Einlesen, Rueckgaengig, Alles zuruecksetzen. Wer den Fehler einmal hatte,
     kam mit Bordmitteln nie wieder heraus. */
  {
    const kctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const kp = horche(await kctx.newPage());
    await kp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await kp.waitForSelector('[data-go="daily"]');
    await kp.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.settings = { ...(st.settings || {}), cats: ['geo', 'sprache'], focus: ['sprache'] };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await kp.reload({ waitUntil: 'networkidle' });
    await kp.click('[data-view="settings"]');
    await kp.waitForTimeout(400);
    check('Einstellungen oeffnen sich trotz erfundenem Kuerzel',
      await kp.locator('#npd').count() === 1);
    for (const [id, was] of [['imp', 'Fortschritt einlesen'], ['rst', 'Alles zuruecksetzen']]) {
      check(`Notausgang „${was}" ist da`, await kp.locator('#' + id).count() === 1);
    }
    const text = await kp.locator('body').innerText();
    check('kein erfundenes Kuerzel wird als wirksam ausgegeben', !text.includes('sprache'));
    /* Die Kehrseite: steht NUR ein erfundenes Kuerzel im Umfang, darf die
       Startseite nicht wortlos „alles erledigt" melden. */
    await kp.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k) || '{}');
      st.settings = { ...(st.settings || {}), cats: ['sprache'], focus: null };
      localStorage.setItem(k, JSON.stringify(st));
    }, KEY);
    await kp.reload({ waitUntil: 'networkidle' });
    await kp.waitForSelector('.hero');
    const heute = await kp.locator('body').innerText();
    check('die Startseite hat weiter etwas zu tun', !/alles erledigt/i.test(heute),
      heute.slice(0, 120).replace(/\n+/g, ' · '));
    await kctx.close();
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
    const kp = horche(await kctx.newPage());
    await kp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await kp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await kp.waitForSelector('.sess-body');
    await kp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
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

  group('Quizrunde: Punkte, Uhr, Ergebnisbild, Rueckfluss in den Plan');
  /* Der Pruefstand der App: zwoelf Fragen quer durch alle Themen, Punkte fuer
     Treffer und Tempo, am Ende die Frage, wo die Punkte blieben. Die Uhr wird
     gestellt (page.clock), damit eine abgelaufene Frage keine fuenfzehn echten
     Sekunden kostet - und damit der Test die Formel wirklich nachrechnet statt
     nur zu schauen, ob irgendeine Zahl erscheint. */
  {
    const qctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const qp = horche(await qctx.newPage());
    await qp.clock.install();
    await qp.goto(URL_BASE, { waitUntil: 'networkidle' });
    check('der Reiter heisst Quiz', /Quiz/.test(await qp.locator('.nav-btn[data-view="duel"]').innerText()));
    await qp.locator('.nav-btn[data-view="duel"]').click();
    await qp.waitForSelector('#quizGo');
    check('ohne Runde gibt es keinen Bestwert', /^0 \//.test(await qp.locator('#quizBest').innerText()),
      await qp.locator('#quizBest').innerText());
    await qp.locator('#quizGo').click();
    await qp.waitForSelector('.opt');
    await qp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    check('der Punktestand steht ueber der Frage', (await qp.locator('#quizStand').innerText()) === '0');
    check('die Blitz-Pille ist zu Beginn sichtbar', !/\baus\b/.test(await qp.locator('#blitz').getAttribute('class')));

    const frageText = () => qp.locator('h1.q').innerText();
    /* Die richtige Antwort kennt nur die Sammlung. Gesucht wird die Karte mit
       diesem Fragetext, deren Antwort auch unter den Knoepfen steht - falls
       zwei Themen dieselbe Frage tragen. */
    const antworte = async (richtig) => {
      const frage = await frageText();
      const werte = await qp.locator('.opt:not([disabled])').evaluateAll(bs => bs.map(b => b.dataset.v));
      const karte = CARDS.find(c => c.q === frage && werte.includes(c.a));
      if (!karte) throw new Error(`Karte nicht gefunden: ${frage}`);
      const wert = richtig ? karte.a : werte.find(v => v !== karte.a);
      await qp.locator(`.opt[data-v="${wert.replace(/"/g, '\\"')}"]`).click();
      return karte;
    };
    const urteil = async () => { await qp.waitForSelector('.verdict'); return qp.locator('.verdict').innerText(); };
    const weiter = async () => {
      await qp.waitForSelector('#next');
      await qp.waitForTimeout(FUSS_TAUB);
      await qp.locator('#next').click();
      await qp.waitForSelector('.opt:not([disabled]), #quizPunkte');
      await qp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    };

    // 1: richtig und schnell -> 15
    const erste = await antworte(true);
    check('ein schneller Treffer bringt 15 Punkte', /\+15/.test(await urteil()), await urteil());
    await weiter();
    check('der Punktestand zaehlt mit', (await qp.locator('#quizStand').innerText()) === '15');
    // 2: die Uhr laeuft ab -> zu langsam, 0
    const zweiteFrage = await frageText();
    const langsam = CARDS.find(c => c.q === zweiteFrage);
    await qp.clock.runFor(16000);
    const abgelaufen = await urteil();
    check('eine abgelaufene Frage heisst so und bringt nichts',
      /abgelaufen/.test(abgelaufen) && /0 Punkte/.test(abgelaufen), abgelaufen);
    await weiter();
    // 3: falsch -> 0
    const falsch = await antworte(false);
    check('ein Fehlgriff bringt nichts', /0 Punkte/.test(await urteil()), await urteil());
    await weiter();
    // 4: richtig, aber nach der Blitzfrist -> 10
    await qp.clock.runFor(6000);
    await qp.waitForTimeout(200);
    check('die Blitz-Pille verblasst nach fuenf Sekunden', /\baus\b/.test(await qp.locator('#blitz').getAttribute('class')));
    await antworte(true);
    check('ein Treffer nach der Frist bringt 10 Punkte', /\+10/.test(await urteil()), await urteil());
    await weiter();
    // 5 bis 12: richtig und schnell
    for (let i = 4; i < 12; i++) { await antworte(true); await weiter(); }

    await qp.waitForSelector('#quizPunkte');
    const punkte = (await qp.locator('#quizPunkte').innerText()).replace(/\s+/g, ' ');
    check('das Ergebnisbild rechnet 15 + 0 + 0 + 10 + 8 x 15 = 145 von 180',
      /^145\s*\/\s*180$/.test(punkte), punkte);
    const verlust = (await qp.locator('#quizVerlust').innerText()).replace(/\s+/g, ' ');
    check('die Verluste stehen getrennt nach falsch, zu langsam und ohne Blitz',
      /15 falsch/.test(verlust) && /15 zu langsam/.test(verlust) && /5 ohne Blitz/.test(verlust), verlust);
    const pcts = await qp.locator('#quizFelder .pct').allInnerTexts();
    const verloren = pcts.map(t => { const [p, m] = t.split('/').map(Number); return m - p; });
    check('jedes der neun Themen hat eine Zeile', pcts.length === 9, pcts.join(' '));
    check('die Themen stehen nach verlorenen Punkten sortiert',
      verloren.every((v, i) => i === 0 || v <= verloren[i - 1]), pcts.join(' '));
    const felder = await qp.locator('#quizFelder').innerText();
    check('die Marken nennen falsch und zu langsam', /1 falsch/.test(felder) && /1 zu langsam/.test(felder));
    check('die verfehlten Karten stehen hinter einem Griff',
      (await qp.locator('[data-merk]').count()) === 2, String(await qp.locator('[data-merk]').count()));
    const obersteZeile = await qp.locator('#quizFelder .quiz-feld').first().getAttribute('data-cat');
    check('das Ergebnisbild bietet das Thema mit dem groessten Verlust zum Nachlegen an',
      (await qp.locator('#quizNachlegen').getAttribute('data-cat')) === obersteZeile, String(obersteZeile));

    await qp.waitForTimeout(600);              // Speichern ist gebuendelt
    const st = await qp.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    const r = (st.quizRunden || [])[0] || {};
    check('die Runde ist gespeichert', st.quizRunden?.length === 1 && r.p === 145 && r.m === 180 && r.l === 1 && r.f === 1 && r.r === 10,
      JSON.stringify(st.quizRunden));
    check('der Bestwert steht', st.quizBest === 145, String(st.quizBest));
    const tag = Object.keys(st.days || {})[0] || '';
    const [y, mo, d] = tag.split('-').map(Number);
    const heute = Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
    const zustand = (c) => st.cards?.[c.id];
    check('die abgelaufene Karte ist heute faellig, obwohl sie nie gelernt war',
      zustand(langsam) && zustand(langsam).seen >= 1 && zustand(langsam).due <= heute, JSON.stringify(zustand(langsam)));
    check('die falsche Karte ebenso', zustand(falsch) && zustand(falsch).seen >= 1 && zustand(falsch).due <= heute,
      JSON.stringify(zustand(falsch)));
    check('ein Treffer im Quiz benotet die Karte nicht', !zustand(erste), JSON.stringify(zustand(erste)));
    check('Quizantworten zaehlen als Zeit unter Druck, nicht als Tagestraining',
      (st.days[tag]?.duel || 0) === 12 && (st.days[tag]?.done || 0) === 0 && (st.totalAnswers || 0) === 0,
      JSON.stringify(st.days[tag]));

    await qp.locator('#again').click();
    await qp.waitForSelector('.opt');
    await qp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    check('„Noch eine Runde" startet wieder ein Quiz', (await qp.locator('#quizStand').count()) === 1);
    await qp.locator('#quit').click();
    await qp.waitForSelector('.hero');
    await qp.locator('.nav-btn[data-view="duel"]').click();
    await qp.waitForSelector('#quizBest');
    check('der Startbildschirm zeigt den Bestwert', /^145 \//.test(await qp.locator('#quizBest').innerText()),
      await qp.locator('#quizBest').innerText());
    check('der Startbildschirm nennt das schwaechste Thema', /Punkte lässt du zuletzt in/.test(await qp.locator('.card').first().innerText()));
    const katNach = await qp.locator('#quizNachlegen').getAttribute('data-cat');
    await qp.locator('#quizNachlegen').click();
    await qp.waitForSelector('.opt');
    await qp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    check('„im Duell nachlegen" startet ein Duell genau in diesem Thema',
      (await qp.locator('#quizStand').count()) === 0
        && (await qp.locator('.qcat').first().innerText()).includes(CAT_BY_ID[katNach].name),
      `${katNach}: ${await qp.locator('.qcat').first().innerText()}`);
    await qctx.close();
  }

  group('Quiz: der Blitzbonus zaehlt nur sichtbare Zeit');
  /* Die Formel verspricht fuenf Sekunden SICHTBARER Zeit - ein Anruf darf den
     Bonus nicht kosten. Die Uhr wird gestellt und die Seite dabei versteckt:
     Sechs Sekunden im Hintergrund, und der Treffer danach muss noch Blitz sein.
     Dazu die zwei Zugaenglichkeitsbefunde: Wer nicht sieht, hoerte bei Ablauf
     „Falsch", und die verblasste Pille versprach im Baum weiter einen Bonus. */
  {
    const bctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const bp = horche(await bctx.newPage());
    await bp.clock.install();
    await bp.goto(URL_BASE, { waitUntil: 'networkidle' });
    await bp.locator('.nav-btn[data-view="duel"]').click();
    await bp.locator('#quizGo').click();
    await bp.waitForSelector('.opt');
    await bp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    const sichtbarkeit = (wert) => bp.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { get: () => v, configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => v === 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, wert);
    const antworte = async (richtig) => {
      const frage = await bp.locator('h1.q').innerText();
      const werte = await bp.locator('.opt:not([disabled])').evaluateAll(bs => bs.map(b => b.dataset.v));
      const karte = CARDS.find(c => c.q === frage && werte.includes(c.a));
      const wert = richtig ? karte.a : werte.find(v => v !== karte.a);
      await bp.locator(`.opt[data-v="${wert.replace(/"/g, '\\"')}"]`).click();
    };
    await sichtbarkeit('hidden');
    await bp.clock.runFor(6000);
    await sichtbarkeit('visible');
    await bp.waitForTimeout(250);
    check('nach sechs Sekunden im Hintergrund ist die Blitz-Pille noch da',
      !/\baus\b/.test(await bp.locator('#blitz').getAttribute('class')));
    await antworte(true);
    await bp.waitForSelector('.verdict');
    const urteil = await bp.locator('.verdict').innerText();
    check('und der Treffer danach ist noch ein Blitz', /\+15/.test(urteil) && /Blitz/.test(urteil), urteil);
    await bp.waitForTimeout(FUSS_TAUB);
    await bp.locator('#next').click();
    await bp.waitForSelector('.opt:not([disabled])');
    await bp.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    await bp.clock.runFor(16000);
    await bp.waitForSelector('.verdict');
    check('die Ansage sagt „Zeit abgelaufen", nicht „Falsch"',
      /abgelaufen/.test(await bp.locator('#live').innerText()) && !/^Falsch/.test(await bp.locator('#live').innerText()),
      await bp.locator('#live').innerText());
    check('die verblasste Pille ist aus dem Zugaenglichkeitsbaum',
      (await bp.locator('#blitz').getAttribute('aria-hidden')) === 'true');
    await bctx.close();
  }

  group('Quiz: Abbruch im Aufloesungsbildschirm laesst nichts Halbes zurueck');
  /* Gefunden von der Gegnerpruefung: Die Punkte wurden in finish() gebucht,
     alles Uebrige - Fehlerliste, Faelligstellung der Karte, Zaehler - erst in
     next(), also beim Tipp auf „Weiter". Der Beenden-Knopf bleibt im
     Aufloesungsbildschirm aber aktiv. Wer die letzte Frage verfehlte und dann X
     tippte, bekam ein Ergebnisbild mit vollen Punkten fuer zwoelf Antworten und
     dem Satz „Die Luecken stehen unten" - waehrend die Liste leer blieb und die
     Karte nie faellig gestellt wurde. Und jede abgebrochene Runde wurde als
     vollwertige abgelegt: {p:15, m:15} stand im Balkenverlauf neben 145/180. */
  {
    const actx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const ap = horche(await actx.newPage());
    await ap.clock.install();
    await ap.goto(URL_BASE, { waitUntil: 'networkidle' });
    await ap.locator('.nav-btn[data-view="duel"]').click();
    await ap.locator('#quizGo').click();
    await ap.waitForSelector('.opt');
    await ap.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz

    const antworte = async (richtig) => {
      const frage = await ap.locator('h1.q').innerText();
      const werte = await ap.locator('.opt:not([disabled])').evaluateAll(bs => bs.map(b => b.dataset.v));
      const karte = CARDS.find(c => c.q === frage && werte.includes(c.a));
      const wert = richtig ? karte.a : werte.find(v => v !== karte.a);
      await ap.locator(`.opt[data-v="${wert.replace(/"/g, '\\"')}"]`).click();
      return karte;
    };
    // Erste Frage sauber durchspielen, damit run.done > 0 ist und der Abbruch ueber endRun laeuft.
    await antworte(true);
    await ap.waitForSelector('#next');
    await ap.waitForTimeout(FUSS_TAUB);
    await ap.locator('#next').click();
    await ap.waitForSelector('.opt:not([disabled])');
    await ap.waitForTimeout(FUSS_TAUB);   // der Startknopf sperrt die erste Antwort kurz
    // Zweite Frage falsch - und dann NICHT „Weiter", sondern X.
    const verfehlt = await antworte(false);
    await ap.waitForSelector('#next');
    check('der Beenden-Knopf ist im Aufloesungsbildschirm erreichbar',
      await ap.locator('#quit').isVisible());
    await ap.locator('#quit').click();
    await ap.waitForSelector('#quizPunkte, .hero');

    const punkte = (await ap.locator('#quizPunkte').innerText()).replace(/\s+/g, ' ');
    check('das Ergebnisbild rechnet nur die zu Ende gebrachten Antworten',
      /^15\s*\/\s*15$/.test(punkte), punkte);
    const verlust = (await ap.locator('#quizVerlust').innerText()).replace(/\s+/g, ' ');
    check('es behauptet keinen Verlust, den es nicht auflisten kann',
      /0 falsch/.test(verlust) && /0 zu langsam/.test(verlust), verlust);
    check('und verspricht keine Fehlerliste, die leer waere',
      (await ap.locator('[data-merk]').count()) === 0);

    await ap.waitForTimeout(600);
    const st = await ap.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    check('eine abgebrochene Runde wandert nicht in die Wertung',
      (st.quizRunden || []).length === 0, JSON.stringify(st.quizRunden));
    check('und setzt keinen Bestwert', (st.quizBest || 0) === 0, String(st.quizBest));
    check('die verworfene Antwort stellt auch keine Karte faellig',
      !st.cards?.[verfehlt.id], JSON.stringify(st.cards?.[verfehlt.id]));
    const tag = Object.values(st.days || {})[0] || {};
    check('und zaehlt genau die eine Antwort, die zu Ende gebracht wurde',
      (tag.duel || 0) === 1, JSON.stringify(tag));
    await actx.close();
  }

  group('Kein Balken ueber den Antwortknoepfen');
  {
    /* Drei Wege, auf denen ein Tipp etwas anderes tat als angezeigt. Bei einem
       Lernprogramm ist das nicht nur Aerger: Die Karte wird falsch gebucht. */
    const bctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE', serviceWorkers: 'block' });
    const bp = horche(await bctx.newPage());
    await bp.goto(URL_BASE, { waitUntil: 'load' });
    await bp.waitForSelector('#app:not([hidden])');

    // Einen Aktionsbalken herstellen, wie ihn das Update-Angebot erzeugt.
    const balkenBauen = () => bp.evaluate(() => {
      document.querySelector('.toast.aktion:not(.speicher)')?.remove();
      const d = document.createElement('div');
      d.className = 'toast aktion';
      d.innerHTML = '<span>Neue Fassung bereit</span>';
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Laden';
      d.appendChild(b);
      document.body.appendChild(d);
    });

    await balkenBauen();
    await bp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await bp.waitForSelector('.sess-body');
    await bp.waitForTimeout(FUSS_TAUB);
    check('ein stehendes Update-Angebot wird beim Start der Runde weggeraeumt',
      await bp.locator('.toast.aktion:not(.speicher)').count() === 0);

    /* Der Balken sass fest auf Hoehe der unteren Leiste – gerechnet fuer
       Bildschirme MIT Leiste. Waehrend einer Runde ist sie ausgeblendet und der
       Fuss traegt die Notenknoepfe; derselbe Abstand legte den „Sichern"-Knopf
       des Speicherhinweises dann ueber „Gut", und der nimmt Tipper an.
       Geprueft wird der Mechanismus, nicht eine Pixelzahl: Waehrend einer Runde
       traegt das Wurzelelement die Bodenhoehe, danach nicht mehr. Gemessen hat
       der Fund 50 px Unterschied ergeben. */
    const toastB = (wo) => bp.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--toast-b').trim());
    check('waehrend einer Runde rueckt der Hinweisbalken vom Fuss weg',
      (await toastB()) !== '', `--toast-b: „${await toastB()}"`);
    await bp.evaluate(() => document.querySelector('.toast.aktion')?.remove());
    await bp.click('#quit');
    await bp.waitForSelector('.done-wrap, .hero');
    check('nach der Runde sitzt er wieder ueber der unteren Leiste',
      (await toastB()) === '', `--toast-b: „${await toastB()}"`);
    await bctx.close();
  }

  group('Die Karte bleibt nach dem Aufdecken ganz zu sehen');
  {
    const cctx = await browser.newContext({ ...devices['iPhone SE'], locale: 'de-DE', serviceWorkers: 'block' });
    const cp = horche(await cctx.newPage());
    /* „Immer frei" erzwingen: Ohne das haengt es vom Lernstand ab, ob ueberhaupt
       eine Karte mit freier Eingabe kommt – und ein Zweig, der bei „keine
       gefunden" bestanden meldet, ist genau die Behauptung, die nichts prueft. */
    await cp.addInitScript((k) => localStorage.setItem(k,
      JSON.stringify({ rev: 1, settings: { recallMode: 'recall' } })), KEY);
    await cp.goto(URL_BASE, { waitUntil: 'load' });
    await cp.waitForSelector('#app:not([hidden])');
    await cp.getByRole('button', { name: /Tagestraining|Extra-Runde/ }).click();
    await cp.waitForSelector('.sess-body');
    await cp.waitForTimeout(FUSS_TAUB);

    /* Nach dem Aufdecken wuchs der Inhalt ueber das Sichtfenster. Die Karte war
       ein schrumpfbares Flex-Kind, fiel unter ihre Inhaltshoehe und schob – weil
       sie mittig ausrichtet – die Haelfte des Ueberhangs nach OBEN aus dem Bild.
       Themenzeile, „neu"-Marke und der Anfang der Frage waren weg, und kein
       Scrollen brachte sie zurueck. */
    /* Bei freier Eingabe kommt zuerst die Selbsteinschaetzung, dann die Loesung. */
    check('mit „Immer frei" kommt auch wirklich eine Karte zum freien Abrufen',
      await cp.locator('[data-hab]').count() === 2);
    await cp.locator('[data-hab="1"]').click();
    await cp.waitForSelector('[data-g]');
    /* Der Ueberlauf wird erzwungen statt erhofft: Ob ein Kartentext lang genug
       ist, haengt an der gezogenen Karte – und ein Test, der bei kurzem Text
       stillschweigend besteht, prueft nichts. Eingesetzt wird derselbe Aufbau,
       den eine Karte mit langer Antwort und langem Kontext erzeugt. */
    const mass = await cp.evaluate(() => {
      const k = document.querySelector('.qcard');
      const p = document.createElement('p');
      p.className = 'expl';
      p.textContent = 'Kontext. '.repeat(120);
      k.appendChild(p);
      return { kasten: Math.round(k.getBoundingClientRect().height), inhalt: k.scrollHeight };
    });
    /* Gemessen vorher: Kasten 364 px, Inhalt 872 px – die Karte war ein
       schrumpfbares Flex-Kind und fiel unter ihre Inhaltshoehe. Mittig
       ausgerichtet schob sie die Haelfte des Ueberhangs nach oben aus dem Bild;
       Themenzeile und Anfang der Frage waren weg und kein Scrollen brachte sie
       zurueck. Nachher: 1.373 zu 1.390. */
    check('die Karte behaelt nach dem Aufdecken ihre volle Hoehe',
      mass.kasten + 24 >= mass.inhalt, `Kasten ${mass.kasten} px, Inhalt ${mass.inhalt} px`);
    await cctx.close();
  }

  group('Ueberschriften und Tippflaechen');
  /* Zwei Dinge, die auf einem Telefon zaehlen:

     Die Ueberschriftenfolge. Wer mit VoiceOver von Ueberschrift zu Ueberschrift
     springt, liest die Gliederung - ein Sprung von h1 auf h3 heisst dort
     „hier fehlt etwas". Die Abschnittsmarke .sec ist genau deshalb ein h2
     (siehe app.css); auf der Themenseite gab es keine, und die Themen standen
     als h3 direkt unter der Seitenueberschrift.

     Die Tippflaechen. Apple nennt 44x44 Punkte als Mindestmass. Gemessen ueber
     alle Hauptansichten: keine einzige darunter - das soll so bleiben. */
  {
    const uctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
    const up = horche(await uctx.newPage());
    await up.goto(URL_BASE, { waitUntil: 'networkidle' });
    await up.evaluate(async () => {
      const daten = await import('/data/index.js');
      const store = await import('/assets/js/store.js');
      const srs = await import('/assets/js/srs.js');
      const heute = store.todayNum();
      for (let i = 0; i < 120; i++) {
        store.putCard(daten.CARDS[i].id, { ...srs.fresh(), seen: 6, ok: 5, reps: 3, iv: 10,
          due: heute - 1, last: Date.now() });
      }
      for (let d = 0; d < 12; d++) {
        store.S().days[store.numToKey(heute - d)] = { done: 18, correct: 14, newC: 5, sec: 400 };
      }
      store.save(true);
    });
    await up.reload({ waitUntil: 'networkidle' });
    /* Erst messen, wenn die Schrift steht: Bis der Webfont getauscht ist,
       fallen Zeilenhoehen und damit Knopfhoehen um Bruchteile kleiner aus - die
       Zeitchips lagen dann bei 43,99 statt 44 px und die Pruefung meldete einen
       Fehler, den es nach dem naechsten Bild nicht mehr gab. */
    const pruefe = async () => {
      await up.evaluate(() => document.fonts && document.fonts.ready);
      await up.waitForTimeout(150);
      return up.evaluate(() => {
      const sichtbar = (el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
      };
      const folge = [...document.querySelectorAll('h1, h2, h3, h4')]
        .filter(h => getComputedStyle(h).display !== 'none').map(h => Number(h.tagName[1]));
      const spruenge = [];
      for (let i = 1; i < folge.length; i++) if (folge[i] > folge[i - 1] + 1) spruenge.push(`${folge[i - 1]}->${folge[i]}`);
      const klein = [];
      /* Ein halbes Pixel Nachsicht. Der Bildschirm rechnet in Dritteln eines
         CSS-Pixels, und aus min-height:44px wird dabei 43,999999999 - die
         Pruefung meldete daraufhin „99,313 x 44,000" als zu klein. Ein halbes
         Pixel ist auf keinem Daumen zu spueren; was wirklich zu klein ist,
         ist es um mehrere. */
      const MASS = 43.5;
      for (const el of document.querySelectorAll('button, a[href], select, input, [role="button"]')) {
        if (el.hidden || el.disabled || !sichtbar(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < MASS || r.height < MASS) {
          klein.push(`${r.width.toFixed(1)}x${r.height.toFixed(1)} ${(el.id || el.className || el.tagName)}`);
        }
      }
      return { folge: folge.join(''), spruenge, klein };
      });
    };
    for (const [name, hin] of [
      ['Heute', async () => { await up.click('[data-view="home"]'); await up.waitForSelector('.hero'); }],
      ['Themen', async () => { await up.click('[data-view="topics"]'); await up.waitForSelector('.trow'); }],
      ['Quiz', async () => { await up.click('[data-view="duel"]'); await up.waitForTimeout(300); }],
      ['Statistik', async () => { await up.click('[data-view="stats"]'); await up.waitForSelector('.heat'); }],
      ['Mehr', async () => { await up.click('[data-view="settings"]'); await up.waitForSelector('#npd'); }],
    ]) {
      await hin();
      const r = await pruefe();
      check(`${name}: die Ueberschriften steigen ohne Sprung`, r.spruenge.length === 0,
        `Folge ${r.folge}, Spruenge ${r.spruenge.join(', ')}`);
      check(`${name}: jede Tippflaeche ist mindestens 44x44`, r.klein.length === 0,
        r.klein.slice(0, 4).join(' | '));
    }
    await uctx.close();
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

/* Ein Boden unter der Zahl der Pruefungen. Ohne ihn kann die halbe Datei
   ausfallen – ein umbenannter Waehler, ein frueh abgebrochener Abschnitt –,
   ohne dass irgendetwas rot wird: passed sinkt einfach. Die Zahl steht auch im
   README und wird dort geprueft; hier ist sie die Untergrenze. */
const MINDESTENS = 234;
if (passed + failed < MINDESTENS) {
  failed++;
  console.error(`\nNur ${passed + failed} von mindestens ${MINDESTENS} Prüfungen gelaufen – `
    + 'ein Abschnitt ist ausgefallen, ohne zu scheitern.');
}

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);

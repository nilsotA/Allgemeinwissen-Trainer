/* Erzeugt die App-Icons. Das „W" wird in derselben Antiqua gesetzt, die auch in
   der App das Markenzeichen traegt – deshalb rendert Chromium (ueber Playwright)
   und nicht eine handgebaute Strichkonstruktion: Die hatte runde Enden und sah
   nach Filzstift aus statt nach Schrift.

   Playwright ist wie beim Durchlauftest optional. Fehlt es, bleiben die
   eingecheckten Icons unveraendert – Netlify ruft dieses Skript ohnehin nicht auf. */
import { mkdirSync, writeFileSync } from 'node:fs';

let playwright;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
  try { playwright = await import(p); break; } catch { /* naechsten Pfad probieren */ }
}
if (!playwright) {
  console.error('Playwright nicht gefunden – Icons bleiben, wie sie sind. (npm i -D playwright)');
  process.exit(0);
}

const GRUND1 = '#c65e18';
const GRUND2 = '#863007';
const SCHRIFT = '#fff8f1';
const SERIF = 'ui-serif, "New York", Georgia, "Iowan Old Style", "Times New Roman", serif';

/* radius: Anteil der Kantenlaenge. inset: freier Rand fuer maskierbare Icons,
   damit Android beliebig beschneiden kann, ohne den Buchstaben anzuschneiden. */
const seite = (size, { radius = 0.225, inset = 0 } = {}) => `
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:transparent}
  .box{width:${size}px;height:${size}px;display:grid;place-items:center;
    border-radius:${size * radius}px;
    background:linear-gradient(150deg, ${GRUND1}, ${GRUND2});}
  .w{font-family:${SERIF};font-weight:600;color:${SCHRIFT};
    font-size:${size * (1 - 2 * inset) * 0.66}px;line-height:1;
    /* Optischer Ausgleich: die Grundlinie sitzt sonst zu tief im Quadrat. */
    transform:translateY(${size * 0.022}px);
    -webkit-font-smoothing:antialiased}
</style>
<div class="box"><span class="w">W</span></div>`;

const { chromium } = playwright;
const browser = await chromium.launch();
mkdirSync('icons', { recursive: true });

const dateien = [
  ['icons/icon-192.png', 192, {}],
  ['icons/icon-512.png', 512, {}],
  ['icons/icon-180.png', 180, { radius: 0 }],                  // iOS rundet selbst
  ['icons/icon-512-maskable.png', 512, { radius: 0, inset: 0.1 }],
  ['icons/favicon-32.png', 32, { radius: 0.2 }],
];

for (const [name, size, opt] of dateien) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(seite(size, opt), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const daten = await page.locator('.box').screenshot({ omitBackground: true });
  writeFileSync(name, daten);
  await page.close();
  console.log(name, daten.length, 'Bytes');
}
await browser.close();

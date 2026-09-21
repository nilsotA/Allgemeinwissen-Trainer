/* Optional: welche Wege der App ein Browserlauf ueberhaupt betritt.

   Mit ABDECKUNG=1 haengt sich der Lauf an die V8-Abdeckung jeder Seite in jedem
   Kontext und legt die Rohdaten ab; `npm run wege` wertet sie aus. Ohne die
   Umgebungsvariable passiert nichts - die Laeufe sollen nicht langsamer werden,
   nur weil die Messung einmal gebraucht wurde.

   Warum ueberhaupt: Der Boden unter der Pruefungszahl faengt Abschnitte ab, die
   AUSFALLEN. Er sagt nichts ueber Wege, die NIE JEMAND GEGANGEN ist. Die erste
   Messung fand 48 kalte Funktionen, 23 davon in app.js - und in zweien davon
   steckte je ein Fehler.

   Beide Browserlaeufe benutzen dieselbe Sonde, und das ist keine Sparsamkeit:
   Die erste Messung lief nur ueber tests/e2e.mjs und meldete den Update-Balken
   als ungeprueft. Er ist es nicht - tests/offline.mjs klickt ihn durch, dort
   braucht er einen zweiten Service Worker. Eine Messung, die nur die Haelfte
   der Pruefwerke kennt, macht aus „woanders geprueft" ein „ungeprueft". */
export function hefteAn(browser) {
  const aktiv = process.env.ABDECKUNG === '1';
  const daten = [];
  if (!aktiv) return { aktiv, daten, ernteAlles: async () => {}, schreibe: async () => {} };

  const offen = new Set();
  const ernten = async (p) => {
    if (!offen.has(p)) return;
    offen.delete(p);
    try { daten.push(...await p.coverage.stopJSCoverage()); } catch { /* nicht messbar */ }
  };
  const alterKontext = browser.newContext.bind(browser);
  browser.newContext = async (...a) => {
    const c = await alterKontext(...a);
    const alteSeite = c.newPage.bind(c);
    c.newPage = async (...b) => {
      const p = await alteSeite(...b);
      try { await p.coverage.startJSCoverage({ resetOnNavigation: false }); offen.add(p); } catch { /* nicht messbar */ }
      const altesSchliessen = p.close.bind(p);
      p.close = async (...z) => { await ernten(p); return altesSchliessen(...z); };
      return p;
    };
    const altesKontextSchliessen = c.close.bind(c);
    c.close = async (...z) => {
      for (const p of [...offen]) if (!p.isClosed()) await ernten(p);
      return altesKontextSchliessen(...z);
    };
    return c;
  };
  return {
    aktiv, daten,
    ernteAlles: async () => { for (const p of [...offen]) if (!p.isClosed()) await ernten(p); },
    schreibe: async (datei) => {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(datei, JSON.stringify(daten));
      console.log(`\nAbdeckung: ${daten.length} Einträge in ${datei} – auswerten mit npm run wege`);
    },
  };
}

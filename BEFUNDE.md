# Offene Befunde aus der Fehlerjagd

Ergebnis einer adversarialen Fehlersuche über den gesamten App-Code (sechs
Perspektiven, jeder Fund von zwei Skeptikern gegengeprüft, die meisten
nachgestellt). **25 bestätigte Fehler**, 3 verworfen, 1 strittig.

Diese Datei liegt bewusst im Repository und nicht im Arbeitsverzeichnis: Die
Sitzung läuft in einem flüchtigen Container, `/tmp` überlebt keinen Neustart.
Erledigte Zeilen werden gestrichen, die Datei verschwindet, wenn die Liste leer
ist. Die Begründungen zu behobenen Fehlern stehen dann in der README.

## Behoben

- [x] **hoch** `store.js` – Fassungsnummer stieg vor dem Schreiben; nach einem
  Fehlschlag überschrieb der Tab die Arbeit des anderen ungeprüft
- [x] **hoch** `store.js` – Speicherhinweis kam nach dem Sichern nie wieder
- [x] **hoch** `quiz.js` – Tausenderpunkt: richtige Zahl ohne Punkt galt als falsch
- [x] **hoch** `quiz.js` – „durch", „mal", „wurzel" galten immer als Rechenzeichen
- [x] **hoch** `session.js` – „Thema im Duell" war bei pausiertem Thema tot
- [x] **hoch** `app.js` – Doppeltipp beantwortete die nächste, ungelesene Karte
- [x] **mittel** `session.js` – jedes Duell begann mit denselben drei Fragen

## Offen

### hoch
- [ ] `session.js:10` – nach dem Einlesen einer Sicherung verlieren umformulierte
  Karten ihren Stand: `uebernimmVorgaenger()` läuft einmal beim Modulstart, also
  vor dem Import. 16 Karten mit früherer Fragefassung fallen auf null zurück.
- [ ] `sw.js:99` – der fetch-Handler liest das Gerüst unter `./index.html`,
  schreibt es aber unter der Anfrage-URL. Eine Lücke bei `index.html` heilt nie,
  offline erscheint die nackte Zeile „Offline" statt der App.
- [ ] `check-content.mjs:324` – ein Vorgängertext `p` darf auf eine noch lebende
  Karte zeigen; keine Prüfung schlägt an, der Lernstand der lebenden Karte wird
  beim Start gelöscht.
- [ ] `merge-cards.mjs:39` – Zeilenumbrüche werden nicht escapt; eine Karte mit
  Umbruch macht `data/*.js` syntaktisch kaputt (weiße Seite).

### mittel
- [ ] `store.js:121` – Markierungen lassen sich bei zwei offenen Tabs nicht
  löschen: Das Zusammenführen kennt bei `flags` nur Wachstum.
- [ ] `store.js:122` – eine abgerissene Serie wird vom zweiten Tab wieder auf den
  alten Wert gehoben (`streak` steht in der Maximum-Liste, obwohl
  `touchStreak()` ihn bewusst auf 1 zurücksetzt).
- [ ] `store.js:125` – `claims`, `claimsMiss`, `factIdx`, `factSeen` fallen beim
  Zusammenführen auf den Stand des schreibenden Tabs zurück.
- [ ] `store.js:111` + `srs.js:111` – `nachDuellFehler()` setzt `last` nicht, die
  Intervall-Deckelung überlebt das Zusammenführen deshalb nicht.
- [ ] `store.js:388` – eine nur markierte, nie gelernte Karte verliert beim
  Umformulieren ihre Markierung.
- [ ] `quiz.js:86` – `normalize()` kennt nur einen Teil der diakritischen
  Zeichen; sieben Karten geben für die deutsche Tastaturschreibweise kein Häkchen.
- [ ] `app.js:1162` – „Weitermachen" nach einer Themenrunde wechselt still das
  Thema (gilt auch für Wackelkandidaten und Markierte).
- [ ] `app.js:1673` – `hatteWorker` wird einmal beim Start festgehalten; in der
  ersten Sitzung bewirkt „Laden" nichts, der alte Bestand ist trotzdem gelöscht.
- [ ] `app.js:1729` – der Balken hält eine feste Worker-Referenz; nach einer
  zweiten Veröffentlichung verpufft „Laden".
- [ ] `app.js:1222` – eine ohne Antwort abgebrochene Runde geht über `show()`
  statt `endRun()`; ein zurückgehaltenes Update-Angebot wird nicht nachgeholt.

### niedrig
- [ ] `quiz.js:106` – `ZAHLWOERTER` ist ein Objektliteral; die Eingabe
  „constructor" liefert Quelltext statt Text.
- [ ] `app.js:142` – ein zweiter Tab löscht den Rückblick nach der Runde.
- [ ] `app.js:1676` – der `controllerchange`-Handler lädt ohne Rücksicht auf eine
  laufende Runde neu.

## Verworfen (von den Skeptikern widerlegt)

- Ein Tag mit nur Duellfragen stehe im Wochenstreifen als „nichts gelernt"
- Getippter Bindestrich statt Gedankenstrich mache die Antwort falsch
- Fehlende Felder im Ergebnis-JSON rutschten als Text „undefined" durch

## Strittig (eine Stimme dafür, eine dagegen)

- `merge-cards.mjs:25` – ein ausdrückliches Feld `cat` werde ignoriert, sobald
  das Teilgebiet eindeutig ist

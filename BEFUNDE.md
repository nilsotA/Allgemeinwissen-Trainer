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
- [x] **hoch** `session.js` – nach dem Einlesen einer Sicherung fielen umformulierte
  Karten auf null zurück
- [x] **hoch** `sw.js` – eine Lücke beim Geruest heilte nie, offline kam „Offline"
- [x] **hoch** `check-content.mjs` – ein `p` durfte auf eine lebende Karte zeigen
- [x] **hoch** `merge-cards.mjs` – Zeilenumbrüche machten `data/*.js` kaputt
- [x] **mittel** `store.js` – Markierungen ließen sich mit zwei Tabs nicht löschen
- [x] **mittel** `store.js` – eine abgerissene Serie wurde vom zweiten Tab aufgeblasen
- [x] **mittel** `store.js` – `claims`, `claimsMiss`, `factIdx`, `factSeen` gingen verloren
- [x] **mittel** `srs.js` – die Duell-Deckelung überlebte das Zusammenführen nicht
- [x] **mittel** `store.js` – eine nur markierte Karte verlor beim Umformulieren ihren Stern
- [x] **mittel** `quiz.js` – í, ø, ř und ć zerrissen das Wort; sieben Karten waren
  mit deutschem Tastenfeld nicht lösbar
- [x] **mittel** `app.js` – „Weitermachen" wechselte still das Thema
- [x] **mittel** `app.js` – in der ersten Sitzung bewirkte „Laden" nichts
- [x] **mittel** `app.js` – nach einer zweiten Veröffentlichung verpuffte „Laden"
- [x] **mittel** `app.js` – eine abgebrochene Runde holte das Angebot nicht nach

## Offen

### hoch
(keine mehr)

### mittel
(keine mehr)

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

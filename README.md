# Wissenswerk

Ein Allgemeinwissen-Trainer als Web-App fürs iPhone. Statisch, offline-fähig, ohne Konto –
alles läuft im Browser, der Lernfortschritt bleibt auf dem Gerät.

**1.477 Karten** in neun Themen, aufgebaut in drei Stufen: Basis (Schulwissen Klasse 5–8),
Solide (gute Allgemeinbildung), Profi (das, was Quizduelle entscheidet).
Schwerpunkte liegen auf **Sport** (Trainingslehre, Anatomie, Sportbiologie, Biomechanik,
Sportpsychologie) und **Mathematik** (Grundlagen, Schulmathematik, Mathematikgeschichte) –
in beiden Fächern reicht die Sammlung bewusst über das hinaus, was als Allgemeinwissen
durchgeht: Energiebereitstellung und Muskelfasertypen ebenso wie Kongruenzsätze, p-q-Formel,
Logarithmusgesetze und vollständige Induktion.

## Warum die App so gebaut ist

Der Aufbau folgt dem, was in der Lernforschung am zuverlässigsten wirkt:

| Prinzip | Umsetzung |
|---|---|
| **Verteiltes Lernen** (spacing) | SM-2-Scheduler: Wiederholung genau dann, wenn du kurz vor dem Vergessen stehst. Intervalle wachsen 1 → 3 → 7 → 20 → 60 Tage. |
| **Aktives Abrufen** (retrieval practice) | Erst Multiple Choice zum Erkennen, ab der dritten Wiederholung freies Abrufen mit Selbstbewertung – Abrufen prägt stärker ein als Wiederlesen. |
| **Verschränken** (interleaving) | Das Tagestraining mischt Themen, statt ein Gebiet am Stück zu pauken, und verteilt neue Karten gleichmäßig über die Einheit. |
| **Elaboration** | Jede Karte liefert nach der Antwort einen Kontext, eine Eselsbrücke oder eine Einordnung – Wissen hält, wenn es andocken kann. |
| **Schwierigkeits-Leiter** | Neue Karten kommen standardmäßig leicht zuerst, damit Grundlagenlücken zuerst schließen. |
| **Sofortige Rückmeldung** | Richtig/falsch plus Erklärung direkt nach der Antwort. |
| **Kleine tägliche Dosis** | Standard: 12 neue Karten pro Tag. Das sind rund 9 Minuten – dauerhaft durchhaltbar. |
| **Bremse gegen den Rückstau** | Stauen sich die Wiederholungen, pausieren neue Karten von selbst, bis der Berg wieder kleiner ist. Ohne die Bremse wuchs der Rückstand nach zwei Pausen von je zwei Wochen auf über 800 Karten. |

Eine Simulation über 180 Tage (`npm run simulate`) ergibt: im Schnitt 91 Karten pro Tag,
Spitzenlast 102, rund 11 Minuten täglich. Nach einem halben Jahr sitzen etwa 1.160 der 1.477
Karten fest. Der Deckel für Wiederholungen sorgt dafür, dass die Tageslast nicht mit dem
Kartenbestand mitwächst.

### Was bewusst *nicht* drin ist

- **Terminglättung.** Die Idee, Wiederholungen auf den am wenigsten belasteten Tag im
  Streuungsfenster zu legen, wurde getestet und wieder verworfen: Der Deckel fängt die
  Spitzen bereits ab, und ein breiteres Fenster verschlechtert die Termintreue, ohne die
  Streuung messbar zu senken.
- **Tägliche Push-Erinnerung.** Web-Push bräuchte einen Server. Eine iOS-Kurzbefehl-
  Automation oder ein Wecker erledigt dasselbe ohne Infrastruktur.

## Modi

- **Tagestraining** – fällige Wiederholungen plus neue Karten, thematisch verschränkt.
  Für unterwegs lässt sich eine kürzere Runde wählen (rund 3, 5 oder 10 Minuten).
- **Wackelkandidaten** – gezielt die Karten, die immer wieder umkippen.
- **Themen** – ein Gebiet am Stück üben.
- **Duell** – zehn Fragen, 15 Sekunden pro Frage. Trainiert Tempo für Quizduelle.
  Fehler landen automatisch im nächsten Tagestraining.
- **Markierte Karten** – was du beim Nachschlagen mit ★ versiehst, lässt sich gezielt üben.
- **Schwachstellen** – die Statistik zeigt die Teilgebiete mit der schlechtesten
  Trefferquote; ein Tipp darauf startet eine Runde genau dazu.

## Weitere Funktionen

- **Verklickt? Zurücknehmen.** Ein Tipp auf ↶ macht die letzte Antwort samt Terminplanung
  rückgängig – auf dem Handy passiert ein Fehlgriff schnell, und er soll den Verlauf nicht
  verfälschen.
- **Nachschlagen** über die Lupe oben rechts: alle Karten durchsuchbar nach Frage, Antwort,
  Thema und Kontext. Antippen klappt die Lösung auf, ★ markiert für später.
- **Wiederholungs-Vorschau** für die nächsten sieben Tage in der Statistik.
- **Rückblick nach jeder Runde**: Welche Karten saßen noch nicht – mit Antwort und Kontext.
- **Hartnäckige Karten** werden nach mehreren Aussetzern gekennzeichnet und liefern einen
  wechselnden Merkhilfe-Tipp. Wer eine Karte zum fünften Mal vergisst, braucht keine sechste
  Wiederholung, sondern eine Eselsbrücke.
- **Trefferquote je Woche** in der Statistik, über acht Wochen mit mindestens zehn Antworten –
  damit sichtbar wird, ob es besser wird, und nicht nur, wie viel geschafft ist.
- **Helles und dunkles Design**, standardmäßig nach Systemeinstellung, in den Einstellungen
  festlegbar. Beide Paletten sind auf Kontrast gerechnet (mindestens 4,5:1) – und der
  Durchlauftest misst das nach, statt es zu behaupten (siehe unten).
- **Tastatur** auf Mac oder iPad: `1`–`4` wählt Antwort oder Bewertung,
  `Enter`/`Leertaste` blättert weiter.

## Auf dem iPhone installieren

1. Die Netlify-URL in **Safari** öffnen (nicht Chrome – nur Safari kann installieren).
2. Teilen-Symbol **⬆︎** → **Zum Home-Bildschirm**.
3. Ab dann startet die App im Vollbild und funktioniert auch ohne Netz.

## Auf Netlify veröffentlichen

Die App braucht keinen Build-Prozess und keine Abhängigkeiten.

**Weg 1 – aus GitHub (empfohlen, aktualisiert sich bei jedem Push):**
1. [app.netlify.com](https://app.netlify.com) → *Add new site* → *Import an existing project*
2. GitHub verbinden, dieses Repository und den Branch wählen
3. Build command: `node scripts/make-sw.mjs` · Publish directory: `.`
   (steht bereits in `netlify.toml`, Netlify übernimmt es automatisch)
4. *Deploy* – fertig.

**Weg 2 – ohne GitHub:** Ordner auf [app.netlify.com/drop](https://app.netlify.com/drop) ziehen.

## Entwicklung

```bash
npm run dev        # lokaler Server auf http://localhost:8080
npm test           # 58 Einheitentests plus Inhaltsprüfung
npm run test:e2e   # 31 Durchlaufprüfungen im iPhone-Viewport (braucht Playwright)
npm run test:all   # beides
npm run check      # nur die Inhaltsprüfung
npm run simulate   # simuliert 180 Tage Lernverlauf
npm run build      # erneuert Icons und Service-Worker-Cache
```

### Qualitätssicherung

`npm run check` prüft nicht nur auf fehlende Felder und doppelte Fragen, sondern auch
darauf, ob sich eine richtige Antwort schon an ihrer **Form** verrät:

- ein Klammerzusatz, den nur die Lösung trägt,
- eine Einheit, die nur in der Lösung ausgeschrieben ist („9 Kilokalorien" gegen „4"),
- eine Antwort, die deutlich länger ist als alle drei Ablenker.

Solche Karten lassen sich ohne Wissen lösen. Wer immer die längste Option wählt, traf in
einer frühen Fassung in 47 % der Fälle richtig statt in 25 % wie beim Raten – das verfälscht
die Trefferquote und lässt den Scheduler zu optimistisch planen. Nach der Überarbeitung von
287 Kartensätzen liegt der Wert bei 23,8 %; `npm run check` gibt ihn bei jedem Lauf aus und
schlägt oberhalb von 32 % fehl.

Dieselbe Prüfung meldet eine zweite Ratestrategie: Bei Zahlenkarten lagen die Ablenker
anfangs in 85 % der Fälle symmetrisch um die richtige Antwort. Wer beide Extremwerte
streicht, rät dann mit 50 statt 25 Prozent. Bei Jahreszahlen ist das behoben – die Ablenker
liegen jetzt teils komplett vor, teils komplett nach dem gesuchten Jahr, bei gleichem Abstand
und damit gleicher Plausibilität. Der Wert liegt bei 76,6 %; der Rest sind Zahlen mit eigener
Struktur (Notrufnummern, Zweierpotenzen, Chromosomenzahlen), bei denen ein verschobener
Ablenker sinnlos würde. Betroffen sind 152 der 1.477 Karten, der Effekt auf die Gesamt-
Ratequote liegt bei rund drei Prozentpunkten.

Die 58 Einheitentests decken den Scheduler (Intervallgrenzen, Wachstumsgarantie, Vorschau),
die Warteschlangen (keine Dubletten, Budget, Themenfilter), das Einlesen fremder Backups und
den Vergleich freier Eingaben ab.

Beim freien Abrufen ist der schlimmste denkbare Fehler, eine falsche Eingabe abzunicken – dann
lernt man die Falschantwort als richtig. Ein Test tippt deshalb jeden der rund 4.000 Ablenker
als Antwort auf seine eigene Karte; keiner davon darf durchgehen. Beim ersten Lauf taten es
148: „Ag" galt als Symbol für Gold, „Ludwig XVI." als „Ludwig XIV.", und vertauschte Aussagen
wie „kW ist Energie, kWh ist Leistung" kamen zeichenweise auf über 90 % Übereinstimmung.
Der Vergleich achtet seither auf Wortreihenfolge, Vielfachheit und den Wortanfang – im
Deutschen sitzt die Unterscheidung vorn (intra-/inter-, Impressionismus/Expressionismus).
Ein Gegentest sichert die andere Richtung: ein Tippfehler in der Antwort wird weiterhin in
96 % der Fälle verziehen.

Ebenso geprüft: dass eine falsche Formel nicht durchgeht – „a² − b² = c²" ist keine Antwort
auf den Satz des Pythagoras, „Grundseite mal Höhe" keine auf die Dreiecksfläche. Zwei
Invarianten laufen über den gesamten Bestand: keine Antwort darf zu einem leeren Text
normalisieren, und jede Antwort muss mit sich selbst übereinstimmen.

Der Durchlauftest prüft zusätzlich beide Farbschemata gegen WCAG AA: Er geht alle Ansichten
bis zu den Bewertungsknöpfen durch, löst für jeden Text den tatsächlichen Hintergrund über
die Elternkette auf – Verläufe eingeschlossen – und rechnet das Kontrastverhältnis aus.
Nötig war das, weil sich feste Farben im Stylesheet erst im jeweils anderen Schema zeigen:
Der Verlauf des Startblocks blieb dunkel, während die Schrift auf dunkel umschlug, sodass
die Begrüßung bei 1,15:1 stand. Und „Nochmal", „Schwer" und „Leicht" waren helle Pastelltöne
auf weißem Grund – 1,3:1 auf Knöpfen, die bei jeder Karte gedrückt werden.

### Karten ergänzen

Die Inhalte liegen als reine Datenlisten in `data/<kategorie>.js`:

```js
{
  q: "Wie lang ist ein Marathon?",     // Frage
  a: "42,195 km",                      // Antwort
  s: "Rekorde",                        // Teilgebiet
  d: 1,                                // Stufe: 1 Basis, 2 Solide, 3 Profi
  t: "Die krummen 195 m stammen …",    // Kontext nach der Antwort
  w: ["40 km", "42 km", "45 km"]       // optionale Ablenker
}
```

Selten braucht eine Karte zusätzlich `mc: true`. Das heißt: nur als Auswahlfrage abfragen,
nie als freie Eingabe. Nötig ist das, wenn sich die Antwort getippt nicht vom Ablenker
trennen lässt – bei der Frage nach „ss" gegen „ß" etwa fallen beide Schreibungen beim
Normalisieren zusammen.

Ohne `w` erzeugt die App die falschen Antworten selbst – aus dem Antwortpool desselben
Teilgebiets, bei Jahreszahlen und Zahlen als knappe Beinahe-Treffer.
IDs entstehen aus dem Fragetext, deshalb bleibt der Lernfortschritt beim Ergänzen erhalten.
Umgekehrt heißt das: Wer eine Frage umformuliert, setzt den Fortschritt dieser einen Karte
zurück.

Nach Änderungen `npm test` und `npm run build` laufen lassen.

## Aufbau

```
index.html              Grundgerüst
assets/css/app.css      Gestaltung, Farbschemata, iPhone-Safe-Areas
assets/js/store.js      Speicherung im Browser, Streak, Tagesstatistik
assets/js/srs.js        Spaced-Repetition-Scheduler
assets/js/session.js    Zusammenstellung der Lerneinheiten
assets/js/quiz.js       Antwortoptionen, Vergleich freier Eingaben
assets/js/app.js        Oberfläche und Ablauf
data/                   Kartensammlung nach Kategorien
scripts/                Icon-, Service-Worker- und Prüfwerkzeuge
tests/                  Einheitentests und Durchlauftest
```

## Daten

Es gibt keinen Server und kein Konto. Der Fortschritt liegt im `localStorage` des Browsers
und wird beim Verlassen der App sofort gesichert. Unter *Mehr → Daten* lässt er sich als
Datei exportieren und auf einem anderen Gerät einlesen.
Wichtig: Wenn du in Safari die Website-Daten löschst, ist der Fortschritt weg – gelegentlich sichern.

# Wissenswerk

Ein Allgemeinwissen-Trainer als Web-App fürs iPhone. Statisch, offline-fähig, ohne Konto –
alles läuft im Browser, der Lernfortschritt bleibt auf dem Gerät.

**1.906 Karten** in neun Themen, aufgebaut in drei Stufen: Basis (Schulwissen Klasse 5–8),
Solide (gute Allgemeinbildung), Profi (das, was Quizduelle entscheidet).
Schwerpunkte liegen auf **Sport** (282 Karten: Trainingslehre, Anatomie, Bewegungslehre,
Sportmedizin, Sportdidaktik, Sportpsychologie) und **Mathematik** (289 Karten: Grundlagen,
Schulmathematik, Analysis, Lineare Algebra, Stochastik, Mathedidaktik, Mathematikgeschichte).
In beiden Fächern gibt es ein eigenes Teilgebiet **Verfahren erkennen**, das nicht nach einem
Fakt fragt, sondern nach der Entscheidung davor – siehe unten. Die beiden **Didaktiken** sind
eigens verstärkt (Mathedidaktik 29, Sportdidaktik 35): Dort schreibt man Prüfungen, und dort
war die Sammlung am dünnsten. Neu unter anderem Aufsichtspflicht, die pädagogischen
Perspektiven, Bezugsnormen der Leistungsbewertung, das Taktik-Spiel-Modell und differenzielles
Lernen; auf der Mathematikseite Variablenaspekte nach Malle, die beiden Deutungen des
Gleichheitszeichens, das Permanenzprinzip, präformales Beweisen und zählendes Rechnen als Kern
der Rechenschwäche.
In beiden Fächern reicht die Sammlung bewusst bis auf Studienniveau: biomechanische Prinzipien
und der Doppelauftrag des Schulsports ebenso wie Hauptsatz, hessesche Normalform, Fehler
erster Art und das EIS-Prinzip. Wer diese Fächer unterrichtet, soll darin nicht nur mitreden,
sondern sattelfest sein.

Für Quizspiele sind drei Standardkategorien eigens besetzt, die vorher fast leer waren:
**Mythologie** (21 Karten – von Zeus bis Yggdrasil, samt der Redewendungen wie Achillesferse
und Sisyphusarbeit, die daraus entstanden), **Essen & Trinken** (15 – Reinheitsgebot,
Currywurst, warum Schärfe kein Geschmack ist) und **Erfindungen** (7 – Penicillin, Dynamit,
MP3 aus Erlangen, der fränkische Jeans-Erfinder). Dazu **Tiere** (11 Quiz-Klassiker vom
Wanderfalken bis zum blauen Krakenblut), acht Karten zu **Marken** (Adidas und Puma aus
Herzogenaurach, Haribo = Hans Riegel Bonn, Aldi = Albrecht-Diskont) und sechs zu **Popmusik
und ESC** (Lena, Nicole, Freddie Mercury, Falco).

Ein eigenes Teilgebiet **Geld im Alltag** (41 Karten) deckt ab, was mit Anfang zwanzig anfängt zu
zählen und in keinem Lehrplan steht: Dispozins und Effektivzins, Mietkaution und
Kündigungsfrist, Probezeit und Urlaubsanspruch, welche Versicherung Pflicht ist und welche man
trotzdem braucht. Dazu die Fristen, die man einmal falsch verstreichen lässt und dann nicht
vergisst – zwei Wochen für die Anmeldung nach dem Umzug, 14 Tage Widerruf im Fernabsatz,
acht Wochen für die Rückbuchung einer Lastschrift, vier Wochen zum 15. oder Monatsende bei der
eigenen Kündigung –, die 20-Stunden-Grenze des Werkstudentenprivilegs, die Kappungsgrenze bei
Mieterhöhungen und der Satz, den der Bundesgerichtshof zu unrenoviert übernommenen Wohnungen
gesprochen hat.

## Warum die App so gebaut ist

Der Aufbau folgt dem, was in der Lernforschung am zuverlässigsten wirkt:

| Prinzip | Umsetzung |
|---|---|
| **Verteiltes Lernen** (spacing) | SM-2-Scheduler: Wiederholung genau dann, wenn du kurz vor dem Vergessen stehst. Intervalle wachsen 1 → 3 → 7 → 20 → 60 Tage. |
| **Aktives Abrufen** (retrieval practice) | Erst Multiple Choice zum Erkennen, ab der dritten Wiederholung freies Abrufen mit Selbstbewertung – Abrufen prägt stärker ein als Wiederlesen. |
| **Verschränken** (interleaving) | Das Tagestraining mischt Themen, statt ein Gebiet am Stück zu pauken, und verteilt neue Karten gleichmäßig über die Einheit. |
| **Elaboration** | Jede Karte liefert nach der Antwort einen Kontext, eine Eselsbrücke oder eine Einordnung – Wissen hält, wenn es andocken kann. |
| **Auch das Beiwerk fragt ab** | „Wissen des Tages" zeigt erst die Frage, dann auf Tastendruck die Auflösung – und holt einen Anker von vor sieben Tagen zurück. Nur Lesen ist die schwächste Lernform, die es gibt. |
| **Schwerpunkt** | Neue Karten kommen reihum aus allen Themen – ein Studienfach bekäme damit ein Neuntel, egal wie viele Karten dahinterstehen. Als Schwerpunkt markierte Themen sind pro Runde zweimal an der Reihe: Sport und Mathematik steigen so von 22 auf 36 % der Neuzugänge. |
| **Schwierigkeits-Leiter** | Neue Karten kommen standardmäßig leicht zuerst, damit Grundlagenlücken zuerst schließen – innerhalb einer Stufe gestreut, damit nicht ähnlich formulierte Fragen beieinanderstehen. |
| **Sofortige Rückmeldung** | Richtig/falsch plus Erklärung direkt nach der Antwort. |
| **Kleine tägliche Dosis** | Standard: 12 neue Karten pro Tag. Das sind rund 9 Minuten – dauerhaft durchhaltbar. |
| **Bremse gegen den Rückstau** | Stauen sich die Wiederholungen, pausieren neue Karten von selbst, bis der Berg wieder kleiner ist. Ohne die Bremse wuchs der Rückstand nach zwei Pausen von je zwei Wochen auf über 800 Karten. |

Eine Simulation über 180 Tage (`npm run simulate`) ergibt: im Schnitt rund 101 Karten pro Tag,
Spitzenlast etwa 140, gut 12 Minuten täglich. Nach einem halben Jahr sitzen rund 1.360 der
1.671 Karten fest (über mehrere Läufe zwischen 1.333 und 1.395). Der Deckel für Wiederholungen sorgt dafür, dass die Tageslast nicht mit dem
Kartenbestand mitwächst.

Die Simulation treibt bewusst den **echten** Code – den Scheduler, die Warteschlangen und den
Speicher. Eine nachgebaute Rechnung prüft sonst nur sich selbst: In der früheren Fassung kam
die Bremse gegen den Rückstau überhaupt nicht vor, sie konnte also auch nichts über sie sagen.
Mit `npm run simulate -- --pausen` kommen zwei Abwesenheiten von je zwei Wochen dazu. Dann
staut sich der Rückstand auf rund 550 fällige Karten – die Bremse pausiert daraufhin die neuen
Karten, und nach etwa vier Wochen ist der Berg abgetragen, ohne dass die Tageslast über den
Deckel steigt.

### Woher die Methoden stammen – und was sie wirklich hergeben

Die Bezugsgröße ist die Übersichtsarbeit von Dunlosky, Rawson, Marsh, Nathan und
Willingham (2013, *Psychological Science in the Public Interest*), die zehn verbreitete
Lerntechniken nach Befundlage einordnet. Zwei erhalten dort **hohe** Wirksamkeit, drei
**mittlere**, fünf **geringe**. Diese Einteilung ist hier die Messlatte:

| Was die App tut | Technik | Befundlage | Belege |
|---|---|---|---|
| Jede Karte ist eine Abfrage, nie ein Lesetext | Übungstests | **hoch** | Roediger & Karpicke 2006; Meta-Analyse Rowland 2014 (g ≈ 0,5) |
| Wachsende Abstände, Termin je Karte | Verteiltes Lernen | **hoch** | Meta-Analyse Cepeda et al. 2006; Cepeda et al. 2008 zum optimalen Abstand |
| Wiederholen bis zum Kriterium über mehrere Termine | Erfolgreiches Wiederlernen | **hoch** | Rawson & Dunlosky 2011 |
| Kontext, Ursache und Einordnung nach jeder Antwort | Elaboration | mittel | Dunlosky et al. 2013 |
| Themen werden gemischt statt am Stück gepaukt | Verschränken | mittel | Rohrer, Dedrick & Stershic 2015 |
| Merkhilfen für hartnäckige Karten | Schlüsselwortmethode | **gering** | Dunlosky et al. 2013 |

**Vier Stellen, an denen es hakt – offen benannt.** Eine davon ist inzwischen behoben; sie
steht hier trotzdem, weil die Begründung erklärt, warum die App an dieser Stelle so aussieht,
wie sie aussieht:

**Multiple Choice ist die schwächere Prüfform.** Freies Abrufen prägt stärker ein als
Wiedererkennen. Die Auswahlfrage ist hier nur das Gerüst für die ersten zwei Begegnungen;
danach wird frei abgerufen. Gemessen über 180 simulierte Tage sind dadurch bereits
**48,2 %** aller Abrufe freie Abrufe – eine Karte verbringt den größten Teil ihres Lebens
jenseits der Schwelle. Ab der ersten Wiederholung umzuschalten brächte 66,2 %, verlangte
aber, eine gerade erst gesehene Karte schon am nächsten Tag zu tippen. Dass Multiple Choice
überhaupt trägt, hängt an der Qualität der Ablenker (Little, Bjork, Bjork & Angello 2012):
Nur wenn die falschen Optionen ernsthaft in Frage kommen, muss man beim Ausschließen
tatsächlich Wissen abrufen. Genau deshalb steckt so viel Arbeit in den Ablenkern – die
Ratequote von 27,0 % und die Klammerquote von 49,1 % oben sind keine Kosmetik, sondern die
Voraussetzung dafür, dass die Auswahlfrage überhaupt eine Prüfung ist.

**Selbstbewertung lädt zur Selbsttäuschung ein – deshalb kommt das Urteil zuerst.** Beim
freien Abrufen bewertet man sich selbst, und wer die Lösung erst sieht und dann urteilt, hält
für gewusst, was er gerade gelesen hat (Koriat & Bjork 2005 nennen das Rückschaufehler). Das
Eingabefeld wirkt dagegen, weil eine getippte Antwort vor der Auflösung feststeht und
automatisch verglichen wird – es ist aber freiwillig, und genau daraus entstand die Lücke:
Ein Tipp auf „Lösung zeigen", und schon urteilte man über etwas, das man bereits gelesen hatte.

Deshalb gibt es diesen Knopf ohne Eingabe nicht mehr. An seiner Stelle stehen zwei:
**„Hab ich"** und **„Hab ich nicht"**. Gleich viele Tipper wie vorher, aber das Urteil fällt,
solange die Antwort noch verdeckt ist. Danach steht die eigene Festlegung neben der Lösung –
wer „Hab ich" gesagt hat und etwas anderes liest, sieht den Unterschied, statt ihn sich
wegzuerinnern. Wer tippt, bekommt weiterhin den einen Knopf: Die Eingabe *ist* die Festlegung.

Aus der Festlegung wird eine Rückmeldung: Die Statistik zeigt ab 15 Festlegungen, in wie
vielen Fällen auf „Hab ich" doch ein „Nochmal" folgte. Erst das macht die Selbsttäuschung
sichtbar – ohne Zahl bleibt „ich dachte, ich hab's" eine Beobachtung, die man sofort wieder
vergisst.

**Wachsende Abstände sind Konvention, nicht Beweis.** Dass die Abstände wachsen müssen, ist
schlechter belegt, als es klingt: Karpicke & Roediger (2007) fanden gleichbleibende Abstände
mindestens ebenbürtig. Belegt ist der Abstand an sich, nicht seine Steigerung. Der Scheduler
folgt hier SM-2 – einem Verfahren von 1987, das sich bewährt hat, aber nicht aus Daten
abgeleitet ist.

**Verschränken wirkt nicht überall gleich – deshalb gibt es „Verfahren erkennen".** Der starke
Befund von Rohrer et al. betrifft das Unterscheiden von *Aufgabentypen*: Wer gemischt übt,
erkennt später, welches Verfahren gefragt ist. Wer ein Kapitel am Stück übt, weiß das Verfahren
schon aus der Überschrift – genau diese Entscheidung wird dabei nie trainiert. Eine Sammlung aus
reinen Wissensfragen kann das Prinzip nur in der schwachen Variante nutzen.

Deshalb gibt es in beiden Schwerpunktfächern jetzt ein Teilgebiet, das die Richtung umdreht:
**Mathematik: 27 Karten**, bei denen eine konkrete Aufgabe dasteht und das Werkzeug gesucht ist –
„∫ x · e^x dx" führt auf partielle Integration, „∫ 2x · (x² + 1)⁵ dx" auf Substitution, „1/(x² − 1)"
auf Partialbruchzerlegung. Die Ablenker sind jeweils die *anderen* Verfahren, sodass die Karte
nur lösbar ist, wenn man das Erkennungsmerkmal kennt. **Sport: 18 Karten** nach demselben Muster
– gegeben ist ein Ziel, gesucht die Methode: Maximalkraft, Muskelaufbau, Kraftausdauer,
Sprungkraft; extensive Dauermethode, intensive Intervallmethode, Wiederholungsmethode.

Sieben zunächst geschriebene Karten sind wieder herausgeflogen, weil sie nur die Umkehrung einer
vorhandenen waren: „Wofür braucht man die hessesche Normalform?" gab es schon, „Welches Verfahren
liefert den Abstand Punkt–Ebene?" ist dieselbe Karte von hinten. Zwei Karten für einen Fakt heißt
doppelte Wiederholungen für einen Fakt – dieselbe Regel, nach der auch der Dublettenwächter
arbeitet. Gefunden hat sie ein Abgleich über seltene Wörter, entschieden wurde von Hand.

**Was die App über sich selbst nicht wissen kann:** Die Simulation (`npm run simulate`) misst
Arbeitslast, Rückstand und Termintreue – nicht Behalten. Ihre Vergessenskurve ist eine Annahme,
kein Messwert; eine Simulation, die ihre eigene Annahme zurückliest, belegt nichts. Alle
Aussagen zum Lernerfolg stehen und fallen daher mit der zitierten Literatur, nicht mit
Zahlen aus diesem Projekt. Aus demselben Grund wurde eine Funktion `retention()` wieder
entfernt: Sie berechnete eine „erwartete Merkwahrscheinlichkeit", wurde von keiner Zeile der
App benutzt und widersprach der Simulation deutlich – am Fälligkeitstag sagte sie 66 %, die
Simulation rechnete mit 86 %. Eine Vergessenskurve, die niemand benutzt, ist eine Behauptung,
die niemand prüft.

### Zwei offene Tabs und das ausdrückliche Ersetzen

Zwei offene Tabs derselben App führen ihren Speicher **zusammen**, statt sich zu
überschreiben – alle Zähler wachsen nur, also geht dabei nichts verloren. Genau diese
Eigenschaft wurde beim Zurücksetzen und beim Einlesen einer Sicherung zur Falle: Ein bewusst
geleerter oder ersetzter Stand ist für das Zusammenführen ununterscheidbar von einem alten,
und der zweite Tab füllte ihn einfach wieder auf. Nachgestellt genügte nach „Alles
zurücksetzen" ein einziger Stern im anderen Tab, und der komplette Altbestand stand wieder im
Speicher – mit höherer Fassungsnummer, also endgültig.

Deshalb trägt der Zustand neben der Fassungsnummer (steigt bei jedem Schreiben) eine
**Generationsnummer**, die nur beim ausdrücklichen Ersetzen steigt: Zurücksetzen, Sicherung
einlesen, Wiederherstellen. Ein Stand höherer Generation wird von anderen Tabs übernommen
statt eingesammelt – die Meldung sagt dann ehrlich „ersetzt – hier übernommen" statt
„zusammengeführt". Ein Test fährt zwei echte Modulinstanzen gegeneinander, wie zwei Tabs es
tun; gegen den alten Stand schlägt er fehl.

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
- **Themen** – ein Gebiet am Stück üben oder ein einzelnes Teilgebiet gezielt: Tippen auf
  „Sport“ öffnet die zwölf Teilgebiete von Trainingslehre bis Rekorde, jedes mit eigenem
  Fortschritt. Vor einer Klausur in Bewegungslehre übt man genau diese Karten.
- **Duell** – zehn Fragen, 15 Sekunden pro Frage. Trainiert Tempo für Quizduelle.
  Fehler landen automatisch im nächsten Tagestraining. Die Antworten zählen **getrennt**:
  Sie füllen weder den Tagesfortschritt noch die Wissensquote, weil unter Zeitdruck
  naturgemäß geraten wird – drei Duelle ließen den Tagesbogen sonst auf 71 % springen,
  ohne dass eine einzige geplante Karte dran war. Für die Serie und die Aktivitätskarte
  zählt ein Duell trotzdem: geübt ist geübt. Die Uhr **pausiert, während die App im
  Hintergrund ist** – siehe unten. Eine im Duell verfehlte Karte wird auf heute fällig
  gestellt, und ihr Intervall wird dabei auf die **wirklich verstrichene Zeit gedeckelt**:
  Vorher galt eine 30-Tage-Karte, die nach zehn Tagen im Duell scheiterte, am nächsten Tag
  als pünktlich abgefragte 30-Tage-Karte – und die vom gerade gezeigten Lösungstext geprimte
  richtige Antwort trieb das Intervall auf rund 75 Tage. Jetzt rechnet das nächste Wachstum
  aus den zehn Tagen, die die Karte nachweislich getragen hat. Gedeckelt wird nur, nie
  verlängert.

  Die Zusammenstellung zog anfangs **blind**: 60 % zufällig aus allem Bekannten, der Rest
  zufällig aus dem Gesamtbestand. Damit kam ausgerechnet das, woran man unter Zeitdruck
  gescheitert war, nie wieder unter Zeitdruck dran – ein Duell-Fehler landete nur im
  untimed Tagestraining. Wer eine Karte in zwanzig Sekunden abruft, hat den Quizduell-Punkt
  trotzdem verloren. Jetzt füllt sich das Duell aus **drei Töpfen**: knapp ein Drittel die
  schwächsten bekannten Karten (Wackelkandidaten zuerst), dann weiteres Bekanntes, dann
  Neues. Dafür war kein neuer Zustand nötig – der Einbruch nach einem Duell-Fehler steckt
  schon in `strength()`.

  Dazu kommt das **Themen-Duell**: Im Quizduell steht die Kategorie vor der Frage fest,
  und genau diese Lage ließ sich vorher nicht proben – Themen nur in Ruhe, Zeitdruck nur
  über den Gesamtbestand. Jeder Themenseite liegt jetzt ein zweiter Knopf bei. Die
  gewählte Kategorie wird im Lauf mitgeführt, sonst wechselte „Weitermachen" nach der
  Runde still das Thema.

  Zwei Fehler in genau dieser Erweiterung fielen erst einer späteren Fehlerjagd auf, beide
  nachgestellt: Das **Themen-Duell war bei pausiertem Thema tot** – `buildDuel` filterte
  zusätzlich auf die im Tagestraining aktiven Themen, sodass der Knopf „Keine Karten in
  diesem Thema" für ein Thema mit 282 Karten meldete, während „Ganzes Thema üben" direkt
  daneben lief. Wer ein Thema ausdrücklich wählt, meint es auch; `buildTopic()` hält es über
  `catCards()` seit jeher so. Und das **Duell begann jedes Mal mit denselben drei Fragen**:
  Der Schwachstellen-Topf war fest sortiert, also kamen die drei schwächsten Karten in jeder
  Runde erneut – aus dem Tempotest wurde das Auswendiglernen von drei Karten. Gemessen über
  acht Runden: drei Karten in allen acht, jetzt keine einzige. Die Vorauswahl bleibt bei den
  Wackelkandidaten, gezogen wird daraus gewürfelt.

  Schließlich wird die **Antwortzeit** ausgewertet, statt sie zu messen und wegzuwerfen:
  Die Duellkarte zeigt die durchschnittliche Zeit bis zur richtigen Antwort. Nur richtige
  Antworten zählen hinein – wie schnell jemand danebengreift, sagt nichts über Fortschritt.
  Tempo ist im Quizduell die eigentliche Währung, und es war die einzige Größe, die die App
  erheben konnte und nicht zeigte.
- **Markierte Karten** – was du beim Nachschlagen mit ★ versiehst, lässt sich gezielt üben.
- **Schwachstellen** – die Statistik zeigt die Teilgebiete mit der schlechtesten
  Trefferquote; ein Tipp darauf startet eine Runde genau dazu.

## Weitere Funktionen

- **Eine Unterbrechung kostet nichts.** Zwei Stellen messen, wie lange eine Frage schon
  dasteht: die Frist im Duell und die Note im Tagestraining, wo über 14 Sekunden als „Schwer"
  gilt. Gerechnet wird mit der Uhrzeit statt mit Zeitgeber-Ticks, damit gedrosselte Intervalle
  die Messung nicht verfälschen – nur läuft die Uhrzeit auch weiter, während das Handy klingelt
  oder gesperrt ist. Gezählt wird deshalb nur die Zeit, in der die App **sichtbar** war.
  Vorher fand man nach einem Anruf die Duellfrage abgelaufen vor, ohne sie je gesehen zu haben.
  Schwerer wog der zweite Fall: Eine sofortige richtige Antwort nach der Unterbrechung wurde als
  „Schwer" gewertet – gemessen fiel der Leichtigkeitsfaktor der Karte von 2,50 auf 2,35, und der
  wirkt auf **jedes künftige Intervall** dieser Karte. Anders als im Duell trifft das den
  Scheduler.
- **Verklickt? Zurücknehmen.** Ein Tipp auf ↶ macht die letzte Antwort samt Terminplanung
  rückgängig – auf dem Handy passiert ein Fehlgriff schnell, und er soll den Verlauf nicht
  verfälschen.
- **Nachschlagen** über die Lupe oben rechts: alle Karten durchsuchbar nach Frage, Antwort,
  Thema und Kontext. Antippen klappt die Lösung auf, ★ markiert für später. Gesucht wird nach
  Teilzeichenketten – absichtlich großzügig, damit „integr" auch „Integral" findet. Sortiert
  wird danach, **wo** der Treffer sitzt: Frage vor Antwort vor Teilgebiet vor Kontext, ganzes
  Wort vor Wortteil. Ohne diese Reihenfolge stand Unsinn oben: „dna" steckt auch in
  „schuldnachweis" und „rekordnationalspieler", und die beiden echten DNA-Karten landeten auf
  Platz drei und vier; bei „Grundgesetz" gewann die Goldene Bulle, weil das Wort in ihrem
  Kontexttext vorkommt. Die Trefferzahl bleibt dieselbe – die Reihenfolge filtert nichts weg.
- **Hinweise schlucken keine Tipper.** Der Hinweisbalken liegt fest über dem unteren Rand –
  also genau über den Antwort- und Notenknöpfen. Ohne `pointer-events: none` nahm sein
  Rechteck jeden Tipper entgegen, der darunter zielte; in einem simulierten Verlauf über
  mehrere Monate blieb eine Runde genau daran hängen. Nur der Knopf im Balken nimmt jetzt noch
  Tipper an. Das Update-Angebot erscheint außerdem gar nicht mehr mitten in der Runde: Laden
  wird dort ohnehin verweigert, weil es die offene Frage schlucken würde, also wird es
  zurückgehalten und nach der Runde nachgeholt. Und der Balken **überlebt Kurzmeldungen**:
  Vorher räumte jede Meldung („Gesichert", ein Stern im Nachschlagen) das erste Element mit
  der Klasse `.toast` weg – und das war der Balken. Das Update-Angebot war damit bis zum
  nächsten vollständigen Neuladen verschwunden; bei einer vom Home-Bildschirm gestarteten
  App kann das Wochen dauern. Jetzt ersetzt eine Meldung nur ihresgleichen und rückt über
  den Balken, statt ihn zu verdecken. Wer während einer laufenden Runde auf „Laden" tippt,
  bekommt das Angebot nach der Runde erneut, statt es zu verlieren.
- **Erinnerung ans Sichern.** Der Fortschritt liegt allein im Browserspeicher dieses Geräts –
  die App hat keinen Server und kann nichts hochladen. Safari räumt den Speicher von Websites
  nach längerer Nichtnutzung auf, ein neues Handy hat ihn ohnehin nicht. Deshalb erinnert die
  Startseite ab 120 beantworteten Karten daran, einmal als Datei zu sichern, und danach wieder,
  wenn die letzte Sicherung 30 Tage her ist. Vorher wäre der Hinweis nur lästig. Als installierte
  App läuft das Sichern über das iOS-Teilen-Blatt („In Dateien sichern") – ein `<a download>`
  verpufft im Home-Bildschirm-Modus still. Ein Abbruch im Teilen-Blatt zählt nicht als Sicherung.
- **Wiederholungs-Vorschau** für die nächsten sieben Tage in der Statistik.
- **Fortschritt nach Stufe** – „Sitzen die Grundlagen aus Klasse 5 bis 8?" war die
  Ausgangsfrage an diese App; beantworten konnte sie sie lange nicht, weil die Statistik nur
  nach Thema aufschlüsselte. Jetzt steht für Basis, Solide und Profi jeweils da, wie viele
  Karten begonnen sind und wie viele wirklich fest sitzen.
- **Wissen des Tages** – 141 kurze Merkanker, die ein Warum erklären oder einen verbreiteten
  Irrtum ausräumen. Einer pro Tag, ein knappes halbes Jahr ohne Wiederholung. Sie sind
  **Abrufaufgaben, keine Lesehäppchen**: Oben steht die Frage, die Auflösung kommt erst auf
  Tastendruck – und ein Anker von vor sieben Anzeigetagen kommt zurück. Vorher war das die
  schwächste Methode im ganzen Projekt: einmal lesen, nie wieder abrufen, von Dunlosky et al.
  als *gering wirksam* eingestuft. Gemessen haben **51 der 141** Anker keine Entsprechung unter
  den Karten – sie wurden also tatsächlich genau einmal gesehen. Damit die Frage überhaupt
  einen Abruf auslöst, darf sie die Antwort nicht schon enthalten; Überschriften wie
  „Mitochondrien waren einmal Bakterien" taugen dafür nicht. **118 der 141** Anker haben
  deshalb eine eigene Abruffrage bekommen, die übrigen 23 fragen schon in der Überschrift
  („Warum Eis schwimmt").
- **Rückblick nach jeder Runde**: Welche Karten saßen noch nicht – mit Antwort und Kontext.
- **„Nochmal" mit Deckel.** Eine falsch beantwortete Karte kommt in derselben Einheit wieder –
  erst rund fünf Karten später, beim zweiten Anlauf am Ende der Runde. Danach nicht mehr:
  Sie ist auf heute fällig gesetzt und steht in der nächsten Runde ohnehin obenan. Ohne
  diesen Deckel schob sich eine Karte, die man schlicht nicht weiß, bei jedem Versuch erneut
  ein. Gemessen wurde dieselbe Karte in einer Runde von zwölf Karten **49-mal** gestellt, und
  die Runde endete nie – ein Test hält das jetzt fest. Der wachsende Abstand ist Absicht:
  Eine Wiederholung im selben Atemzug hält kürzer vor als eine mit ein paar Karten dazwischen.
- **Hartnäckige Karten** werden nach mehreren Aussetzern gekennzeichnet und liefern einen
  wechselnden Merkhilfe-Tipp. Wer eine Karte zum fünften Mal vergisst, braucht keine sechste
  Wiederholung, sondern eine Eselsbrücke. Als Aussetzer zählt dabei nur das **erste** Umkippen
  je Einheit – die Nachreichungen derselben Runde sind Nachlernen. Sonst meldete die App nach
  einer einzigen zähen Runde „Diese Karte ist dir schon 3-mal entfallen", der
  Leichtigkeitsfaktor fiele dreifach, und die Wackelkandidaten füllten sich nach zwei
  schlechten Tagen statt nach vier schlechten Terminen.
- **Selbsteinschätzung** in der Statistik: Wie oft folgte auf ein „Hab ich" doch ein
  „Nochmal"? Ab 15 Festlegungen sichtbar. Wer dauerhaft über einem Viertel liegt, sollte die
  Antwort tippen statt sie nur zu denken – dann entscheidet der Vergleich und nicht das Gefühl.
- **Trefferquote je Woche** in der Statistik, über acht Wochen mit mindestens zehn Antworten –
  damit sichtbar wird, ob es besser wird, und nicht nur, wie viel geschafft ist.
- **Helles und dunkles Design** – „Papier" und „Abendlicht", beide auf warmen Tönen mit einem
  Akzent aus gebranntem Ton. Standardmäßig nach Systemeinstellung, in den Einstellungen
  festlegbar. Beide Paletten sind auf Kontrast gerechnet (mindestens 4,5:1) – und der
  Durchlauftest misst das nach, statt es zu behaupten (siehe unten).
- **Alle Symbole selbst gezeichnet** als Inline-SVG in einem Strichstil: Navigation, Suche,
  Serie, Stern und neun Themenzeichen. Nichts liegt außerhalb des Repositorys, damit die App
  offline vollständig bleibt.
- **Tastatur** auf Mac oder iPad: `1`–`4` **oder** `A`–`D` wählt Antwort oder Bewertung –
  die Knöpfe tragen Buchstaben, also gelten auch die. `Enter`/`Leertaste` blättert weiter.

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
npm test           # 96 Einheitentests plus Inhaltsprüfung
npm run test:e2e   # 139 Durchlaufprüfungen im iPhone-Viewport (braucht Playwright)
npm run test:offline # Service Worker: Offline-Start und Update ohne Versionsmischung
npm run test:all   # alles zusammen
npm run check      # nur die Inhaltsprüfung
npm run simulate   # simuliert 180 Tage Lernverlauf
npm run build      # erneuert Icons und Service-Worker-Cache
```

### Mehrere richtige Schreibweisen

Beim freien Abrufen zählt die Eingabe gegen die Antwort der Karte – und gegen jede
Schreibweise, die unter `az` hinterlegt ist. `„1/x"` gilt damit als richtige Antwort auf die
Frage nach der Ableitung des natürlichen Logarithmus, obwohl auf der Karte „Eins durch x"
steht. `npm run check` weist zurück, was zugleich Ablenker der Karte ist.

Zahlwörter und Ziffern gelten grundsätzlich als dasselbe: Wer „8" tippt, hat die Frage nach
der Zahl der Planeten beantwortet. Das betrifft 93 Karten, deren Lösung ein Zahlwort enthält.

### Erster Start

Alles Weitere läuft offline, aber der allererste Aufruf muss die Karten holen. Gemessen auf
langsamem 3G (400 kbit/s, 300 ms Latenz, vierfach gedrosselte CPU):

| | vorher | jetzt |
|---|---|---|
| Datenmenge des ersten Besuchs | 757 kB | 295 kB |
| bis zur ersten Ansicht | 6,4 s | 6,1 s |

Der große Posten war nicht die App, sondern der Service Worker: Er lud mit `cache: 'reload'`
jede Datei ein zweites Mal herunter, direkt nachdem die Seite sie geladen hatte. Mit
`cache: 'no-cache'` fragt er nur noch nach, ob sich etwas geändert hat, und begnügt sich sonst
mit einer 304 – dieselbe Sicherheit gegen veraltete Module, ohne den doppelten Verkehr. Dazu
bleiben die beiden 512er-Icons (230 kB) aus dem Vorabbestand: Sie gehen ans Betriebssystem
beim Installieren, die App selbst zeigt sie nie.

`<link rel="modulepreload">` in `index.html` spart die Nachladerunden, mit denen der Browser
die Kartendateien sonst erst über `app.js` und `data/index.js` entdeckt. `npm run build` bricht
ab, wenn diese Liste nicht mehr zum Ordner `data/` passt.

Zwei Dateien lagen im Vorabbestand, die gar nicht zur App gehören: `package.json` und
`data/kennungen.json`, der Bestandsnachweis für die Inhaltsprüfung. Zusammen 26 kB, die jeder
Erstbesucher lud, obwohl die App beide nirgends importiert. Schwerer wog, dass sie in die
Versionskennung des Service Workers eingingen: Eine neue Zeile in `package.json` hätte jedem
Nutzer ein Update angeboten, das nichts ändert. `kennungen.json` wird zudem von
`npm run check --kennungen` neu geschrieben – damit entschied die Reihenfolge der Bauschritte
über die Versionskennung. Beide sind jetzt ausgenommen, und `npm run build` bricht ab, wenn
die Ausnahmeliste nicht mehr zum Ordner passt.

Die restlichen sechs Sekunden sind reine Übertragungszeit für 240 kB Karten – dagegen hilft
nur weniger Inhalt. Stattdessen sagt der Startbildschirm nach anderthalb Sekunden, was gerade
passiert und dass es einmalig ist.

**Und wenn die App gar nicht lädt?** Dann blieb „Wissenswerk wird geladen …" für immer stehen –
samt dem Hinweis, dass es gleich losgeht. Ein abgebrochener Download, eine beschädigte
Kartendatei oder ein zu alter Browser sahen aus wie ein Hänger. Zwei Fälle, zwei Antworten:
Ein **gemeldeter Fehler** ist eindeutig, dort steht sofort Klartext samt Dateiname und ein Knopf
zum Neuladen. **Langsam ist nicht kaputt** – nach 20 Sekunden sagt der Bildschirm deshalb nur,
dass es ungewöhnlich lange dauert, und bietet denselben Knopf an, statt einen Abbruch zu
behaupten. Diese Zeilen stehen bewusst als klassisches Skript in `index.html`, ohne Modul und
ohne moderne Schreibweise: Sie müssen gerade dort laufen, wo der Rest der App es nicht tut.

Die Fehlermeldung nennt **Safari 15.4** als Mindestversion. Das ist nachgerechnet und nicht
geschätzt: `structuredClone` und die Einheit `dvh` sind die einzigen Bausteine mit einer höheren
Anforderung als Safari 14 – alles andere ist älter oder fällt weich aus, etwa
`overscroll-behavior`, das ältere Versionen einfach überlesen. Ein Ersatz für `structuredClone`
wäre drei Zeilen lang, ist aber bewusst nicht drin: Betroffen wären nur Geräte, die seit
März 2022 kein Update bekommen haben, und eine klare Meldung ist dort ehrlicher als eine
halb funktionierende App.

**Ein blinder Fleck, der bleibt.** Das Wortmengen-Maß zählt nur Wörter über vier Buchstaben und
liefert 0, sobald eine Seite weniger als drei davon hat. Damit ist **jede kurze Frage von der
Dublettenprüfung ausgenommen** – gemessen 312 von 1.742 Karten, also 18 %. „Was ist ein
Palindrom?" hat genau ein solches Wort. Genau dort saß eine Dublette: „Was ist ein
Palindrom-Datum wie 22.02.2022?" ist aus der Grundkarte ableitbar und kostete nur
Wiederholungen; sie ist jetzt in den Kontext der Grundkarte eingearbeitet.

Eine Ersatzregel für kurze Fragen wurde gebaut und wieder verworfen. Sie findet über den ganzen
Bestand **zwei** Fälle: den echten und „Wer malte die Mona Lisa?" gegen „Wer malte das
Abendmahl?" – zwei verschiedene Fakten mit derselben Antwort. Eine höhere Schranke hilft nicht,
denn der falsche Treffer liegt mit 1,00 *über* dem echten mit 0,80. Ein Wächter, der zuverlässig
einen Fehlalarm meldet, erzieht dazu, ihn zu überlesen. Die Lücke bleibt deshalb offen und ist
hier festgehalten: Kurze Fragen brauchen einen Blick von Hand.

**Zwei Wege zur selben Dublette.** Die Prüfung meldet zwei Karten als inhaltlich gleich, wenn
sich Frage *und* Antwort stark überlappen (ab 0,7). Diese Schranke ließ eine Lücke: „Wie lange
gilt die gesetzliche Gewährleistung bei Neuware?" und „Wie lange gilt die Gewährleistung auf neu
gekaufte Ware?" kommen nur auf 0,40 – anders formuliert, dasselbe gemeint. Steht auf beiden
Karten **wörtlich dieselbe** Antwort, genügt deshalb schon 0,40. Gemessen über den ganzen
Bestand liefert das genau diesen einen Treffer; bei 0,33 kämen „Wer malte die Mona Lisa?" und
„Wer malte das Abendmahl?" dazu – zwei verschiedene Fakten mit derselben Antwort.

### Wie fair wird eine getippte Antwort bewertet?

Beim freien Abrufen vergleicht die App die Eingabe mit der Lösung und meldet drei Stufen:
**passt** (ab 0,8), **knapp daneben – vergleich genau** (ab 0,6) und darunter die bloße
Gegenüberstellung. Bewertet wird trotzdem selbst; die Zahl steuert nur, was danebensteht.
Weil inzwischen **48 %** aller Abrufe freie Abrufe sind, entscheidet diese Zahl mit darüber,
ob sich das Üben fair anfühlt.

Gemessen wurde mit dem naheliegendsten Fall: Was passiert, wenn jemand die Antwort **weiß**
und sich vertippt? Über alle 1.671 Karten wurden zwei Vertipper erzeugt – zwei vertauschte
Nachbarbuchstaben und ein fehlender Buchstabe – und eingestuft:

| | vorher „passt" | jetzt „passt" |
|---|---|---|
| zwei vertauschte Buchstaben | 8,6 % | **77,7 %** |
| ein fehlender Buchstabe | 27,3 % | 27,3 % |

Der Dreher war der wunde Punkt. Zwei Regeln hatten ihn zum Wissensfehler gemacht. Erstens
zählte der Editierabstand ihn als **zwei** Fehler; jetzt als einen, denn die Buchstaben sind
alle noch da. Zweitens verlangte der Wortvergleich, dass die **vordere Worthälfte exakt**
stimmt – aus gutem Grund, denn im Deutschen sitzt die Unterscheidung vorn
(intra-/inter-, Impressionismus/Expressionismus, Bundesrats-/Bundestags-). Ein Dreher in
dieser Hälfte machte daraus ein völlig anderes Wort: „Varusshclacht" galt nicht als
„Varusschlacht". Erlaubt ist dort jetzt **genau der Dreher und sonst nichts** – die Paare, um
die es der Regel geht, vertauschen nichts, sie ersetzen. Sie bleiben getrennt, ein Test hält
alle sieben fest.

**Aufzählungen: Menge oder Abfolge?** 54 Antworten der Sammlung sind
kommagetrennte Aufzählungen – und sie zerfallen in zwei Sorten. Bei den einen nennt die Lösung
eine **Menge**: Wer die vier DNA-Basen oder die fünf Verfassungsorgane in anderer Folge tippt,
hat recht. Bei den anderen **ist die Reihenfolge die Antwort**: der Modellierungskreislauf, die
PECH-Regel, die Rangfolge beim Skat, die Flagge von oben nach unten. Vorher wurden alle 54
streng behandelt, also die Hälfte davon zu Unrecht.

Welche Sorte vorliegt, kann kein Vergleich errechnen – es steht deshalb als Kennzeichen `ug`
an der Karte, von Hand gesetzt für **23** davon. Ein Gegentest zeigt, warum das so sein muss:
Markiert man versuchsweise alle Karten als Menge, rutschen Ablenker als richtig durch *und* die
Abfolgen brechen. `npm run check` weist das Kennzeichen zurück, wenn die Antwort gar keine
Aufzählung ist, und meldet es als überflüssig, wenn die Karte ohnehin nur als Auswahlfrage
läuft – so wurde es bei den Kongruenzsätzen gleich wieder entfernt.

Der Vergleich lief bisher an drei Stellen getrennt: in der App, im Test und in jeder Messung.
Jede Kopie konnte eine Regel verpassen. Es gibt jetzt eine Funktion `bewerte(card, eingabe)`,
die die Karte als Ganzes bewertet – mit Nebenschreibweisen und Mengenregel –, und der
Ablenker-Rundumschlag läuft durch genau diesen Weg.

Der fehlende Buchstabe bleibt bewusst, wo er war: Er kann ein Wort echt verändern, und 68 %
dieser Fälle landen bei „knapp daneben" – genau die richtige Aufforderung, nachzusehen.

Zwei Dinge, die die Messung **nicht** ergeben haben, gehören dazu: Eine erste Auswertung
meldete auch „Antwort ohne Satzzeichen" als Problem – bis auffiel, dass sie aus „9,81 m/s²"
die Zahl „981" machte. Und verkürzte Antworten („Die Bibliothek" statt „Die Bibliothek von
Alexandria") werden abgelehnt, was richtig ist: Das sind unvollständige Antworten, keine
Tippfehler.

### Zwei Fehler in der Bewertung getippter Antworten

Beide fielen bei einer adversarialen Fehlerjagd auf und waren nachstellbar.

**Der deutsche Tausenderpunkt machte die richtige Zahl falsch.** `normalize()` ersetzte
jedes Nicht-Alphanumerische durch ein Leerzeichen – aus „3.600" wurde die Wortfolge
„3 600", während der Nutzer schlicht „3600" tippt. Der Kernwort-Vergleich sah dann links
zwei Zahlen und rechts eine, wertete das als Kernfehler und deckelte auf 0,5 – unter der
Schwelle. Wer die exakt richtige Zahl getippt hatte, bekam ein rotes Kreuz und den
Fehlerton. Betroffen waren alle **zehn** Karten mit Tausenderpunkt; auf dem Handy tippt
praktisch niemand Tausenderpunkte, sie waren beim freien Abrufen faktisch unlösbar.
Ironischerweise unterscheidet `NUM`/`zuZahl` ein paar Zeilen weiter oben Tausenderpunkt
und Dezimalkomma längst korrekt – nur `normalize()` tat es nicht. Jetzt fällt der
Tausenderpunkt vorher heraus; das Dezimalkomma bleibt unberührt.

**„Durch", „mal" und „wurzel" galten immer als Rechenzeichen.** Drei der acht Operatorwörter
sind zugleich gewöhnliche deutsche Wörter. Die natürliche Kurzantwort auf eine
Wodurch-Frage – „Eindampfen" statt „Durch Eindampfen" – wurde deshalb nicht als „knapp
daneben" gewertet, sondern als glatt falsch, und zwar *bevor* die nachgelagerte,
verzeihende Logik überhaupt zum Zuge kam. Rechenzeichen zählen jetzt nur noch, wo
überhaupt Ziffern im Spiel sind – genau der Fall, für den die Regel gedacht war.

Die strengere Variante – Rechenzeichen nur *zwischen* zwei Zahlen – wurde **gemessen und
verworfen**: Sie hätte den Schutz gegen einen vertauschten Operator bei 38 auf 10 Antworten
gedrückt, also bei 28 Antworten verloren, darunter „Grundseite mal Höhe geteilt durch 2"
und „E = mc²" – und das, um genau *eine* Karte zusätzlich zu retten („Durch 3,6 teilen",
wo eine Ziffer in der Antwort steht und „durch" deshalb weiter mitzählt). Gemessen über
alle 1.906 Karten: Die wörtlich getippte Antwort ergibt weiterhin ausnahmslos 1,00.

### Faktenprüfung

Die Sammlung wurde Datei für Datei gegengelesen. Gefunden und behoben:

- **Ablenker, die selbst richtig sind.** „Die Währungsreform" stand als falsche Antwort auf
  „Was passierte 1923 in Deutschland wirtschaftlich?" – die Rentenmark kam im November 1923,
  der Kontexttext der Karte sagte das sogar selbst. Ebenso „1517" beim Ende des Mittelalters
  und „Cyan, Magenta, Gelb" beim additiven Weiß: Als Licht addiert ergeben auch die drei Weiß.
- **Titel-Anachronismus.** Heinrich IV. war beim Gang nach Canossa 1077 römisch-deutscher
  König, Kaiser erst ab 1084 – bei einer Frage zum Investiturstreit ist genau das der Punkt.
- **Sachfehler im Kontext.** Frankreich stimmte 1884 nicht gegen Greenwich als Nullmeridian,
  es enthielt sich.
- **Widerspruch zwischen zwei Teilen der App.** Die Karte zur Berliner Konferenz 1884/85 sagte,
  sie habe Afrika aufgeteilt – der Tagesfakt zum selben Thema sagte das Gegenteil (sie setzte nur
  die Regeln, gezogen wurden die Grenzen danach in bilateralen Verträgen). Der Tagesfakt hatte
  recht; die Karte ist umformuliert.
- **Inhaltliche Dubletten: 16 Stück.** Der Betrag eines Vektors wurde zweimal gefragt, DIN A4
  zweimal erklärt, die Verdopplungsregel stand einmal mit 70 und einmal mit 72 im Vorrat, und
  Michelangelo an der Sixtinischen Decke gleich zweimal. Der größte Block entstand beim Ausbau
  von Sport und Mathematik: Zehn neue Sport- und drei neue Mathe-Karten fragten Dinge ab, die der
  Altbestand längst enthielt – Höhentraining, Kraftstoß, EPO, Übertraining, Kreatinphosphat,
  Bewegungsphasen. Alle entfernt.
- **Veraltete Frageform.** „Wie viele Abgeordnete hat der Bundestag regulär mindestens?" – seit
  der Wahlrechtsreform sind 630 keine Untergrenze mehr, sondern die feste Größe.
- **Ein Zahlenwiderspruch.** Der Kreatinphosphat-Speicher trug auf einer Karte „6–10 Sekunden",
  auf einer neueren „10–20 Sekunden". 6–10 stimmt und passt zum 100-Meter-Lauf im Kontexttext.

Alle zehn Datendateien sind einmal vollständig gegengelesen. Sprache & Literatur, Kunst & Musik
und Politik & Wirtschaft blieben ohne inhaltlichen Fund; die Fehler häuften sich dort, wo Karten
nachträglich ergänzt wurden.

**Zweite Runde: der ganze Bestand, unabhängig geprüft.** Gegenlesen durch denselben Autor hat
eine bekannte blinde Stelle – wer schreibt, liest seine eigenen Fehler am schlechtesten. Deshalb
haben anschließend unabhängige Prüfinstanzen sämtliche 1.742 Karten und 141 Merkanker
durchgesehen, in Gruppen von höchstens ~150 Stück, mit klarem Auftrag: nur echte Sachfehler,
keine Geschmacksfragen. Jeder gemeldete Fehler ging an zwei Skeptiker mit dem Gegenauftrag, ihn
zu **widerlegen** – eine falsche „Korrektur" an richtigem Inhalt wäre teurer als ein
stehengelassener Zweifelsfall. Zeitabhängige Befunde wurden zusätzlich per Websuche gegen
mehrere Quellen geprüft.

Ergebnis: **acht bestätigte Fehler in 1.883 Einträgen**, alle behoben. Der schwerste war der
WM-Torrekord – Klose (16) ist seit Juli 2026 von Mbappé (22) und Messi (21) überholt; genau die
Karte, mit der man im Quizduell aufgelaufen wäre. Dazu: Magdeburg hat Halle als größte Stadt
Sachsen-Anhalts abgelöst, die 979 m des Salto Ángel sind Gesamthöhe und nicht freier Fall
(Fallstufe: 807 m), der Grönlandhai ist das langlebigste *Wirbeltier* und nicht das
längstlebige Tier (Islandmuschel: 507 Jahre), der DOSB zählt 29 statt 27 Millionen
Mitgliedschaften, „Form follows function" stammt von Louis Sullivan und nicht vom Bauhaus,
Bismarck begründete drei der fünf Sozialversicherungssäulen und nicht alle, und der
Oscar-Nominierungsrekord von „Das Boot" fiel 2023 an „Im Westen nichts Neues".

Ebenso wichtig: **Sechs weitere Meldungen wurden von den Skeptikern entkräftet** – darunter
Fälle, in denen die vorgeschlagene „Korrektur" eine richtige Karte verschlechtert hätte, etwa
der Vorwurf, bei der Ableitung von (x+1)/(x−1) sei auch „Produktregel" richtig (allein reicht
sie nicht), oder die Antibiotika-Karte, deren Frage ausdrücklich an die ärztliche Verordnung
gebunden ist und deren Kontext die verkürzten Leitlinien längst nennt. Ohne die
Widerlegungsstufe wären sechs korrekte Karten „repariert" worden.

Was sich davon maschinell absichern lässt, ist jetzt eine Schranke in `npm run check`:
doppelte Sätze im selben Kontexttext, gleiche Titel oder Texte bei den Tagesfakten, und Karten
mit fast gleicher Frage **und** zusammengehender Antwort. Die Antwortschwelle liegt gemessen
bei 0,25 – darüber rutschte die Vektor-Dublette durch, darunter kämen die Abkürzungsfragen.

Die Dubletten in Sport und Mathematik fand keine dieser Schranken, sondern ein Vergleich über
**seltene Fachbegriffe**: Wörter, die in höchstens vier Karten vorkommen, sind aussagekräftig –
teilen sich zwei Karten drei oder mehr davon, lohnt der Blick. Als Dauerschranke taugt das nicht
(zu viele Fehlalarme), als Werkzeug beim Aufräumen sehr wohl.

Bei der Gelegenheit sind die Teilgebiete sortiert worden: Ableitungen, Integrale und Grenzwerte
stehen jetzt in **Analysis** statt in Schulmathe, Wahrscheinlichkeiten in **Stochastik**,
Vektoren in **Linearer Algebra**; im Sport wanderten Kraftstoß und Bewegungsphasen in die
**Bewegungslehre**, Doping und Verletzungen in die **Sportmedizin**, Methodik in die
**Sportdidaktik**. Die Kennungen hängen am Fragetext – der Lernfortschritt bleibt dabei erhalten.

Was sich **nicht** absichern lässt: dieselbe Erklärung in anderen Worten. Bei der Schwelle, die
die beiden Fakten-Dubletten fängt, kommen 15 Fehlalarme mit. Solche Fälle findet nur, wer die
Dateien liest.

### Quer-Audit und Wartungsliste

Nachdem jede Karte einzeln geprüft war, hat ein Quer-Audit (August 2026) erstmals alle
1.900 Karten **gegeneinander** gelesen: Widersprüche zwischen Karten, Dubletten über
Dateigrenzen hinweg – die bekannte blinde Stelle der automatischen Schranke – und
Behauptungen, die durch Zeitablauf falsch werden können. Ergebnis: sieben strukturelle
Befunde, alle behoben. Vier Dubletten wurden nicht gelöscht, sondern zu einem anderen
Abrufziel umgebaut (Begriff → englischer Fachterm, Definition → Beispiel-Erkennung,
Autor → Werk, Frist → Ausnahmen), jeweils mit `p`-Migration; ein Widerspruch
(Innenohr „verarbeitet“ vs. Kleinhirn „steuert“ das Gleichgewicht) wurde auf „misst“
präzisiert. Bewusst behalten: das Marathon-Paar (Wortherkunft und Perserkriegs-Schlacht
sind verschiedene Abrufwege), das Descartes-Paar (Übersetzung vs. Urheber) und die
Antibiotika-Einnahme-Karte (siehe Widerlegungen oben).

Der zweite Ertrag ist diese **Wartungsliste**: Behauptungen, die heute stimmen, aber
kippen können. Wer die Sammlung pflegt, prüft sie einmal im Jahr – der jeweilige
Auslöser steht dabei.

- **Zählwerte per Beschluss:** EU-Mitglieder 27 (nächster Beitritt), Euro-Länder 21,
  Europarat 46, UNO 193, 96 deutsche EU-Parlamentssitze (jede Europawahl),
  Bundestag 630 (Wahlrechtsreform), Fünf-Prozent-Hürde samt Grundmandatsklausel
  (BVerfG verlangt Neuregelung), DAX 40, sechs Lohnsteuerklassen (III/V-Reform),
  Mehrwertsteuer 19/7 % (Gastronomie 2026), Abgeltungsteuer 25 % + Soli,
  Mietkappung 20/15 %, Pfandsätze 25/8/15 Cent, EZB-Ziel 2 % (Strategieüberprüfung),
  Periodensystem 118 (IUPAC-Anerkennung von Element 119/120).
- **Laufende Rekorde und Rankings:** Burj Khalifa höchstes Gebäude (Jeddah Tower),
  Tokio größte Metropolregion (UN sehen Delhi um 2028–2030 vorn), Minecraft
  meistverkauft, Chanel No. 5 „gilt als“ meistverkauft, Finnland Kaffee-Weltmeister,
  Umsatzsteuer „knapp vor“ der Lohnsteuer, Indonesien größte muslimische Bevölkerung
  und Hauptstadt Jakarta (Umzug nach Nusantara), „beide über 1,4 Milliarden“
  (China fällt Ende des Jahrzehnts darunter), Srebrenica-Einordnung „seit 1945“,
  ISS „ununterbrochen bewohnt“ (geplanter Absturz um 2030), „Die Mausefalle“ läuft
  seit 1952, Energieklasse-A-Kontext („kaum ein Gerät erreicht A“).
- **Amts- und Serienstände:** Kanzler-Aufzählungen enden bei Merz (Zählstand 6:4),
  Nixon „bislang einziger“ Rücktritt, Facebook-Mutter „heißt seit 2021 Meta“,
  Musk „wurde später Chef“ von Tesla, Earhart-Wrack „nie gefunden“ (aktive Suche),
  G7-Aufzählung, Pariser Abkommen „fast alle Staaten“, Zeitumstellung (EU-Abschaffung
  schwebt seit 2019).

Drei Karten wurden dabei vorsorglich gehärtet: Die Weltbevölkerungs-Karte nennt jetzt
die 9-Milliarden-Prognose, die Schaltsekunden-Karte das beschlossene Auslaufen bis 2035,
der CO₂-Fußabdruck die sinkende Tendenz.

### Kartenkennungen

Die Kennung einer Karte ist ein Hash ihres Fragetextes. Das hält sie stabil, wenn Karten
ergänzt oder umsortiert werden – aber eine **umformulierte Frage** bekommt eine neue Kennung,
und der Lernfortschritt dazu wäre still verloren.

Zwei Vorkehrungen verhindern das:

- `data/kennungen.json` führt den Bestand. `npm run check` meldet jede Kennung, die ohne
  Nachfolger verschwindet, als Fehler.
- Wer eine Frage umschreibt, trägt den alten Wortlaut bei der Karte unter `p` ein
  (`p:"alte Fassung der Frage"`, auch als Liste). Die App hebt den gespeicherten Stand beim
  Start auf die neue Kennung – samt Markierung.

Eine dritte Stelle konnte Karten still an den falschen Ort legen: `scripts/merge-cards.mjs`
ordnet neue Karten über ihr Teilgebiet einer Datei zu und ging davon aus, dass Teilgebiete
eindeutig sind. Seit „Verfahren erkennen" in Mathematik **und** Sport existiert, stimmt das
nicht mehr – das Skript nahm einfach die erste Datei und hätte Sportkarten nach `data/mat.js`
geschrieben. Es verlangt jetzt bei mehrdeutigen Teilgebieten ein ausdrückliches Feld `cat` und
weist alles andere ab. Ein Test prüft das mit, weil falsch abgelegte Karten beim Lesen des
Diffs kaum auffallen.

Nach dem Umformulieren einmal `node scripts/check-content.mjs --kennungen` laufen lassen,
damit die Liste den neuen Stand kennt.

### Bedienung ohne Farbe, ohne Blick, ohne Verlust

Drei Stellen kosteten Nutzer etwas, ohne dass es beim Ausprobieren auffiel.

**Richtig und falsch hingen allein an der Farbe.** Nach dem Antworten unterschied nur
der Hintergrund die richtige von der gewählten Option – grün gegen rot, bei ähnlicher
Helligkeit. Rund acht Prozent der Männer trennen die beiden nicht zuverlässig. Screenreader
erfuhren das Ergebnis über die Live-Region, sehende Farbfehlsichtige nicht. Jetzt ersetzt
ein **Haken** bzw. ein **Kreuz** den Buchstaben im Feld; die übrigen Optionen behalten ihren.

**Der Fokus fiel bei jeder Karte auf `body`.** Jedes `innerHTML` zerstört das fokussierte
Element – mit VoiceOver begann der Lesecursor deshalb bei *jeder einzelnen Frage* wieder
ganz oben und musste über Beenden-Knopf, Fortschrittsbalken und Zurücknehmen hinweg. Frage
und Lösung tragen jetzt `tabindex="-1"`, und nach jedem Aufbau wandert der Fokus auf das
letzte Ziel: bei der Frage auf die Frage, nach dem Aufdecken auf die Lösung. `preventScroll`
und eine Regel gegen den Rahmen sorgen dafür, dass für alle anderen optisch nichts passiert.
Beim Aufdecken war ein zweiter Griff nötig – dort wird die Lösung **angehängt**, nicht neu
gerendert; der Test hat genau diese Lücke gefunden, nachdem der erste Teil schon grün war.

**„Speicher voll" war eine Fünf-Sekunden-Meldung.** Schlug das Schreiben fehl, kam genau
eine Kurzmeldung, und `quotaWarned` verhinderte jede weitere – zurückgesetzt wird das Flag
nur durch einen *erfolgreichen* Schreibvorgang, den es bei wirklich vollem Speicher nie
gibt. Danach konnte man eine Stunde weiterlernen, ohne dass etwas ankam: der einzige Pfad
der App, auf dem Antworten still verschwinden. Jetzt steht ein **Aktionsbalken**, bis
gesichert wurde, mit dem Sichern-Knopf gleich daneben. Er verdrängt ein wartendes
Update-Angebot nicht, sondern stellt es zurück und holt es nach – sonst wäre das Angebot
nach einem einzigen Speicherfehler bis zum nächsten Start verschwunden.

**Bilder, die ihre Auskunft nur im `title` tragen.** Die Heatmap besteht aus 84 Zellen
`<i title="…">`, die Wochenvorschau aus sieben Säulen derselben Bauart. Auf iOS wird
`title` nie angezeigt und von VoiceOver unzuverlässig gelesen – beide Karten waren für
Hilfsmittel schlicht leer. Jetzt sind die Bilder `aria-hidden` und tragen einen Satz
daneben: „X von Y Tagen gelernt, zusammen N Antworten" bzw. die sieben Tageswerte im
Klartext. Dasselbe Muster benutzte die Datei an zwei anderen Stellen längst.

**Ein Klassenname war doppelt vergeben – mit sichtbarer Folge.** `.merk` stylt eine
kleine Marke am Zeilenende („pausiert"): 11 px, fett, Akzentfarbe, Pillenform. Dieselbe
Klasse trug versehentlich auch den Auflösungstext der Merkanker. Ein mehrsätziger
Erklärtext erschien dadurch als **vierzeilige Pille in fettem Akzentrot** statt als ruhiger
Fließtext – nachgemessen im Browser: `display:inline-block`, `border-radius:999px`,
`font-size:11px`, 315 × 70 px. Der Text hat jetzt eine eigene Klasse. Gefunden wurde das
nicht durch Lesen, sondern durch einen Screenshot mit ausgelesenen berechneten Stilen; der
bestehende Test suchte nach der alten Klasse und wäre nach dem Umbenennen aus dem falschen
Grund grün geblieben (kein Element ist auch „unsichtbar") – er prüft jetzt die Existenz mit.

**Der Rückblick nach der Runde war reiner Lesetext.** Er zeigte Frage, Antwort und Kontext
der verfehlten Karten offen nebeneinander – nach der eigenen Regel dieser App die
schwächste Lernform. Die Lösung steht jetzt hinter „Erst überlegen – dann aufdecken",
demselben Muster wie beim Merkanker; der Aufdeck-Handler ist dafür in eine gemeinsame
Funktion gewandert.

**Die Duell-Uhr existierte nur visuell.** Ein `<div class="bar">` ohne Rolle und ohne Text:
Ohne Sicht bekam man weder mit, dass die Zeit läuft, noch dass sie fast um ist – die Frage
löste sich einfach auf. Der Balken ist jetzt `aria-hidden`, dafür nennt ein Satz das Limit,
und fünf Sekunden vor Schluss kommt **einmalig** eine Ansage. Einmalig ist wichtig: Eine
Live-Region, die zehnmal je Sekunde schreibt, macht das Vorlesen der Frage unmöglich.

### Was die Startseite kostet – und was bewusst teuer bleibt

`overview()` liefert die Kennzahlen der Startseite und lief bei jedem Aufbau **2,44 ms**
(gemessen an einem realistischen Halbjahresstand: 800 gelernte Karten, 400 Tage Verlauf,
94 kB). Zwei Posten waren reine Doppelarbeit: `dueCards()` lief zweimal – einmal direkt,
einmal über `newBudget() → imRueckstau()` –, und für die eine Zahl „wie viele neue Karten
gibt es noch" baute `newCards()` die **komplette Warteschlange** auf, mit Sortieren je
Kategorie, Mischen und Reihum-Verteilung. Beide Zahlen fallen jetzt dort ab, wo ohnehin
gerechnet wird: `dueCards()` wird einmal ermittelt und durchgereicht, der Vorrat in der
Schleife mitgezählt, die ohnehin über alle Karten läuft. Ergebnis: **1,04 ms**, gemessen
mit demselben Aufbau.

Der Test dazu war zweimal zu schwach, bevor er gegriffen hat – und das ist die eigentliche
Lehre. Erster Versuch: Der Aufbau enthielt gar keine Karte, die *einen Zustand hat, aber nie
abgefragt wurde* (`seen === 0`). Genau die gilt als neu, und genau die übersieht eine
Zählung, die nur auf einen fehlenden Zustand schaut. Zweiter Versuch, mit solchen Karten:
immer noch grün – weil `newLeft` ein `Math.min(Budget, Vorrat)` ist. Bei Budget 12 und einem
Vorrat von 1875 oder 1900 kommt beide Male 12 heraus; der Zählfehler war **maskiert**. Erst
ein Aufbau, in dem der Vorrat *kleiner* ist als das Budget – alles auf gesehen, dann genau
drei Karten mit Zustand ohne Abfrage – macht den Fehler sichtbar. Ein Test, der eine
absichtlich kaputte Fassung nicht rot färbt, prüft nichts; hier hat erst der dritte Anlauf
wirklich geprüft.

**Nicht gemacht: die Fassungsnummer aus dem Speicher herauslösen.** `save()` liest und
parst vor jedem Schreiben den kompletten Stand, nur um zu erkennen, ob ein zweiter Tab
inzwischen geschrieben hat – gemessen **1,91 ms** je Schreibvorgang. Eine separate
Mini-Zelle nur für die Fassungsnummer würde das auf den seltenen Fall beschränken, dass
wirklich jemand voraus ist. Dagegen sprechen drei Dinge: Der Gewinn landet **nicht** auf dem
kritischen Pfad (`save()` ist um 250 ms verzögert und läuft nach dem Bildaufbau, 2 ms sind
dort unsichtbar); zwei Schlüssel statt einem sind **nicht mehr atomar**, die Schreibreihenfolge
wird sicherheitsrelevant und öffnet ein neues Zeitfenster zwischen den beiden Schreibvorgängen;
und betroffen wäre ausgerechnet die Zwei-Tab-Logik, die sich diese App mühsam erarbeitet hat
und mit einem eigenen Zwei-Instanzen-Test absichert. Ein unsichtbarer Gewinn rechtfertigt
kein Risiko an der Stelle, an der Datenverlust entstünde. Die Messung steht hier, damit die
Frage nicht dreimal neu aufgeworfen wird.

### Qualitätssicherung

`npm run check` prüft nicht nur auf fehlende Felder und doppelte Fragen, sondern auch
darauf, ob sich eine richtige Antwort schon an ihrer **Form** verrät:

- ein Klammerzusatz, den nur die Lösung trägt,
- eine Einheit, die nur in der Lösung ausgeschrieben ist („9 Kilokalorien" gegen „4"),
- eine Antwort, die deutlich länger ist als alle drei Ablenker,
- eine Zahl, die eine Frage beiläufig nennt und damit die Antwort einer **anderen** Karte
  verrät.

Der letzte Punkt ist der jüngste und war der schwerste zu fassen. Der harmlose Fall ist
häufig und egal: Dass „Niedersachsen" in irgendeiner Frage vorkommt, verrät nicht, welches
Bundesland an die meisten anderen grenzt – über den ganzen Bestand sind das 23 solcher Fälle,
alle unschädlich. Schädlich ist der enge Fall: Eine Karte fragt nach einer Zahl, und eine
andere Frage zum selben Gegenstand nennt sie nebenbei. Drei Bedingungen zusammen trennen ihn
sauber, und jede einzelne war nötig:

1. Die Antwort ist eine bloße Zahl oder ein Zahlwort.
2. Beide Fragen liegen inhaltlich dicht beieinander – verglichen über die ersten sechs
   Buchstaben, sonst zählt „pädagogische" nicht als „pädagogischen" und der Fall rutscht durch.
   Genau daran scheiterte der erste Versuch: Die Prüfung meldete nichts.
3. Die Zahl steht **frei im Satz**. Ohne diese Bedingung meldete die Prüfung auch „Welche
   Dezimalzahl ergibt der Bruch 1/3?" und „die Folge (1 + 1/n) hoch n" – dort ist die Ziffer
   Teil einer Formel und verrät nichts.

So eingestellt findet die Prüfung über den ganzen Bestand **genau zwei** Fälle und keinen falschen.
Beide sind behoben.

Dieselbe Regel auf **Wortantworten** auszuweiten bringt dagegen nichts, und das ist gemessen:
Von 14 Kandidaten war kein einziger echt. „Deutsch", „Afrika" und „Der Bundestag" stehen in
vielen Fragen, ohne irgendetwas zu verraten – dass „Niedersachsen" irgendwo vorkommt, sagt
nicht, welches Bundesland an die meisten anderen grenzt. Zahlen sind der Sonderfall, weil eine
genannte Zahl die Antwort *ist* und nicht bloß ein Stichwort. Die Prüfung bleibt deshalb bei
Zahlen.

Solche Karten lassen sich ohne Wissen lösen. Wer immer die längste Option wählt, traf in
einer frühen Fassung in 47 % der Fälle richtig statt in 25 % wie beim Raten – das verfälscht
die Trefferquote und lässt den Scheduler zu optimistisch planen. Nach der Überarbeitung von
287 Kartensätzen liegt der Wert bei 23,8 %; `npm run check` gibt ihn bei jedem Lauf aus und
schlägt oberhalb von 32 % fehl.

Dieselbe Prüfung meldet eine zweite Ratestrategie: Bei Zahlenkarten liegen die Ablenker oft
symmetrisch um die richtige Antwort. Wer beide Extremwerte streicht, rät dann mit 50 statt
25 Prozent. Gezählt wird nur, wo die Strategie greift – vier Optionen mit je genau einer Zahl
und gleichem Text davor und dahinter; „11. November 1918" neben „28. Juni 1919" ist keine
sortierbare Reihe. Der Wert lag bei 81,9 % von 105 Karten.

Automatisch **gespiegelt** wird trotzdem nicht. Ein Versuch, die Ablenker maschinell auf die
andere Seite zu legen, hätte „110" neben „112", die alten 16 % Mehrwertsteuer neben den
heutigen 19 % und 400 Volt neben 230 Volt durch beliebige Zahlen ersetzt. Genau diese Ablenker
tragen den Lehrwert der Karte: Dass die richtige Antwort zwischen ihnen liegt, ist dann die
Folge guter Ablenker und nicht ihr Fehler.

Die frühere Schätzung, es blieben nach Ausschluss dieser Karten „ganze drei" übrig, war zu
pessimistisch – sie stammte aus dem Versuch, ganze Ablenkersätze am Stück zu tauschen. Von
Hand durchgesehen trugen **22 der 86** Karten Ablenker, die nichts erklären: rund gegriffene
Nachbarwerte, die nur den Abstand zur Lösung füllen. Bei ihnen wurde je ein Wert getauscht,
mehrfach gegen einen, der selbst etwas beibringt – 11 statt 12 Bundesländer (die alte BRD),
4 kg statt 10 kg (die Kugel der Frauen), 598 statt 800 Abgeordnete (die alte Sollgröße des
Bundestags), 43.200 statt 100.000 Sekunden (ein halber Tag), 27 und 39 statt 12 und 150
(die Bücher des Neuen und des Alten Testaments). Die Klammerquote fiel damit von 81,9 % auf
**61,0 %**, ohne dass eine Karte an Aussage verlor.

Der Rest bleibt so: alle 16 Mathematikkarten (ihre Ablenker sind die typischen Rechenfehler),
alle 7 Geschichtskarten (jede Jahreszahl ist selbst ein Anker) und jede Karte, deren Ablenker
etwas bedeuten – 2,24 m Netzhöhe der Frauen, 92 als letztes natürliches Element, 1,62 m/s²
Mondschwerkraft, 48 Staaten vor Alaska, die Pfandstufen 8 und 15 Cent, die Promillegrenzen
0,3 / 0,8 / 1,1. Die Schranke im Prüfskript liegt jetzt bei 70 % statt 85 %: Sie fängt weiter
den systematischen Fall ab, in dem Ablenker maschinell um die Antwort gelegt werden, hält
aber den erreichten Stand fest.

Eine zweite Handdurchsicht hat die Quote später von 61,0 % auf **49,1 %** gebracht – also auf
Zufallsniveau, „nimm die Mitte" verrät nichts mehr. Getauscht wurde wieder nur je ein Wert und
nur, wo er reiner Füllwert war; mehrfach kam etwas Lehrreicheres zurück: 9.999 statt 100.000
Code-Möglichkeiten (der klassische Zählfehler von 0000 bis 9999), 225 statt 1024 für FF
(die verführerische Rechnung 15 · 15), 55 statt 21 Dominosteine (das Doppel-Neun-Spiel),
1147 statt 1066 beim Kreuzzug und 1815 statt 1888 beim Kaiserreich (je ein Anker für einen
Anker). Wo der Ablenker selbst Wissen trägt, blieb er auch diesmal stehen – 1967 bei der
Staatsgründung Israels, 28 Zähne ohne Weisheitszähne, 180 als Dart-Maximum mit drei Pfeilen,
die 28 EU-Staaten vor dem Brexit; ein bereits getauschter 1967er-Wert wurde deshalb wieder
zurückgenommen.

Das Skript, das die Ablenker automatisch spiegeln konnte, ist gelöscht. Es lag noch in
`scripts/`, war in keinem npm-Befehl eingetragen und tat genau das, was hier als schädlich
gemessen und verworfen wurde. Ein lauffähiges Werkzeug für eine verworfene Entscheidung ist
eine Falle: Ein einziger Aufruf hätte die Ablenker eingeebnet, die den Lehrwert tragen. Die
Kennzahl selbst meldet weiterhin `npm run check`.

Der Planer wird zusätzlich als **Eigenschaftstest** geprüft: 16.000 zufällige Bewertungsfolgen –
mal früh, mal pünktlich, mal verspätet beantwortet – gegen die Zusicherungen, die immer gelten
müssen (Intervall in Grenzen, Termin nie in der Vergangenheit, kein Schrumpfen nach richtiger
Antwort, kein Vorziehen eines Termins). Dazu ein Raster über alle Ausgangslagen: „Leicht" darf
nie früher wiederkommen als „Gut", „Gut" nie früher als „Schwer" – sonst bestraft die App
ehrliche Selbsteinschätzung. Der Startwert des Zufalls liegt fest, ein Fehlschlag ist also
reproduzierbar und nicht „manchmal rot".

Die 79 Einheitentests decken den Scheduler (Intervallgrenzen, Wachstumsgarantie, Vorschau),
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
96 % der Fälle verziehen, und übliche Schreibvarianten müssen durchgehen – klein geschrieben,
mit Punkt am Ende, ohne den Artikel vorn, mit umschriebenen Umlauten und ohne einen
nachgestellten Klammerzusatz. Der letzte Punkt kostete zuvor Treffer: Wer auf
„Stickstoff (78 %)" nur „Stickstoff" tippte, bekam kein Häkchen, obwohl das die Antwort ist.

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

Ebenfalls gemessen statt behauptet: Jedes Tippziel muss die von Apple genannten 44 × 44
Punkt erreichen, und jeder Knopf braucht einen Namen für die Sprachausgabe. Der Stern zum
Markieren war 32 px groß und ließ sich mit dem Daumen kaum treffen.

Dazu zwei Satzfehler, die man auf einem kleinen Bildschirm leicht übersieht: waagerecht
abgeschnittener Inhalt und ein einzelnes Bruchstück auf der letzten Zeile. Der Schalter in
den Einstellungen ragte 4 px aus seiner Zeile heraus, und am ersten Tag standen „0" und „%"
untereinander, weil der Text daneben die Spalte zu schmal machte.

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

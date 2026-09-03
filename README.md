# Wissenswerk

Ein Allgemeinwissen-Trainer als Web-App fürs iPhone. Statisch, offline-fähig, ohne Konto –
alles läuft im Browser, der Lernfortschritt bleibt auf dem Gerät.

**2.127 Karten** in neun Themen, aufgebaut in drei Stufen: Basis (Schulwissen Klasse 5–8),
Solide (gute Allgemeinbildung), Profi (das, was Quizduelle entscheidet).
Schwerpunkte liegen auf **Sport** (326 Karten: Trainingslehre, Anatomie, Bewegungslehre,
Sportmedizin, Sportdidaktik, Sportpsychologie) und **Mathematik** (313 Karten: Grundlagen,
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

#### Was wachsen darf – und was nicht

„Alle Zähler wachsen nur" stimmte nicht für alles, was im Zustand steht, und an vier Stellen
log das Ergebnis:

- **Markierungen.** Sie kannten beim Zusammenführen nur Wachstum. Mit zwei offenen Tabs ließ
  sich damit kein einziger Stern löschen: Der andere Tab holte ihn beim nächsten Schreiben
  zurück, und „Alle Markierungen löschen" war wirkungslos. Eine Markierung ist deshalb kein
  `true` mehr, sondern ein **Zeitpunkt**; ein negativer Wert ist ein Grabstein – entfernt zu
  diesem Zeitpunkt. Es gewinnt der jüngere Stempel, bei Gleichstand der Grabstein, damit beide
  Tabs zum selben Ergebnis kommen. Grabsteine werden nach 90 Tagen weggeräumt. Alte Stände mit
  `true` gelten als Stempel 1 und verlieren gegen jede spätere Entscheidung.
- **Die Serie.** `streak` stand in der Maximum-Liste, obwohl `touchStreak()` sie nach einer
  Pause bewusst auf 1 zurücksetzt – der zweite Tab hob sie wieder auf den alten Wert. Die
  Serie gehört jetzt zu dem Stand, der zuletzt gelernt hat (späteres `lastDay` gewinnt). Der
  **Rekord** bleibt beim Maximum: Er ist eine Bestmarke und fällt nie.
- **Merkanker und Selbsteinschätzung.** `claims`, `claimsMiss`, `factSeen` und `factIdx`
  standen in gar keiner Regel und fielen auf den Stand des schreibenden Tabs zurück – die
  Merkanker fingen von vorn an. Die drei Zähler wachsen jetzt mit; `factIdx` zeigt in eine
  Liste und wandert deshalb mit dem `factSeen`, zu dem er gehört.
- **Die Deckelung nach einem Duellfehler.** Beim Kartenvergleich entscheidet allein `last`,
  welcher Stand der jüngere ist – und `nachDuellFehler()` setzte das Feld nicht. Die gedeckelte
  Karte sah damit genauso alt aus wie die ungedeckelte im anderen Tab, und die Deckelung fiel
  beim nächsten Speichern still wieder weg.

Jeder der vier Fälle hat einen Test, der zwei echte Modulinstanzen gegeneinander fährt und
gegen den alten Stand fehlschlägt.

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
  „Sport“ öffnet die dreizehn Teilgebiete von Trainingslehre bis Rekorde, jedes mit eigenem
  Fortschritt. Vor einer Klausur in Bewegungslehre übt man genau diese Karten.
- **Quiz** – der Prüfstand der App: zwölf Fragen quer durch alle Themen, 15 Sekunden pro
  Frage, zehn Punkte je Treffer und fünf dazu, wenn die Antwort in den ersten fünf Sekunden
  kommt. Gezogen wird auch, was nie gelernt wurde – ein Quizspiel fragt nicht nur nach dem
  Gelernten. Am Ende zeigt das Ergebnisbild, **wo die Punkte blieben**: getrennt nach falsch,
  zu langsam und ohne Blitzbonus, und je Thema. Jede verfehlte Frage – falsch *oder*
  abgelaufen – landet im nächsten Tagestraining. Die Entscheidungen dahinter stehen unten
  unter „Der Quizmodus".
- **Duell** – zehn Fragen mit Schwerpunkt auf dem Gelernten, aufgefüllt mit Neuem, 15 Sekunden
  pro Frage. Beide teilen sich Uhr, Reiter und Zähler. Der Unterschied liegt nicht in der
  Ziehung – auch das Duell greift in den Gesamtbestand, wenn das Gelernte nicht reicht –,
  sondern darin, was danach passiert: Das Quiz plant eine entdeckte Lücke aktiv ein.
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

**Live:** <https://merry-mooncake-4ddc2a.netlify.app/>

Die App braucht keinen Build-Prozess und keine Abhängigkeiten.

**Weg 1 – aus GitHub (empfohlen, aktualisiert sich bei jedem Push):**
1. [app.netlify.com](https://app.netlify.com) → *Add new site* → *Import an existing project*
2. GitHub verbinden, dieses Repository und den Branch wählen.
   **Achtung beim Branch:** Dieses Repository hat kein `main`. Der Produktivzweig heißt
   `claude/general-knowledge-learning-app-6sldd8` und ist zugleich der Standardzweig.
   Netlify schlägt gern `main` vor – das ginge ins Leere.
3. Build command: `node scripts/make-sw.mjs` · Publish directory: `.`
   (steht bereits in `netlify.toml`, Netlify übernimmt es automatisch)
4. *Deploy* – fertig.

**Weg 2 – ohne GitHub:** Ordner auf [app.netlify.com/drop](https://app.netlify.com/drop) ziehen.
Achtung: So eine Seite holt sich **nie** etwas von GitHub. Sie bleibt für immer auf dem Stand
des hochgeladenen Ordners, egal wie oft danach gepusht wird.

### Welche Fassung liegt gerade draußen?

Zwei Wege, den veröffentlichten Stand mit dem Repository zu vergleichen:

- **Ohne Technik:** Seite in Safari öffnen → **Mehr** → ganz unten steht `N Karten · Wissenswerk`.
  Diese Zahl wächst mit jeder Ergänzung und verrät den Stand eindeutig.
- **Genau:** `<Adresse>/sw.js` **im privaten Tab** aufrufen. In der dritten Zeile steht
  `const VERSION = 'wissenswerk-…'`. Dieselbe Kennung gibt `node scripts/make-sw.mjs`
  hier im Repository aus. Stimmen beide überein, ist der Stand draußen aktuell.
  Der private Tab ist nötig, weil ein aktiver Service Worker jede *Navigation* als Anfrage
  nach dem Grundgerüst behandelt und die App ausliefert – im normalen Tab bekäme man also
  die Oberfläche zu sehen statt des Quelltexts.

## Entwicklung

```bash
npm run dev        # lokaler Server auf http://localhost:8080
npm test           # 135 Einheitentests plus Inhaltsprüfung
npm run test:e2e   # 188 Durchlaufprüfungen im iPhone-Viewport (braucht Playwright)
npm run test:offline # 29 Prüfungen am Service Worker: Offline-Start, Update, Fassungsanzeige
npm run test:all   # alles zusammen
npm run check      # nur die Inhaltsprüfung
npm run abdeckung  # wie viele typische Quizfragen die Sammlung beantwortet
npm run luecken    # Begriffe, die vorkommen, ohne je Antwort zu sein
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

**Eine Lücke im Bestand heilte nie.** Der Browser räumt bei Platzmangel einzelne Einträge weg,
und eine Veröffentlichung kann auf halbem Weg stehenbleiben. Fehlte dabei ausgerechnet das
Grundgerüst, half kein weiterer Aufruf: Der `fetch`-Handler **las** es unter `./index.html`,
**legte** die Antwort aber unter der Anfrage-URL ab – bei einem Aufruf von `/` also unter `/`.
Jeder Aufruf mit Netz gelang und verdeckte den Schaden; ohne Netz stand statt der App die
nackte Zeile „Offline". Gelesen und geschrieben wird jetzt unter demselben Namen.

Der Prüfstein dafür musste zweimal umgebaut werden. Ein Neuladen der Seite bewies nichts –
Chromium bedient es notfalls aus seinem eigenen Zwischenspeicher –, und `setOffline` ebenso
wenig: Abrufe, die der Service Worker selbst absetzt, gehen an der Offline-Nachstellung des
Browsers vorbei. Beide Fassungen waren grün, obwohl der Fehler danebenlag. Erst als der
Testserver das Grundgerüst selbst verweigert, misst der Test, was er behauptet.

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

### Sonderzeichen, die kein deutsches Tastenfeld hergibt

„Brasília", „Reykjavík", „Jørn Utzon", „Bedřich Smetana" – wer die Antwort weiß, tippt
`Brasilia`, `Reykjavik`, `Jorn Utzon`, `Bedrich Smetana`, denn í, ø und ř stehen auf keiner
deutschen Tastatur. Die Umschrift kannte aber nur eine handverlesene Liste (é, à, ç, ñ); alles
andere fiel dem Muster `[^a-z0-9]` zum Opfer und **zerriss dabei das Wort**: Aus „Brasília"
wurde `bras lia`, und die richtige Antwort galt als glatt falsch. Sieben Karten waren so nicht
lösbar.

Statt die Liste zu verlängern – sie hätte immer nur die Zeichen gekannt, an die jemand gerade
dachte – zerlegt `normalize()` den Text jetzt in Grundbuchstabe plus Zeichen und wirft die
Zeichen weg. **Nach** der deutschen Umschrift: „Öl" bleibt `oel` und wird nicht zu `ol`.
Umlaute kann man auf einer deutschen Tastatur schließlich tippen – „Konigs" statt „Königs" ist
ein Schreibfehler, kein Tastaturproblem, und dafür ist die Fehlertoleranz zuständig. Ein Test
prüft alle 2073 Antworten daraufhin durch.

### „Weitermachen" wechselte still das Thema

Nach einer Runde bietet der Rückblick „Weitermachen" an. Er kannte dafür nur den *Modus* und
baute für alles außer dem Duell einfach den Tagesplan. Wer gezielt Sport übte, ein Teilgebiet
durchging, die Wackelkandidaten nacharbeitete oder seine markierten Karten wiederholte, bekam
beim Weitermachen etwas anderes – ohne dass irgendwo stand, dass gewechselt wurde.

Die Runde trägt jetzt ihre eigene Fortsetzung mit sich: Wer sie startet, weiß am besten, was
weitergehen soll. Der Rückblick ruft nur noch auf, was ihm mitgegeben wurde. Der Durchlauftest
prüft es an einer Themenrunde – und musste dafür erst das Tagespensum hochsetzen: Nach zwanzig
Karten war der Tagesplan aufgebraucht, „Weitermachen" fiel auf die Wackelkandidaten zurück,
und die waren im Test zufällig auch alle aus Sport. Der Test war grün, obwohl der Fehler
danebenlag.

### Was läuft hier eigentlich – und ist etwas Neues da?

Der Balken „Neue Fassung bereit" beantwortete nur die halbe Frage. Nach dem Tippen auf „Laden"
lud die Seite neu, und **niemand sagte, ob es geklappt hat**. Auch sonst gab es keine Stelle,
an der man hätte nachsehen können, welche Fassung gerade läuft.

**Der erste Anlauf fragte den Service Worker danach – und das war der Umweg zu viel.** Er
kannte seine Fassung, beantwortete sie brav über den Port der Anfrage, und trotzdem taugte es
nichts: Im **privaten Tab** steuert kein Worker, beim allerersten Aufruf noch keiner, und eine
ältere Fassung beantwortet die Frage gar nicht. In allen drei Fällen stand in den Einstellungen
„wird beim ersten Start eingerichtet" statt einer Auskunft – ausgerechnet dann, wenn man
nachsehen will, ob die neue Fassung überhaupt ankommt. Genau in dieser Lage stand ich, als eine
veraltete Netlify-Auslieferung zu klären war.

Jetzt schreibt der Build die Kennung **in die App**: `scripts/make-sw.mjs` erzeugt
`assets/js/fassung.js` mit derselben Kennung, die auch der Service Worker trägt. Die App
vergleicht sie beim Start mit der zuletzt gemerkten. Weicht sie ab, kommt die Meldung
**„Aktualisiert – Wissenswerk läuft jetzt in der neuen Fassung"**, auch für Sprachausgabe. Ohne
Worker, ohne Netz, ohne Wartezeit.

Diese eine Datei bleibt aus der Kennungsberechnung heraus – sie enthält die Kennung, sie kann
sie nicht mitbestimmen. Ausgeliefert und offline vorgehalten wird sie trotzdem. Der Build
bricht ab, wenn sie fehlt, und zwei Läufe hintereinander ergeben dasselbe Ergebnis.

Dazu eine Karte unter **Mehr → Fassung**: die installierte Fassung mit dem Datum, seit dem sie
läuft, ein Knopf **Suchen** für die Nachfrage von Hand, und – falls etwas bereitsteht – **Neue
Fassung laden** an derselben Stelle wie der Balken. Das Datum wird nur fortgeschrieben, wenn
sich die Fassung wirklich geändert hat; sonst stünde dort nach jedem Start das heutige und die
Angabe wäre wertlos.

Eine Feinheit, die beim Bauen auffiel: `update()` stößt bei einer neuen Fassung erst das
Installieren an – das Ergebnis steht nicht sofort fest. Der Suchen-Knopf wartet deshalb kurz,
statt vorschnell „alles aktuell" zu behaupten.

**Der Prüfstein selbst war zuerst falsch gebaut.** Der Offline-Test stellte eine
Veröffentlichung nach, indem er nur `sw.js` austauschte. Solange die Kennung allein im Service
Worker stand, war das eine gültige Nachstellung – mit dem eingebackenen Stempel ist es keine
mehr: Ein echter Build tauscht **beide** Dateien, weil beide aus ihm entstehen. Nur `sw.js` zu
ersetzen ergibt einen neuen Cache-Schlüssel bei unveränderter App, und die Meldung
„Aktualisiert" bliebe dann zu Recht aus. Der Test wurde rot – zu Recht, aber am falschen Ende.
Er stellt jetzt beides um.

Der erste Sprung von einer Fassung ohne diese Anzeige meldet noch nichts: Es gibt keinen
gemerkten Vorgänger, mit dem sich vergleichen ließe. Ab dem übernächsten Update sagt die App
jedes Mal Bescheid.

### Drei Wege, auf denen das Update-Angebot verpuffte

Der Balken „Neue Fassung bereit" hatte drei Löcher, alle drei still:

- **Erster Besuch.** Ob beim Start schon ein Service Worker die Seite steuerte, wurde einmal
  abgelesen und als Konstante behalten. Beim allerersten Besuch lautet die Antwort „nein" – und
  blieb es für die ganze Sitzung. Wurde in derselben Sitzung wirklich eine neue Fassung
  veröffentlicht, bewirkte „Laden" nichts Sichtbares, während der neue Worker den alten Bestand
  längst gelöscht hatte. Jetzt zählt nur noch, ob es der *erste* Wechsel dieser Sitzung ist.
- **Zweite Veröffentlichung.** Der Balken hielt eine feste Referenz auf den wartenden Worker.
  Erschien, während er stand, eine zweite neue Fassung, war diese Referenz überholt – der
  Browser stuft den vorherigen Worker als `redundant` ein, und „Laden" schickte seine Nachricht
  ins Leere. Die wartende Fassung wird jetzt erst beim Tippen abgefragt.
- **Abgebrochene Runde.** Während einer Runde wird das Angebot zurückgehalten. Nachgeholt hat
  es nur `endRun()` – eine ohne einzige Antwort abgebrochene Runde geht aber über `show()`.
  Das Angebot blieb bis zum nächsten Start liegen. Das Nachholen sitzt jetzt in `show()`
  selbst, damit *jeder* Weg aus einer Runde heraus es mitnimmt.

Alle drei haben einen Prüfstein im Offline-Test, und alle drei brauchten dafür einen **eigenen
Browserkontext**: In einem gemeinsamen Kontext färbte ein stehengebliebener Balken aus dem
vorigen Abschnitt das Ergebnis, und zwei der drei Tests waren grün, obwohl der Fehler wieder
eingebaut war.

### Drei kleine Löcher, die zusammen die Fehlerjagd beschließen

- **`constructor` als Antwort.** Die Zahlwortliste („sieben" → `7`) war ein Objektliteral, und
  bei einem Objekt antwortet auch die Prototypenkette. Wer `constructor` tippte, bekam
  `function Object() { [native code] }` in die Bewertung. Es ist jetzt eine `Map`.
- **Der Rückblick, den ein zweiter Tab wegwischte.** Nach einer Runde steht der Rückblick mit
  der Liste der Karten, die man gerade falsch hatte. Er ist keine Ansicht, die `render()`
  kennt – schrieb der zweite Tab in diesem Moment, zeichnete der Horcher die zuletzt gewählte
  Ansicht, und der Rückblick war weg, ohne dass der Nutzer etwas getan hätte. Die Meldung über
  den fremden Stand kommt weiterhin, nur ohne Neuzeichnen.
- **Das Neuladen mitten in der Runde.** Tippt jemand im *zweiten* Tab auf „Laden", übernimmt
  der neue Service Worker für alle Tabs. Dieser hier lud daraufhin sofort neu und schluckte die
  offene Frage – ohne Vorwarnung, denn hier hatte niemand etwas getippt. Der Austausch wartet
  jetzt auf den nächsten Ansichtswechsel; die Module laufen so lange aus dem Speicher der Seite
  weiter.

Dazu die eine strittige Meldung, die zwei Prüfer unterschiedlich bewertet hatten: Beim
Einpflegen gewann ein eindeutiges Teilgebiet über ein ausdrücklich angegebenes Thema. Eine
Karte mit `cat:"spo"` und einem Teilgebiet, das es nur in Mathematik gibt, landete wortlos in
`data/mat.js`. Wer beides angibt und sich dabei widerspricht, hat einen Fehler gemacht und will
davon erfahren – die Karte wird jetzt abgewiesen.

Damit sind alle 25 bestätigten Befunde der Fehlerjagd abgearbeitet.

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

Alle zehn Datendateien sind einmal vollständig gegengelesen. Sprache & Literatur, Kunst & Unterhaltung
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

Die Übernahme lief allerdings **nur einmal beim Modulstart** – also vor jedem Einlesen. Wer
eine Sicherung zurückholte, verlor den Stand genau der Karten, deren Frage seither neu
formuliert worden war; derzeit wären das 16. Der Zustandsspeicher ruft die Übernahme jetzt
nach jedem ausdrücklichen Ersetzen erneut auf – Einlesen, Zurücksetzen, Wiederherstellen.

Zwei Fehler im Werkzeug konnten dabei still Schaden anrichten:

- Ein Vorgängertext `p` durfte auf eine **noch lebende** Karte zeigen. Dann räumte die
  Übernahme beim Start den Lernstand dieser Karte ab – sie trägt ja die Kennung, die eine
  andere Karte als ihre frühere Fassung beansprucht. Es genügt, den alten Wortlaut aus der
  falschen Zeile zu kopieren. `npm run check` weist das jetzt ab, ebenso zwei Karten, die
  dieselbe Vorgängerin beerben wollen.
- `scripts/merge-cards.mjs` maskierte Anführungszeichen und Schrägstriche, aber keine
  **Zeilenumbrüche**. Eine Karte mit Umbruch im Text hätte `data/*.js` syntaktisch zerstört –
  weiße Seite, und keine Prüfung hätte angeschlagen, weil die Skripte die kaputte Datei gar
  nicht mehr einlesen können. Weißraum wird jetzt eingeebnet, und vor dem Schreiben parst das
  Skript die erzeugten Zeilen selbst; was nicht parst, wird nicht geschrieben.

Nach dem Umformulieren einmal `node scripts/check-content.mjs --kennungen` laufen lassen,
damit die Liste den neuen Stand kennt.

### Der Doppeltipp, der eine Karte verbrannte

Die Bewertungsknöpfe einer Karte und die Festlegen-Knöpfe der nächsten stehen an
**derselben Stelle im Fuß**. Gegen einen zweiten, schnellen Tipp war bisher nur die eine
Richtung geschützt (aufdecken → benoten); die Gegenrichtung nicht. Wer nach dem Benoten
noch einmal zutippte, legte sich damit für eine Karte fest, die er nie gelesen hatte, und
deckte sie gleich auf. Die Karte war verbraucht, und die selbst vergebene Note ging über
`schedule()` dauerhaft in Leichtigkeitsfaktor und Intervall ein.

Entprellt wird jetzt auch beim Aufbau jeder neuen Karte. Bewusst **nur der Fuß**: Die
Antwortoptionen liegen im Rumpf, wo es keine Kollision gibt – sie bleiben sofort tippbar,
damit im Duell keine Zeit verfällt. Der Durchlauftest musste dafür lernen zu warten wie ein
Mensch; er klickte schneller, als eine Frage lesbar ist.

**Ein Test war zunächst wackelig – und das fiel nur auf, weil ein Lauf rot war.** Die erste
Fassung des Prüfsteins für die Duell-Auswahl schlug in etwa einem von dreizehn Läufen fehl.
Ursache war der Aufbau: Er machte *alle* sechzig Karten schwach, womit die Zusicherung
„schwache kommen bevorzugt dran" gar nichts mehr prüfte und nur noch Rauschen maß. Der neue
Aufbau trennt sauber – zehn wacklige, vierzig fest sitzende –, und die Schwellen sind
**ausgemessen** statt geraten: über 40 Versuche nie eine Karte in allen Runden, Anteil der
Wackligen zwischen 30 und 38 %. Der Test läuft jetzt 20-mal grün und 5-mal rot, wenn man den
Fehler wieder einbaut. Ein Test, der manchmal grundlos rot wird, ist schlimmer als keiner:
Man gewöhnt sich an, ihn zu ignorieren.

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

### Die dünnste Flanke fürs Quizduell: Unterhaltung

Ein Abgleich der Sammlung gegen die Fragetypen echter Quizspiele legte eine Lücke offen, die
in der Fächerverteilung nicht auffällt: **Popkultur**. Film war mit 55 Karten gut ausgebaut,
Musik mit 67 – aber Fernsehserien kamen auf vier Karten, Videospiele auf vier, Comics auf vier.
In Quizduell und Trivial Pursuit ist „Unterhaltung" dagegen eine der sechs Hauptkategorien.

35 neue Karten schließen die Lücke, in drei neuen Teilgebieten: **Fernsehen** (15),
**Videospiele** (10) und **Comics** (10). Das Thema heißt deshalb jetzt **Kunst &
Unterhaltung** statt „Kunst & Musik" – ein Gebiet, das Serien und Videospiele enthält, sollte
sich nicht nach Musik benennen.

**Die Gegenprüfung fand bei 15 der 35 Karten etwas.** Zwei unabhängig beauftragte Prüfer mit
Rechercheauftrag kamen dabei auf denselben Kern – genau diese Übereinstimmung macht die Funde
belastbar. Die lehrreichsten:

- *The Crown* besetzt **alle zwei** Staffeln neu, nicht jede.
- Die Namen *Tick, Trick und Track* hat Erika Fuchs **nicht** erfunden – der Verlag gab sie ihr
  vor. Eine Legende, die in fast jeder Quelle steht.
- Die *Gamescom* ist die größte Spielemesse der Welt nach **Ausstellungsfläche**; nach
  Besucherzahl liegt ChinaJoy vorn. Ein Superlativ, der in der falschen Maßeinheit stand.
- *Doctor Who* „läuft seit 1963" verschweigt, dass die Serie 1989 eingestellt und erst 2005
  wiederbelebt wurde.
- *Alfred* taucht erst 1943 in den Comics auf, vier Jahre nach Batman – „von Anfang an dabei"
  stimmt nicht, und Robin kannte das Geheimnis schon seit 1940.
- *Game of Thrones* war als Antwort **nicht mehr eindeutig**: „Beruht auf den Romanen von
  George R. R. Martin" trifft inzwischen auch auf *House of the Dragon* und *A Knight of the
  Seven Kingdoms* zu. Beim freien Abrufen hätte die App eine richtige Antwort abgestraft.
- Der *Game Boy* kam 1989 in Japan heraus – nach Deutschland erst 1990.

Dazu vier Zuschreibungen, die zu absolut formuliert waren und jetzt absichern, was sich
absichern lässt: Doom als „Durchbruch zum Massenphänomen" statt als Begründer des Genres,
Zelda „die meisten Teile" statt „die Reihe", die Lindenstraße als erste deutsche Soap **nach
britischem Vorbild**, die Sopranos als Serie, die den Antihelden zum Standard machte statt ihn
zu erfinden.

### Der Härtetest: wie viele Quizfragen kann die Sammlung wirklich?

Bis hierher wurde gezählt, wie viele Karten es gibt. Das ist die falsche Zahl. Die richtige
lautet: *Wie viele Fragen, die ein Quizspiel tatsächlich stellt, kann die Sammlung
beantworten?* Acht Prüfer haben je zwanzig typische Fragen aus ihrem Gebiet geschrieben – was
in Quizduell, Trivial Pursuit oder im Kneipenquiz wirklich drankommt – und für jede
nachgesehen, ob eine Karte sie abdeckt.

**97 von 160, also 61 %.** Aufgeschlüsselt:

| Gebiet | abgedeckt |
|---|---|
| Geschichte | 15/20 |
| Naturwissenschaft | 15/20 |
| Politik & Wirtschaft | 13/20 |
| Unterhaltung | 12/20 |
| Sprache & Literatur | 12/20 |
| Geografie | 11/20 |
| Alltag & Welt | 11/20 |
| **Sport** | **8/20** |

Der schlechteste Wert ist ausgerechnet Sport – bei 282 Sportkarten. Der Grund steht in der
Datei: Rund 150 davon sind Trainingslehre, Sportdidaktik, Anatomie und Bewegungslehre. Das ist
**Lehramtsstoff, kein Quizstoff**. Die siebzehn Fußballkarten fragen nach Rekordmeister und
Rekordnationalspieler – nicht nach Beckenbauers Spitznamen oder der Meisterschale. Dasselbe
gilt für die 289 Mathematikkarten, die in keinem der acht Prüfgebiete überhaupt vorkommen. Das
ist kein Fehler: Diese Karten haben einen anderen Zweck. Aber sie zählen nicht für das Quiz,
und die Gesamtzahl 1.941 hat das bisher verdeckt.

**Die wichtigste Erkenntnis ist aber kein Themenloch, sondern eine Rollenverwechslung.** Von
dreizehn nachgeprüften Fehlbegriffen – Stalingrad, Nürnberg, Den Haag, Jauch, Dürrenmatt,
Frisch, Ärmelkanal, Heine, Wilhelm II., St. Helena, Pyrenäen, Klose – stand **kein einziger im
`a`-Feld einer Karte**. Fast alle standen als Ablenker oder im Erklärtext. Die Sammlung kennt
den Stoff, prüft ihn aber nie ab.

Damit verbunden eine zweite Schlagseite: Wo ein Thema besetzt ist, sitzt die Karte auf der
zweiten Assoziationsstufe statt auf der ersten. Argentiniens Hauptstadt ja, Belgiens nein.
Volleyball-Netzhöhe ja, Spieleranzahl nein. Simpsons-Rekordlaufzeit ja, Springfield nein.
Gotham City ja, Bruce Wayne nein. Genau das Naheliegende, das im Spiel zuerst gefragt wird,
wurde beim Schreiben gemieden.

**24 geprüfte Karten** schlossen die dringendsten dieser Lücken – jede von zwei Prüfern
gegengelesen, einer auf Wahrheit (mit Recherche), einer auf Handwerk (Form, Ablenker,
Dublette). Sieben wurden zunächst abgelehnt und nach der Kritik repariert: Der Batman-Kontext
behauptete, er sei „der einzige Held ohne Superkräfte" (Iron Man auch nicht), der Moby-Dick-Text
trug die Legende, Melville habe das Schreiben aufgegeben, und bei GmbH und TÜV ließ sich je ein
Ablenker durch bloßes Buchstabenzählen ausschließen – ohne jedes Sachwissen.

Aus der Erkenntnis ist ein Werkzeug geworden: `npm run luecken` listet alle Begriffe, die in
der Sammlung **nur als Ablenker** vorkommen und nie als Antwort.

### Die Fundregel auf die Probe gestellt – und für schwächer befunden als gedacht

Der nächste Durchgang nahm die 42 häufigsten dieser Begriffe und ließ sechs Autoren daraus
Karten machen, jede wieder von zwei Prüfern gegengelesen. **16 wurden es.** Zwölf Kandidaten
verwarfen die Autoren vorab, vierzehn Karten fielen bei der Prüfung durch – macht **38 %
Ausbeute**.

Das ist die ehrliche Zahl, und sie ist niedriger, als die Regel versprochen hatte. Der Grund
ist systematisch: **Ablenker werden gerade so gewählt, dass sie plausible Nachbarn vorhandener
Antworten sind.** Sie sitzen also per Konstruktion in Themenfeldern, die schon besetzt sind –
Schweden war die Antwort der IKEA-Karte, Basketball hatte vier eigene Karten, die
naheliegendste Ölberg-Frage stand schon als Getsemane-Karte da. Die zweite Hälfte des
Ausschusses waren Fülltypen: Zahlen, Zeitspannen, Farben, Blutgruppen – als Antwort gar nicht
eindeutig treffbar. Die Liste liefert Begriffe, aber keine Lücken. Sie ist eine **Ideenquelle,
keine Bedarfsanalyse**, und im Werkzeug steht das jetzt auch so.

Dabei kam ein Fehler im Werkzeug selbst heraus: Es hielt „Schweden" und „Aus Schweden" für
verschiedene Antworten, weil `normalize()` zwar Artikel wegräumt, aber keine Präpositionen. Die
Kandidatenliste war dadurch fast doppelt so lang wie berechtigt – 4.376 statt der tatsächlichen
2.448. Behoben, und die Fülltypen filtert es jetzt gleich mit heraus.

Die 16 Karten, die durchkamen, sind gleichwohl lauter Erstassoziationen, die vorher fehlten:
Hauptstadt von Finnland, das Land zu Reykjavík, der flächenkleinste Kontinent, der Koreakrieg,
Weltmeister 2006, Newtons Apfel, Raffaels „Schule von Athen", Berninis Kolonnaden, „Der Ruf der
Wildnis", die Niere. Und eine Karte kam mit einer **Frage im Kontextfeld** aus der Prüfung –
offenbar ein durchgereichter Formulierungsvorschlag. Sie ist vor dem Einpflegen aufgefallen,
weil ein kurzer Selbsttest über alle neuen Karten lief; ohne den wäre sie durchgerutscht.

### Ein fester Prüfsatz – damit die Zahl endlich etwas bedeutet

Zwei Messungen mit je frisch erfundenen Fragen ergaben 97/160 und 122/160. Der Sprung sah nach
Fortschritt aus und war keiner (siehe unten). Die Lehre: **Nur ein eingefrorener Fragensatz
trennt die Wirkung neuer Karten von der Schwierigkeit der Fragen.**

`data/quizprobe.json` enthält deshalb **104 feste Quizfragen** mit erwarteter Antwort, über acht
Gebiete. `npm run abdeckung` misst dagegen – in einer Sekunde, ohne Prüfer, jederzeit
wiederholbar. Der Prüfsatz wird **nicht** nachgebessert, wenn die Sammlung wächst; sein ganzer
Wert liegt darin, dass er gleich bleibt.

**Ausgangswert: 64 von 104 (62 %).**

| Gebiet | | Gebiet | |
|---|---|---|---|
| Sprache & Literatur | 5/13 | Naturwissenschaft | 9/13 |
| Geschichte | 7/13 | Sport | 9/13 |
| Geografie · Politik · Alltag | je 8/13 | Unterhaltung | 10/13 |

Das Maß ist **absichtlich streng**: Eine Frage gilt nur als abgedeckt, wenn eine Karte die
erwartete Antwort auch wirklich als *Antwort* trägt – nicht, wenn der Begriff bloß im
Kontexttext oder unter den Ablenkern steht. Genau diese Unterscheidung war der wichtigste
Befund aller bisherigen Messungen. Und weil ich den Prüfsatz selbst geschrieben habe, sagt die
absolute Höhe wenig; aussagekräftig ist die Veränderung über die Zeit.

**Der Vergleicher war beim ersten Wurf zu nachsichtig** – und das ließ sich messen. Erlaubt man
einer kürzeren Wortfolge, am Anfang einer längeren zu stehen, steigt die Zahl von 63 auf 66.
Zwei der drei Zugewinne waren aber falsch: „Martin Luther" passte auf **Martin Luther King Jr.**,
„E. T. A. Hoffmann" auf die **Eulersche Zahl `e`**. Ein Messgerät, das zwei von drei Zugewinnen
erfindet, misst schlechter als das strenge. Geblieben ist die Nachsicht nur für den Fall, für
den sie gedacht war: Eine reine Zahl darf am Anfang stehen, damit „100" auf „100 °C" passt.

Nebenbei: `data/quizprobe.json` ist von der Versionskennung ausgenommen – wie `package.json`.
Sonst böte jede Erweiterung des Prüfsatzes allen Nutzern ein Update an, das nichts ändert.

### Der Quizmodus – ein Prüfstand, kein Spielzeug

Bis hierhin trainierte die App Abruf in Ruhe: eine Karte, eine Antwort, so viel Zeit wie nötig.
Das Duell brachte Zeitdruck, zog aber aus dem Gelernten. Ein Quizspiel macht beides anders –
es fragt **alles**, unter der Uhr, und rechnet in Punkten. Genau das ist der Quizmodus. Er
baut auf dem Duell auf statt daneben: dieselbe Uhr (die nur sichtbare Zeit zählt), derselbe
Fragebildschirm, derselbe Rückfluss in den Plan. Neu sind Ziehung, Punkte und Ergebnisbild.

**Die Ziehung** (`assets/js/quizmodus.js`, rein, Zufall und Kartenstand als Parameter): zwölf
Fragen, jedes aktive Thema mindestens einmal, drei Themen zweimal – welche, entscheidet der
Zufall. Die Schwierigkeit steigt wie im Quiz: vier Basis, vier Solide, vier Profi. Die drei
Zusatzplätze bevorzugen bekannte Karten, die wackeln – das ist die Duell-Regel „woran man unter
Zeitdruck scheiterte, muss unter Zeitdruck wiederkommen". Pausierte Themen bleiben draußen: Wer
Mathematik unter Mehr abgeschaltet hat, will sie auch im Quiz nicht (das Themen-Duell hält es
anders, weil dort das Thema ausdrücklich gewählt wird).

**Die Punkteformel in einem Satz:** Zehn Punkte für jeden Treffer, fünf dazu, wenn die Antwort in
den ersten fünf Sekunden kommt. 180 sind das Maximum. Der Bonus ist bewusst kleiner als der
Treffer – ein Quiz belohnt Wissen, Tempo ist die Zugabe. Über der Frage steht der Punktestand,
rechts daneben die Blitz-Pille, die nach fünf Sekunden verblasst: Man sieht die Formel beim
Spielen, nicht erst im Ergebnis.

**Der Rückfluss in den Plan** war die eine Stelle, an der das Duell nicht reichte. Eine
gelernte Karte, die im Quiz fällt, bekommt die Deckelung aus `nachDuellFehler()`. Eine **nie
gelernte** Karte, die im Quiz fällt, ließ das Duell liegen („steht ohnehin in der Neu-Liste") –
im Quiz ist sie eine *entdeckte Lücke* und soll morgen drankommen, nicht erst, wenn die Leiter
der neuen Karten sie irgendwann erreicht. Sie bekommt `seen: 1` und ist heute fällig. Nicht
`seen: 0` mit Termin – ein solcher Zustand stünde in beiden Listen zugleich (siehe
`dueCards()`). Ein Treffer im Quiz benotet die Karte nicht – wie im Duell, weil unter Zeitdruck
geraten wird.

Genau formuliert, weil eine frühere Fassung dieses Absatzes „keine Note, kein Aussetzer"
behauptete und das nur halb stimmte: Der **Scheduler** rührt die Karte nicht an – `ef`, `iv`
und `lapses` bleiben unberührt, es läuft kein `schedule()`. Der `strength()`-Wert sinkt aber
sehr wohl, denn `seen: 1` bei `ok: 0` heißt: einmal gefragt, nicht gewusst. Das ist auch richtig
so – der Lernende hat sie eben nicht gewusst –, nur ist es keine Nullbuchung, und so steht es
jetzt hier. Die Karte zählt außerdem gegen das Tagesbudget neuer Karten: Ohne das könnten
mehrere Quizrunden dutzende unberührte Karten in den Plan schieben, an `newPerDay` vorbei.

**Die Zähler:** Quizantworten laufen in dieselben Zähler wie Duellantworten (`d.duel`,
`duelAnswers`, `duelMs`), getrennt vom Tagestraining. Es ist dieselbe Größe – Antworten unter
15 Sekunden – und sechs weitere Felder samt Zusammenführungsregel hätten nichts gemessen, was
diese nicht messen. Die Startseite sagt deshalb jetzt „unter Zeitdruck" statt „im Duell".
Neu gespeichert werden nur die Runden selbst: `quizRunden` (die letzten dreißig, beim
Zusammenführen zweier Tabs **vereinigt** über den Zeitstempel, denn Runden werden nur angehängt)
und `quizBest` (ein Rekord, fällt nie). Beides geht durch den Säuberer – auch beim Laden, weil
Listen sonst ungeprüft aus dem Speicher kämen und eine kaputte Runde das Ergebnisbild träfe.

**Das Ergebnisbild** beantwortet nicht „wie gut war ich", sondern „wo habe ich verloren": drei
Kacheln (falsch, zu langsam, ohne Blitz), darunter die Themen nach verlorenen Punkten sortiert,
darunter die verfehlten Karten – hinter dem Griff, wie überall in dieser App. Der Reiter heißt
jetzt **Quiz**; das Duell bleibt dort als zweite Wahl.

Ein Prüfstand, der nur sagt, wo es hakt, ist erst die Hälfte. Deshalb führt das Ergebnisbild
von dort **in die Werkstatt**: Unter den Themen steht ein Knopf „Geografie im Duell nachlegen"
– zehn Fragen unter Zeitdruck, genau im Thema mit dem größten Verlust. Derselbe Knopf steht auf
dem Startbildschirm unter dem Satz, wo die Punkte zuletzt liegen blieben. Vorher führte der Weg
dorthin über Themen, Thema suchen, „Thema im Duell" – drei Tipps, die niemand macht.

**Die Gegnerprüfung fand sieben echte Fehler in diesem ausgelieferten Code** – fünf Sucher mit
verschiedenen Blickwinkeln, jeder Befund von zwei Skeptikern angefochten, die ihn zu widerlegen
hatten. Vierzehn Befunde überlebten beide Anfechtungen, mit wenigen gemeinsamen Wurzeln:

- **Die Buchung war gespalten.** `finish()` schrieb die Punkte, `next()` alles andere – die
  Fehlerliste, die Fälligstellung der Karte, die Zähler. Der Beenden-Knopf bleibt im
  Auflösungsbildschirm aber aktiv. Wer die letzte Frage verfehlte und dann X tippte statt
  „Weiter", bekam ein Ergebnisbild über **zwölf** Antworten samt dem Satz „Die Lücken stehen
  unten – sie kommen im nächsten Training", während die Liste leer blieb und die Karte nie
  fällig gestellt wurde. Genau die Zusage, mit der der Modus committet worden war. Jetzt wird
  eine Antwort an einer einzigen Stelle gebucht.
- **Jede abgebrochene Runde galt als volle Runde.** Eine nach einer Frage abgebrochene ergab
  `{p:15, m:15}`: Der Rückblick lobte „Fehlerfrei und schnell", der Balkenverlauf zeigte sie
  voll ausgeschlagen neben einer echten 145/180, und der Schnitt mittelte rohe Punkte über
  Runden mit verschiedenem Maximum. Abgelegt wird jetzt nur, was zu Ende gespielt wurde – wie
  ein abgebrochenes Duell auch nicht in `duelBest` wandert.
- **Der Bestwert wurde gelesen, bevor der fremde Stand eingeholt war.** Während einer Runde
  verwirft ein Tab die Meldungen des anderen; der Rückblick meldete „Neuer Bestwert!" für eine
  Punktzahl, die der zweite Tab längst überboten hatte.
- Dazu: der Punktestand über der Frage zog nicht nach (über „Richtig · +15 Punkte" stand
  „Punkte 0"), die Bestwert-Markierung im Balkenverlauf verglich rohe Punkte gegen normierte
  Höhen (der höchste Balken trug keinen Anstrich), und die Statistik schrieb „Ø der letzten
  1 Runden".

**Geprüft:** elf reine Tests über Ziehung, Formel und Auswertung mit festem Zufall; der
Sicherungs-Rundlauf und der Säuberer (ohne die zwei Säuberer-Zeilen scheitern nachweislich
zwei Tests); zwei Tabs, die je eine Runde spielen, haben hinterher beide; und ein Durchlauftest
mit gestellter Uhr (`page.clock`), der eine Runde spielt – ein Blitztreffer, eine abgelaufene,
eine falsche, ein Treffer nach der Frist, acht Blitztreffer – und **145 von 180** nachrechnet,
statt nur zu schauen, ob eine Zahl erscheint.

### Der zweite Prüfsatz – und die ehrliche Zahl: 63 %

Der erste Prüfsatz meldet **102 von 104 (98 %)**. Diese Zahl ist wertlos geworden: Die letzten
39 Karten wurden gegen genau seine Lücken geschrieben. Sie misst, ob das Abschreiben geklappt
hat, nicht die Sammlung. Ein Maß, das man optimiert, hört auf, ein Maß zu sein.

`data/quizprobe2.json` ist deshalb ein **zweiter, unabhängig geschriebener Satz**. Die Autoren
durften genau eine Datei im Repository lesen – den ersten Prüfsatz, um Wiederholungen zu
vermeiden. `data/*.js` und diese README waren tabu. Jede Frage lief danach **einzeln** durch
eine Faktenprüfung mit Webrecherche: richtig, eindeutig, zeitfest, quiztaugliche Antwortform.
Wo eine Frage zwei vertretbare Antworten zuließ, wurde sie geschärft – „Welcher Fluss bildet
den größten Teil der Grenze zu Polen?" etwa fiel durch, weil die Neiße dort länger ist als die
Oder.

**Ausgangswert, gemessen vor jeder Kartenänderung: 63 von 100 (63 %).**

| Gebiet | | Gebiet | |
|---|---|---|---|
| Geografie | 12/13 | Literatur · Sport · Geschichte | je 7 |
| Naturwissenschaft | 11/13 | Unterhaltung | 6/13 |
| Gesellschaft | 8/12 | Alltag | 5/12 |

Die Gebiete sind nicht die neun Themen der App, sondern die acht Kategorien, in denen
Quizspiele fragen – deshalb 12 oder 13 Fragen je Gebiet und keine glatte Zehn.

**Die erste Messung sagte 34, und sie war falsch – am Messgerät, nicht an der Sammlung.**
`abdeckung.mjs` hielt eine eigene Kopie der Verhältniswörter, die es beim Vergleich abstreift,
und die Kopie war längst veraltet: „an" fehlte. Die Karte *„An Oder und Neiße"* galt deshalb
nicht als Antwort auf eine Frage nach „Oder und Neiße". Den Klammerzusatz kannte die Kopie gar
nicht, also zählte *„Stickstoff (78 %)"* nicht als „Stickstoff". Zwei der 18 gemeldeten Lücken
waren keine. Beide Muster sind jetzt aus `quiz.js` **exportiert** statt kopiert – dieselben, die
die App benutzt, wenn sie eine getippte Antwort bewertet. Wo die App nachsichtig ist, muss es
die Messung auch sein, sonst misst sie etwas anderes als das, was der Nutzer erlebt. Ein Test
hält die Muster jetzt fest.

Nicht behoben, bewusst: Der Prüfsatz erwartet „Sonic", die Karte antwortet *„Sonic the
Hedgehog"*. Eine allgemeine Nachsicht für kürzere Wortfolgen ist weiter oben schon einmal
gemessen und **durchgefallen** – sie erfand zwei von drei Zugewinnen. Lieber eine Lücke zu viel
melden als eine zu wenig.

Die 98 % des ersten Satzes und die 69 % des zweiten sind kein Widerspruch, sondern derselbe
Befund aus zwei Richtungen.

### Der dritte Prüfsatz: was eine Sport- und Mathelehrkraft können muss – 41 %

Das Ziel wurde präzisiert: vor allem am Spieleabend glänzen, dazu das Basiswissen einer Sport-
und Mathelehrkraft. Das Erste misst der zweite Prüfsatz (94 %). Für das Zweite gab es noch
keine Zahl – die Kategorien Sport und Mathematik haben 296 und 289 Karten, aber niemand hatte
je gefragt, ob das *das* Wissen ist, das ein Fachleiter im Staatsexamen abfragt.

`data/quizprobe3.json`: je 51 Fragen Sport und Mathe, geschrieben in der Rolle eines
Fachleiters am Studienseminar, ohne Blick in die Sammlung, danach jede einzeln geprüft. Mathe
war fehlerfrei; sechs Formulierungen wurden geschärft (Hilbert trug in Paris nur zehn seiner
23 Probleme vor). Sport brauchte vier Korrekturen: Das Kniegelenk hat vier gleichwertige
Lehrbuchnamen, „größter Muskel" ist ohne Kriterium mehrdeutig (Volumen: Gluteus, Fläche:
Latissimus), und „nach Blume/Hirtz" zählt je nach Autor sieben oder fünf koordinative
Fähigkeiten. Vierzig Fragen führen Zweitschreibweisen – „ad − bc" ist dieselbe Determinante
wie „a·d − b·c"; das ist Notation, nicht Inhalt.

**Ausgangswert, vor jeder Kartenänderung: 42 von 102 (41 %) – Sport 18/51, Mathe 24/51.**

**Die Messung fand vorher einen Fehler, der jeden Nutzer trifft.** Getipptes `^2` und
gesetztes `²` waren verschiedene Wörter: „3x^2" auf „3x²" ergab 0,33, „x^3" auf „x³" 0,25,
„sqrt(2)" auf „√2" 0,38, die Produktregel mit ASCII-Strich 0,59. Kein deutsches Tastenfeld hat
ein ², ³ oder √ – **ein Mathelehrer, der am Handy seine Ableitung tippt, galt als falsch.** Jetzt
gehen beide Formen in dieselbe Ziffer (nur ein Exponent, der keine Ziffer ist, bleibt „hoch":
e^x ist nicht ex), `sqrt` ist Wurzel, der Ableitungsstrich U+2032 ein Strich, und ein
Formelkopf wie „A =" zählt nicht zur Antwort – wer „π·r²" tippt, hat die Kreisfläche gewusst.
Gemessen: Satz 3 von 35 auf 41 allein dadurch, Sätze 1 und 2 unverändert, also keine
Falschtreffer. Zwei Tests halten es fest.

**Und die 60 Lücken sind zu zwei Dritteln dasselbe Muster wie beim zweiten Satz.** Die
Sammlung kennt Superkompensation, Grobkoordination, Maximalkraft, Kreatinphosphat – aber als
*Frage* („Was versteht man unter Superkompensation?") oder als *Aufzählung* („Welche Kraftarten
unterscheidet die Trainingslehre?"). Ein Prüfer fragt umgekehrt: Definition gegeben, Begriff
gesucht. Das ist die Richtung, die im Examen drankommt, und beim freien Abrufen die einzige,
die sich tippen lässt. Von 60 Lücken stecken 13 in Aufzählungskarten und 23 im Frage- oder
Kontexttext einer Karte; 24 fehlen wirklich. Die fehlende Richtung wird ergänzt – als eigene
Karten, weil eine Definition→Begriff-Karte etwas anderes prüft als ihre Umkehrung.

### 42 auf 102 – die fehlende Richtung, zweifach geprüft

Gegen die 60 Lücken des dritten Satzes haben zwei Autoren geschrieben, die nur den Prüfsatz
kannten: 27 Mathe- und 33 Sportkarten. Jede Karte ging danach durch zwei getrennt gebriefte
Prüfungen – Wahrheit mit Webrecherche, Handwerk mit dem echten `bewerte()` gegen den Bestand.
Die Zuordnung, nachgerechnet über die deckenden Kartenkennungen gegen `data/kennungen.json`
vor der Ergänzung:

| Woher der Treffer kommt | Fragen |
|---|---|
| Stand vor jeder Änderung | 42 |
| 54 **neue** Karten (24 Mathe, 30 Sport), jede zweifach geprüft | +54 |
| Sechs **Bestandskarten** mit Zweitschreibweisen statt einer Dublette | +6 |
| **Summe** | **102** |

**Sechs Karten wurden nicht eingepflegt, obwohl sie Lücken geschlossen hätten.** Die
Handwerksprüfung fand sie als Dubletten in gleicher Richtung: „Die erste Ableitung ist null"
stand schon da, nur nicht als Formel; „log(a) + log(b)" stand da, der Prüfsatz fragte mit x und
y; die Quotientenregel stand in Worten, „Bei 4 mmol pro Liter", „Der große Gesäßmuskel" und
„Erziehung zum und durch Sport" ebenso. Die Lücke war jeweils Notation, nicht Wissen. Also
bekam die Bestandskarte die Schreibweise (`az`), und die neue Karte blieb draußen – sonst
lernte jemand dieselbe Sache zweimal und das Maß zählte es als Fortschritt.

**Die Wahrheitsprüfung fand einen echten Fehler und elf Präzisierungen.** Feynman nannte nicht
die Eulersche Identität „unser Juwel", sondern die allgemeine Formel (Lectures I, Kap. 22).
Hochmuth formulierte 1967 fünf Prinzipien, nicht sechs – das sechste kam 1981. Der Handball-
Torraum ist kein Halbkreis, sondern zwei Viertelkreise mit einem geraden Stück; im Badminton
galten bis 2006 im Dameneinzel 11 Punkte, nicht 15; der Prozentschlüssel der Bundesjugendspiele
ist nicht von 2023, sondern von 2001. Alles nach Beleg korrigiert, nichts geschätzt.

**Die Handwerksprüfung fand zwei Fehler im Messgerät, die nichts mit den neuen Karten zu tun
hatten.** Ein getipptes „-q" galt als „q": Der Bindestrich wurde nur vor Ziffern zum Minus, vor
Buchstaben fiel er weg – bei Vieta war damit der Ablenker „−q" richtig. Und eine Klammer, die am
Wort klebt, wurde als freiwilliger Zusatz gestrichen: aus „a^(m+n)" wurde „a^". Beides mit
Test festgehalten, der erst rot war; die drei Prüfsätze messen danach unverändert. Gestrichen
wurde außerdem eine Karte, die beim freien Abrufen den falschen Ablenker mit 1,00 durchließ:
„¬B ⇒ ¬A" wird nach der Normalisierung zu „B A", genau wie die Umkehrung „B ⇒ A". Die
Kontraposition steht jetzt in Worten da, „nicht B ⇒ nicht A", und die Umkehrung misst 0,56.
Beim Doppelauftrag des Schulsports war es dasselbe: „durch Sport" verliert sein Verhältniswort,
„im Sport" auch – 1,00 für den Ablenker. Die Karte ist draußen, die Bestandskarte trägt die
Langform.

Dazu kamen Schreibweisen, die gemessen unter 0,8 lagen (die Kettenregel ohne Malpunkt,
„np(1 − p)", „E + F = K + 2", „slow twitch", „106,7 cm"); entfernt wurden die, die nach der
Normalisierung der Antwort glichen, und fünf Fragen kamen unter 160 Zeichen.

### 65 auf 94 – getrennt nach dem, was es wirklich war

Die Lücken des zweiten Satzes wurden geschlossen, aber die Zahl allein sagt wieder wenig.
Deshalb hier die Zuordnung, nachgerechnet über die deckenden Kartenkennungen gegen den
Bestand vor der Ergänzung (`data/kennungen.json`):

| Woher der Treffer kommt | Fragen |
|---|---|
| Stand vor jeder Änderung (nach Reparatur des Messgeräts) | 65 |
| Zwei Schreibweisen an Bestandskarten („Sonic", „Gelb") | +2 |
| 25 **neue** Karten, jede zweifach geprüft | +25 |
| 3 Bestandskarten **gedreht** – der Begriff wurde zur Antwort, der Lernstand blieb (`p`) | +3 |
| Eine Schreibweise an einer Bestandskarte („NaCl" für Natriumchlorid) | +1 |
| **Summe** | **94** |
| Bewusst offen gelassen | 6 |

**Die Kartenprüfung hat das Maß selbst korrigiert.** 35 Karten gingen durch zwei getrennte
Prüfungen – Wahrheit mit Webrecherche, Handwerk mit dem echten `bewerte()` – und kamen mit
**107 Befunden** zurück. Zehn der zwölf schweren waren dieselbe Sache: **Rollenverwechslung.**
Die Sammlung kannte Armstrong, Hastings, Carter, Maastricht, Sarajevo, Uruguay, Hattrick,
Palindrom, Hyperbel und DAX längst – als *Frage*, nicht als Antwort. „Was geschah 1066 bei
Hastings?" trägt Hastings im Fragetext; ein Prüfsatz, der nach der Schlacht fragt, zählt das
als Lücke. Die gemessenen 63 % unterschätzten also, was die App lehrt.

Daraus folgten drei Sorten von Entscheidung statt einer:

- **Sieben Karten kamen nicht hinein.** Wo die Bestandskarte die gesuchte Antwort schon im
  Fragetext trägt (Hastings, Carter) oder in der eigenen Antwort (Sarajevo, Maastricht,
  Uruguay), wäre die neue Karte geschenkt. Beim Hattrick widersprachen sich die beiden
  Fassungen sogar – die Bestandskarte führt die strenge deutsche Bedeutung, die neue die
  internationale. Diese sechs Lücken bleiben **absichtlich offen**; das Maß meldet sie
  weiter, und das ist richtig so.
- **Drei Bestandskarten wurden gedreht.** „Was ist ein Palindrom?" mit einer Definition als
  Antwort ist beim freien Abrufen kaum tippbar; „Wie nennt man ein Wort wie Anna oder
  Rentner?" mit „Ein Palindrom" schon. Dieselbe Regel wie bei Euphemismus und Pleonasmus
  weiter oben – nur galt sie dort für neue Karten, hier für alte. Der Lernstand wandert über
  das `p`-Feld mit.
- **Fünf Bestandskarten verrieten Antworten**, die sie nicht verraten dürfen: Der
  Kilimandscharo stand „in Tansania", die Mondlandung nannte Armstrong, Aldrin und Collins,
  Star Wars trug „ab 1977", der Grand Slam verriet „Rasen". Alle entschärft – die Regel „ein
  Kontexttext verrät nicht die Antwort einer anderen Karte" galt schon, nur hatte sie hier
  niemand geprüft.

Und die Wahrheitsprüfung fand, was sie immer findet: Der Kilimandscharo ist kein
*erloschener*, sondern ein *ruhender* Vulkan (Fumarolen im Gipfelkrater). Die Mayflower ging
nicht bei Plymouth an Land, sondern vor Cape Cod. Schumacher ist in Hürth geboren, nicht in
Kerpen, und seine 91 Siege sind seit 2020 kein Rekord mehr. Cameron ist nicht „der Einzige mit
mehreren" Zwei-Milliarden-Filmen, sondern der Einzige mit dreien. „Schlagfertig" steht im Duden
als Synonym von *eloquent* – und war als Ablenker gedacht.

### Eine Schranke gegen Antwortverrat – gemessen und verworfen

Fünf der vierzehn bestätigten Quizmodus-Befunde und ein gutes Dutzend der Kartenbefunde hatten
dasselbe Muster: Ein Kontexttext verrät die Antwort einer *anderen* Karte. Das schreit nach
einer Schranke in `check-content.mjs`. Also gemessen, bevor gebaut: Für jede Karte, ob ihr
Kontext- oder Fragetext die vollständige, normalisierte Antwort einer anderen Karte enthält –
mindestens fünf Zeichen, keine reine Zahl, als ganze Wortfolge.

**Ergebnis: 298 Treffer im selben Teilgebiet, 170 in derselben Kategorie, 638 quer.** Und die
Stichprobe zeigt, warum das keine Schranke werden kann: „Athen" steht in jeder zweiten
griechischen Geschichtsfrage, ohne dass eine davon verrät, welche Stadt als Wiege der
Demokratie gilt. Die Punischen Kriege nennen die Phönizier, ohne zu verraten, dass sie Europa
das Alphabet weitergaben. Das Wort ist da – der *Fakt*, den die andere Karte abfragt, ist es
nicht. Ein echter Verrat („5.895 m in Tansania" auf einer Karte, deren Nachbarin fragt, zu
welchem Land der Berg gehört) unterscheidet sich vom bloßen Vorkommen des Worts nur semantisch,
und das misst kein Zeichenkettenvergleich. Eine Schranke mit ein paar hundert Fehlalarmen wird
nicht gelesen; dann ist sie schlimmer als keine.

Die Regel bleibt eine Prüferregel – beide Kartenprüfungen fragen sie ausdrücklich ab, und beide
haben sie zuletzt gefunden. Das ist der Platz dafür.

### Zwei Fehler im Vergleicher, gefunden beim Prüfen von Karten

Die Handwerksprüfung der 39 neuen Karten hat nicht geschätzt, sondern mit dem echten
`bewerte()` aus `assets/js/quiz.js` gemessen — und dabei zwei Fehler freigelegt, die gar nichts
mit den Karten zu tun hatten.

**Ein einleitendes Verhältniswort machte richtige Antworten falsch.** Die Lösung „Aus
Sojabohnen"; wer „Sojabohnen" tippt, hat recht und bekam 0,60 — abgelehnt. Artikel erledigte
`FUELLWOERTER` längst, die Verhältniswörter fehlten dort. **75 der 2.048 Karten** waren
betroffen, quer durch alle Themen. Die Reparatur sitzt bewusst nicht in `FUELLWOERTER`: Dort
verschwände das Wort überall, auch in der Eingabe, und „Vor Christus" wäre dasselbe wie „Nach
Christus". Stattdessen zählt jetzt eine zusätzliche Vergleichsfassung der *Lösung* ohne ihr
erstes Wort — die volle Lösung gilt weiter. Danach: 75 → 0, ohne dass ein einziger Ablenker
durchrutscht.

**Der zweite Fehler war der schwerere: eine Übereinstimmung aus dem Nichts.** Getippt „Lehre"
gegen die Lösung „Mit werden" ergab **0,95**. Der Grund: Links fällt „Lehre" als Klassifikator
weg, rechts „werden" als Bindewort — übrig bleibt auf beiden Seiten nichts, und die Abkürzung
für knappe Eingaben meldete trotzdem Beinahe-Sicherheit. Gemessen galten so zehn völlig fremde
Eingaben auf der Karte „Wie viele Zeitzonen hat China?" als richtig.

Die Abkürzung braucht einen **Beleg**: Mindestens ein getipptes Wort muss in der Lösung
wiedergefunden worden sein. „Pythagoras" auf „Satz des Pythagoras" erfüllt das, „Lehre" auf
„Mit werden" nicht. Gemessen über den ganzen Bestand mit zehn Unsinnseingaben je Karte: **19
Fehlannahmen vorher, 0 nachher.** Der Fehler steckte schon im Bestand, lange vor diesen Karten
— gefunden hat ihn erst, dass jemand die Zahlen wirklich ausgerechnet hat statt sie zu schätzen.

Nebenbefund derselben Messung: Genau eine Antwort im Bestand — „Nur eine" — schrumpft in
`normalize()` auf „nur", weil „eine" ein Füllwort ist. Die naheliegende Eingabe „Eine" fiel
damit auf 0. Diese Karte hat jetzt `az`.

### 65 auf 102 – und warum der Prüfsatz damit verbraucht ist

Der Prüfsatz hatte **39 offene Fragen** benannt. Genau dagegen sind 39 Karten geschrieben
worden. Ergebnis: **102 von 104 (98 %)**, vorher 65.

Diese Zahl ist ehrlich gemessen und trotzdem **kein Beleg für breitere Abdeckung**. Sie ist
weitgehend tautologisch: Wer die Lücken einer festen Liste abschreibt und dann gegen dieselbe
Liste misst, lernt nur, dass er richtig abgeschrieben hat. Der Prüfsatz hat als **Lückensucher**
gearbeitet – das war sein Zweck und er hat ihn erfüllt. Als **Fortschrittsmaß** ist er damit
aufgebraucht; die nächste belastbare Messung braucht einen neuen, unabhängig geschriebenen Satz,
der wieder eingefroren wird, bevor auch nur eine Karte dazukommt.

Der Sprung von 65 auf 102 heißt also: *diese 39 Wissenslücken sind geschlossen.* Nicht mehr.

Die 39 Karten sind, wie jeder neue Satz, durch **zwei unabhängig unterrichtete Prüfungen**
gelaufen — eine auf Wahrheit mit Webrecherche, eine auf Handwerk. Zusammen kamen **36 Befunde**
zurück, alle bestätigt und behoben:

*Sachlich:* Grönland ist gut dreißigmal Bayern, nicht achtzigmal (Faktor 2,6 daneben). Die Umra
*ist* eine Pilgerfahrt nach Mekka und taugte so nicht als Ablenker — die Frage nennt jetzt die
fünf Säulen. „Überflüssig" führt der Duden ausdrücklich als zweite Bedeutung von *obsolet*, war
also ein richtiger Ablenker. Der offizielle Name des Dortmunder Stadions ist seit 2005 ein
anderer, und „Rote Erde" ist bis heute BVB-Heimstätte — beides zog die Karte schief. Dazu die
roten Blattfarbstoffe (werden im Herbst neu gebildet, waren nicht „längst da"), die
Reichstagskuppel (kostenlos, aber nur mit Anmeldung), die D-Mark (nie parallel gültig), der
Stanley Cup (ältester Pokal *Nordamerikas*, und volle Ringe wandern ins Museum) und die
Herkunft des Fettnäpfchens.

*Handwerklich:* Sechs Kontexttexte verrieten die Antwort einer **anderen** Karte — die
Donau-Karte gleich drei auf einmal. Eine Karte widersprach sich selbst: Antwort „Das Römische
Reich", Kontext „Genauer die Römische Republik" — wer das Genauere tippte, galt als falsch.
Eine Mario-Karte lehrte „Zimmermann", während die Bestandskarte „Zimmermann" ausdrücklich als
Quizfalle führt. Dazu Formverrat: 159 als einzige krumme Zahl neben 100/200/250; „Die Aorta"
als einziges Fremdwort neben drei Ablenkern auf *-schlagader*; drei erfundene Filmpreise neben
einem echten.

Der Prüfer hat die Freitext-Befunde nicht geschätzt, sondern mit dem echten `bewerte()`
nachgerechnet — und dabei die beiden Vergleicherfehler oben mit ausgegraben.

**Die letzten zwei Lücken bleiben absichtlich offen.** Der Prüfsatz fragt „Was ist ein
Euphemismus?" und erwartet „eine beschönigende Umschreibung". Die Karten fragen andersherum:
„Wie nennt man eine beschönigende Umschreibung?" → *Euphemismus*. Beide Richtungen sind
sinnvolle Quizfragen, aber im **Freitextmodus** ist nur eine davon brauchbar – einen Fachbegriff
tippt man, eine Definition formuliert jeder anders. Dieselbe Karte in beide Richtungen würde
zudem an der Dublettenschranke hängen bleiben. Die Zahl 102 statt 104 ist hier das ehrlichere
Ergebnis als eine erzwungene 104.

### Zweite Messung – und warum „61 % auf 76 %" nicht stimmt

Nach 58 gezielt ergänzten Karten lag die Frage nahe: Hat das die Abdeckung gehoben? Also
dieselbe Messung noch einmal, mit **frischen** Fragen. Damit sie etwas wert ist, wurden drei
Vorkehrungen eingebaut: Die Prüfer mussten ihre zwanzig Fragen aufschreiben, **bevor** sie in
die Sammlung sahen; jede abgedeckte Frage brauchte die **deckende Karte** als Beleg; und die
Schlussbilanz musste ausdrücklich beantworten, ob die Verbesserung ein Artefakt sein kann.

Das Rohergebnis: **122 von 160, 76 %** gegenüber 97 von 160 beim ersten Mal.

**Diese Zahlen belegen keinen Fortschritt.** Zwei verschiedene Fragensätze, keine gemeinsame
Teilmenge, keine Schwierigkeitskontrolle – belegt ist nur, dass Garnitur 2 zu 76 % beantwortet
wurde. Die Belege erlauben aber eine schärfere Rechnung: Von den 122 deckenden Karten sind
**nur 10 unter den 58 neuen**. Ohne sie stünde dieselbe Garnitur bei 112 von 160 = 70 %. Der
Sammlung zurechenbar sind also **+6 Punkte**, nicht +15. Die restlichen neun Punkte sind
Unterschied zwischen den Fragensätzen.

Ein Indiz spricht trotzdem für echte Wirkung, und es ist ein hübsches: **Alltag & Welt bekam im
Lückenschluss fast nichts** – eine einzige Karte – und steht exakt still bei 11/20. Die Zuwächse
liegen genau dort, wo nachgeliefert wurde: Geografie +5, Politik +5, Unterhaltung +5. Eine
leichtere zweite Garnitur hätte alle Gebiete gehoben, nicht die bearbeiteten. Ein
Kontrollgebiet, das sich nicht bewegt, ist mehr wert als jede Gesamtzahl.

| Gebiet | 1. Messung | 2. Messung |
|---|---|---|
| Politik & Wirtschaft | 13/20 | 18/20 |
| Naturwissenschaft | 15/20 | 17/20 |
| Unterhaltung | 12/20 | 17/20 |
| Geografie | 11/20 | 16/20 |
| Geschichte | 15/20 | 16/20 |
| Sprache & Literatur | 12/20 | 15/20 |
| Sport | 8/20 | 12/20 |
| **Alltag & Welt** | **11/20** | **11/20** |

Bei zwanzig Fragen je Gebiet sind ±2 Rauschen; Geschichte 15→16 zeigt nichts.

**Das neue Muster ist schärfer als das alte.** Beim ersten Mal hieß es: „Der Begriff steht nur
als Ablenker, nie als Antwort." Jetzt lautet es **eine Entität, nur eine Frageachse**: Zur
Pflanze gibt es den Chloroplast, aber nicht das Chlorophyll. Zum Kaiserreich das Gründungsjahr,
aber nicht den ersten Reichskanzler. Zum größten See den *Süßwasser*-Rekord, aber nicht den
Flächenrekord. Das Thema gilt als erledigt, das Quiz fragt die andere Achse. 16 der 38
Fehlschläge sind von dieser Sorte.

Deshalb liest `npm run luecken` jetzt auch die **Kontexttexte** – dort standen Grönland, Zloty,
Bismarck und die Bastille, alle nie Antwort. Der erste Versuch ertrank allerdings im Rauschen:
Im Deutschen ist jedes Substantiv großgeschrieben, „Jahre", „Welt" und „Stadt" sehen aus wie
Eigennamen. Der Filter, der es löst, ist die **Streuung**: Ein Allerweltswort taucht quer durch
alle neun Themen auf, ein Eigenname bleibt bei seinem. Ab drei Themen gilt ein Begriff als
Füllwort. Danach steht oben, was oben stehen soll – Donau, Bundesrat, Pythagoras, Renaissance,
Ägypten, Alpen.

### Wenn der Fehler wandert, muss die Schranke mitwandern

Die Prüfrunden hatten einen Trend gezeigt: Die Kartenmechanik sitzt inzwischen – die Fehler
stecken im **Kontexttext**, dem Satz nach der Antwort. Vier von sechs Ablehnungen der letzten
Runde betrafen ihn, und eine Karte war sogar durch zwei unabhängige Prüfungen gekommen, in
deren `t`-Feld eine **Frage** stand („Welche Einheit hat der Druck?") – offenbar ein
durchgereichter Formulierungsvorschlag. Der Nutzer hätte nach der Antwort eine zweite Frage
präsentiert bekommen.

Zwei dieser Fehlersorten lassen sich maschinell fassen, und `npm run check` prüft sie jetzt:

- **Das Kontextfeld ist eine Frage.** Harte Schranke. Getroffen wird nur, was von vorn bis
  hinten nichts als eine Frage ist – eine Rückfrage *mitten* im Text bleibt erlaubt („Damit rät
  man ganzzahlige Lösungen: Welche zwei Zahlen passen zu Summe und Produkt?"). Über alle 1.999
  Karten: kein einziger Fehltreffer.
- **Zeitabhängige Angabe ohne Jahreszahl.** Nur ein Hinweis, kein Fehler – ein Teil der Treffer
  ist harmlos. „Rekordhalter: Messi mit acht Auszeichnungen" stimmt, bis jemand die neunte holt.
  Drei Karten sind daraufhin datiert worden.

**Eine dritte Idee ist durchgefallen und bleibt draußen:** „Der Kontexttext trägt nichts über
die Antwort hinaus bei" klang plausibel, traf aber 15 Karten, von denen fast alle in Ordnung
waren – „Vor dem Brandenburger Tor, adressiert an Gorbatschow" trägt sehr wohl bei. Eine
Schranke, die zu 90 % Unschuldige meldet, wird ignoriert und ist damit schlimmer als keine.

Auch die zweite Schranke war beim ersten Wurf zu eng: Sie verlangte eine **Ziffer** im Text und
übersah deshalb „Rekordhalter: Messi mit **acht** Auszeichnungen". Ausgeschriebene Zahlen zählen
jetzt mit.

### Zwei Wege, Lücken zu finden – im Vergleich gemessen

Die Fundregel „nur als Ablenker vorhanden" hatte 38 % Ausbeute. Der zweite Weg nahm stattdessen
die **konkret gemessenen** Lücken aus dem Härtetest: 47 benannte Fragen, die ein Quizspiel
stellt und die die Sammlung nicht beantwortete. Sechs Autoren, wieder zwei Prüfer je Karte.

| | Heuristik („nur Ablenker") | Gemessene Lücken |
|---|---|---|
| Karten angenommen | 16 | 18 |
| Annahmequote der geschriebenen | 53 % | **75 %** |
| Quote inkl. vorab verworfener Kandidaten | 38 % | **53 %** |

**Gemessene Nachfrage schlägt jede Heuristik.** Aber die Messung zeigt eben nur Nachfrage, nicht
Deckung: Vierzehn der 47 Lücken waren inzwischen geschlossen, die Autoren mussten sie erst
wegprüfen. Ein Abgleich mit dem Bestand bleibt Pflicht, egal wie gut die Fundregel ist.

**Der Prüfdruck ist gewandert.** In vier der sechs Ablehnungen waren Frage, Antwort und Ablenker
sauber – beanstandet wurde der **Kontexttext**: eine Zuspitzung über das Reichstagsgebäude, ein
falsches Detail zum Westfalenstadion, eine unbelegte Behauptung über Mark Twain. Die
Kartenmechanik sitzt inzwischen; die Fehler stecken jetzt in dem Satz, der nach der Antwort
kommt. Zwei klassische Konstruktionsfehler waren trotzdem dabei: Bei „Wie heißt die größte
Schlagader?" war **kein einziger Ablenker eine Arterie** – wer nur weiß, dass eine Vene keine
Schlagader ist, trifft ohne Anatomiekenntnis. Und bei „Welche Beere gibt Gin sein Aroma?"
tippt man frei „Wacholderbeere", die Karte erwartete „Wacholder".

**Die eigene Dublettenschranke hat dabei gegriffen** – gegen eine der neuen Karten. „Wie viele
Spieler stehen beim Volleyball pro Team auf dem Feld?" kollidierte mit der vorhandenen
Eishockey-Karte: dieselbe Antwort, fast wortgleiche Frage. Wer das Muster erkennt, tippt
„Sechs", ohne die Sportart zu lesen. Umformuliert zu „Wie groß ist eine Volleyballmannschaft
auf dem Spielfeld?" mit der Antwort „Sechs Spieler".

### Zweite Fehlerjagd: der eigene neue Code

Nach der ersten Jagd sind rund tausend Zeilen dazugekommen – Markierungs-Zeitstempel,
Fassungsanzeige, Rundenfortsetzung, Diakritika, ein neuer Build-Schritt. Genau dort sitzen die
noch unentdeckten Fehler, also lief eine zweite Jagd **nur über diesen Bereich**: acht
Perspektiven, jeder Fund von zwei Skeptikern mit verschiedenem Blickwinkel gegengeprüft
(„ist der Ablauf überhaupt erreichbar?" und „ist das falsch – oder Absicht?"), dazu ein
Kritiker, der am Ende nach dem Übersehenen sucht. **Neun bestätigt, sieben von den Skeptikern
verworfen, vier Nachträge vom Kritiker.**

Die schwersten Funde waren beides Selbsttore aus derselben Woche:

- **Der Nachlauf des Suchen-Knopfs sperrte den Nutzer ein.** „Suchen" prüft nach und zeichnet
  1,5 Sekunden später die Einstellungen neu. Startet man in dieser Zeit eine Runde, zeichnete
  der Nachlauf die Einstellungen darüber – und weil eine Runde Leiste und Kopfzeile
  ausblendet, stand man ohne jede Navigation da. Heraus kam man nur über Neuladen oder die
  zerstörenden Knöpfe. Der Rückruf prüft jetzt, ob er noch in seine Lage passt.
- **Ein Prüfstein konnte nicht fehlschlagen.** Der Test „die erste Übernahme lädt die Seite
  nicht neu" setzte seine Marke **nach** dem Ereignis, das sie überleben sollte, und las sie
  eine Zeile später zurück. Er wäre auch dann grün geblieben, wenn die Seite jedem
  Erstbesucher unter den Händen neu geladen hätte.

Dazu, kürzer:

- **„Alle Markierungen löschen" beerdigte nur, was dieser Tab kannte.** Während einer Runde
  verwirft ein Tab die Meldungen des anderen bewusst – dessen frische Sterne bekamen deshalb
  keinen Grabstein, und das Speichern danach führte sie wieder herein. Erst einholen, dann
  beerdigen.
- **Ein Stern aus der Zukunft überlebte seinen Grabstein.** Der Zeitstempel ist zugleich die
  Fassungsnummer der Entscheidung; fängt die Uhr bei 0 an, kann eine spätere Entscheidung
  einen kleineren Betrag tragen als eine frühere. Die Uhr wird jetzt aus dem vorhandenen
  Bestand nachgezogen.
- **Ein Duellfehler löschte die Wiederholung des anderen Tabs.** Die Deckelung trägt eine
  frische `last`-Marke, und beim Zusammenführen gewinnt der jüngere Stand *als Ganzes* – auf
  einem veralteten Kartenzustand angewandt nahm sie `reps`, `ok` und das gewachsene Intervall
  mit. Sie wird jetzt über `aendereKarte()` auf den eingeholten Stand angewandt. Der Fix von
  vorgestern hatte einen kleinen Verlust gegen einen großen getauscht.
- **Der Service Worker konnte sich selbst vergiften.** Bei einer Lücke im Bestand legte er die
  Antwort auf die *angefragte* Adresse unter dem Gerüst-Schlüssel ab. Ein Aufruf von
  `/manifest.webmanifest` als Seite genügte, und die App lieferte dauerhaft JSON statt
  Oberfläche – und heilte nie wieder, weil der Eintrag ja vorhanden war. Bei einer Navigation
  wird jetzt das Gerüst selbst geholt, und nur was `id="app"` enthält, darf dort landen.
- **Der zurückgestellte Worker-Wechsel schützte den Rückblick nicht** (`endRun()` setzt `run`
  vorher auf null), und nach einer Übernahme aus dem zweiten Tab bot der Rückblick eine
  Fassung an, die es nicht mehr gab.
- **Zwölf Karten lagen im falschen Teilgebiet.** Tatort, Batman, Super Mario und neun weitere
  standen weiter unter „Film", obwohl es seit dem Unterhaltungs-Paket Fernsehen, Comics und
  Videospiele gibt. Wer gezielt „Videospiele" übte, bekam vier Karten nicht zu sehen. Das
  Teilgebiet geht nicht in die Kennung ein, der Lernfortschritt blieb beim Umtragen erhalten.
- **Ein weiterer Prüfstein las ein Feld, das es nicht gibt** (`c.al` statt `c.az`) und ließ
  damit genau die Hälfte aus, für die er geschrieben war.
- **`merge-cards.mjs` meldete „nichts geschrieben", nachdem es geschrieben hatte** – die
  Syntaxprüfung saß innerhalb der Schleife über die Zieldateien. Sie prüft jetzt alle, bevor
  die erste geschrieben wird.

**Was die Skeptiker verwarfen**, ist genauso lehrreich: eine angebliche Lücke in der
lastDay-Regel, ein behaupteter Rückwärtssprung beim Merkanker, eine „Weitermachen"-Runde mit
angeblich identischer Kartenmenge, ein Bewertungsrückschritt bei „Machiavelli" – alle vier
hielten der Gegenprüfung nicht stand. Ein Fund war strittig: Eine Perspektive meldete die
Gerüst-Vergiftung, die Gegenprüfung einer anderen widerlegte sie – aber am falschen Punkt, sie
prüfte das vorgeschlagene Gegenmittel statt den Fehler. Der Prüfstein hat es dann entschieden.

**Und der Prüfstein dafür war zunächst selbst falsch gebaut:** Er löste die Vergiftung über
einen Aufruf von `/sw.js` aus – Anfragen an das Worker-Skript selbst fängt der Worker nach
Spezifikation aber gar nicht ab. Der Test blieb grün, obwohl der Fehler danebenlag. Mit
`/manifest.webmanifest` schlägt er zu und zeigt das eingelagerte JSON im Klartext.

### Was die Fehlerjagd nicht bestätigt hat

Drei Meldungen aus derselben Suche hielten der Gegenprüfung **nicht** stand. Sie stehen hier,
damit niemand sie ein zweites Mal „findet":

- *Ein Tag mit ausschließlich Duellfragen erscheine im Wochenstreifen als „nichts gelernt".*
  Falsch – der Streifen liest `done` **und** `duel`.
- *Ein getippter Bindestrich statt eines Gedankenstrichs mache die Antwort falsch.* Falsch –
  `normalize()` ebnet beide zum selben Zeichen ein.
- *Fehlende Felder in einer eingelesenen Ergebnisdatei rutschten als Text „undefined" durch.*
  Falsch – `merge-cards.mjs` weist unvollständige Karten vorher ab.

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

Die 130 Einheitentests decken den Scheduler (Intervallgrenzen, Wachstumsgarantie, Vorschau),
die Warteschlangen (keine Dubletten, Budget, Themenfilter), das Einlesen fremder Backups, den
Vergleich freier Eingaben und den Quizmodus (Ziehung, Punkteformel, Auswertung, Runden über
zwei Tabs) ab.

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

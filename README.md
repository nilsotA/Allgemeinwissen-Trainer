# Wissenswerk

Ein Allgemeinwissen-Trainer als Web-App fürs iPhone. Statisch, offline-fähig, ohne Konto –
alles läuft im Browser, der Lernfortschritt bleibt auf dem Gerät.

**1.671 Karten** in neun Themen, aufgebaut in drei Stufen: Basis (Schulwissen Klasse 5–8),
Solide (gute Allgemeinbildung), Profi (das, was Quizduelle entscheidet).
Schwerpunkte liegen auf **Sport** (267 Karten: Trainingslehre, Anatomie, Bewegungslehre,
Sportmedizin, Sportdidaktik, Sportpsychologie) und **Mathematik** (274 Karten: Grundlagen,
Schulmathematik, Analysis, Lineare Algebra, Stochastik, Mathedidaktik, Mathematikgeschichte).
In beiden Fächern gibt es ein eigenes Teilgebiet **Verfahren erkennen**, das nicht nach einem
Fakt fragt, sondern nach der Entscheidung davor – siehe unten.
In beiden Fächern reicht die Sammlung bewusst bis auf Studienniveau: biomechanische Prinzipien
und der Doppelauftrag des Schulsports ebenso wie Hauptsatz, hessesche Normalform, Fehler
erster Art und das EIS-Prinzip. Wer diese Fächer unterrichtet, soll darin nicht nur mitreden,
sondern sattelfest sein.

Ein eigenes Teilgebiet **Geld im Alltag** deckt ab, was mit Anfang zwanzig anfängt zu zählen und
in keinem Lehrplan steht: Dispozins und Effektivzins, Mietkaution und Kündigungsfrist, Probezeit
und Urlaubsanspruch, welche Versicherung Pflicht ist und welche man trotzdem braucht.

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
Ratequote von 27,1 % und die Klammerquote von 61,0 % oben sind keine Kosmetik, sondern die
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
  zählt ein Duell trotzdem: geübt ist geübt.
- **Markierte Karten** – was du beim Nachschlagen mit ★ versiehst, lässt sich gezielt üben.
- **Schwachstellen** – die Statistik zeigt die Teilgebiete mit der schlechtesten
  Trefferquote; ein Tipp darauf startet eine Runde genau dazu.

## Weitere Funktionen

- **Verklickt? Zurücknehmen.** Ein Tipp auf ↶ macht die letzte Antwort samt Terminplanung
  rückgängig – auf dem Handy passiert ein Fehlgriff schnell, und er soll den Verlauf nicht
  verfälschen.
- **Nachschlagen** über die Lupe oben rechts: alle Karten durchsuchbar nach Frage, Antwort,
  Thema und Kontext. Antippen klappt die Lösung auf, ★ markiert für später.
- **Hinweise schlucken keine Tipper.** Der Hinweisbalken liegt fest über dem unteren Rand –
  also genau über den Antwort- und Notenknöpfen. Ohne `pointer-events: none` nahm sein
  Rechteck jeden Tipper entgegen, der darunter zielte; in einem simulierten Verlauf über
  mehrere Monate blieb eine Runde genau daran hängen. Nur der Knopf im Balken nimmt jetzt noch
  Tipper an. Das Update-Angebot erscheint außerdem gar nicht mehr mitten in der Runde: Laden
  wird dort ohnehin verweigert, weil es die offene Frage schlucken würde, also wird es
  zurückgehalten und nach der Runde nachgeholt.
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
npm test           # 79 Einheitentests plus Inhaltsprüfung
npm run test:e2e   # 68 Durchlaufprüfungen im iPhone-Viewport (braucht Playwright)
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

Der fehlende Buchstabe bleibt bewusst, wo er war: Er kann ein Wort echt verändern, und 68 %
dieser Fälle landen bei „knapp daneben" – genau die richtige Aufforderung, nachzusehen.

Zwei Dinge, die die Messung **nicht** ergeben haben, gehören dazu: Eine erste Auswertung
meldete auch „Antwort ohne Satzzeichen" als Problem – bis auffiel, dass sie aus „9,81 m/s²"
die Zahl „981" machte. Und verkürzte Antworten („Die Bibliothek" statt „Die Bibliothek von
Alexandria") werden abgelehnt, was richtig ist: Das sind unvollständige Antworten, keine
Tippfehler.

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

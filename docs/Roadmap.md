# MD_Calendar

## Projektbasis

#Version
- 0.0.1

#Date
- 09.11.2026

### Konzept

- [x] ~Optionen evaluieren (Google-Frontend, Plugin, eigene Entwicklung, ...)~
- [x] ~Open-Source-Recherche (Kalender, Todo-Planer)~
- [x] ~Konzept ausarbeiten~
- [x] ~Tech-Stack festlegen~
- [x] ~Projekt-Doku erstellen~

### Design

- [x] ~5 UI-Mockups evaluieren~
- [x] ~Favoriten auswählen => *Aurora*~
- [x] ~UI anpassen, Typografie und Radien bestimmen~
- [x] ~Control- und Headerbar ausarbeiten~
- [x] ~Farbschema festlegen => *Nord* (Intern: `03b`)~
- [x] ~Logo erstellen => *Orbit C*~
- [x] ~Finished-Sound erstellen => *Arpeggio*~

### Repo-Grundgerüst

- [x] ~`MD_Calendar.html`, `app.js` und `styles.css` erstellen~
- [x] ~`vendor/`: SortableJS, dayjs, Plus Jakarta Sans~
- [x] ~`jsconfig.json` mit `checkJs`~
- [x] ~Harness: `npm run verify` (Typen, Lint, Architektur, Unit, E2E)~

### Format

- [x] ~Golden File `Calendar`~
- [x] ~Golden File `Backlog`~
- [x] ~Golden File `Contacts`~
- [x] ~Golden File `Holidays`~
- [x] ~Golden File `Config`~

## Wochenkalender

#Version
- 0.1.0

#Date
- 10.11.2026

#Info
Erste nutzbare Version: Ordner öffnen, Woche ansehen, Einträge pflegen und speichern.

### Daten

- [x] ~Speicher-Adapter für den lokalen Ordner umsetzen (Basis: MD_Manager `io/files.js`)~
- [x] ~Parser + Serializer für `Calendar.md` gegen die Golden File entwickeln~
- [x] ~Letzten Ordner merken => Öffnen mit einem Klick~
- [x] ~Externe Änderungen erkennen => neu laden oder überschreiben~

### Shell

- [x] ~Headerbar umsetzen (Logo, Monat, KW, Navigation, View-Switcher)~
- [x] ~Farben + Glas-Optik aus `03b` übernehmen~
- [x] ~Icon-Sprite übernehmen + Icon-Test ergänzen~
- [x] ~Notificationssystem + Tooltips aus MD_Manager übernehmen~
- [x] ~Startprüfung umsetzen~

### Woche

- [x] ~Wochenansicht quer + hochkant umsetzen~
- [x] ~Tageskopf mit Heute-Markierung~
- [x] ~Erledigte + überfällige Einträge darstellen~
- [x] ~Vergangene Tage dimmen~
- [x] ~Abstände verfeinern und vereinheitlichen~

### Bearbeiten

- [x] ~Eintragsdialog umsetzen (Titel, Datum, Uhrzeit, Ort, Notiz)~
- [x] ~Anlegen über „+ Neu" und den Knopf am Tag~
- [x] ~Löschen ohne Rückfrage, Hinweis auf `Strg+Z`~
- [x] ~Soundsystem aus MD_Manager übernehmen~
- [x] ~Abhaken mit *Arpeggio* + Lautsprecher-Knopf zum Stummschalten~
- [x] ~Drag & Drop innerhalb eines Tages und zwischen Tagen~

### Speichern

- [x] ~Undo/Redo-System aus MD_Manager übernehmen~
- [x] ~Speichern per `Strg+S` + Anzeige im Header~
- [x] ~Versionsprüfung vor jedem Schreiben~
- [x] ~Warnung beim Schließen mit ungespeicherten Änderungen~

### Release

- [x] ~Docs aktualisieren~

## Monatskalender und Serien

#Version
- 0.2.0

#Date
- 10.11.2026

### Monat

- [x] ~Monatsansicht umsetzen (KW-Spalte, Überlauf „+N")~
- [x] ~Standardansicht je Ausrichtung => quer *Woche*, hochkant *Monat*~
- [x] ~Drag & Drop im Monat~

### Serien

- [x] ~Regeln umsetzen (täglich, wöchentlich, monatlich nach Datum + Position, jährlich)~
- [x] ~Vorkommen für den sichtbaren Zeitraum berechnen + cachen~
- [x] ~Serie im Dialog anlegen + bearbeiten~
- [x] ~Vorkommen abhaken + löschen~
- [x] ~Serie ab hier beenden~

### Mehrtägig

- [x] ~`## Multi-day` parsen + schreiben~
- [x] ~Balken in Woche + Monat, überlappende stapeln~
- [x] ~Umschalten im Dialog per Icon => Von-bis-Zeitraum~

### Release

- [x] ~Docs aktualisieren~

## Backlog und Tags

#Version
- 0.3.0

#Date
- 10.11.2026

### Backlog

- [x] ~`Backlog.md` parsen + schreiben~
- [x] ~Panel umsetzen (quer rechts, hochkant unten)~
- [x] ~Drag & Drop zwischen Backlog und Tagen~
- [x] ~Sortieren + zwischen Gruppen verschieben~
- [x] ~„Ins Backlog" im Dialog~

### Feiertage

- [x] ~Skript für `Holidays.md` (NRW) außerhalb des Repos schreiben => Python im ClaudeHub, Daten per API~
- [x] ~Feiertage parsen und im Tageskopf anzeigen~
- [x] ~Knopf + Ansicht der Feiertagsübersicht festlegen~
- [x] ~Feiertagsübersicht umsetzen (Icon im Header, Panel mit Feiertagen + Schulferien)~

### Tags

- [x] ~Festlegen, wo das Tag-Icon erscheint => Kachel + Balken~
- [x] ~Einträge mit Tag-Farbe darstellen~
- [x] ~`Config.md` einlesen~
- [x] ~Tag im Dialog wählen können~

### Mehrtägig

- [x] ~Balken ziehen => verschieben + Anfang/Ende ändern~

### Release

- [x] ~Docs aktualisieren~

## Kontakte und Tags

#Version
- 0.4.0

#Date
- 10.11.2026

#Info
Die Kontakte-Ansicht wird ein vollwertiger Kontakt-Editor. `Contacts.md` bleibt die Datenquelle.

### Vorbereitung

- [x] ~Informieren + Recherchieren => An Best-Practices anderer Parser orientieren~
- [x] ~Offene Fragen klären (29.02., Duplikate beim Import, Fotos, Spitzname im Badge)~
- [x] ~Parser + Serializer für `Contacts.md` gegen die Golden File entwickeln~

### Editor

- [x] ~Liste mit Suche, Filtern + Sortierung umsetzen~
- [x] ~Detailansicht mit allen Feldern umsetzen~
- [x] ~Anlegen, Löschen, Gruppen verwalten~
- [x] ~`tel:` / `mailto:` + Adresse kopieren~

### Kalender

- [x] ~Geburtstage + Jahrestage im Tageskopf, mit Alter + „+X"~
- [x] ~Klick auf Badge öffnet den Kontakt~

### vCard

- [x] ~Import mit Duplikat-Erkennung~
- [x] ~Export pro Kontakt und als ganze Liste~

### Tag-Icons

- [x] ~Icon-Satz für Tags gestalten (`res/tag-icons/`)~
- [x] ~Tag-Icon auf Kachel + Balken anzeigen~
- [x] ~Unbekannte Icon-ID in `Config.md` als Fehler melden~
- [x] ~Tags als Dropdown-Liste zur Auswahl => Default ist leer~

### Release

- [x] ~Docs aktualisieren~

## Suche, Shortcuts und Import

#Version
- 0.5.0

#Date
- 10.11.2026

### Suche

- [x] ~Fuzzy-Suche über den ganzen Kalender~
- [x] ~Sprung zum Treffer~

### Shortcuts

- [x] ~Weitere Shortcuts festlegen => Nutzer fragen + Vorschläge machen~
- [x] ~Shortcuts umsetzen (T mit Scroll-Animation)~
- [x] ~Hilfe-Übersicht umsetzen~
- [x] ~Rechtsklick kopiert Aufgaben~
- [x] ~Gedrückte linke Maustaste multiselektiert Aufgaben~
- [x] ~Mausrad-Scrollen durch die Wochen und Monate aktivieren (one-at-a-time)~

### Import

- [x] ~ICS-Import der Google-Historie in `Calendar.md`~
- [x] ~ICS-Import einzelner Einladungen~

### Bugs und Verbesserungen

- [x] ~Logo überall rahmenlos anzeigen (bspw. Browser-Tab)~
- [x] ~Startseite nur mit minimaler Ansicht (Headerbar zeigt nicht funktionale Dinge an)~
- [x] ~Erstmal alle Tooltips rauswerfen => einzelne werden später wieder nachgepflegt~
- [x] ~"+ Eintrag"-Button kann raus => Doppelklick auf Tag triggert Neu-Dialog mit dem Tag als Vorauswahl~
- [x] ~"+ Neu"-Button auf "+" kürzen~
- [x] ~New-Menu aufräumen: Kalenderauswahl, Uhrzeitauswahl, sauber + klare Pre-Selection, Dropdown und Auswahl in passendem CSS~
- [x] ~Notifications anzeigen wenn bspw. versucht eine Serie zu verschieben~
- [x] ~Der aktuelle Tag ist nicht gut genug erkennbar, wenn er nicht mittig liegt. Man schaut erstmal auf das Licht in der Mitte~
- [x] ~Mute-Button in Options-Menü rechts vom New-Button schieben~
- [x] ~Das Holiday-Skript sollte sich an deutsche Normen und übliche Bezeichnungen für Feiertage halten~
- [x] ~Wenn Urlaube hinterlegt sind, werden sie auch im Menü "Feiertage ..." angezeigt (oberhalb der Schulferien)~
- [x] ~Die Aufgaben einer gesamten Woche brauchen sich nicht nach unten verschieben, wenn irgendwann am Ende der Woche ein Multi-day Event startet~
- [x] ~Rechtsklick auf Item => Nicht erledigt, Kopieren, Löschen~
- [x] ~Die Navigation (rechts/links) springt mit unterschiedlich langen Monatsnamen~

### Release

- [x] ~Docs aktualisieren~

#Pin
## Umstieg und Nutzung

#Version
- 0.6.0

#Info
Ab hier ersetzt MD_Calendar den Google-Kalender. Google bleibt nur noch als Archiv.

### Umstieg

- [ ] Stichtag festlegen
- [ ] Google-Kalender exportieren + importieren
- [ ] Google-Kontakte per vCard importieren
- [ ] Ordner ins NAS-Backup aufnehmen

### Bugs und Verbesserungen

- [x] ~Tag-Icons für Spielen + Finanzen ergänzen~
- [x] ~Header: Pfeile + KW raus, „+“, Undo, Redo + Speichern wie MD_Manager~
- [x] ~Header rechts: Hilfe, Ton, Ferien, Backlog => Optionsmenü entfällt~
- [x] ~Suche nur per `F`, als Leiste unten mittig~
- [x] ~Hilfe als Panel wie die Ferienansicht, mit Tastenkappen in drei Spalten~
- [x] ~Heute auf `H`~
- [x] ~Kalender importieren nur noch auf der Startseite~
- [x] ~Notifications knapp, zentriert + nur so breit wie nötig~
- [x] ~Ordner-Meldung eindeutig („Ordner „…“ geöffnet“)~
- [x] ~Kontextmenü ohne Tastenkürzel~
- [x] ~Kein Hover-Highlight in reinen Anzeige-Panels~
- [x] ~Wiederholungs-Icon größer + vertikal zentriert~
- [x] ~Hintergrundlicht in der Mitte entfernt~
- [x] ~Rahmen von Header + Hintergrund entfernt~
- [x] ~Undo-Zähler: unveränderter Stand gilt als gespeichert~

### Release

- [ ] Docs + README aktualisieren

## Mobil

#Version
- 2.0.0

#Info
Dieselbe App als gehostete PWA auf dem iPhone. Die Vorkehrungen sind ab 0.1.0 eingebaut.

### Plattform

- [ ] Hosting festlegen (NAS oder GitHub Pages)
- [ ] Service Worker + Installation auf dem Home-Bildschirm

### Speicher

- [ ] Drive-Scope klären (`drive` vs. Picker)
- [ ] Drive-Adapter mit OAuth umsetzen
- [ ] Konflikte zwischen Geräten behandeln => neu laden + eigene Änderungen erneut anwenden

### Layout

- [ ] Mobile Skizze erstellen (Tag/Agenda)
- [ ] Mobiles Layout umsetzen inkl. Backlog + Inbox
- [ ] Touch-Bedienung prüfen
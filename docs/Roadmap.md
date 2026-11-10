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

#Pin
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

## Kontakte

#Version
- 0.4.0

#Info
Die Kontakte-Ansicht wird ein vollwertiger Kontakt-Editor. `Contacts.md` bleibt die Datenquelle.

### Vorbereitung

- [ ] Offene Fragen klären (29.02., Duplikate beim Import, Fotos, Spitzname im Badge)
- [ ] Parser + Serializer für `Contacts.md` gegen die Golden File entwickeln

### Editor

- [ ] Liste mit Suche, Filtern + Sortierung umsetzen
- [ ] Detailansicht mit allen Feldern umsetzen
- [ ] Anlegen, Löschen, Gruppen verwalten
- [ ] `tel:` / `mailto:` + Adresse kopieren

### Kalender

- [ ] Geburtstage + Jahrestage im Tageskopf, mit Alter + „+X"
- [ ] Klick auf Badge öffnet den Kontakt

### vCard

- [ ] Import mit Duplikat-Erkennung
- [ ] Export pro Kontakt

### Release

- [ ] Docs + README aktualisieren
- [ ] Internen Tag setzen

## Suche, Shortcuts und Import

#Version
- 0.5.0

### Tag-Icons

- [ ] Icon-Satz für Tags gestalten (`res/tag-icons/`) => interaktiv mit Nutzer
- [ ] Tag-Icon auf Kachel + Balken anzeigen
- [ ] Unbekannte Icon-ID in `Config.md` als Fehler melden

### Suche

- [ ] Fuzzy-Suche über den ganzen Kalender
- [ ] Sprung zum Treffer

### Shortcuts

- [ ] Weitere Shortcuts festlegen
- [ ] Shortcuts umsetzen (T mit Scroll-Animation)
- [ ] Hilfe-Übersicht umsetzen

### Import

- [ ] ICS-Import der Google-Historie in `Calendar.md`
- [ ] ICS-Import einzelner Einladungen

### Release

- [ ] Docs + README aktualisieren
- [ ] Internen Tag setzen

## Umstieg

#Version
- 1.0.0

#Info
Ab hier ersetzt MD_Calendar den Google-Kalender. Google bleibt nur noch als Archiv.

### Umstieg

- [ ] Stichtag festlegen
- [ ] Google-Kalender exportieren + importieren
- [ ] Google-Kontakte per vCard importieren
- [ ] Ordner ins NAS-Backup aufnehmen

### Release

- [ ] Docs + README aktualisieren
- [ ] Internen Tag setzen

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
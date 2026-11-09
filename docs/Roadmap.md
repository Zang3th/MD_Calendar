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

#Info
Erste nutzbare Version: Ordner öffnen, Woche ansehen, Einträge pflegen und speichern.
Ab hier laufen die täglichen ToDo-Listen über MD_Calendar.

### Daten

- [ ] Speicher-Adapter für den lokalen Ordner umsetzen (Basis: MD_Manager `io/files.js`)
- [ ] Dauerhafte Dateirechte unter `file://` prüfen
- [ ] Verhalten mit Drive für Desktop prüfen (Spiegeln, Konfliktkopien)
- [ ] Parser + Serializer für `Calendar.md` gegen die Golden File entwickeln
- [ ] Letzten Ordner merken => Öffnen mit einem Klick
- [ ] Externe Änderungen erkennen => neu laden oder überschreiben

### Shell

- [ ] Header-Pille umsetzen (Logo, Monat, KW, Navigation, View-Switcher)
- [ ] Hintergrundlichter + Glas-Optik aus `03b` übernehmen
- [ ] Icon-Sprite aufbauen + Icon-Test ergänzen
- [ ] Notifications + Tooltips aus MD_Manager übernehmen
- [ ] Startprüfung umsetzen

### Woche

- [ ] Wochenansicht quer + hochkant umsetzen
- [ ] Tageskopf mit Heute-Markierung
- [ ] Erledigte + überfällige Einträge darstellen
- [ ] Vergangene Tage dimmen
- [ ] Abstände verfeinern

### Bearbeiten

- [ ] Eintragsdialog umsetzen (Titel, Datum, Uhrzeit, Ort, Notiz)
- [ ] Anlegen über „+ Neu" und den Knopf am Tag
- [ ] Löschen ohne Rückfrage, Hinweis auf `Strg+Z`
- [ ] Abhaken mit *Arpeggio* + Lautsprecher-Knopf zum Stummschalten
- [ ] Drag & Drop innerhalb eines Tages und zwischen Tagen

### Speichern

- [ ] Undo/Redo aus MD_Manager übernehmen
- [ ] Speichern per `Strg+S` + Anzeige im Header
- [ ] Versionsprüfung vor jedem Schreiben
- [ ] Warnung beim Schließen mit ungespeicherten Änderungen

### Release

- [ ] Eigene Daten anlegen + eine Woche im Alltag testen
- [ ] Docs + README aktualisieren
- [ ] Internen Tag setzen

## Monat, Tags und Mehrtägiges

#Version
- 0.2.0

### Monat

- [ ] Monatsansicht umsetzen (KW-Spalte, Überlauf „+N")
- [ ] Standardansicht je Ausrichtung => quer *Woche*, hochkant *Monat*
- [ ] Drag & Drop im Monat

### Tags

- [ ] Icon-Satz für Tags gestalten (`res/tag-icons/`)
- [ ] Festlegen, wo das Tag-Icon erscheint (Kachel, Balken, Dialog)
- [ ] `Config.md` einlesen, unbekannte Icon-ID als Fehler melden
- [ ] Einträge mit Tag-Farbe + Icon darstellen
- [ ] Tag im Dialog wählen

### Mehrtägig

- [ ] `## Multi-day` parsen + schreiben
- [ ] Balken in Woche + Monat, überlappende stapeln
- [ ] Umschalten im Dialog per Icon => Von-bis-Zeitraum

### Feiertage

- [ ] Skript für `Holidays.md` (NRW) außerhalb des Repos schreiben
- [ ] Feiertage im Tageskopf anzeigen
- [ ] Knopf + Ansicht der Feiertagsübersicht festlegen
- [ ] Feiertagsübersicht umsetzen (Feiertage + Ferien, aktuelles Jahr)

### Release

- [ ] Docs + README aktualisieren
- [ ] Internen Tag setzen

## Serien und Backlog

#Version
- 0.3.0

#Warn
Größtes Risiko im Projekt. Gründlich testen.

### Serien

- [ ] Regeln umsetzen (täglich, wöchentlich, monatlich nach Datum + Position, jährlich)
- [ ] Vorkommen für den sichtbaren Zeitraum berechnen + cachen
- [ ] Serie im Dialog anlegen + bearbeiten
- [ ] Vorkommen abhaken + löschen
- [ ] Serie ab hier beenden

### Backlog

- [ ] `Backlog.md` parsen + schreiben
- [ ] Panel umsetzen (quer rechts, hochkant unten)
- [ ] Drag & Drop zwischen Backlog und Tagen
- [ ] Sortieren + zwischen Gruppen verschieben
- [ ] „Ins Backlog" im Dialog

### Release

- [ ] Docs + README aktualisieren
- [ ] Internen Tag setzen

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

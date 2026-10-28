# Chrome Web Store Eintrag (Deutsch)

## Name (max. 45 Zeichen)
Tab Matomen Kai – Tab-Bereiche

## Kurzbeschreibung (max. 132 Zeichen)
Ein „Bereich“ pro Projekt, ganze Tab-Sets im Fenster wechseln. Speichern, Wiederherstellen, Sammelaktionen, Rückgängig. 10 Sprachen.

## Ausführliche Beschreibung
Tab Matomen Kai speichert deine Tabs als „Bereiche“, einen pro Projekt oder Aufgabe, und lässt dich das gesamte Tab-Set im selben Chrome-Fenster wechseln.

■ Funktionen
- Bereiche: Speichere pro Projekt ein Set von Tabs und wechsle mit einem Klick. Auf Wunsch werden die aktuellen Tabs beim Wechsel automatisch gespeichert.
- Kategorien: Ordne Bereiche in einer Hierarchie. Per Drag-and-drop verschieben, mit Farbe und Symbol unterscheiden.
- Tab-Gruppen: Chrome-Tab-Gruppen werden unverändert gespeichert und wiederhergestellt.
- Tab-Sammelaktionen: Wähle Tabs aus, um sie zu öffnen, zu verschieben, zu gruppieren, zu archivieren oder zu löschen. Alles auswählen und Bereiche mit Umschalt+Klick.
- Rückgängig: Mache eine Löschung oder Archivierung direkt danach rückgängig (Ctrl/⌘+Z).
- URL-Listen kopieren: als Markdown, Titel + URL oder nur URLs direkt in die Zwischenablage.
- Speichern per Rechtsklick: Speichere die Seite oder den Link unter dem Mauszeiger über das Kontextmenü in einem beliebigen Bereich.
- Tastatur: Ctrl/⌘+S speichern, Ctrl/⌘+K Bereiche suchen, / Tabs filtern.
- Sicherung: JSON-Export/-Import, geplante automatische Sicherungen und manuelle Sicherung in Google Drive.
- 10 Sprachen: Englisch, Japanisch, Chinesisch (vereinfacht), Chinesisch (traditionell), Koreanisch, Spanisch, Portugiesisch (Brasilien), Deutsch, Französisch und Italienisch. Umschalten in den Einstellungen.

■ Deine Daten
Alles wird im lokalen Speicher deines Browsers abgelegt. Die Sicherung in Google Drive schreibt nur dann in dein eigenes Drive, wenn du auf „Verbinden“ und „Jetzt sichern“ klickst. Nichts von dem, was du aufrufst, wird irgendwohin gesendet.

## Begründung der Berechtigungen (für das Entwickler-Dashboard)
- tabs / tabGroups: Die geöffneten Tabs und Tab-Gruppen lesen, um sie als Bereiche zu speichern und wiederherzustellen.
- storage / unlimitedStorage: Bereiche und Einstellungen lokal speichern.
- alarms: geplante automatische Sicherungen.
- downloads: JSON-Sicherungen in den Download-Ordner schreiben.
- contextMenus: das Rechtsklick-Menü „In Tab Matomen Kai speichern“.
- identity: die Berechtigung zum Speichern von Sicherungen in Google Drive einholen (nur der Bereich drive.file).
- Host-Berechtigung googleapis.com: Hochladen in die Google-Drive-API. 127.0.0.1: Kommunikation mit dem optionalen lokalen KI-Integrationsserver auf dem eigenen PC des Nutzers.
- Content-Skript (alle Websites): lauscht nur auf die eingestellte Maustaste, um zum Dashboard zurückzukehren. Es liest keine Seiteninhalte.

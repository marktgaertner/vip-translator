# Preispflege – Preise ändern ohne Programmierkenntnisse

`preispflege/index.html` ist eine interne Seite für das Team. Sie ändert die
Preisdaten im **Tarifberater** und im **Jobticket-Rechner**. Es wird nichts
hochgeladen – alles läuft im Browser, auch offline.

## So geht's

1. `preispflege/index.html` im Browser öffnen (Doppelklick genügt).
2. Die aktuelle `index.html` des Tools hineinziehen – also
   `tarifberater/index.html` oder `jobticket/index.html`, am besten die
   Datei, die gerade auf dem Webspace liegt.
3. Preise eintragen. Linke Spalte = laufendes Jahr, rechte Spalte = Folgejahr.
   Geänderte Zeilen werden grün markiert; „Datenstand“ auf heute setzen.
4. Unten zeigt die Prüfung, ob alles stimmt:
   - **Rot** = Fehler (leeres Feld, Betrag ≤ 0 …) – Download gesperrt.
   - **Orange** = Hinweis (mehr als 10 % teurer, Folgejahr günstiger) – bitte
     prüfen, Download möglich.
   - Die Stichprobe zeigt typische Empfehlungen mit den neuen Preisen.
5. „Vorschau öffnen“ zeigt die geänderte Seite, „Neue Datei herunterladen“
   speichert sie.
6. Auf dem Webspace die alte Datei sichern (z. B. `index-alt.html`) und durch
   die neue ersetzen. Einmal im Browser öffnen und eine Empfehlung durchklicken.

## Jahreswechsel

Wenn der VBB die Preise des übernächsten Jahres veröffentlicht (meist im
September), „Jahreswechsel vorbereiten“ klicken: Das Folgejahr wird zum
laufenden Jahr (mit seinen Preisen), ein neues Folgejahr wird angelegt.
Danach die neuen Preise rechts eintragen. Bis dahin muss nichts getan werden –
die Seiten schalten am 1. Januar selbst auf die Preise der rechten Spalte um.

## Abgeleitete Preise

Deutschlandticket Job (70 %), Deutschlandticket Zuschuss Ausbildung (60 %) und
Deutschlandsemesterticket (60 %) hängen am Deutschlandticket. Der Knopf
„berechnen“ setzt sie aus dem Deutschlandticket-Preis.

## Für Entwickler

Der Kern (Erkennen, Prüfen, Schreiben, Jahreswechsel) steht im Block
`<script id="pflege-kern">` und wird mit den echten Dateien beider Tools getestet:

```
node preispflege/test/pflege-test.mjs
```

Die Prüfung lädt die Rechenlogik aus der geladenen Datei selbst – geprüft wird
also genau der Code, der später auf der Webseite läuft. Kommt ein neues
Preisfeld hinzu, erscheint es automatisch im Editor; für eine verständliche
Beschriftung einen Eintrag in `NAMES` ergänzen (der Test meldet fehlende).

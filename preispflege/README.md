# Preispflege – direkt im Tarifberater und im Jobticket-Rechner

Die Preise pflegt das Team **in den Tools selbst**, ohne Code und ohne
zusätzliche Seite.

## So geht's

1. Das Tool öffnen und an die Adresse `?pflege` anhängen – oder ganz unten
   auf **„Preise pflegen (ViP intern)“** klicken. Beispiel:
   `https://…/tarifberater/?pflege`. Tipp: als Lesezeichen speichern.
2. Über der Seite erscheint die Preispflege mit allen aktuellen Preisen.
   Links das laufende Jahr, rechts das Folgejahr. Geänderte Zeilen werden
   grün, Fehler rot (Speichern gesperrt), Auffälliges orange (z. B. mehr als
   10 % teurer).
3. **Speichern**:
   - In **Chrome/Edge** öffnet sich ein Speichern-Dialog: die `index.html`
     im Webspace-Ordner auswählen (z. B. als Netzlaufwerk verbunden) – dann
     ist der neue Stand sofort online.
   - In anderen Browsern wird die neue `index.html` heruntergeladen und auf
     dem Webspace ersetzt (alte Datei vorher sichern).
4. Seite neu laden und eine Empfehlung durchklicken.

Vor dem Speichern rechnet die Preispflege mit der Rechenlogik der Seite alle
Antwortkombinationen durch (Tarifberater: 2.160) und zeigt eine Stichprobe
typischer Empfehlungen sowie eine Liste aller Änderungen. „Vorschau“ öffnet
die geänderte Seite in einem neuen Tab.

**Jahreswechsel:** Wenn der VBB die Preise des übernächsten Jahres
veröffentlicht (meist im September), „Jahreswechsel vorbereiten“ klicken und
die neuen Preise rechts eintragen. Sonst ist nichts zu tun – die Seiten
schalten am 1. Januar selbst um.

**Abgeleitete Preise:** Deutschlandticket Job (70 %), Zuschuss Ausbildung
und Semesterticket (je 60 %) lassen sich per „berechnen“ aus dem
Deutschlandticket setzen.

Die Preispflege ändert nur die Datei, die gespeichert wird. Wer `?pflege`
aufruft, ohne zu speichern, verändert nichts – auch Besucher der Website
nicht.

## Für Entwickler

Quelle: `pflege-kern.js` (Prüfen, Schreiben, Jahreswechsel – ohne DOM),
`pflege-ui.js` (Oberfläche), `pflege.css`. Eingebaut wird mit

```
node preispflege/einbauen.mjs
```

zwischen `<!-- PFLEGE:START -->` und `<!-- PFLEGE:END -->` sowie als
`<script id="pflege-quelle">` im Kopf. Letzteres sichert beim Laden die
unveränderte Seite (nur mit `?pflege`), damit auch eine lokal geöffnete
Datei gespeichert werden kann; online liest die Pflege die Datei direkt vom
Server. Die Tools starten deshalb erst bei `DOMContentLoaded`.

Test (prüft auch, dass die eingebaute Fassung aktuell ist):

```
node preispflege/test/pflege-test.mjs
```

Kommt ein neues Preisfeld hinzu, erscheint es automatisch; für eine
verständliche Beschriftung einen Eintrag in `NAMES` (pflege-kern.js)
ergänzen – der Test meldet fehlende.

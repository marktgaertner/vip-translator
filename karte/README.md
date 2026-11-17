# ViP Karte – Kundenzentren, Serviceagentur und Verkaufsstellen

Eine HTML-Datei (`karte/index.html`) mit allen 16 Stellen, an denen es
ViP-Tickets gibt: 2 Kundenzentren, die Serviceagentur Clavis und 13
Verkaufsstellen (nur Ticketverkauf). Grundlage ist die Seite
[ViP Kundenzentren und Verkaufsagenturen](https://www.swp-potsdam.de/de/verkehr/kontakt-servicestellen/vip-verkaufsstellen-und-agenturen/),
Stand 17.11.2026.

## Was die Seite kann

- Kundenzentren sind mit rotem Rahmen hervorgehoben (Karte, Liste, Legende).
- Liste mit Filter (Kundenzentren / Serviceagentur / Verkaufsstellen), Suche
  nach Name, Straße oder Stadtteil und „Nur jetzt geöffnete“.
- **Jetzt geöffnet / schließt bald / öffnet morgen 7:00** – berechnet in
  Potsdamer Zeit, mit allen gesetzlichen Feiertagen in Brandenburg
  (Ostern, Pfingsten, Reformationstag …) und den Schließtagen zum Jahresende.
- Detail mit Öffnungszeiten (heutiger Tag hervorgehoben), Angebot, Telefon,
  E-Mail und „Route planen“.
- „In meiner Nähe“ sortiert nach Entfernung. Der Standort bleibt im Browser.
- Direktlink auf einen Standort: `index.html#mobiagentur`,
  `#platz-der-einheit`, `#clavis-babelsberg` …; `?embed=1` blendet den Kopf
  für iframes und die App aus.

## Datenschutz

Liste und Öffnungszeiten laufen ohne externe Dienste; Leaflet (Karten-
bibliothek) ist in die Datei eingebettet. Die Kartenkacheln kommen von
OpenStreetMap und werden **erst nach Klick auf „Karte laden“** geladen
(Zwei-Klick-Lösung); die Entscheidung kann auf dem Gerät gemerkt werden.
`?karte=1` lädt die Karte sofort – nur verwenden, wo die einbettende Seite
selbst eine Einwilligung einholt.

Für viel Verkehr (z. B. Startseite der Website) sind die öffentlichen
OSM-Kacheln nach deren Nutzungsrichtlinie nicht gedacht; dann einen eigenen
oder kommerziellen Kachel-Server eintragen (eine Zeile, `L.tileLayer(...)`).
Lokal per Doppelklick geöffnet zeigt die Karte keine Kacheln (OSM verlangt
eine Webadresse als Herkunft) – auf dem Webspace funktioniert es.

## Pflegen

Alle Standorte stehen im Block `<script id="karte-data">` am Ende der Datei.
Öffnungszeiten als Regeln: `"t"` = Wochentage (0 = Sonntag … 6 = Samstag,
`"F"` = Feiertag), `"von"`/`"bis"` als `HH:MM`, `"geschlossen"` = Tage im
Format `MM-TT`. Verkaufsstellen ohne `"zeiten"` zeigen „Öffnungszeiten des
Geschäfts“. Koordinaten z. B. über openstreetmap.org (Rechtsklick → „Adresse
anzeigen“). Danach:

```
node karte/test/karte-test.mjs
```

## Bitte intern klären (aus der Quelle nicht eindeutig)

- **Bornstedt:** Auf der Seite steht bei „LPT & Theaterkasse,
  Alexander-Klein-Straße 4“ zusätzlich „Ab 01.07.2026: Georg-Hermann-Allee 9,
  Spätkauf 63“. Ersetzt die neue Stelle die alte? Die Karte zeigt beide.
- **Groß Glienicke** (Presseshop Potsdamer Chaussee) und **Luisenplatz**:
  keine Hausnummer – die Lage ist ungefähr und als solche gekennzeichnet.
- Kundenzentrum Platz der Einheit hat keine eigene Telefonnummer; die Karte
  nennt das ViP-Infotelefon.
- Tippfehler auf der Quellseite: „Bitte beachen Sie“, „ViP-Kundenzetrum
  Platz der Einheit“.

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
Sind die Kacheln gesperrt (Firmen-Firewall, Werbeblocker, eingebettete
Vorschau), zeigt die Karte einen Hinweis mit Link auf openstreetmap.org; die
Liste funktioniert trotzdem.
Lokal per Doppelklick geöffnet zeigt die Karte keine Kacheln (OSM verlangt
eine Webadresse als Herkunft) – auf dem Webspace funktioniert es.

## Kartendienst (MapTiler)

Die Kacheln kommen von OpenStreetMap, solange kein Schlüssel eingetragen ist.
Mit einem MapTiler-Schlüssel laden sie von MapTiler (zuverlässiger für die
Website). Eintrag im Datenblock `karte-data` unter `kartendienst`:

    "kartendienst": { "maptilerKey": "HIER_DER_SCHLÜSSEL", "stil": "streets-v2" }

Den Schlüssel in der MapTiler-Oberfläche auf die Domains der ViP-Website
beschränken (Referrer-Einschränkung), damit er außerhalb nicht nutzbar ist.
Die Nennung von MapTiler und OpenStreetMap erscheint dann automatisch.

## Standorte pflegen und erweitern

Ohne Programmierkenntnisse, direkt in der Karte: `?pflege` an die Adresse
hängen oder unten auf **„Standorte pflegen (ViP intern)“** klicken.

- **Neue Stelle:** „+ Neue Stelle“, Name, Art (Kundenzentrum /
  Serviceagentur / Verkaufsstelle), Adresse, Stadtteil eintragen. Position
  mit **„Position aus Adresse suchen“** (über OpenStreetMap) oder per Klick
  in die Karte setzen; der Punkt lässt sich ziehen.
- **Öffnungszeiten:** Haken bei „Feste Öffnungszeiten“, dann je Zeile Tage
  anklicken (inkl. „Feiertag“) und Uhrzeiten wählen; die Beschriftung
  („Montag – Freitag“) entsteht automatisch. Schließtage als Datum
  („24.12., 31.12.“). Ohne Haken zeigt die Karte „Öffnungszeiten des
  Geschäfts“.
- **Angebot** (ein Punkt pro Zeile), Telefon, E-Mail, Hinweis – optional.
- **Ändern / Entfernen:** Stelle links wählen; „Stelle entfernen“ oben rechts.
- **Speichern** wie bei den Preisen: in Chrome/Edge direkt über die
  `index.html` im Webspace-Ordner, sonst Download und auf dem Webspace
  ersetzen. Fehler (fehlende Adresse, Position außerhalb Potsdams, ungültige
  Uhrzeit oder Schließtage) sperren das Speichern.

Neue Stellen bekommen eine ID aus dem Namen; damit funktionieren
Direktlinks wie `index.html#kiosk-am-bassinplatz`. Bestehende IDs bleiben
beim Umbenennen erhalten, damit verschickte Links nicht brechen.

Technisch stehen die Standorte im Block `<script id="karte-data">` (Format
siehe oben in der Datei). Tests:

```
node karte/test/karte-test.mjs
node preispflege/test/karte-pflege-test.mjs
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

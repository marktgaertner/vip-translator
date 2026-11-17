// Prüft den Kern der Standortpflege und das Speichern mit der echten Karte:
//   node preispflege/test/karte-pflege-test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { einbauen } from '../einbauen.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'karte', 'index.html'), 'utf8');
const ctx = { location: { search: '' }, window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(join(root, 'preispflege', 'pflege-datei.js'), 'utf8') + '\n' + readFileSync(join(root, 'preispflege', 'karte-pflege.js'), 'utf8') + '\nthis.PD = PflegeDatei; this.PK = KartePflegeKern;', ctx);
vm.runInContext(html.match(/<script id="karte-kern">([\s\S]*?)<\/script>/)[1] + '\nthis.K = KarteKern;', ctx);
const { PD, PK, K } = ctx;

let failures = 0;
const check = (name, cond, detail) => { if (cond) console.log('  ok   ' + name); else { failures++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };

console.log('Einbau');
check('Standortpflege ist eingebaut und aktuell (sonst: node preispflege/einbauen.mjs)', html.includes('<script id="pflege-quelle">') && einbauen(html, 'karte/index.html') === html);
check('Fußzeile verlinkt die Standortpflege', html.includes('href=\\"?pflege\\"') || html.includes('href="?pflege"'));

console.log('\nTage und Schließtage');
check('Mo–Fr', PK.tageLabel([1, 2, 3, 4, 5]) === 'Montag – Freitag', PK.tageLabel([1, 2, 3, 4, 5]));
check('So + Feiertage', PK.tageLabel([0, 'F']) === 'Sonntag und Feiertage', PK.tageLabel([0, 'F']));
check('Mo, Mi', PK.tageLabel([3, 1]) === 'Montag, Mittwoch', PK.tageLabel([3, 1]));
check('Mo–Sa', PK.tageLabel([1, 2, 3, 4, 5, 6]) === 'Montag – Samstag');
check('Fr, Sa (zwei Tage ohne Strich)', PK.tageLabel([5, 6]) === 'Freitag, Samstag', PK.tageLabel([5, 6]));
const g = PK.parseGeschlossen('24.12., 25.12., 31.12. und 1.1.');
check('Schließtage lesen', JSON.stringify(g.tage) === '["12-24","12-25","12-31","01-01"]' && !g.fehler.length, JSON.stringify(g));
check('Falsches Datum wird gemeldet', PK.parseGeschlossen('24.12., 32.1.').fehler.length === 1);
check('Schließtage schreiben', PK.formatGeschlossen(['12-24', '01-01']) === '24.12., 1.1.');
check('ID aus Name, eindeutig', PK.slug('Kiosk am Bassinplatz', []) === 'kiosk-am-bassinplatz' && PK.slug('Spätkauf 63', ['spaetkauf-63']) === 'spaetkauf-63-2');

console.log('\nSpeichern mit der echten Karte');
const orig = PD.lesen(html, 'karte-data');
const d = PK.bereinigen(orig);
const neuHtml = PD.ersetzen(html, 'karte-data', PK.serialize(d));
const zurueck = PD.lesen(neuHtml, 'karte-data');
check('Unverändert gespeichert: Daten bleiben gleich', JSON.stringify(PK.bereinigen(zurueck)) === JSON.stringify(d));
check('Unverändert gespeichert: Prüfung ohne Fehler', K.pruefen(zurueck).length === 0, K.pruefen(zurueck).join(' | '));
check('Tage-Beschriftungen unverändert', zurueck.standorte.every((s, i) => !s.zeiten || s.zeiten.every((z, k) => z.tage === orig.standorte[i].zeiten[k].tage)));
check('Rest der Datei unverändert', neuHtml.replace(/<script id="karte-data"[\s\S]*?<\/script>/, '') === html.replace(/<script id="karte-data"[\s\S]*?<\/script>/, ''));

const mit = JSON.parse(JSON.stringify(d));
const s = PK.neueStelle(52.40, 13.06, mit.standorte.map(x => x.id));
Object.assign(s, { name: 'Testkiosk', adresse: 'Teststraße 1', plz: '14467', zeiten: [{ t: [1, 2, 3, 4, 5], von: '08:00', bis: '18:00' }] });
mit.standorte.push(s);
const gespeichert = PD.lesen(PD.ersetzen(html, 'karte-data', PK.serialize(PK.bereinigen(mit))), 'karte-data');
check('Neue Stelle landet in der Datei', gespeichert.standorte.length === orig.standorte.length + 1 && gespeichert.standorte.some(x => x.name === 'Testkiosk'));
check('Neue Stelle hat Tage-Beschriftung und gültige Daten', gespeichert.standorte.find(x => x.name === 'Testkiosk').zeiten[0].tage === 'Montag – Freitag' && K.pruefen(gespeichert).length === 0);
check('Änderungsliste nennt die neue Stelle', JSON.stringify(PK.aenderungen(d, PK.bereinigen(mit))) === JSON.stringify([{ art: 'neu', name: 'Testkiosk' }]));
const weg = JSON.parse(JSON.stringify(d)); weg.standorte.pop();
check('Entfernte Stelle wird gemeldet', PK.aenderungen(d, weg)[0].art === 'entfernt');
const kaputt = JSON.parse(JSON.stringify(d)); kaputt.standorte[0].lat = 48.1;
check('Position außerhalb Potsdams wird erkannt', K.pruefen(kaputt).length === 1);

console.log('\n' + (failures ? failures + ' Prüfung(en) fehlgeschlagen' : 'Alle Prüfungen bestanden'));
process.exit(failures ? 1 : 0);

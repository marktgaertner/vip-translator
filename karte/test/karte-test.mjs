// Prüft Daten und Öffnungszeiten-Logik der Karte ohne Browser:
//   node karte/test/karte-test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const D = JSON.parse(html.match(/<script id="karte-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.match(/<script id="karte-kern">([\s\S]*?)<\/script>/)[1] + '\nthis.K = KarteKern;', ctx);
const K = ctx.K;

let failures = 0;
const check = (name, cond, detail) => { if (cond) console.log('  ok   ' + name); else { failures++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
const byId = id => D.standorte.find(s => s.id === id);
const at = (s, iso) => K.status(byId(s), new Date(iso));

console.log('Daten');
const fehler = K.pruefen(D);
check(D.standorte.length + ' Standorte ohne Datenfehler', fehler.length === 0, fehler.join(' | '));
check('2 Kundenzentren, 1 Serviceagentur, Rest Verkaufsstellen', D.standorte.filter(s => s.kategorie === 'kundenzentrum').length === 2 && D.standorte.filter(s => s.kategorie === 'serviceagentur').length === 1);
check('Keine Inhabernamen in den Anzeigenamen', D.standorte.every(s => !/Inh\.|Inhaber/.test(s.name)));
check('Ungefähre Lagen sind gekennzeichnet', D.standorte.filter(s => s.genau === false).length >= 1);

console.log('\nFeiertage Brandenburg');
const f26 = K.feiertage(2026);
check('Ostersonntag 2026 = 5.4., 2027 = 28.3.', K.ostern(2026).toISOString().startsWith('2026-04-05') && K.ostern(2027).toISOString().startsWith('2027-03-28'));
check('Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag 2026', f26['2026-04-03'] && f26['2026-04-06'] && f26['2026-05-14'] && f26['2026-05-25']);
check('Reformationstag (31.10.) ist Feiertag', f26['2026-10-31']);

console.log('\nÖffnungszeiten (Uhrzeiten Potsdam)');
let s = at('mobiagentur', '2026-11-17T09:00:00Z');   // Di 10:00 MEZ
check('Di 10:00 mobiagentur: geöffnet bis 19:00', s.code === 'open' && /bis 19:00/.test(s.text), s.text);
s = at('mobiagentur', '2026-11-17T17:45:00Z');       // Di 18:45
check('Di 18:45: schließt bald', s.code === 'soon', s.text);
s = at('mobiagentur', '2026-11-17T19:00:00Z');       // Di 20:00
check('Di 20:00: geschlossen, öffnet morgen 7:00', s.code === 'closed' && /morgen 7:00/.test(s.text), s.text);
s = at('mobiagentur', '2026-11-22T09:00:00Z');       // So 10:00
check('So 10:00 mobiagentur: geöffnet bis 15:00', s.code === 'open' && /bis 15:00/.test(s.text), s.text);
s = at('mobiagentur', '2026-10-31T15:30:00Z');       // Sa 31.10. 16:30 (Feiertag: 9-15)
check('Reformationstag 16:30: Feiertagszeiten, geschlossen', s.code === 'closed', s.text);
s = at('mobiagentur', '2026-12-24T10:00:00Z');       // Do 24.12.
check('Heiligabend geschlossen, öffnet erst So 27.12.', s.code === 'closed' && /So 9:00/.test(s.text), s.text);
s = at('platz-der-einheit', '2027-03-26T10:00:00Z'); // Karfreitag 2027
check('Karfreitag: Platz der Einheit geschlossen, öffnet Di', s.code === 'closed' && /Di 9:00/.test(s.text), s.text);
s = at('platz-der-einheit', '2026-11-21T10:00:00Z'); // Samstag
check('Samstag: Platz der Einheit geschlossen, öffnet Mo', s.code === 'closed' && /Mo 9:00/.test(s.text), s.text);
s = at('clavis-babelsberg', '2026-07-14T08:00:00Z');  // Di 10:00 MESZ
check('Sommerzeit: Di 10:00 MESZ Clavis geöffnet', s.code === 'open', s.text);
s = at('clavis-babelsberg', '2026-11-21T11:30:00Z');  // Sa 12:30
check('Sa 12:30 Clavis: schließt bald (13:00)', s.code === 'soon', s.text);
s = at('cigo-marktcenter', '2026-11-17T09:00:00Z');
check('Verkaufsstelle ohne Zeiten: Öffnungszeiten des Geschäfts', s.code === 'unknown');

console.log('\nEntfernung');
const km = K.km(byId('mobiagentur'), byId('platz-der-einheit'));
check('Hauptbahnhof – Platz der Einheit etwa 1 km', km > 0.7 && km < 1.4, km.toFixed(2));

console.log('\n' + (failures ? failures + ' Prüfung(en) fehlgeschlagen' : 'Alle Prüfungen bestanden'));
process.exit(failures ? 1 : 0);

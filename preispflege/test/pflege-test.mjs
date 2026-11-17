// Prüft den Kern der Preispflege mit den echten Dateien beider Tools:
//   node preispflege/test/pflege-test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(join(root, 'preispflege', 'pflege-kern.js'), 'utf8') + '\nthis.P = PreisPflege;', ctx);
const { einbauen } = await import('../einbauen.mjs');
const P = ctx.P;

let failures = 0;
const check = (name, cond, detail) => { if (cond) console.log('  ok   ' + name); else { failures++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const [ordner, tool, feld] of [['tarifberater', 'tarif', ['potsdam', 'ab', 'regel']], ['jobticket', 'job', ['dticket']]]) {
  console.log('\n' + ordner);
  const html = readFileSync(join(root, ordner, 'index.html'), 'utf8');
  const f = P.findData(html);
  check('Preispflege ist eingebaut und aktuell (sonst: node preispflege/einbauen.mjs)', html.includes('<script id="pflege-quelle">') && html.includes('<!-- PFLEGE:START') && einbauen(html, ordner + '/index.html') === html);
  check('Fußzeile verlinkt die Preispflege', html.includes('href="?pflege"'));
  check('Tool erkannt', f && f.tool === tool, f && f.tool);

  const rund = P.replaceData(html, tool, f.data);
  check('Unverändert gespeichert: Daten identisch', same(P.findData(rund).data, f.data));
  check('Unverändert gespeichert: Rest der Datei identisch', rund.replace(/<script id="(tarif|jobticket)-data"[\s\S]*?<\/script>/, '') === html.replace(/<script id="(tarif|jobticket)-data"[\s\S]*?<\/script>/, ''));
  check('Preise stehen mit zwei Nachkommastellen in der Datei', /\[\d+\.\d\d, \d+\.\d\d\]/.test(rund));

  const ok = P.checkAll(html, tool, f.data);
  check('Aktuelle Daten bestehen die Prüfung (' + ok.combos + ' Kombinationen)', ok.errors.length === 0, ok.errors.join(' | '));
  check('Stichprobe vorhanden', ok.samples.length > 0);

  const d = JSON.parse(JSON.stringify(f.data));
  const alt = P.getPath(d, feld);
  P.setPath(d, feld, [alt[0], P.r2(alt[1] + 0.10)]);
  const neu = P.replaceData(html, tool, d);
  check('Geänderter Preis landet in der Datei', same(P.getPath(P.findData(neu).data, feld), [alt[0], P.r2(alt[1] + 0.10)]));
  const ch = P.changes(f.data, d);
  check('Änderungsliste nennt genau den einen Wert', ch.length === 1 && ch[0].label.length > 3, JSON.stringify(ch));

  const kaputt = JSON.parse(JSON.stringify(f.data));
  P.setPath(kaputt, feld, [-1, alt[1]]);
  check('Negativer Preis wird als Fehler erkannt', P.checkAll(html, tool, kaputt).errors.length > 0);
  const leer = JSON.parse(JSON.stringify(f.data));
  P.setPath(leer, feld, [NaN, alt[1]]);
  check('Leeres Feld wird als Fehler erkannt', P.checkAll(html, tool, leer).errors.length > 0);

  const roll = P.yearRollover(f.data, '2027-01-02');
  check('Jahreswechsel: ' + f.data.jahre[1].key + ' wird laufendes Jahr', roll.jahre[0].key === f.data.jahre[1].key && Number(roll.jahre[1].key) === Number(f.data.jahre[1].key) + 1);
  check('Jahreswechsel: Folgepreise übernommen', same(P.getPath(roll, feld), [alt[1], alt[1]]));
  check('Jahreswechsel: Datenstand gesetzt', roll.stand === '2027-01-02');
  check('Jahreswechsel: Ergebnis besteht die Prüfung', P.checkAll(html, tool, roll).errors.length === 0, P.checkAll(html, tool, roll).errors.join(' | '));

  const unbenannt = P.flatten(f.data).filter(x => P.labelFor(x.path) === x.path.join('.'));
  check('Jeder Wert hat eine verständliche Beschriftung', unbenannt.length === 0, unbenannt.map(x => x.path.join('.')).join(', '));
}

console.log('\nAbgeleitete Preise');
const tarif = P.findData(readFileSync(join(root, 'tarifberater', 'index.html'), 'utf8')).data;
check('Deutschlandticket Job = 70 % (44,10 / 46,76)', same(P.derive(tarif, ['zeit', 'dticketJob']), [44.1, 46.76]));
check('Zuschuss Ausbildung = 60 % (37,80 / 40,08)', same(P.derive(tarif, ['zeit', 'dticketAzubi']), [37.8, 40.08]));

console.log('\n' + (failures ? failures + ' Prüfung(en) fehlgeschlagen' : 'Alle Prüfungen bestanden'));
process.exit(failures ? 1 : 0);

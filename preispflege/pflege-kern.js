var PreisPflege = (function () {
  'use strict';

  var TOOLS = {
    tarif: { dataId: 'tarif-data', name: 'Tarifberater' },
    job: { dataId: 'jobticket-data', name: 'Jobticket-Rechner' }
  };

  function dataRegex(id) { return new RegExp('(<script id="' + id + '" type="application/json">)([\\s\\S]*?)(<\/script>)'); }

  // Erkennt das Tool und liest den Datenblock.
  function findData(html) {
    for (var k in TOOLS) {
      var m = html.match(dataRegex(TOOLS[k].dataId));
      if (m) return { tool: k, name: TOOLS[k].name, data: JSON.parse(m[2]) };
    }
    return null;
  }

  function isPair(v) { return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number'; }
  function r2(x) { return Math.round(x * 100) / 100; }

  // JSON im selben gut lesbaren Format wie von Hand gepflegt: Preispaare und
  // kurze Objekte in einer Zeile, Preise immer mit zwei Nachkommastellen.
  function serialize(v, ind) {
    ind = ind || '';
    var nx = ind + '  ';
    if (isPair(v)) return '[' + v[0].toFixed(2) + ', ' + v[1].toFixed(2) + ']';
    if (Array.isArray(v)) {
      if (v.every(function (x) { return x === null || typeof x !== 'object'; })) return JSON.stringify(v).replace(/,/g, ', ');
      return '[\n' + v.map(function (x) { return nx + inline(x); }).join(',\n') + '\n' + ind + ']';
    }
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      var one = inline(v);
      if (one.length + ind.length <= 110 && keys.every(function (k) { var x = v[k]; return !x || typeof x !== 'object' || isPair(x); })) return one;
      return '{\n' + keys.map(function (k) { return nx + JSON.stringify(k) + ': ' + serialize(v[k], nx); }).join(',\n') + '\n' + ind + '}';
    }
    return JSON.stringify(v);
  }
  function inline(v) {
    if (isPair(v)) return serialize(v);
    if (Array.isArray(v)) return '[' + v.map(inline).join(', ') + ']';
    if (v && typeof v === 'object') return '{ ' + Object.keys(v).map(function (k) { return JSON.stringify(k) + ': ' + inline(v[k]); }).join(', ') + ' }';
    return JSON.stringify(v);
  }

  function replaceData(html, tool, data) {
    var re = dataRegex(TOOLS[tool].dataId);
    if (!re.test(html)) throw new Error('Datenblock nicht gefunden');
    var json = '\n' + serialize(data) + '\n';
    return html.replace(re, function (m, a, b, c) { return a + json + c; });
  }

  // Alle Preispaare und Einzelwerte mit Pfad, in Dateireihenfolge.
  var SKIP = { stand: 1, jahre: 1, abgeleitet: 1 };
  function flatten(data) {
    var out = [];
    (function walk(o, path) {
      Object.keys(o).forEach(function (k) {
        if (!path.length && SKIP[k]) return;
        var v = o[k], p = path.concat(k);
        if (isPair(v)) out.push({ path: p, kind: 'pair', value: v });
        else if (typeof v === 'number') out.push({ path: p, kind: 'number', value: v });
        else if (typeof v === 'string') out.push({ path: p, kind: 'text', value: v });
        else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p);
      });
    })(data, []);
    return out;
  }
  function getPath(o, p) { return p.reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var last = p[p.length - 1]; getPath(o, p.slice(0, -1))[last] = v; }

  // Jahreswechsel: Folgejahr wird laufendes Jahr, neues Folgejahr = Vorjahr + 1.
  function yearRollover(data, heute) {
    var d = JSON.parse(JSON.stringify(data));
    var next = d.jahre[1];
    var neu = String(Number(next.key) + 1);
    d.jahre = [{ key: next.key, ab: next.ab, hinweis: '' }, { key: neu, ab: neu + '-01-01', hinweis: 'Preise noch nicht veröffentlicht' }];
    flatten(d).forEach(function (f) { if (f.kind === 'pair') setPath(d, f.path, [f.value[1], f.value[1]]); });
    if (heute) d.stand = heute;
    return d;
  }

  // Beschriftung für Menschen. Unbekannte Felder zeigen ihren Pfad.
  var NAMES = {
    'fahrtenProMonat.einmal': 'Fahrten pro Monat bei „eine einzelne Fahrt“', 'fahrtenProMonat.tag': 'Fahrten bei „mehrere Fahrten an einem Tag“',
    'fahrtenProMonat.gelegentlich': 'Fahrten pro Monat bei „ein paar Mal im Monat“', 'fahrtenProMonat.wenig': 'Fahrten pro Monat bei „1 bis 2 Tage pro Woche“',
    'fahrtenProMonat.oft': 'Fahrten pro Monat bei „fast täglich“',
    'potsdam.kurz': 'Kurzstrecke Potsdam', 'potsdam.ab': 'Einzelfahrausweis Potsdam AB', 'potsdam.ab4': '4-Fahrten-Karte Potsdam AB',
    'potsdam.abc': 'Einzelfahrausweis Potsdam ABC', 'potsdam.abc4': '4-Fahrten-Karte Potsdam ABC',
    'potsdam.anschlussC': 'Anschlussfahrausweis Bereich C', 'potsdam.anschlussBerlinAB': 'Anschlussfahrausweis Potsdam → Berlin AB',
    'potsdam.tagAB': '24-Stunden-Karte Potsdam AB', 'potsdam.tagABC': '24-Stunden-Karte Potsdam ABC',
    'berlin.ab': 'Einzelfahrausweis Berlin AB', 'berlin.abc': 'Einzelfahrausweis Berlin ABC', 'berlin.abc4': '4-Fahrten-Karte Berlin ABC',
    'berlin.tagABC': '24-Stunden-Karte Berlin ABC', 'gesamtnetzTag': 'Tageskarte VBB-Gesamtnetz',
    'zeit.umweltAB': 'VBB-Umweltkarte Potsdam AB', 'zeit.umweltABC': 'VBB-Umweltkarte Potsdam ABC', 'zeit.umweltBerlinABC': 'VBB-Umweltkarte Berlin ABC',
    'zeit.gesamtnetz': 'VBB-Umweltkarte Gesamtnetz', 'zeit.azubiAB': 'Schüler/Azubi Potsdam AB', 'zeit.azubiABC': 'Schüler/Azubi Potsdam ABC',
    'zeit.schuelerticketPotsdam': 'Schülerticket Potsdam', 'zeit.freizeitTicket': 'Freizeitticket', 'zeit.mobilAB': 'Mobilitätsticket Brandenburg Potsdam AB',
    'zeit.mobilABC': 'Mobilitätsticket Brandenburg Potsdam ABC', 'zeit.dticket': 'Deutschlandticket', 'zeit.dticketJob': 'Deutschlandticket Job (Eigenanteil)',
    'zeit.dticketAzubi': 'Deutschlandticket Zuschuss Ausbildung', 'zeit.dsemester': 'Deutschlandsemesterticket',
    'fahrrad.potsdam': 'Fahrrad Potsdam', 'fahrrad.berlin': 'Fahrrad Berlin', 'fahrrad.gesamtnetz': 'Fahrrad VBB-Gesamtnetz',
    'dticket': 'Deutschlandticket', 'rabattProzent': 'Jobticket-Rabatt in %', 'mindestzuschussProzent': 'Mindestzuschuss Arbeitgeber in % des Ticketpreises',
    'pauschalsteuerProzent': 'Pauschalsteuer in %', 'soliProzent': 'Solidaritätszuschlag in % der Pauschalsteuer',
    'faustwert.abzuegeBeschaeftigteProzent': 'Faustwert: Abzüge Beschäftigte in %', 'faustwert.svArbeitgeberProzent': 'Faustwert: Sozialabgaben Arbeitgeber in %',
    'email': 'E-Mail-Adresse für Anfragen'
  };
  var PARTS = { regel: 'Normaltarif', erm: 'ermäßigt', gruppe: 'Kleingruppe bis 5 Personen', monat: 'Monatskarte', abo: 'im Abo, je Monat',
    eigenanteil: 'Eigenanteil', gesamt: 'voller Preis', einzel: 'Einzelfahrt', einzelABC: 'Einzelfahrt ABC', tag: '24 Stunden', tagABC: '24 Stunden ABC',
    monatAB: 'Monatskarte AB', monatABC: 'Monatskarte ABC', einmal: 'eine Fahrt', gelegentlich: 'ein paar Mal', wenig: '1–2 Tage pro Woche', oft: 'fast täglich' };
  function labelFor(path) {
    var full = path.join('.');
    if (NAMES[full]) return NAMES[full];
    for (var n = path.length - 1; n > 0; n--) {
      var base = NAMES[path.slice(0, n).join('.')];
      if (base) return base + ' – ' + path.slice(n).map(function (p) { return PARTS[p] || p; }).join(' – ');
    }
    return full;
  }
  var SECTIONS = { potsdam: 'Potsdam: Einzel-, 4-Fahrten- und Tageskarten', berlin: 'Berlin', gesamtnetzTag: 'VBB-Gesamtnetz', zeit: 'Zeitkarten und Abos',
    fahrrad: 'Fahrrad', fahrtenProMonat: 'Annahmen für die Empfehlung', dticket: 'Deutschlandticket', faustwert: 'Faustwerte' };
  function sectionFor(path) { return SECTIONS[path[0]] || (typeof path[0] === 'string' && /Prozent$|email/.test(path[0]) ? 'Regeln und Kontakt' : 'Weitere Werte'); }

  // Abgeleitete Preise: auf Knopfdruck aus dem Deutschlandticket berechnen.
  var DERIVED = {
    'zeit.dticketJob': { faktor: 0.70, text: '70 % des Deutschlandtickets (25 % Arbeitgeber + 5 % Rabatt)' },
    'zeit.dticketAzubi': { faktor: 0.60, text: '60 % des Deutschlandtickets' },
    'zeit.dsemester': { faktor: 0.60, text: '60 % des Deutschlandtickets' }
  };
  function derive(data, path) {
    var d = DERIVED[path.join('.')]; if (!d) return null;
    var base = getPath(data, ['zeit', 'dticket']);
    return [r2(base[0] * d.faktor), r2(base[1] * d.faktor)];
  }

  // Prüfregeln je Wert: Fehler blockieren den Download, Hinweise nicht.
  function checkValue(f) {
    var v = f.value;
    if (f.kind === 'pair') {
      if (!isFinite(v[0]) || !isFinite(v[1]) || v[0] <= 0 || v[1] <= 0) return { level: 'bad', text: 'Bitte zwei Beträge größer als 0 eintragen.' };
      if (v[1] < v[0]) return { level: 'warn', text: 'Folgejahr günstiger als laufendes Jahr – richtig?' };
      if (v[1] > v[0] * 1.10 + 0.005) return { level: 'warn', text: 'Mehr als 10 % teurer im Folgejahr – bitte prüfen.' };
      return null;
    }
    if (f.kind === 'number') {
      if (!isFinite(v) || v < 0) return { level: 'bad', text: 'Bitte eine Zahl ab 0 eintragen.' };
      if (/Prozent$/.test(f.path[f.path.length - 1]) && v > 100) return { level: 'bad', text: 'Prozentwert über 100.' };
      return null;
    }
    if (f.kind === 'text' && f.path[f.path.length - 1] === 'email' && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return { level: 'bad', text: 'Keine gültige E-Mail-Adresse.' };
    return null;
  }

  function changes(orig, data) {
    var a = {}; flatten(orig).forEach(function (f) { a[f.path.join('.')] = f.value; });
    var out = [];
    flatten(data).forEach(function (f) {
      var k = f.path.join('.'), o = a[k];
      if (JSON.stringify(o) !== JSON.stringify(f.value)) out.push({ path: f.path, label: labelFor(f.path), vorher: o, nachher: f.value });
    });
    ['stand'].forEach(function (k) { if (orig[k] !== data[k]) out.push({ path: [k], label: 'Datenstand', vorher: orig[k], nachher: data[k] }); });
    if (JSON.stringify(orig.jahre) !== JSON.stringify(data.jahre)) out.push({ path: ['jahre'], label: 'Jahre', vorher: orig.jahre.map(function (j) { return j.key; }).join(' / '), nachher: data.jahre.map(function (j) { return j.key + (j.hinweis ? ' (' + j.hinweis + ')' : ''); }).join(' / ') });
    return out;
  }

  // Lädt die Rechenlogik aus der geladenen Datei selbst - so prüft der
  // Editor genau den Code, der später auf der Webseite läuft.
  function scriptText(html, id) { var m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\/script>')); return m ? m[1] : null; }
  function loadEngine(html, tool) {
    if (tool === 'tarif') {
      var i18n = scriptText(html, 'tarif-i18n'), eng = scriptText(html, 'tarif-engine');
      if (!i18n || !eng) return null;
      return new Function(i18n + '\n' + eng + '\nreturn TarifEngine;')();
    }
    var j = scriptText(html, 'jobticket-engine');
    return j ? new Function(j + '\nreturn JobticketRechner;')() : null;
  }

  var WER = ['erwachsen', 'kind', 'u6', 'schueler', 'azubi', 'student', 'leistung', 'sb', 'senior'];
  var WIE = ['einmal', 'tag', 'gelegentlich', 'wenig', 'oft'];
  var WOHIN = ['ab', 'abc', 'berlin', 'weit'];
  var EXTRAS = [[], ['kinder'], ['gruppe'], ['fahrrad'], ['hund'], ['kinder', 'gruppe', 'fahrrad', 'hund']];

  // Komplettprüfung: alle Werte plus alle Antwortkombinationen durchrechnen.
  function checkAll(html, tool, data) {
    var errors = [], warnings = [];
    flatten(data).forEach(function (f) {
      var c = checkValue(f); if (!c) return;
      (c.level === 'bad' ? errors : warnings).push(labelFor(f.path) + ': ' + c.text);
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.stand || '')) errors.push('Datenstand fehlt oder ist kein Datum.');
    if (!data.jahre || data.jahre.length !== 2 || Number(data.jahre[1].key) !== Number(data.jahre[0].key) + 1) errors.push('Es müssen genau zwei aufeinanderfolgende Jahre angegeben sein.');
    var engine, combos = 0, samples = [];
    try { engine = loadEngine(html, tool); } catch (e) { errors.push('Rechenlogik der Datei lässt sich nicht laden: ' + e.message); }
    if (engine && !errors.length) {
      if (tool === 'tarif') {
        var bad = 0;
        WER.forEach(function (w) { WIE.forEach(function (h) { WOHIN.forEach(function (z) { EXTRAS.forEach(function (x) { [0, 1].forEach(function (j) {
          combos++;
          try {
            var r = engine.empfehlen({ wer: w, wie: h, wohin: z, extras: x, jahrIndex: j }, data);
            var ok = r.sofort || (r.empfehlungen.length && r.empfehlungen.every(function (e) { return e.name && (e.preis === null || (isFinite(e.preis) && e.preis >= 0)); }));
            if (ok && JSON.stringify(r).indexOf('NaN') >= 0) ok = false;
            if (!ok) bad++;
          } catch (e) { bad++; }
        }); }); }); }); });
        if (bad) errors.push(bad + ' von ' + combos + ' Antwortkombinationen liefern kein sauberes Ergebnis.');
        [['erwachsen', 'einmal', 'ab'], ['erwachsen', 'tag', 'ab'], ['erwachsen', 'gelegentlich', 'abc'], ['erwachsen', 'oft', 'abc'], ['erwachsen', 'oft', 'berlin'], ['schueler', 'oft', 'ab'], ['azubi', 'oft', 'weit']].forEach(function (c) {
          var r = engine.empfehlen({ wer: c[0], wie: c[1], wohin: c[2], extras: [], jahrIndex: 0 }, data);
          var e = r.empfehlungen[0];
          samples.push({ frage: c.join(' · '), name: e.name, jetzt: e.preis, next: e.preisNext, einheit: e.einheit });
        });
      } else {
        [0, 1].forEach(function (j) {
          var r = engine.rechnen({ jahrIndex: j, anzahl: 1, zuschuss: 'min' }, data);
          combos++;
          if (Math.abs(r.rabatt + r.zuschuss + r.beschaeftigte - r.preis) > 0.011 || r.beschaeftigte < 0) errors.push('Rechnung ' + data.jahre[j].key + ' geht nicht auf.');
          samples.push({ frage: data.jahre[j].key + ' · Mindestzuschuss', name: 'Eigenanteil Beschäftigte', jetzt: r.beschaeftigte, next: null, einheit: 'Zuschuss ' + r.zuschuss.toFixed(2).replace('.', ',') + ' € · Rabatt ' + r.rabatt.toFixed(2).replace('.', ',') + ' €' });
        });
      }
    }
    return { errors: errors, warnings: warnings, combos: combos, samples: samples };
  }

  return { TOOLS: TOOLS, findData: findData, serialize: serialize, replaceData: replaceData, flatten: flatten, getPath: getPath, setPath: setPath,
    yearRollover: yearRollover, labelFor: labelFor, sectionFor: sectionFor, derive: derive, DERIVED: DERIVED, checkValue: checkValue,
    changes: changes, checkAll: checkAll, isPair: isPair, r2: r2 };
})();

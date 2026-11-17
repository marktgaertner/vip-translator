/* Standortpflege für die Karte (?pflege): Stellen hinzufügen, ändern,
   entfernen; Position per Klick in die Karte; speichern wie die Preispflege. */

// ---------- Kern ohne DOM (getestet in preispflege/test/karte-pflege-test.mjs) ----------
var KartePflegeKern = (function () {
  'use strict';
  var NAMEN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var REIHE = [1, 2, 3, 4, 5, 6, 0];

  // [1,2,3,4,5] -> "Montag – Freitag", [0,"F"] -> "Sonntag und Feiertage"
  function tageLabel(t) {
    var tage = REIHE.filter(function (d) { return t.indexOf(d) >= 0; }), teile = [], i = 0;
    while (i < tage.length) {
      var j = i;
      while (j + 1 < tage.length && REIHE.indexOf(tage[j + 1]) === REIHE.indexOf(tage[j]) + 1) j++;
      if (j - i >= 2) teile.push(NAMEN[tage[i]] + ' – ' + NAMEN[tage[j]]);
      else for (var k = i; k <= j; k++) teile.push(NAMEN[tage[k]]);
      i = j + 1;
    }
    var s = teile.join(', ');
    if (t.indexOf('F') >= 0) s = s ? s + ' und Feiertage' : 'Feiertage';
    return s;
  }

  // "24.12., 25.12. und 1.1." -> ["12-24", "12-25", "01-01"]
  function parseGeschlossen(text) {
    var out = [], fehler = [];
    String(text || '').split(/[,;]|\bund\b/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (x) {
      var m = x.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
      if (!m || +m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12) { fehler.push(x); return; }
      out.push((m[2].length < 2 ? '0' : '') + m[2] + '-' + (m[1].length < 2 ? '0' : '') + m[1]);
    });
    return { tage: out, fehler: fehler };
  }
  function formatGeschlossen(list) {
    return (list || []).map(function (md) { var p = md.split('-'); return +p[1] + '.' + +p[0] + '.'; }).join(', ');
  }

  function slug(name, vorhanden) {
    var s = String(name || 'stelle').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'stelle';
    var id = s, n = 2;
    while (vorhanden.indexOf(id) >= 0) id = s + '-' + n++;
    return id;
  }

  function neueStelle(lat, lon, vorhanden) {
    return { id: slug('neue-stelle', vorhanden), name: 'Neue Verkaufsstelle', kategorie: 'verkaufsstelle', adresse: '', plz: '', ort: 'Potsdam',
      stadtteil: '', lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, genau: true, angebot: ['Fahrscheine des VBB'] };
  }

  // Lesbares JSON: Objekte untereinander, kurze Listen und Zeit-Regeln in einer Zeile.
  function serialize(v, ind) {
    ind = ind || '';
    var nx = ind + '  ';
    var flach = function (x) { return x === null || typeof x !== 'object'; };
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      if (v.every(flach)) { var one = '[' + v.map(function (x) { return JSON.stringify(x); }).join(', ') + ']'; if (one.length + ind.length < 100) return one; }
      if (v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(function (k) { return flach(x[k]) || (Array.isArray(x[k]) && x[k].every(flach)); }); })) {
        var zeilen = v.map(function (x) { return '{ ' + Object.keys(x).map(function (k) { return JSON.stringify(k) + ': ' + serialize(x[k], nx); }).join(', ') + ' }'; });
        if (zeilen.every(function (z) { return z.length + nx.length < 120; })) return '[\n' + zeilen.map(function (z) { return nx + z; }).join(',\n') + '\n' + ind + ']';
      }
      return '[\n' + v.map(function (x) { return nx + serialize(x, nx); }).join(',\n') + '\n' + ind + ']';
    }
    if (v && typeof v === 'object') return '{\n' + Object.keys(v).map(function (k) { return nx + JSON.stringify(k) + ': ' + serialize(v[k], nx); }).join(',\n') + '\n' + ind + '}';
    return JSON.stringify(v);
  }

  // Aufräumen vor dem Speichern: leere Felder weg, Tage-Beschriftung neu.
  function bereinigen(D) {
    var d = JSON.parse(JSON.stringify(D));
    d.standorte.forEach(function (s) {
      ['stadtteil', 'lage', 'telefon', 'email', 'hinweis', 'geschlossenText'].forEach(function (k) { if (s[k] != null && !String(s[k]).trim()) delete s[k]; });
      if (s.geschlossen && !s.geschlossen.length) delete s.geschlossen;
      if (s.angebot) { s.angebot = s.angebot.map(function (a) { return a.trim(); }).filter(Boolean); if (!s.angebot.length) delete s.angebot; }
      if (s.zeiten) s.zeiten.forEach(function (z) { z.tage = tageLabel(z.t); });
      if (s.genau !== false) delete s.genau;
    });
    return d;
  }

  function aenderungen(orig, neu) {
    var a = {}, b = {}, out = [];
    orig.standorte.forEach(function (s) { a[s.id] = s; });
    neu.standorte.forEach(function (s) { b[s.id] = s; });
    neu.standorte.forEach(function (s) {
      if (!a[s.id]) out.push({ art: 'neu', name: s.name });
      else if (JSON.stringify(a[s.id]) !== JSON.stringify(s)) out.push({ art: 'geändert', name: s.name });
    });
    orig.standorte.forEach(function (s) { if (!b[s.id]) out.push({ art: 'entfernt', name: s.name }); });
    if (orig.stand !== neu.stand) out.push({ art: 'Datenstand', name: neu.stand });
    return out;
  }

  return { tageLabel: tageLabel, parseGeschlossen: parseGeschlossen, formatGeschlossen: formatGeschlossen, slug: slug,
    neueStelle: neueStelle, serialize: serialize, bereinigen: bereinigen, aenderungen: aenderungen };
})();

// ---------- Oberfläche ----------
(function () {
  'use strict';
  if (!/[?&]pflege(=|&|$)/.test(location.search)) return;
  var PK = KartePflegeKern;
  var KAT = { kundenzentrum: 'Kundenzentrum', serviceagentur: 'Serviceagentur', verkaufsstelle: 'Verkaufsstelle (nur Tickets)' };
  var KURZ = [['Mo', 1], ['Di', 2], ['Mi', 3], ['Do', 4], ['Fr', 5], ['Sa', 6], ['So', 0], ['Feiertag', 'F']];
  var st = null, root = null, karte = null, punkte = {}, $ = function (id) { return document.getElementById(id); };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stelle(id) { return st.data.standorte.filter(function (s) { return s.id === id; })[0]; }

  document.addEventListener('DOMContentLoaded', function () {
    root = document.createElement('div');
    root.id = 'pf';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Standortpflege');
    root.innerHTML = '<div class="pf-top"><div class="pf-top-in"><b>Standortpflege</b><span id="pf-was">wird geladen …</span><a href="' + esc(location.pathname) + '">Fertig – zur Karte</a></div></div><div class="pf-main" id="pf-main"></div>';
    document.body.appendChild(root);
    document.documentElement.style.overflow = 'hidden';
    PflegeDatei.quelle(function (t) { return !!PflegeDatei.lesen(t, 'karte-data'); }).then(function (html) {
      var d = html && PflegeDatei.lesen(html, 'karte-data');
      if (!d) { $('pf-main').innerHTML = '<div class="pf-note bad">Die Standortdaten dieser Seite ließen sich nicht lesen.</div>'; return; }
      st = { html: html, orig: PK.bereinigen(d), data: PK.bereinigen(d), sel: null };
      aufbauen();
    });
  });

  function aufbauen() {
    $('pf-main').innerHTML =
      '<ol class="pf-steps">' +
        '<li><b>Stelle wählen oder neu anlegen</b><br>Position per Klick in die Karte</li>' +
        '<li><b>Angaben ändern</b><br>Öffnungszeiten, Angebot, Kontakt</li>' +
        '<li><b>Speichern</b><br>' + (PflegeDatei.kannDirekt ? 'direkt über die <code>index.html</code> im Webspace-Ordner' : 'neue <code>index.html</code> auf dem Webspace ersetzen') + '</li>' +
      '</ol>' +
      '<div class="pf-split">' +
        '<section class="pf-card pf-listcard"><div class="pf-listhead"><h2>Stellen</h2><button class="pf-btn" type="button" id="pf-neu">+ Neue Stelle</button></div>' +
          '<div class="pf-meta" style="margin:0 0 8px"><div><label for="pf-stand">Datenstand</label><input type="date" id="pf-stand"></div></div><div id="pf-liste"></div></section>' +
        '<section class="pf-card"><h2>Position</h2>' +
          '<div class="pf-poszeile"><p class="pf-muted" id="pf-poshint">Stelle wählen, dann in die Karte klicken oder den Punkt ziehen.</p>' +
          '<button class="pf-btn pf-sec pf-small" type="button" id="pf-suche">Position aus Adresse suchen</button></div><div id="pf-map"></div>' +
          '<div id="pf-form" style="margin-top:16px"><p class="pf-muted">Links eine Stelle auswählen oder „Neue Stelle“ anlegen.</p></div></section>' +
      '</div>' +
      '<section class="pf-card"><h2>Prüfung und Änderungen</h2><div id="pf-check"></div><div id="pf-changes"></div></section>' +
      '<div class="pf-bar"><div class="pf-bar-in"><span class="pf-status" id="pf-status"></span>' +
        '<button class="pf-btn pf-sec" type="button" id="pf-preview">Vorschau</button><button class="pf-btn" type="button" id="pf-save">Speichern</button></div></div>';
    $('pf-stand').value = st.data.stand;
    $('pf-stand').addEventListener('input', function (e) { st.data.stand = e.target.value; pruefen(); });
    $('pf-neu').addEventListener('click', neu);
    $('pf-suche').addEventListener('click', adresseSuchen);
    $('pf-preview').addEventListener('click', function () { PflegeDatei.vorschau(html()); });
    $('pf-save').addEventListener('click', speichern);
    $('pf-liste').addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) waehlen(b.dataset.id); });
    karteAufbauen();
    liste(); pruefen();
  }

  function liste() {
    var gruppen = ['kundenzentrum', 'serviceagentur', 'verkaufsstelle'];
    $('pf-liste').innerHTML = gruppen.map(function (k) {
      var ss = st.data.standorte.filter(function (s) { return s.kategorie === k; });
      if (!ss.length) return '';
      return '<div class="pf-gruppe">' + esc(KAT[k]) + ' (' + ss.length + ')</div>' + ss.map(function (s) {
        return '<button type="button" class="pf-item' + (s.id === st.sel ? ' sel' : '') + '" data-id="' + esc(s.id) + '"><b>' + esc(s.name || '(ohne Namen)') + '</b><span>' + esc(s.adresse || 'Adresse fehlt') + '</span></button>';
      }).join('');
    }).join('');
    $('pf-was').textContent = st.data.standorte.length + ' Stellen';
  }

  // ---------- Formular ----------
  function feld(k, label, wert, opts) {
    opts = opts || {};
    var id = 'pf-f-' + k;
    if (opts.area) return '<div class="pf-f' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" data-k="' + k + '" rows="' + (opts.rows || 3) + '">' + esc(wert) + '</textarea>' + (opts.hilfe ? '<small>' + esc(opts.hilfe) + '</small>' : '') + '</div>';
    return '<div class="pf-f' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" data-k="' + k + '" value="' + esc(wert) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' + (opts.hilfe ? '<small>' + esc(opts.hilfe) + '</small>' : '') + '</div>';
  }

  function waehlen(id) {
    st.sel = id;
    var s = stelle(id); if (!s) return;
    $('pf-form').innerHTML =
      '<div class="pf-formhead"><h2>' + esc(s.name) + '</h2><button class="pf-btn pf-sec pf-small" type="button" id="pf-del">Stelle entfernen</button></div>' +
      '<div class="pf-grid">' +
        feld('name', 'Name', s.name, { wide: true }) +
        '<div class="pf-f"><label for="pf-f-kategorie">Art</label><select id="pf-f-kategorie" data-k="kategorie">' + Object.keys(KAT).map(function (k) { return '<option value="' + k + '"' + (k === s.kategorie ? ' selected' : '') + '>' + esc(KAT[k]) + '</option>'; }).join('') + '</select></div>' +
        feld('stadtteil', 'Stadtteil', s.stadtteil || '', { ph: 'z. B. Babelsberg' }) +
        feld('adresse', 'Straße und Hausnummer', s.adresse, { ph: 'z. B. Friedrich-Ebert-Straße 107' }) +
        feld('plz', 'PLZ', s.plz) +
        feld('ort', 'Ort', s.ort) +
        feld('lage', 'Lagebeschreibung (optional)', s.lage || '', { ph: 'z. B. Am Ausgang des S-Bahnhofs' }) +
        feld('telefon', 'Telefon (optional)', s.telefon || '') +
        feld('email', 'E-Mail (optional)', s.email || '') +
        feld('angebot', 'Angebot – ein Punkt pro Zeile', (s.angebot || []).join('\n'), { area: true, wide: true, rows: 4 }) +
        feld('hinweis', 'Hinweis (optional)', s.hinweis || '', { area: true, wide: true, rows: 2 }) +
      '</div>' +
      '<h2 style="margin-top:14px">Öffnungszeiten</h2>' +
      '<label class="pf-check"><input type="checkbox" id="pf-fest"' + (s.zeiten ? ' checked' : '') + '> Feste Öffnungszeiten angeben (sonst: „Öffnungszeiten des Geschäfts“)</label>' +
      '<div id="pf-zeiten"></div>';
    $('pf-form').querySelectorAll('[data-k]').forEach(function (el) { el.addEventListener('input', aendern); });
    $('pf-del').addEventListener('click', function () {
      if (!confirm('„' + s.name + '“ von der Karte entfernen?')) return;
      st.data.standorte = st.data.standorte.filter(function (x) { return x.id !== id; });
      st.sel = null; $('pf-form').innerHTML = '<p class="pf-muted">Entfernt. Links eine andere Stelle auswählen.</p>';
      punkteNeu(); liste(); pruefen();
    });
    $('pf-fest').addEventListener('change', function (e) {
      if (e.target.checked) { s.zeiten = [{ t: [1, 2, 3, 4, 5], von: '09:00', bis: '18:00' }]; }
      else { delete s.zeiten; delete s.geschlossen; delete s.geschlossenText; }
      zeiten(s); pruefen();
    });
    zeiten(s);
    liste(); punkteNeu(); pruefen();
    if (karte) karte.setView([s.lat, s.lon], Math.max(karte.getZoom(), 15));
  }

  function aendern(e) {
    var s = stelle(st.sel), k = e.target.dataset.k, v = e.target.value;
    if (k === 'angebot') s.angebot = v.split('\n');
    else s[k] = v;
    if (k === 'name') $('pf-form').querySelector('.pf-formhead h2').textContent = v;
    liste(); punkteNeu(); pruefen();
  }

  function zeiten(s) {
    var box = $('pf-zeiten');
    if (!s.zeiten) { box.innerHTML = ''; return; }
    box.innerHTML = s.zeiten.map(function (z, i) {
      return '<div class="pf-regel" data-i="' + i + '"><div class="pf-tage">' + KURZ.map(function (d) {
        return '<label><input type="checkbox" data-tag="' + d[1] + '"' + (z.t.indexOf(d[1]) >= 0 ? ' checked' : '') + '>' + d[0] + '</label>';
      }).join('') + '</div><div class="pf-zeit"><input type="time" data-z="von" value="' + esc(z.von) + '" aria-label="von"> bis <input type="time" data-z="bis" value="' + esc(z.bis) + '" aria-label="bis"> Uhr ' +
        '<button class="pf-btn pf-sec pf-small" type="button" data-weg="' + i + '">entfernen</button></div><div class="pf-muted pf-label">' + esc(PK.tageLabel(z.t) || 'keine Tage gewählt') + '</div></div>';
    }).join('') +
      '<div class="pf-row"><button class="pf-btn pf-sec pf-small" type="button" id="pf-regel">+ weitere Zeile (z. B. Samstag)</button></div>' +
      '<div class="pf-grid" style="margin-top:10px">' +
        '<div class="pf-f wide"><label for="pf-geschl">Geschlossen an (Datum, kommagetrennt)</label><input id="pf-geschl" value="' + esc(PK.formatGeschlossen(s.geschlossen)) + '" placeholder="z. B. 24.12., 25.12., 26.12., 31.12., 1.1."><small>Feiertage sind automatisch berücksichtigt: Ohne Haken bei „Feiertag“ ist an Feiertagen geschlossen.</small></div>' +
        '<div class="pf-f wide"><label for="pf-geschltext">Text dazu (optional)</label><input id="pf-geschltext" value="' + esc(s.geschlossenText || '') + '" placeholder="z. B. 24.–26.12., 31.12. und 1.1. geschlossen"></div>' +
      '</div>';
    box.querySelectorAll('.pf-regel').forEach(function (r) {
      var z = s.zeiten[+r.dataset.i];
      r.querySelectorAll('[data-tag]').forEach(function (c) {
        c.addEventListener('change', function () {
          var tag = c.dataset.tag === 'F' ? 'F' : +c.dataset.tag;
          z.t = z.t.filter(function (x) { return x !== tag; }); if (c.checked) z.t.push(tag);
          r.querySelector('.pf-label').textContent = PK.tageLabel(z.t) || 'keine Tage gewählt';
          pruefen();
        });
      });
      r.querySelectorAll('[data-z]').forEach(function (inp) { inp.addEventListener('input', function () { z[inp.dataset.z] = inp.value; pruefen(); }); });
    });
    box.querySelectorAll('[data-weg]').forEach(function (b) { b.addEventListener('click', function () { s.zeiten.splice(+b.dataset.weg, 1); if (!s.zeiten.length) { delete s.zeiten; $('pf-fest').checked = false; } zeiten(s); pruefen(); }); });
    var plus = $('pf-regel'); if (plus) plus.addEventListener('click', function () { s.zeiten.push({ t: [6], von: '09:00', bis: '13:00' }); zeiten(s); pruefen(); });
    var g = $('pf-geschl'); if (g) g.addEventListener('input', function () { var r = PK.parseGeschlossen(g.value); s.geschlossen = r.tage; st.geschlFehler = r.fehler; pruefen(); });
    var gt = $('pf-geschltext'); if (gt) gt.addEventListener('input', function () { s.geschlossenText = gt.value; pruefen(); });
  }

  // ---------- Positionskarte ----------
  function karteAufbauen() {
    if (!window.L) { $('pf-poshint').textContent = 'Kartenbibliothek fehlt.'; return; }
    karte = L.map('pf-map').setView([52.395, 13.07], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap-Mitwirkende' }).addTo(karte);
    karte.on('click', function (e) {
      var s = st.sel && stelle(st.sel); if (!s) { $('pf-poshint').textContent = 'Erst links eine Stelle auswählen.'; return; }
      setzen(s, e.latlng.lat, e.latlng.lng);
    });
    punkteNeu();
  }
  function setzen(s, lat, lon) {
    s.lat = Math.round(lat * 1e6) / 1e6; s.lon = Math.round(lon * 1e6) / 1e6;
    $('pf-poshint').textContent = 'Position: ' + s.lat.toFixed(5) + ', ' + s.lon.toFixed(5) + ' – gesetzt.';
    punkteNeu(); pruefen();
  }
  function punkteNeu() {
    if (!karte) return;
    Object.keys(punkte).forEach(function (k) { karte.removeLayer(punkte[k]); }); punkte = {};
    st.data.standorte.forEach(function (s) {
      var sel = s.id === st.sel;
      var m = L.marker([s.lat, s.lon], {
        draggable: sel, title: s.name, zIndexOffset: sel ? 2000 : 0,
        icon: L.divIcon({ className: 'mk', html: '<span class="sym ' + s.kategorie + '" style="' + (sel ? 'outline:3px solid #F39200;outline-offset:2px' : 'opacity:.75') + '">' + ({ kundenzentrum: 'K', serviceagentur: 'S', verkaufsstelle: 'V' }[s.kategorie] || '?') + '</span>', iconSize: [28, 28], iconAnchor: [14, 14] })
      }).addTo(karte);
      if (sel) m.on('dragend', function (e) { var p = e.target.getLatLng(); setzen(s, p.lat, p.lng); });
      else m.on('click', function () { waehlen(s.id); });
      punkte[s.id] = m;
    });
  }

  // Position über OpenStreetMap (Nominatim) aus der Adresse suchen - nur auf Klick.
  function adresseSuchen() {
    var s = st.sel && stelle(st.sel);
    if (!s || !s.adresse) { $('pf-poshint').textContent = 'Erst eine Stelle wählen und Straße mit Hausnummer eintragen.'; return; }
    var q = s.adresse + ', ' + (s.plz || '') + ' ' + (s.ort || 'Potsdam');
    $('pf-poshint').textContent = 'Suche „' + q + '“ …';
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.length) { $('pf-poshint').textContent = 'Adresse nicht gefunden – bitte in die Karte klicken.'; return; }
        setzen(s, +res[0].lat, +res[0].lon);
        if (karte) karte.setView([s.lat, s.lon], 17);
        $('pf-poshint').textContent = 'Gefunden: ' + res[0].display_name.split(',').slice(0, 3).join(',') + ' – bitte kurz prüfen, ggf. Punkt ziehen.';
      }, function () { $('pf-poshint').textContent = 'Suche nicht erreichbar – bitte in die Karte klicken.'; });
  }

  function neu() {
    var c = karte ? karte.getCenter() : { lat: 52.395, lng: 13.07 };
    var s = PK.neueStelle(c.lat, c.lng, st.data.standorte.map(function (x) { return x.id; }));
    st.data.standorte.push(s);
    waehlen(s.id);
    $('pf-poshint').textContent = 'Neue Stelle liegt in der Kartenmitte – jetzt an die richtige Stelle klicken oder den Punkt ziehen.';
    $('pf-f-name').focus(); $('pf-f-name').select();
  }

  // ---------- Prüfen und Speichern ----------
  function daten() {
    var d = PK.bereinigen(st.data);
    // Neue Stellen bekommen eine ID aus dem Namen (für Direktlinks wie #name).
    var alt = st.orig.standorte.map(function (s) { return s.id; });
    d.standorte.forEach(function (s, i) {
      if (alt.indexOf(s.id) < 0 && /^neue-stelle/.test(s.id) && s.name && s.name !== 'Neue Verkaufsstelle') {
        var andere = d.standorte.filter(function (x, j) { return j !== i; }).map(function (x) { return x.id; });
        s.id = PK.slug(s.name, andere);
      }
    });
    return d;
  }
  function html() { return PflegeDatei.ersetzen(st.html, 'karte-data', PK.serialize(daten())); }

  var letzte = [];
  function pruefen() {
    var d = daten(), fehler = KarteKern.pruefen(d);
    d.standorte.forEach(function (s) { if (s.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s.email)) fehler.push(s.name + ': E-Mail-Adresse unvollständig'); });
    if (st.geschlFehler && st.geschlFehler.length) fehler.push('Schließtage nicht erkannt: ' + st.geschlFehler.join(', ') + ' (Format: 24.12.)');
    if (!/^\d{4}-\d\d-\d\d$/.test(d.stand || '')) fehler.push('Datenstand fehlt');
    // Fehlermeldungen mit Namen statt IDs
    var namen = {}; d.standorte.forEach(function (s) { namen[s.id] = s.name; });
    fehler = fehler.map(function (f) { return f.replace(/^([a-z0-9-]+):/, function (m, id) { return namen[id] ? namen[id] + ':' : m; }); });
    letzte = fehler;
    $('pf-check').innerHTML = fehler.length
      ? '<div class="pf-note bad"><b>Bitte korrigieren – so kann nicht gespeichert werden:</b><ul>' + fehler.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>'
      : '<div class="pf-note ok">Alle ' + d.standorte.length + ' Stellen sind vollständig; Öffnungszeiten und Positionen geprüft.</div>';
    var ch = PK.aenderungen(st.orig, d);
    $('pf-changes').innerHTML = ch.length ? '<table><thead><tr><th>Änderung</th><th>Stelle</th></tr></thead><tbody>' + ch.map(function (c) { return '<tr><td>' + esc(c.art) + '</td><td>' + esc(c.name) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="pf-muted">Noch keine Änderungen.</p>';
    $('pf-status').textContent = fehler.length ? fehler.length + ' Fehler – Speichern gesperrt' : (ch.length ? ch.length + ' Änderung' + (ch.length === 1 ? '' : 'en') + ' · Prüfung bestanden' : 'Keine Änderungen');
    $('pf-status').style.color = fehler.length ? '#7A1216' : '#0B1612';
    $('pf-save').disabled = !!fehler.length || !ch.length;
    $('pf-preview').disabled = !!fehler.length;
  }
  function speichern() {
    if (letzte.length) return;
    var h = html();
    PflegeDatei.speichern(h, function (wie) {
      st.html = h; st.orig = daten(); st.data = JSON.parse(JSON.stringify(st.orig));
      liste(); pruefen();
      $('pf-check').insertAdjacentHTML('afterbegin', '<div class="pf-note info">' + PflegeDatei.hinweisNachSpeichern(wie) + '</div>');
    });
  }
})();

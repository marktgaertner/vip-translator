/* Preispflege direkt im Tool: Seite mit ?pflege öffnen (oder unten auf
   "Preise pflegen" klicken). Der Editor liest die eigene Datei, prüft jede
   Eingabe mit der Rechenlogik dieser Seite und speichert eine neue Fassung. */
(function () {
  'use strict';
  if (!/[?&]pflege(=|&|$)/.test(location.search)) return;
  var P = PreisPflege;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return x == null ? '–' : x.toFixed(2).replace('.', ',') + ' €'; }
  function f2(x) { return isFinite(x) ? x.toFixed(2).replace('.', ',') : ''; }
  function num(x) { return typeof x === 'number' ? String(x).replace('.', ',') : x; }
  function parse(s) { s = String(s).trim().replace(/\s|€/g, '').replace(',', '.'); return s === '' ? NaN : Number(s); }
  function datum(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso; }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  var st = null, root = null, $ = function (id) { return document.getElementById(id); };

  document.addEventListener('DOMContentLoaded', function () {
    root = document.createElement('div');
    root.id = 'pf';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Preispflege');
    root.innerHTML = '<div class="pf-top"><div class="pf-top-in"><b>Preispflege</b><span id="pf-was">wird geladen …</span><a href="' + esc(location.pathname) + '">Fertig – zur Seite</a></div></div><div class="pf-main" id="pf-main"></div>';
    document.body.appendChild(root);
    document.documentElement.style.overflow = 'hidden';
    PflegeDatei.quelle(function (t) { return !!P.findData(t); }).then(function (html) {
      var found = html && P.findData(html);
      if (!found) { $('pf-main').innerHTML = '<div class="pf-note bad">Die Preisdaten dieser Seite ließen sich nicht lesen.</div>'; return; }
      st = { html: html, tool: found.tool, name: found.name, orig: found.data, data: JSON.parse(JSON.stringify(found.data)) };
      aufbauen();
    });
  });

  function aufbauen() {
    $('pf-was').textContent = st.name + ' · Preise ' + st.data.jahre[0].key + ' und ' + st.data.jahre[1].key;
    var kannSpeichern = PflegeDatei.kannDirekt;
    $('pf-main').innerHTML =
      '<ol class="pf-steps">' +
        '<li><b>Preise ändern</b><br>geänderte Zeilen werden grün, Fehler rot</li>' +
        '<li><b>Speichern</b><br>' + (kannSpeichern ? 'direkt über die Datei <code>index.html</code> – z. B. im Webspace-Ordner' : 'neue <code>index.html</code> wird heruntergeladen') + '</li>' +
        '<li><b>Fertig</b><br>' + (kannSpeichern ? 'liegt die Datei im Webspace-Ordner, ist sie sofort online' : 'Datei auf dem Webspace ersetzen') + '</li>' +
      '</ol>' +
      '<section class="pf-card"><h2>Stand und Jahre</h2><div class="pf-meta" id="pf-meta"></div>' +
        '<div class="pf-row"><button class="pf-btn pf-sec" type="button" id="pf-roll">Jahreswechsel vorbereiten …</button><button class="pf-btn pf-sec" type="button" id="pf-reset">Änderungen verwerfen</button></div>' +
        '<p class="pf-muted" style="margin-top:8px">Linke Spalte: gilt seit 1. Januar des laufenden Jahres. Rechte Spalte: Folgejahr – erscheint als „ab 1.1.“, wenn der Preis abweicht, und gilt ab dem 1. Januar automatisch. Wenn der VBB die Preise für das übernächste Jahr veröffentlicht: „Jahreswechsel vorbereiten“, dann rechts eintragen.</p></section>' +
      '<section class="pf-card"><h2>Preise</h2><p class="pf-muted">Beträge in Euro, Komma oder Punkt.</p><div id="pf-tables"></div></section>' +
      '<section class="pf-card"><h2>Prüfung</h2><div id="pf-check"></div><details><summary>Stichprobe: so rechnet die Seite mit den neuen Preisen</summary><div id="pf-sample"></div></details></section>' +
      '<section class="pf-card"><h2>Änderungen</h2><div id="pf-changes"></div></section>' +
      '<div class="pf-bar"><div class="pf-bar-in"><span class="pf-status" id="pf-status"></span>' +
        '<button class="pf-btn pf-sec" type="button" id="pf-preview">Vorschau</button>' +
        '<button class="pf-btn" type="button" id="pf-save">Speichern</button></div></div>';
    $('pf-roll').addEventListener('click', jahreswechsel);
    $('pf-reset').addEventListener('click', function () {
      if (!confirm('Alle Änderungen verwerfen?')) return;
      st.data = JSON.parse(JSON.stringify(st.orig)); alles();
    });
    $('pf-preview').addEventListener('click', function () { PflegeDatei.vorschau(neu()); });
    $('pf-save').addEventListener('click', speichern);
    alles();
  }

  function alles() { meta(); tabellen(); auffrischen(); }

  function meta() {
    var d = st.data;
    $('pf-meta').innerHTML =
      '<div><label for="pf-stand">Datenstand (Tag der Prüfung)</label><input type="date" id="pf-stand" value="' + esc(d.stand) + '"></div>' +
      d.jahre.map(function (j, i) {
        return '<div><label for="pf-h' + i + '">Zusatz zu ' + esc(j.key) + (i ? ' (Folgejahr)' : ' (laufendes Jahr)') + ', optional</label><input type="text" id="pf-h' + i + '" value="' + esc(j.hinweis || '') + '" placeholder="z. B. vorbehaltlich Tarifgenehmigung"></div>';
      }).join('');
    $('pf-stand').addEventListener('input', function (e) { st.data.stand = e.target.value; auffrischen(); });
    d.jahre.forEach(function (j, i) { $('pf-h' + i).addEventListener('input', function (e) { st.data.jahre[i].hinweis = e.target.value; auffrischen(); }); });
  }

  function tabellen() {
    var d = st.data, groups = {}, order = [];
    P.flatten(d).forEach(function (f) {
      var s = P.sectionFor(f.path);
      if (!groups[s]) { groups[s] = []; order.push(s); }
      groups[s].push(f);
    });
    var LAST = ['Regeln und Kontakt', 'Faustwerte', 'Annahmen für die Empfehlung', 'Weitere Werte'];
    order.sort(function (a, b) { return LAST.indexOf(a) - LAST.indexOf(b); });
    $('pf-tables').innerHTML = order.map(function (s) {
      var pairs = groups[s].some(function (f) { return f.kind === 'pair'; });
      return '<table><caption>' + esc(s) + '</caption><thead><tr><th>Wert</th>' +
        (pairs ? '<th class="n">' + esc(d.jahre[0].key) + '</th><th class="n">' + esc(d.jahre[1].key) + '</th><th class="n">Änderung</th>' : '<th class="n">Wert</th><th></th><th></th>') +
        '</tr></thead><tbody>' + groups[s].map(zeile).join('') + '</tbody></table>';
    }).join('');
    root.querySelectorAll('input[data-path]').forEach(function (inp) { inp.addEventListener('input', eingabe); });
    root.querySelectorAll('button[data-derive]').forEach(function (b) { b.addEventListener('click', ableiten); });
  }

  function zeile(f) {
    var key = f.path.join('.'), d = P.DERIVED[key], label = P.labelFor(f.path), j = st.data.jahre;
    var name = '<td class="pf-name">' + esc(label) + (d ? '<small>' + esc(d.text) + ' <button class="pf-btn pf-sec pf-small" type="button" data-derive="' + key + '">berechnen</button></small>' : '') + '<span class="pf-msg" data-msg="' + key + '"></span></td>';
    if (f.kind === 'pair') {
      return '<tr data-row="' + key + '">' + name +
        [0, 1].map(function (i) { return '<td class="n" data-h="' + j[i].key + '"><input inputmode="decimal" data-path="' + key + '" data-i="' + i + '" value="' + f2(f.value[i]) + '" aria-label="' + esc(label + ' ' + j[i].key) + '"></td>'; }).join('') +
        '<td class="pf-diff" data-diff="' + key + '"></td></tr>';
    }
    var text = f.kind === 'text';
    return '<tr data-row="' + key + '">' + name + '<td class="n"' + (text ? ' colspan="3"' : '') + '><input' + (text ? ' class="pf-text"' : ' inputmode="decimal"') + ' data-path="' + key + '" value="' + esc(num(f.value)) + '" aria-label="' + esc(label) + '"></td>' + (text ? '' : '<td></td><td></td>') + '</tr>';
  }

  function eingabe(e) {
    var inp = e.target, path = inp.dataset.path.split('.'), cur = P.getPath(st.data, path);
    if (Array.isArray(cur)) { var v = cur.slice(); v[Number(inp.dataset.i)] = P.r2(parse(inp.value)); P.setPath(st.data, path, v); }
    else if (typeof P.getPath(st.orig, path) === 'number') P.setPath(st.data, path, parse(inp.value));
    else P.setPath(st.data, path, inp.value.trim());
    auffrischen();
  }
  function ableiten(e) {
    var path = e.target.dataset.derive.split('.'), v = P.derive(st.data, path); if (!v) return;
    P.setPath(st.data, path, v);
    root.querySelectorAll('input[data-path="' + path.join('.') + '"]').forEach(function (inp) { inp.value = f2(v[Number(inp.dataset.i)]); });
    auffrischen();
  }
  function jahreswechsel() {
    var j = st.data.jahre;
    if (!confirm('Jahreswechsel: ' + j[1].key + ' wird das laufende Jahr (mit den Preisen der rechten Spalte), ' + (Number(j[1].key) + 1) + ' das neue Folgejahr.\n\nDanach die neuen Preise rechts eintragen. Fortfahren?')) return;
    st.data = P.yearRollover(st.data, heute());
    $('pf-was').textContent = st.name + ' · Preise ' + st.data.jahre[0].key + ' und ' + st.data.jahre[1].key;
    alles();
  }

  var timer = null, letzte = null;
  function auffrischen() {
    var orig = {}; P.flatten(st.orig).forEach(function (f) { orig[f.path.join('.')] = f.value; });
    P.flatten(st.data).forEach(function (f) {
      var key = f.path.join('.'), row = root.querySelector('[data-row="' + key + '"]'); if (!row) return;
      row.classList.toggle('pf-changed', JSON.stringify(orig[key]) !== JSON.stringify(f.value));
      var c = P.checkValue(f), msg = row.querySelector('[data-msg="' + key + '"]');
      msg.className = 'pf-msg' + (c ? ' ' + c.level : ''); msg.textContent = c ? c.text : '';
      row.querySelectorAll('input').forEach(function (inp) {
        var bad = f.kind === 'pair' ? !(f.value[Number(inp.dataset.i)] > 0) : (c && c.level === 'bad');
        inp.classList.toggle('pf-bad', !!bad);
        inp.classList.toggle('pf-warn', !bad && !!c && c.level === 'warn');
      });
      var diff = row.querySelector('[data-diff="' + key + '"]');
      if (diff && f.value[0] > 0 && f.value[1] > 0) { var p = (f.value[1] / f.value[0] - 1) * 100; diff.textContent = (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(1).replace('.', ',') + ' %'; }
      else if (diff) diff.textContent = '';
    });
    var ch = P.changes(st.orig, st.data);
    var zeig = function (v) { return P.isPair(v) ? eur(v[0]) + ' / ' + eur(v[1]) : esc(typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? datum(v) : num(v)); };
    $('pf-changes').innerHTML = ch.length
      ? '<table><thead><tr><th>Wert</th><th class="n">vorher</th><th class="n">nachher</th></tr></thead><tbody>' + ch.map(function (c) {
          return '<tr><td>' + esc(c.label) + '</td><td class="n">' + zeig(c.vorher) + '</td><td class="n"><b>' + zeig(c.nachher) + '</b></td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="pf-muted">Noch keine Änderungen.</p>';
    clearTimeout(timer);
    timer = setTimeout(pruefen, 150);
  }

  function pruefen() {
    var r = P.checkAll(st.html, st.tool, st.data), out = '';
    letzte = r;
    if (r.errors.length) out += '<div class="pf-note bad"><b>Bitte korrigieren – so kann nicht gespeichert werden:</b><ul>' + r.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    if (r.warnings.length) out += '<div class="pf-note warn"><b>Bitte kurz prüfen:</b><ul>' + r.warnings.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    if (!r.errors.length) out += '<div class="pf-note ok">Rechenlogik mit den neuen Werten geprüft: ' + r.combos + ' Kombinationen ohne Fehler.</div>';
    $('pf-check').innerHTML = out;
    var j = st.data.jahre;
    $('pf-sample').innerHTML = r.samples.length ? '<table><thead><tr><th>Fall</th><th>Empfehlung</th><th class="n">' + esc(j[0].key) + '</th><th class="n">' + esc(j[1].key) + '</th></tr></thead><tbody>' +
      r.samples.map(function (s) { return '<tr><td>' + esc(s.frage) + '</td><td>' + esc(s.name) + '<br><span class="pf-muted">' + esc(s.einheit || '') + '</span></td><td class="n">' + eur(s.jetzt) + '</td><td class="n">' + (s.next ? eur(s.next) : '<span class="pf-muted">gleich</span>') + '</td></tr>'; }).join('') + '</tbody></table>' : '';
    var n = P.changes(st.orig, st.data).length;
    $('pf-status').textContent = r.errors.length ? r.errors.length + ' Fehler – Speichern gesperrt' : (n ? n + ' Änderung' + (n === 1 ? '' : 'en') + ' · Prüfung bestanden' : 'Keine Änderungen');
    $('pf-status').style.color = r.errors.length ? '#7A1216' : '#0B1612';
    $('pf-save').disabled = !!r.errors.length || !n;
    $('pf-preview').disabled = !!r.errors.length;
  }

  function neu() { return P.replaceData(st.html, st.tool, st.data); }

  function speichern() {
    if (!letzte || letzte.errors.length) return;
    if (letzte.warnings.length && !confirm('Es gibt ' + letzte.warnings.length + ' Hinweis(e) aus der Prüfung. Trotzdem speichern?')) return;
    var html = neu();
    PflegeDatei.speichern(html, function (wie) {
      st.orig = JSON.parse(JSON.stringify(st.data)); st.html = html; auffrischen();
      $('pf-check').insertAdjacentHTML('afterbegin', '<div class="pf-note info">' + PflegeDatei.hinweisNachSpeichern(wie) + '</div>');
    });
  }
})();

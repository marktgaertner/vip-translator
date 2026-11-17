/* Gemeinsam für alle Pflege-Ansichten (?pflege): die eigene Datei lesen,
   einen JSON-Datenblock ersetzen, speichern. */
var PflegeDatei = (function () {
  'use strict';

  // Quelle der Seite: online die Datei selbst vom Server (genau der Stand,
  // der veröffentlicht ist); lokal geöffnet die beim Laden gesicherte Fassung.
  function quelle(passt) {
    var lokal = function () { return window.PflegeQuelle || null; };
    if (!window.fetch || location.protocol === 'file:') return Promise.resolve(lokal());
    var url = location.href.split('#')[0].split('?')[0];
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { return passt(t) ? t : lokal(); }, lokal);
  }

  function blockRegex(id) { return new RegExp('(<script id="' + id + '" type="application/json">)([\\s\\S]*?)(<\/script>)'); }
  function lesen(html, id) { var m = html.match(blockRegex(id)); return m ? JSON.parse(m[2]) : null; }
  function ersetzen(html, id, json) {
    var re = blockRegex(id);
    if (!re.test(html)) throw new Error('Datenblock ' + id + ' nicht gefunden');
    return html.replace(re, function (m, a, b, c) { return a + '\n' + json.replace(/<\//g, '<\\/') + '\n' + c; });
  }

  // Speichern: in Chrome/Edge direkt in eine Datei nach Wahl (etwa die
  // index.html im Webspace-Ordner), sonst als Download.
  // fertig(wie) mit wie = 'datei' | 'download'.
  function speichern(html, fertig) {
    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({ suggestedName: 'index.html', types: [{ description: 'Webseite', accept: { 'text/html': ['.html'] } }] })
        .then(function (h) { return h.createWritable().then(function (w) { return w.write(html).then(function () { return w.close(); }); }); })
        .then(function () { fertig('datei'); }, function (e) { if (e && e.name !== 'AbortError') herunterladen(html, fertig); });
      return;
    }
    herunterladen(html, fertig);
  }
  function herunterladen(html, fertig) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    a.download = 'index.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    fertig('download');
  }
  function vorschau(html) {
    var w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
    if (!w) alert('Der Browser hat das neue Fenster blockiert – bitte Pop-ups erlauben.');
  }
  function hinweisNachSpeichern(wie) {
    return wie === 'datei'
      ? '<b>Gespeichert.</b> Liegt die Datei im Webspace-Ordner, ist der neue Stand online – einmal die Seite neu laden und prüfen.'
      : '<b>Heruntergeladen.</b> Die neue <code>index.html</code> liegt im Download-Ordner. Auf dem Webspace die alte Datei sichern (z. B. <code>index-alt.html</code>) und durch die neue ersetzen.';
  }
  var kannDirekt = !!window.showSaveFilePicker;

  return { quelle: quelle, lesen: lesen, ersetzen: ersetzen, speichern: speichern, vorschau: vorschau, hinweisNachSpeichern: hinweisNachSpeichern, kannDirekt: kannDirekt };
})();

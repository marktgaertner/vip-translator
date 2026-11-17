// Baut die Preispflege in Tarifberater und Jobticket-Rechner ein.
// Quelle: preispflege/pflege-kern.js, pflege-ui.js, pflege.css.
// Nach jeder Änderung dort:  node preispflege/einbauen.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const lies = f => readFileSync(join(here, f), 'utf8').trim();

// Sichert die unveränderte Seite, bevor die Tools sie beim Laden umbauen
// (nur mit ?pflege). Gebraucht, wenn die Datei lokal geöffnet wird.
const QUELLE = `<script id="pflege-quelle">
if (/[?&]pflege(=|&|$)/.test(location.search)) document.addEventListener('DOMContentLoaded', function () {
  window.PflegeQuelle = '<!doctype html>\\n' + document.documentElement.outerHTML;
});
</script>`;

const css = lies('pflege.css');
const BLOCK = `<!-- PFLEGE:START - eingebaut aus preispflege/ (dort ändern, dann node preispflege/einbauen.mjs) -->
<script id="pflege-kern">
${lies('pflege-kern.js')}
</script>
<script id="pflege-ui">
// Stil erst nach dem Sichern der Seite einfügen, sonst wanderte er in die gespeicherte Datei.
if (/[?&]pflege(=|&|$)/.test(location.search)) document.addEventListener('DOMContentLoaded', function () {
  var pflegeStil = document.createElement('style');
  pflegeStil.textContent = ${JSON.stringify(css).replace(/<\//g, '<\\/')};
  document.head.appendChild(pflegeStil);
});
${lies('pflege-ui.js')}
</script>
<!-- PFLEGE:END -->`;

export function einbauen(html) {
  if (/<script id="pflege-quelle">[\s\S]*?<\/script>/.test(html)) html = html.replace(/<script id="pflege-quelle">[\s\S]*?<\/script>/, () => QUELLE);
  else html = html.replace(/\n<\/head>/, () => '\n' + QUELLE + '\n</head>');
  if (/<!-- PFLEGE:START[\s\S]*?<!-- PFLEGE:END -->/.test(html)) html = html.replace(/<!-- PFLEGE:START[\s\S]*?<!-- PFLEGE:END -->/, () => BLOCK);
  else html = html.replace(/\n<\/body>/, () => '\n' + BLOCK + '\n</body>');
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of ['tarifberater/index.html', 'jobticket/index.html']) {
    const p = join(root, f), alt = readFileSync(p, 'utf8'), neu = einbauen(alt);
    writeFileSync(p, neu);
    console.log((alt === neu ? 'unverändert ' : 'eingebaut   ') + f);
  }
}

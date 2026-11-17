// Baut die Pflege-Ansichten (?pflege) in die Web-Tools ein.
// Quelle: preispflege/*.js und *.css. Nach jeder Änderung dort:
//   node preispflege/einbauen.mjs
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

// Was in welches Tool gehört
const TOOLS = {
  'tarifberater/index.html': { css: ['pflege.css'], js: ['pflege-kern.js', 'pflege-datei.js', 'pflege-ui.js'] },
  'jobticket/index.html': { css: ['pflege.css'], js: ['pflege-kern.js', 'pflege-datei.js', 'pflege-ui.js'] },
  'karte/index.html': { css: ['pflege.css', 'karte-pflege.css'], js: ['pflege-datei.js', 'karte-pflege.js'] }
};

function block(cfg) {
  const css = cfg.css.map(lies).join('\n');
  const js = cfg.js.map(f => '/* ---- ' + f + ' ---- */\n' + lies(f)).join('\n\n');
  return `<!-- PFLEGE:START - eingebaut aus preispflege/ (dort ändern, dann node preispflege/einbauen.mjs) -->
<script id="pflege-code">
// Stil erst nach dem Sichern der Seite einfügen, sonst wanderte er in die gespeicherte Datei.
if (/[?&]pflege(=|&|$)/.test(location.search)) document.addEventListener('DOMContentLoaded', function () {
  var pflegeStil = document.createElement('style');
  pflegeStil.textContent = ${JSON.stringify(css).replace(/<\//g, '<\\/')};
  document.head.appendChild(pflegeStil);
});

${js.replace(/<\/script/gi, '<\\/script')}
</script>
<!-- PFLEGE:END -->`;
}

export function einbauen(html, datei) {
  const cfg = TOOLS[datei];
  if (!cfg) throw new Error('Unbekanntes Tool: ' + datei);
  if (/<script id="pflege-quelle">[\s\S]*?<\/script>/.test(html)) html = html.replace(/<script id="pflege-quelle">[\s\S]*?<\/script>/, () => QUELLE);
  else html = html.replace(/\n<\/head>/, () => '\n' + QUELLE + '\n</head>');
  const b = block(cfg);
  if (/<!-- PFLEGE:START[\s\S]*?<!-- PFLEGE:END -->/.test(html)) html = html.replace(/<!-- PFLEGE:START[\s\S]*?<!-- PFLEGE:END -->/, () => b);
  else html = html.replace(/\n<\/body>/, () => '\n' + b + '\n</body>');
  return html;
}
export const DATEIEN = Object.keys(TOOLS);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of DATEIEN) {
    const p = join(root, f), alt = readFileSync(p, 'utf8'), neu = einbauen(alt, f);
    writeFileSync(p, neu);
    console.log((alt === neu ? 'unverändert ' : 'eingebaut   ') + f);
  }
}

/**
 * « Serveur de l'attaquant » — reçoit ce que le MCP malveillant exfiltre, et
 * l'affiche sur une petite page web. Dans la vraie vie, il serait sur Internet ;
 * ici il tourne en local (rien ne quitte votre machine).
 *
 * Il démarre automatiquement avec `npm run dev` (transparent). Console web :
 *   http://127.0.0.1:57624
 */
import { createServer } from 'node:http';

const PORT = 57624;
const captures = []; // { heure, corps }

function page() {
  const lignes =
    captures.length === 0
      ? '<p class="vide">En attente d\'exfiltration…</p>'
      : captures
          .map(
            (c) =>
              `<article><h2>🛰️ ${c.heure}</h2><pre>${c.corps.replace(/[<&]/g, (m) => (m === '<' ? '&lt;' : '&amp;'))}</pre></article>`,
          )
          .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="2">
<title>Console de collecte</title>
<style>
  body{font:14px/1.5 ui-monospace,Consolas,monospace;background:#0b0b17;color:#e8e8ff;margin:0;padding:2rem}
  h1{color:#ff2e88;font-size:1.3rem}
  .vide{opacity:.6}
  article{background:#161628;border:1px solid #2a2a44;border-radius:8px;padding:1rem;margin:1rem 0}
  h2{color:#2de2e6;font-size:.95rem;margin:0 0 .5rem}
  pre{white-space:pre-wrap;margin:0;color:#ffd319}
</style></head><body>
<h1>Console de collecte de l'attaquant · ${captures.length} capture(s)</h1>
${lignes}
</body></html>`;
}

createServer((req, res) => {
  if (req.method === 'POST') {
    let corps = '';
    req.on('data', (c) => (corps += c));
    req.on('end', () => {
      captures.push({ heure: new Date().toLocaleTimeString('fr-FR'), corps });
      res.writeHead(200).end('ok');
    });
  } else if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page());
  } else {
    res.writeHead(404).end();
  }
}).listen(PORT, () => {
  console.error(`[collecte] console de l'attaquant sur http://127.0.0.1:${PORT}`);
});

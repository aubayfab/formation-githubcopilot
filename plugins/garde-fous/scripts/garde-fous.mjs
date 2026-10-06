#!/usr/bin/env node
// Hook PreToolUse des garde-fous.
//
// Lit l'événement JSON sur l'entrée standard. Si une règle s'applique, répond par une
// décision « deny » ou « ask » sur la sortie standard ; sinon ne répond rien, et
// l'appel suit son cours normal (approbations habituelles de VS Code ou du CLI).
//
// Le hook ne sort jamais en erreur : sous Copilot CLI, un hook PreToolUse en échec
// refuse l'appel, ce qui bloquerait tout l'agent. Une erreur interne, y compris une
// erreur de syntaxe dans regles.mjs (d'où l'import dynamique), est signalée sur la
// sortie d'erreur et l'appel suit son cours.

import { readFileSync } from 'node:fs';

function versionDuPlugin() {
  try {
    const manifeste = new URL('../.claude-plugin/plugin.json', import.meta.url);
    return JSON.parse(readFileSync(manifeste, 'utf8')).version ?? '?';
  } catch {
    return '?';
  }
}

try {
  const { traiter } = await import('./moteur.mjs');
  process.stdin.setEncoding('utf8');
  let brut = '';
  for await (const morceau of process.stdin) brut += morceau;
  const reponse = traiter(JSON.parse(brut || '{}'), { version: versionDuPlugin() });
  if (reponse) process.stdout.write(JSON.stringify(reponse));
} catch (erreur) {
  process.stderr.write(`[garde-fous] erreur interne, appel laissé à la décision habituelle : ${erreur.message}\n`);
}

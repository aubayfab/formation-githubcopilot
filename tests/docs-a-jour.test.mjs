// Tests du script versions.mjs du plugin docs-a-jour : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../plugins/docs-a-jour/skills/consulter-doc/scripts/versions.mjs', import.meta.url));

function projet(fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'projet-'));
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(racine, chemin)), { recursive: true });
    writeFileSync(join(racine, chemin), JSON.stringify(contenu));
  }
  return racine;
}

function lancer(racine, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: racine, encoding: 'utf8' });
}

const PROJET = {
  'package.json': { dependencies: { vite: '^7.0.0' }, devDependencies: { vitest: '^4.1.0', '@scope/outil': '~1.2.0' } },
  'node_modules/vite/package.json': { version: '7.3.6' },
  'node_modules/@scope/outil/package.json': { version: '1.2.9' },
  'package-lock.json': { packages: { 'node_modules/vitest': { version: '4.1.11' } } },
};

test('version installée, sinon verrouillée, et plage déclarée', () => {
  const resultat = lancer(projet(PROJET), '--json');
  assert.equal(resultat.status, 0, resultat.stderr);
  assert.deepEqual(JSON.parse(resultat.stdout), [
    { nom: '@scope/outil', version: '1.2.9', source: 'installée', declaree: { plage: '~1.2.0', section: 'devDependencies' } },
    { nom: 'vite', version: '7.3.6', source: 'installée', declaree: { plage: '^7.0.0', section: 'dependencies' } },
    { nom: 'vitest', version: '4.1.11', source: 'verrouillée', declaree: { plage: '^4.1.0', section: 'devDependencies' } },
  ]);
});

test('paquet demandé introuvable : code 1', () => {
  const resultat = lancer(projet(PROJET), 'vite', 'inconnu');
  assert.equal(resultat.status, 1);
  assert.match(resultat.stdout, /^vite\s+7\.3\.6\s+installée/m);
  assert.match(resultat.stdout, /^inconnu\s+-\s+absente\s+\(non déclarée\)/m);
});

test('pas de package.json : code 2', () => {
  const resultat = lancer(mkdtempSync(join(tmpdir(), 'vide-')));
  assert.equal(resultat.status, 2);
  assert.match(resultat.stderr, /Pas de package\.json/);
});

// Tests des scripts du plugin atelier-plugins : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = fileURLToPath(new URL('../plugins/atelier-plugins/skills/', import.meta.url));
const VALIDER = join(SCRIPTS, 'publier-plugin/scripts/valider.mjs');
const VERSION = join(SCRIPTS, 'publier-plugin/scripts/version.mjs');
const CREER = join(SCRIPTS, 'creer-plugin/scripts/creer.mjs');
const MARKETPLACE = fileURLToPath(new URL('..', import.meta.url));
const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const SCHEMA_MCP = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';

function ecrire(racine, fichiers) {
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(racine, chemin)), { recursive: true });
    writeFileSync(join(racine, chemin), typeof contenu === 'string' ? contenu : `${JSON.stringify(contenu, null, 2)}\n`);
  }
}

/** Marketplace minimale valide avec un plugin « demo », modifiée par les fichiers donnés. */
function marketplace(fichiers = {}, entree = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'marketplace-'));
  ecrire(racine, {
    '.github/plugin/marketplace.json': {
      name: 'essai',
      owner: { name: 'Équipe' },
      plugins: [{ name: 'demo', source: './plugins/demo', description: 'Plugin de démonstration.', version: '1.0.0', ...entree }],
    },
    'plugins/demo/plugin.json': { $schema: SCHEMA, name: 'demo', version: '1.0.0', description: 'Démo.' },
    'plugins/demo/README.md': '# demo\n',
    'plugins/demo/CHANGELOG.md': '# Changelog\n\n## [1.0.0] - 2026-01-01\n\n### Ajouté\n\n- Première version.\n',
    'plugins/demo/skills/bonjour/SKILL.md': '---\nname: bonjour\ndescription: Dit bonjour quand on le demande.\n---\n\nDis bonjour.\n',
    ...fichiers,
  });
  return racine;
}

function valider(racine, ...options) {
  const resultat = spawnSync(process.execPath, [VALIDER, racine, '--json', ...options], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });
  const sortie = resultat.stdout ? JSON.parse(resultat.stdout) : null;
  return { code: resultat.status, problemes: sortie?.problemes ?? [], stderr: resultat.stderr };
}

function attendreProbleme(racine, niveau, motif, ...options) {
  const { code, problemes } = valider(racine, ...options);
  const trouve = problemes.find((p) => p.niveau === niveau && motif.test(p.message));
  assert.ok(trouve, `${niveau} « ${motif} » attendu ; obtenu : ${JSON.stringify(problemes, null, 1)}`);
  if (niveau === 'erreur') assert.equal(code, 1);
}

test('la marketplace du dépôt est valide', () => {
  const { code, problemes } = valider(MARKETPLACE);
  assert.equal(code, 0, JSON.stringify(problemes, null, 1));
  assert.deepEqual(problemes, []);
});

test('une marketplace minimale valide ne signale rien', () => {
  const { code, problemes } = valider(marketplace());
  assert.equal(code, 0);
  assert.deepEqual(problemes, []);
});

test('versions différentes entre catalogue et manifeste', () => {
  attendreProbleme(marketplace({}, { version: '1.1.0' }), 'erreur', /version 1\.0\.0 dans le manifeste, 1\.1\.0 dans le catalogue/);
});

test('nom du manifeste différent de celui du catalogue', () => {
  attendreProbleme(marketplace({ 'plugins/demo/plugin.json': { $schema: SCHEMA, name: 'autre', version: '1.0.0' } }), 'erreur', /s'appelle « autre »/);
});

test('champ de composant dans un manifeste Agent Plugins', () => {
  const racine = marketplace({ 'plugins/demo/plugin.json': { $schema: SCHEMA, name: 'demo', version: '1.0.0', skills: 'skills/' } });
  attendreProbleme(racine, 'erreur', /« skills » n'existe pas en Agent Plugins 1\.0/);
});

test('skill dont le nom diffère du dossier', () => {
  const racine = marketplace({ 'plugins/demo/skills/bonjour/SKILL.md': '---\nname: salut\ndescription: x\n---\n' });
  attendreProbleme(racine, 'erreur', /identique au nom du dossier/);
});

test('skill au nom préfixé, ignorée par VS Code', () => {
  const racine = marketplace({ 'plugins/demo/skills/bonjour/SKILL.md': '---\nname: equipe/bonjour\ndescription: x\n---\n' });
  attendreProbleme(racine, 'erreur', /ignorée sans message/);
});

test('skill sans description', () => {
  attendreProbleme(marketplace({ 'plugins/demo/skills/bonjour/SKILL.md': '---\nname: bonjour\n---\n' }), 'erreur', /« description » est obligatoire/);
});

test('lien cassé ou hors du plugin dans un SKILL.md', () => {
  const racine = marketplace({
    'plugins/demo/skills/bonjour/SKILL.md':
      '---\nname: bonjour\ndescription: x\n---\n\nVoir [le script](scripts/absent.mjs), [la doc](../../../../README.md) et [le site](https://exemple.org).\n\n```md\n[exemple](ignore.md)\n```\n',
  });
  attendreProbleme(racine, 'erreur', /mène à un fichier absent/);
  attendreProbleme(racine, 'erreur', /sort du plugin/);
  assert.ok(!valider(racine).problemes.some((p) => /ignore\.md|exemple\.org/.test(p.message)));
});

test('hook Agent Plugins qui compte sur ${PLUGIN_ROOT}', () => {
  const racine = marketplace({
    'plugins/demo/scripts/h.mjs': '',
    'plugins/demo/com.github.copilot/hooks/hooks.json': { hooks: { PreToolUse: [{ type: 'command', command: 'node ${PLUGIN_ROOT}/scripts/h.mjs' }] } },
  });
  attendreProbleme(racine, 'avertissement', /VS Code ne remplace pas \$\{PLUGIN_ROOT\}.*format Claude/);
});

test('hook Claude dont le script est absent, ou désigné par un chemin relatif', () => {
  const racine = mkdtempSync(join(tmpdir(), 'marketplace-'));
  ecrire(racine, {
    '.github/plugin/marketplace.json': { name: 'essai', owner: { name: 'É' }, plugins: [{ name: 'gf', source: './plugins/gf', description: 'x', version: '1.0.0' }] },
    'plugins/gf/.claude-plugin/plugin.json': { name: 'gf', version: '1.0.0' },
    'plugins/gf/scripts/present.mjs': '',
    'plugins/gf/hooks/hooks.json': {
      hooks: {
        PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/absent.mjs"' }] }],
        PostToolUse: [{ type: 'command', command: 'node scripts/present.mjs' }],
        SurEvenementInconnu: [{ type: 'command', command: 'echo' }],
      },
    },
  });
  attendreProbleme(racine, 'erreur', /« \/scripts\/absent\.mjs » n'existe pas/);
  attendreProbleme(racine, 'erreur', /relatif au projet de l'utilisateur/);
  attendreProbleme(racine, 'avertissement', /SurEvenementInconnu/);
});

test('script JavaScript livré avec une erreur de syntaxe', () => {
  const racine = marketplace({ 'plugins/demo/skills/bonjour/scripts/outil.mjs': 'export const motif = /(non fermée/;\n' });
  attendreProbleme(racine, 'erreur', /script JavaScript invalide/);
});

test('mcp.json Agent Plugins non conforme', () => {
  const racine = marketplace({
    'plugins/demo/mcp.json': {
      $schema: 'https://agent-plugins.org/schemas/1.1.0/mcp.schema.json',
      mcpServers: {
        distant: { type: 'streamable-http', url: 'http://exemple.org/mcp', headers: { Authorization: 'Bearer x' } },
        local: { type: 'stdio', command: 'node serveur.js', env: { PLUGIN_ROOT: '/x' }, cwd: 'data' },
        autre: { type: 'websocket', url: 'wss://x' },
      },
    },
  });
  const { problemes } = valider(racine);
  for (const motif of [/« \$schema » doit valoir .*1\.0\.0/, /HTTPS obligatoire/, /aucun secret/, /un seul exécutable/, /PLUGIN_ROOT et PLUGIN_DATA/, /« cwd » commence/, /« type » doit valoir/]) {
    assert.ok(problemes.some((p) => p.niveau === 'erreur' && motif.test(p.message)), `erreur ${motif} attendue`);
  }
});

test('catalogue incomplet', () => {
  const racine = mkdtempSync(join(tmpdir(), 'marketplace-'));
  ecrire(racine, { '.github/plugin/marketplace.json': { name: 'Mauvais Nom', plugins: [{ name: 'x', version: '1.0' }, { name: 'x', source: './x' }] } });
  const { code, problemes } = valider(racine);
  assert.equal(code, 1);
  for (const motif of [/« name » est obligatoire/, /« owner\.name »/, /« source » est obligatoire/, /non sémantique/, /déclaré deux fois/, /n'existe pas/]) {
    assert.ok(problemes.some((p) => motif.test(p.message)), `${motif} attendu`);
  }
});

test('absence de catalogue : code 2', () => {
  assert.equal(valider(mkdtempSync(join(tmpdir(), 'vide-'))).code, 2);
});

function depotGit(racine) {
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'marketplace');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  return git;
}

test('--base : un plugin modifié sans nouvelle version est refusé, puis accepté après version.mjs', () => {
  const racine = marketplace();
  depotGit(racine);
  writeFileSync(join(racine, 'plugins/demo/skills/bonjour/SKILL.md'), '---\nname: bonjour\ndescription: Dit bonjour poliment.\n---\n\nDis bonjour.\n');
  attendreProbleme(racine, 'erreur', /version toujours 1\.0\.0/, '--base', 'HEAD');

  const resultat = spawnSync(process.execPath, [VERSION, 'demo', 'minor', '--note', 'Bonjour plus poli.', '--racine', racine], { encoding: 'utf8' });
  assert.equal(resultat.status, 0, resultat.stderr);
  assert.match(resultat.stdout, /demo : 1\.0\.0 → 1\.1\.0/);
  const { code, problemes } = valider(racine, '--base', 'HEAD');
  assert.equal(code, 0, JSON.stringify(problemes));
});

test('--base : référence inconnue, code 2', () => {
  const racine = marketplace();
  depotGit(racine);
  assert.equal(valider(racine, '--base', 'origin/nexiste-pas').code, 2);
});

test('version.mjs ne change que les lignes de version et ouvre le changelog', () => {
  const racine = marketplace();
  const avantCatalogue = readFileSync(join(racine, '.github/plugin/marketplace.json'), 'utf8');
  const resultat = spawnSync(process.execPath, [VERSION, 'demo', 'patch', '--note', 'Faute corrigée.', '--racine', racine], { encoding: 'utf8' });
  assert.equal(resultat.status, 0, resultat.stderr);
  const apresCatalogue = readFileSync(join(racine, '.github/plugin/marketplace.json'), 'utf8');
  const differences = apresCatalogue.split('\n').filter((ligne, i) => ligne !== avantCatalogue.split('\n')[i]);
  assert.deepEqual(differences, ['      "version": "1.0.1"']);
  assert.equal(JSON.parse(readFileSync(join(racine, 'plugins/demo/plugin.json'), 'utf8')).version, '1.0.1');
  const changelog = readFileSync(join(racine, 'plugins/demo/CHANGELOG.md'), 'utf8');
  assert.match(changelog, /## \[1\.0\.1\] - \d{4}-\d{2}-\d{2}\n\n### Corrigé\n\n- Faute corrigée\.\n\n## \[1\.0\.0\]/);
});

test('version.mjs refuse une version plus basse, une note absente, un plugin inconnu', () => {
  const racine = marketplace();
  const lancer = (...args) => spawnSync(process.execPath, [VERSION, ...args, '--racine', racine], { encoding: 'utf8' }).status;
  assert.equal(lancer('demo', '0.9.0', '--note', 'x'), 1);
  assert.equal(lancer('demo', 'minor'), 2);
  assert.equal(lancer('inconnu', 'minor', '--note', 'x'), 1);
});

test('creer.mjs empaquette un dossier .github et produit un plugin valide', () => {
  const racine = marketplace();
  const projet = mkdtempSync(join(tmpdir(), 'projet-'));
  ecrire(projet, {
    '.github/skills/contraste/SKILL.md': '---\nname: contraste\ndescription: Vérifie le contraste des couleurs.\n---\n\nVoir [le script](scripts/c.mjs).\n',
    '.github/skills/contraste/scripts/c.mjs': 'console.log(1);\n',
    '.github/agents/relecteur.agent.md': '---\nname: relecteur\ndescription: Relit.\ntools: [read]\n---\nRelis.\n',
    '.github/instructions/ts.instructions.md': "---\napplyTo: '**/*.ts'\n---\nTypes stricts.\n",
    '.github/prompts/check.prompt.md': '---\ndescription: Vérifie.\n---\nVérifie.\n',
  });
  const avant = readFileSync(join(racine, '.github/plugin/marketplace.json'), 'utf8');
  const resultat = spawnSync(
    process.execPath,
    [CREER, 'equipe-front', '--description', 'Personnalisations de l’équipe front.', '--depuis', join(projet, '.github'), '--racine', racine],
    { encoding: 'utf8' },
  );
  assert.equal(resultat.status, 0, resultat.stderr);
  const apres = readFileSync(join(racine, '.github/plugin/marketplace.json'), 'utf8');
  assert.ok(apres.startsWith(avant.slice(0, avant.lastIndexOf('}', avant.lastIndexOf(']')) + 1)), 'les entrées existantes ne doivent pas être reformatées');
  const catalogue = JSON.parse(apres);
  assert.deepEqual(catalogue.plugins.map((p) => p.name), ['demo', 'equipe-front']);
  for (const fichier of [
    'skills/contraste/SKILL.md',
    'skills/contraste/scripts/c.mjs',
    'com.github.copilot/agents/relecteur.agent.md',
    'com.github.copilot/commands/check.md',
  ]) {
    assert.ok(readFileSync(join(racine, 'plugins/equipe-front', fichier)), fichier);
  }
  const regle = readFileSync(join(racine, 'plugins/equipe-front/com.github.copilot/rules/ts.mdc'), 'utf8');
  assert.match(regle, /^applyTo: '\*\*\/\*\.ts'\nglobs: \['\*\*\/\*\.ts'\]$/m);
  assert.match(resultat.stdout, /ATTENTION instructions ts : ajoutez une « description »/);
  const { code, problemes } = valider(racine);
  assert.equal(code, 0, JSON.stringify(problemes, null, 1));
  assert.ok(problemes.some((p) => /Copilot CLI ignore un fichier \.mdc sans « description »/.test(p.message)));
});

test('instructions de plugin lisibles par VS Code mais pas par Copilot CLI', () => {
  const racine = marketplace({
    'plugins/demo/com.github.copilot/rules/a.instructions.md': "---\ndescription: a\napplyTo: '**'\n---\nA.\n",
    'plugins/demo/com.github.copilot/rules/b.mdc': "---\ndescription: b\napplyTo: '**/*.ts'\n---\nB.\n",
    'plugins/demo/com.github.copilot/rules/c.mdc': "---\ndescription: c\napplyTo: '**/*.ts'\nglobs: ['**/*.ts']\n---\nC.\n",
  });
  const { code, problemes } = valider(racine);
  assert.equal(code, 0);
  assert.deepEqual(
    problemes.map((p) => [p.fichier.split('/').pop(), p.message.slice(0, 40)]),
    [
      ['a.instructions.md', 'Copilot CLI ne charge, dans un plugin, q'],
      ['b.mdc', 'Copilot CLI lit la portée dans « globs »'],
    ],
  );
});

test('creer.mjs refuse un nom déjà pris ou invalide', () => {
  const racine = marketplace();
  const lancer = (...args) => spawnSync(process.execPath, [CREER, ...args, '--racine', racine], { encoding: 'utf8' }).status;
  assert.equal(lancer('demo', '--description', 'x'), 1);
  assert.equal(lancer('Mon_Plugin', '--description', 'x'), 2);
  assert.equal(lancer('nouveau'), 2);
});

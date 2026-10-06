#!/usr/bin/env node
// Lance Vitest et résume le résultat en quelques lignes : un échec = un emplacement,
// un nom, un message. La sortie brute de Vitest, bien plus longue, coûte cher en
// contexte quand c'est un agent qui la lit.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

const AIDE = `Usage : node rapport-vitest.mjs [fichiers ou filtres…] [--nom <motif>] [--complet]

Lance « vitest run » dans le répertoire courant (la racine du projet) et affiche :
  - le nombre de tests réussis, échoués et ignorés ;
  - pour chaque échec : fichier:ligne, nom complet du test, message d'erreur.

Arguments :
  fichiers ou filtres   transmis à Vitest (ex. test/snake.logic.test.ts) ; sans
                        argument, toute la suite configurée est lancée
  --nom <motif>         ne lance que les tests dont le nom correspond (vitest -t)
  --complet             message d'erreur entier, au lieu des 12 premières lignes
  --aide                affiche cette aide

Codes de sortie : 0 tous les tests passent, 1 au moins un test échoue,
2 Vitest introuvable, aucun test exécuté ou rapport illisible.`;

const LIGNES_MESSAGE = 12;

function arreter(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function lireArguments(argv) {
  const filtres = [];
  let nom = null;
  let complet = false;
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--aide' || argument === '--help' || argument === '-h') {
      process.stdout.write(`${AIDE}\n`);
      process.exit(0);
    } else if (argument === '--nom') {
      nom = argv[++i];
      if (!nom) arreter('--nom attend un motif.');
    } else if (argument === '--complet') {
      complet = true;
    } else if (argument.startsWith('--')) {
      arreter(`Option inconnue : ${argument}. Voir --aide.`);
    } else {
      filtres.push(argument);
    }
  }
  return { filtres, nom, complet };
}

/** Binaire de Vitest installé dans le projet, et sa version. */
function trouverVitest(racine) {
  try {
    const require = createRequire(join(racine, 'package.json'));
    const manifeste = require.resolve('vitest/package.json');
    const { version, bin } = JSON.parse(readFileSync(manifeste, 'utf8'));
    const relatif = typeof bin === 'string' ? bin : bin?.vitest;
    return { version, binaire: join(dirname(manifeste), relatif ?? 'vitest.mjs') };
  } catch {
    return null;
  }
}

/** Chemin lisible, relatif à la racine du projet. */
function cheminCourt(chemin, racine) {
  let propre = chemin;
  try {
    propre = decodeURI(chemin);
  } catch {
    // chemin déjà décodé
  }
  propre = propre.replace(/^file:\/\/\/?/, '');
  if (/^[a-z]:/i.test(propre) || propre.startsWith('/')) {
    const court = relative(racine, propre).replaceAll('\\', '/');
    if (!court.startsWith('..')) return court;
  }
  return propre;
}

/** Premier emplacement du projet (hors node_modules) cité par une pile d'appels. */
function emplacement(message, racine) {
  for (const ligne of message.split('\n')) {
    const appel = /^\s+at (?:.*\((.+)\)|(.+))$/.exec(ligne);
    const position = appel && /^(.+):(\d+):(\d+)$/.exec(appel[1] ?? appel[2]);
    if (position && !position[1].includes('node_modules')) {
      return `${cheminCourt(position[1], racine)}:${position[2]}:${position[3]}`;
    }
  }
  return null;
}

function compter(nombre, singulier, pluriel) {
  return `${nombre} ${nombre > 1 ? pluriel : singulier}`;
}

/** Message d'erreur sans la pile d'appels. */
function messageSansPile(message, complet) {
  const lignes = message.split('\n').filter((ligne) => !/^\s+at /.test(ligne));
  while (lignes.length && !lignes.at(-1).trim()) lignes.pop();
  if (complet || lignes.length <= LIGNES_MESSAGE) return lignes;
  return [...lignes.slice(0, LIGNES_MESSAGE), `… (${lignes.length - LIGNES_MESSAGE} lignes de plus, relancez avec --complet)`];
}

function decaler(lignes) {
  return lignes.map((ligne) => `  ${ligne}`).join('\n');
}

const racine = process.cwd();
const { filtres, nom, complet } = lireArguments(process.argv.slice(2));
const vitest = trouverVitest(racine);
if (!vitest || !existsSync(vitest.binaire)) {
  arreter(`Vitest n'est pas installé dans ${racine} : lancez ce script depuis la racine du projet, après « npm install ».`);
}

const dossier = mkdtempSync(join(tmpdir(), 'rapport-vitest-'));
const fichierRapport = join(dossier, 'rapport.json');
const execution = spawnSync(
  process.execPath,
  [vitest.binaire, 'run', ...filtres, ...(nom ? ['-t', nom] : []), '--reporter=json', `--outputFile=${fichierRapport}`],
  { cwd: racine, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } },
);

let rapport;
try {
  rapport = JSON.parse(readFileSync(fichierRapport, 'utf8'));
} catch {
  const sortie = `${execution.stdout ?? ''}${execution.stderr ?? ''}`.trim().split('\n').slice(-20);
  arreter(`Vitest n'a pas produit de rapport (code ${execution.status}). Fin de sa sortie :\n${decaler(sortie)}`);
} finally {
  rmSync(dossier, { recursive: true, force: true });
}

const fichiers = rapport.testResults ?? [];
const tests = fichiers.flatMap((fichier) => (fichier.assertionResults ?? []).map((test) => ({ ...test, fichier: fichier.name })));
const echecs = tests.filter((test) => test.status === 'failed');
const ignores = tests.filter((test) => test.status !== 'passed' && test.status !== 'failed');
// Un fichier peut échouer sans test exécuté : erreur d'import, de syntaxe, de configuration.
const fichiersEnErreur = fichiers.filter(
  (fichier) => fichier.status === 'failed' && fichier.message && !(fichier.assertionResults ?? []).some((t) => t.status === 'failed'),
);

const debut = Math.min(...fichiers.map((fichier) => fichier.startTime).filter(Number.isFinite), rapport.startTime ?? Infinity);
const fin = Math.max(...fichiers.map((fichier) => fichier.endTime).filter(Number.isFinite), 0);
const duree = Number.isFinite(debut) && fin > debut ? ` en ${((fin - debut) / 1000).toFixed(1)} s` : '';

if (tests.length === 0 && fichiersEnErreur.length === 0) {
  arreter('Aucun test exécuté : vérifiez les filtres et la section « include » de la configuration de Vitest.');
}

const bilan = [
  compter(tests.length - echecs.length - ignores.length, 'réussi', 'réussis'),
  compter(echecs.length, 'échoué', 'échoués'),
];
if (ignores.length) bilan.push(compter(ignores.length, 'ignoré', 'ignorés'));
if (fichiersEnErreur.length) bilan.push(compter(fichiersEnErreur.length, 'fichier en erreur', 'fichiers en erreur'));
console.log(
  `Vitest ${vitest.version} : ${compter(tests.length, 'test', 'tests')} dans ${compter(fichiers.length, 'fichier', 'fichiers')}${duree}, ${bilan.join(', ')}.`,
);

for (const fichier of fichiersEnErreur) {
  console.log(`\nERREUR ${cheminCourt(fichier.name, racine)} (aucun test exécuté)`);
  console.log(decaler(messageSansPile(fichier.message, complet)));
}

for (const test of echecs) {
  const message = (test.failureMessages ?? []).join('\n');
  const ou = emplacement(message, racine) ?? cheminCourt(test.fichier, racine);
  console.log(`\nÉCHEC ${ou}`);
  console.log(`  ${[...(test.ancestorTitles ?? []), test.title].filter(Boolean).join(' › ')}`);
  console.log(decaler(messageSansPile(message, complet)));
}

process.exit(echecs.length > 0 || fichiersEnErreur.length > 0 ? 1 : 0);

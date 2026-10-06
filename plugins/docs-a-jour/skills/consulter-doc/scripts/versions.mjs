#!/usr/bin/env node
// Versions réellement utilisées par le projet : celle installée dans node_modules,
// à défaut celle du fichier de verrouillage, et la plage déclarée dans package.json.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AIDE = `Usage : node versions.mjs [paquet…] [--json]

À lancer depuis la racine du projet. Pour chaque paquet, affiche :
  - la version installée (node_modules), à défaut la version verrouillée
    (package-lock.json ou npm-shrinkwrap.json) ;
  - la plage déclarée dans package.json et la section qui la déclare.
Sans paquet, liste toutes les dépendances directes.

Options :
  --json   sortie JSON
  --aide   affiche cette aide

Codes de sortie : 0 tous les paquets trouvés, 1 au moins un paquet demandé
introuvable, 2 pas de package.json lisible dans le répertoire courant.`;

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function lireJson(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch {
    return null;
  }
}

const argumentsBruts = process.argv.slice(2);
if (argumentsBruts.some((a) => a === '--aide' || a === '--help' || a === '-h')) {
  process.stdout.write(`${AIDE}\n`);
  process.exit(0);
}
const enJson = argumentsBruts.includes('--json');
const inconnue = argumentsBruts.find((a) => a.startsWith('--') && a !== '--json');
if (inconnue) {
  process.stderr.write(`Option inconnue : ${inconnue}. Voir --aide.\n`);
  process.exit(2);
}

const racine = process.cwd();
const manifeste = lireJson(join(racine, 'package.json'));
if (!manifeste) {
  process.stderr.write(`Pas de package.json lisible dans ${racine} : lancez ce script depuis la racine du projet.\n`);
  process.exit(2);
}
const verrou = lireJson(join(racine, 'package-lock.json')) ?? lireJson(join(racine, 'npm-shrinkwrap.json'));

function declaration(nom) {
  for (const section of SECTIONS) {
    const plage = manifeste[section]?.[nom];
    if (plage) return { plage, section };
  }
  return null;
}

function versionVerrouillee(nom) {
  return verrou?.packages?.[`node_modules/${nom}`]?.version ?? verrou?.dependencies?.[nom]?.version ?? null;
}

const demandes = argumentsBruts.filter((a) => !a.startsWith('--'));
const noms = demandes.length > 0 ? demandes : [...new Set(SECTIONS.flatMap((s) => Object.keys(manifeste[s] ?? {})))].sort();

const resultats = noms.map((nom) => {
  const installee = lireJson(join(racine, 'node_modules', nom, 'package.json'))?.version ?? null;
  const verrouillee = installee ? null : versionVerrouillee(nom);
  return {
    nom,
    version: installee ?? verrouillee,
    source: installee ? 'installée' : verrouillee ? 'verrouillée' : 'absente',
    declaree: declaration(nom),
  };
});

if (enJson) {
  process.stdout.write(`${JSON.stringify(resultats, null, 2)}\n`);
} else if (resultats.length === 0) {
  console.log('Aucune dépendance déclarée dans package.json.');
} else {
  const largeur = Math.max(...resultats.map((r) => r.nom.length));
  const largeurVersion = Math.max(...resultats.map((r) => (r.version ?? '-').length));
  for (const { nom, version, source, declaree } of resultats) {
    const detail = declaree ? `déclarée ${declaree.plage}, ${declaree.section}` : 'non déclarée';
    console.log(`${nom.padEnd(largeur)}  ${(version ?? '-').padEnd(largeurVersion)}  ${source.padEnd(11)} (${detail})`);
  }
}

process.exit(resultats.some((r) => r.source === 'absente') && demandes.length > 0 ? 1 : 0);

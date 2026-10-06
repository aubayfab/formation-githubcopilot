// Outils communs aux scripts de l'atelier : lecture d'une marketplace et de ses
// plugins, versions sémantiques, frontmatter YAML, modification ciblée d'un JSON.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// Emplacements du catalogue, dans l'ordre où Copilot CLI les cherche.
export const EMPLACEMENTS_MARKETPLACE = [
  'marketplace.json',
  '.plugin/marketplace.json',
  '.github/plugin/marketplace.json',
  '.claude-plugin/marketplace.json',
];

export const SCHEMAS_AGENT_PLUGINS = {
  'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json': '1.0.0',
  'https://agent-plugins.org/schemas/1.1.0/plugin.schema.json': '1.1.0',
};

// Emplacement des composants selon le format du plugin (VS Code et Copilot CLI).
export const FORMATS = {
  'agent-plugins': {
    libelle: 'Agent Plugins 1.0',
    skills: ['skills'],
    agents: ['com.github.copilot/agents'],
    regles: ['com.github.copilot/rules'],
    commandes: ['com.github.copilot/commands'],
    hooks: ['com.github.copilot/hooks/hooks.json'],
    mcp: ['mcp.json'],
    jetonRacine: null,
  },
  openplugin: {
    libelle: 'OpenPlugin historique',
    skills: ['skills'],
    agents: ['agents'],
    regles: ['rules'],
    commandes: ['commands'],
    hooks: ['hooks/hooks.json'],
    mcp: ['.mcp.json'],
    jetonRacine: '${PLUGIN_ROOT}',
  },
  claude: {
    libelle: 'Claude',
    skills: ['skills'],
    agents: ['agents'],
    regles: ['rules'],
    commandes: ['commands'],
    hooks: ['hooks/hooks.json'],
    mcp: ['.mcp.json'],
    jetonRacine: '${CLAUDE_PLUGIN_ROOT}',
  },
  copilot: {
    libelle: 'Copilot historique',
    skills: ['skills'],
    agents: ['agents'],
    regles: ['rules'],
    commandes: ['commands'],
    hooks: ['hooks.json', 'hooks/hooks.json'],
    mcp: ['.mcp.json', '.github/mcp.json'],
    jetonRacine: null,
  },
};

export function lireJson(chemin) {
  const texte = readFileSync(chemin, 'utf8');
  return { texte, donnees: JSON.parse(texte) };
}

/** Catalogue de la marketplace située à la racine donnée, ou null. */
export function trouverMarketplace(racine) {
  for (const emplacement of EMPLACEMENTS_MARKETPLACE) {
    const chemin = join(racine, emplacement);
    if (existsSync(chemin)) return { chemin, relatif: emplacement };
  }
  return null;
}

/** Vrai si le chemin résolu reste dans le dossier racine. */
export function estDans(racine, chemin) {
  const relatif = relative(resolve(racine), resolve(chemin));
  return relatif === '' || (!relatif.startsWith('..') && !relatif.startsWith(sep) && !/^[a-z]:/i.test(relatif));
}

/** Dossier local d'une entrée du catalogue, ou null pour une source distante. */
export function dossierDeSource(racine, source) {
  if (typeof source !== 'string') return null;
  return resolve(racine, source);
}

/**
 * Format d'un plugin, détecté comme VS Code : un plugin.json racine qui déclare le
 * $schema Agent Plugins, puis .plugin/plugin.json, .claude-plugin/plugin.json,
 * plugin.json. Copilot CLI accepte aussi .github/plugin/plugin.json.
 */
export function detecterFormat(dossier) {
  const racine = join(dossier, 'plugin.json');
  if (existsSync(racine)) {
    try {
      const { donnees } = lireJson(racine);
      if (SCHEMAS_AGENT_PLUGINS[donnees?.$schema]) return { format: 'agent-plugins', manifeste: 'plugin.json' };
    } catch {
      return { format: 'copilot', manifeste: 'plugin.json' };
    }
  }
  for (const [format, manifeste] of [
    ['openplugin', '.plugin/plugin.json'],
    ['claude', '.claude-plugin/plugin.json'],
    ['copilot', 'plugin.json'],
    ['copilot', '.github/plugin/plugin.json'],
  ]) {
    if (existsSync(join(dossier, manifeste))) return { format, manifeste };
  }
  return null;
}

// --- Versions sémantiques ---------------------------------------------------

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function estSemver(version) {
  return typeof version === 'string' && SEMVER.test(version);
}

/** Négatif si a < b, positif si a > b, 0 si égales (métadonnées de build ignorées). */
export function comparerVersions(a, b) {
  const [, ma, na, pa, prea] = SEMVER.exec(a);
  const [, mb, nb, pb, preb] = SEMVER.exec(b);
  for (const [x, y] of [[ma, mb], [na, nb], [pa, pb]]) {
    if (Number(x) !== Number(y)) return Number(x) - Number(y);
  }
  if (prea === preb) return 0;
  if (!prea) return 1;
  if (!preb) return -1;
  return prea < preb ? -1 : 1;
}

export function incrementer(version, niveau) {
  const [, majeure, mineure, correctif] = SEMVER.exec(version).map(Number);
  if (niveau === 'major') return `${majeure + 1}.0.0`;
  if (niveau === 'minor') return `${majeure}.${mineure + 1}.0`;
  return `${majeure}.${mineure}.${correctif + 1}`;
}

// --- Frontmatter --------------------------------------------------------------

/**
 * Lit le frontmatter YAML d'un fichier Markdown. Seules les clés de premier niveau
 * sont interprétées (valeurs simples, entre guillemets ou en bloc « > » / « | ») ;
 * une valeur imbriquée (liste, objet) est rendue telle quelle, en texte.
 */
export function lireFrontmatter(texte) {
  const debut = /^﻿?---\r?\n/.exec(texte);
  if (!debut) return { champs: null, corps: texte };
  const reste = texte.slice(debut[0].length);
  const fin = /^---\s*$/m.exec(reste);
  if (!fin) return { champs: null, corps: texte, erreur: 'frontmatter non refermé par « --- »' };
  const lignes = reste.slice(0, fin.index).split(/\r?\n/);
  const champs = {};
  let cle = null;
  for (const ligne of lignes) {
    const entree = /^([A-Za-z][\w-]*):(?:\s(.*))?$/.exec(ligne);
    if (entree) {
      cle = entree[1];
      champs[cle] = (entree[2] ?? '').trim();
    } else if (cle && /^\s/.test(ligne)) {
      champs[cle] = `${champs[cle]}\n${ligne}`;
    }
  }
  for (const [nom, valeur] of Object.entries(champs)) {
    champs[nom] = valeurYaml(valeur);
  }
  return { champs, corps: reste.slice(fin.index + fin[0].length) };
}

function valeurYaml(brut) {
  const [premiere, ...suite] = brut.split('\n');
  if (/^[>|][+-]?$/.test(premiere)) {
    const separateur = premiere.startsWith('>') ? ' ' : '\n';
    return suite.map((ligne) => ligne.trim()).filter(Boolean).join(separateur);
  }
  if (suite.length > 0) return brut;
  const guillemets = /^(['"])(.*)\1$/.exec(premiere);
  if (guillemets) return guillemets[1] === "'" ? guillemets[2].replaceAll("''", "'") : guillemets[2];
  return premiere;
}

// --- Modification ciblée d'un fichier JSON ------------------------------------

/**
 * Position { debut, fin } dans le texte JSON de la valeur située au chemin donné,
 * par exemple ['plugins', 2, 'version'] ; null si le chemin n'existe pas.
 */
export function localiserValeur(texte, chemin) {
  const pile = [];
  let i = 0;
  const estCible = () =>
    pile.length === chemin.length && pile.every((niveau, n) => niveau.cle === chemin[n]);
  const finDeChaine = () => {
    let j = i + 1;
    while (texte[j] !== '"') j += texte[j] === '\\' ? 2 : 1;
    return j + 1;
  };
  // Après une valeur complète : clé suivante (objet) ou indice suivant (tableau).
  const valeurLue = () => {
    const parent = pile.at(-1);
    if (parent?.type === 'objet') parent.attendCle = true;
    else if (parent?.type === 'tableau') parent.cle++;
  };

  while (i < texte.length) {
    const caractere = texte[i];
    if (/\s|,|:/.test(caractere)) {
      i++;
    } else if (caractere === '}' || caractere === ']') {
      const conteneur = pile.pop();
      if (conteneur.debut !== undefined) return { debut: conteneur.debut, fin: i + 1 };
      i++;
      valeurLue();
    } else if (pile.at(-1)?.type === 'objet' && pile.at(-1).attendCle) {
      const fin = finDeChaine();
      pile.at(-1).cle = JSON.parse(texte.slice(i, fin));
      pile.at(-1).attendCle = false;
      i = fin;
    } else if (caractere === '{' || caractere === '[') {
      const debut = estCible() ? i : undefined;
      pile.push({ type: caractere === '{' ? 'objet' : 'tableau', attendCle: caractere === '{', cle: caractere === '[' ? 0 : null, debut });
      i++;
    } else {
      const fin = caractere === '"' ? finDeChaine() : i + /^[^\s,\]}]+/.exec(texte.slice(i))[0].length;
      if (estCible()) return { debut: i, fin };
      i = fin;
      valeurLue();
    }
  }
  return null;
}

/**
 * Remplace la valeur située au chemin donné sans toucher au reste du fichier : la
 * mise en forme est conservée et le diff ne montre que la ligne modifiée. Renvoie
 * null si le chemin n'existe pas.
 */
export function modifierChampJson(texte, chemin, valeur) {
  const position = localiserValeur(texte, chemin);
  if (!position) return null;
  return `${texte.slice(0, position.debut)}${JSON.stringify(valeur)}${texte.slice(position.fin)}`;
}

/**
 * Ajoute un élément à la fin du tableau situé au chemin donné, indenté comme les
 * éléments existants ; null si le chemin ne désigne pas un tableau.
 */
export function ajouterAuTableau(texte, chemin, valeur) {
  const position = localiserValeur(texte, chemin);
  if (!position || texte[position.debut] !== '[') return null;
  const debutLigne = texte.lastIndexOf('\n', position.debut) + 1;
  const retrait = /^[ \t]*/.exec(texte.slice(debutLigne))[0];
  const retraitElement = `${retrait}  `;
  const element = JSON.stringify(valeur, null, 2).replaceAll('\n', `\n${retraitElement}`);
  let dernier = position.fin - 2;
  while (dernier > position.debut && /\s/.test(texte[dernier])) dernier--;
  const vide = dernier === position.debut;
  const insertion = `${vide ? '' : ','}\n${retraitElement}${element}\n${retrait}`;
  return `${texte.slice(0, dernier + 1)}${insertion}${texte.slice(position.fin - 1)}`;
}

/** Date du jour, au format AAAA-MM-JJ, en heure locale. */
export function aujourdhui() {
  const maintenant = new Date();
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`;
}

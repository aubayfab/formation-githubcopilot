#!/usr/bin/env node
// Vérifie une marketplace de plugins GitHub Copilot avant publication : catalogue,
// manifestes, skills, agents, instructions, hooks, serveurs MCP et versions.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  FORMATS,
  SCHEMAS_AGENT_PLUGINS,
  comparerVersions,
  detecterFormat,
  dossierDeSource,
  estDans,
  estSemver,
  lireFrontmatter,
  lireJson,
  trouverMarketplace,
} from './marketplace.mjs';

const AIDE = `Usage : node valider.mjs [racine] [--base <référence git>] [--json]

Vérifie la marketplace dont la racine est donnée (par défaut le répertoire courant) :
  - le catalogue (.github/plugin/marketplace.json ou autre emplacement reconnu) ;
  - chaque plugin local qu'il référence : manifeste, skills, agents, instructions,
    commandes, hooks, serveurs MCP, liens des SKILL.md ;
  - l'accord entre la version du catalogue et celle de chaque plugin.

Options :
  --base <réf>   vérifie aussi que chaque plugin modifié depuis cette référence Git
                 (ex. origin/marketplace) a une version plus élevée qu'à cette référence
  --json         sortie JSON
  --aide         affiche cette aide

Codes de sortie : 0 aucune erreur (avertissements possibles), 1 au moins une erreur,
2 usage incorrect, marketplace ou référence Git introuvable.`;

const NOM_KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CHAMPS_CATALOGUE = new Set(['$schema', 'name', 'owner', 'plugins', 'metadata']);
const CHAMPS_ENTREE = new Set([
  'name', 'source', 'description', 'version', 'author', 'homepage', 'repository', 'license', 'keywords',
  'category', 'tags', 'commands', 'agents', 'skills', 'hooks', 'mcpServers', 'lspServers', 'strict',
]);
const CHAMPS_AGENT_PLUGINS = new Set([
  '$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions',
]);
const CHAMPS_COMPOSANTS = new Set(['agents', 'skills', 'commands', 'hooks', 'mcpServers', 'lspServers']);
const CHAMPS_SKILL = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
  'argument-hint', 'user-invocable', 'disable-model-invocation', 'context',
]);
const EVENEMENTS = new Set([
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'PreCompact', 'SubagentStart', 'SubagentStop', 'Stop', 'ErrorOccurred', 'Notification', 'PermissionRequest',
  'sessionStart', 'sessionEnd', 'userPromptSubmitted', 'userPromptTransformed', 'preToolUse', 'postToolUse',
  'postToolUseFailure', 'agentStop', 'subagentStart', 'subagentStop', 'errorOccurred', 'preCompact',
  'permissionRequest', 'notification',
]);
const CHAMPS_COMMANDE_HOOK = ['command', 'bash', 'powershell', 'windows', 'linux', 'osx', 'exec'];
const JETON_RACINE = /\$\{(?:CLAUDE_PLUGIN_ROOT|PLUGIN_ROOT|COPILOT_PLUGIN_ROOT)\}/;
const JETONS_RACINE = new RegExp(JETON_RACINE.source, 'g');
const CHEMINS_SOUS_JETON = new RegExp(`${JETON_RACINE.source}([\\\\/][^\\s"'\`;|&<>]+)`, 'g');

// --- Arguments ----------------------------------------------------------------

function lireArguments(argv) {
  const options = { racine: '.', base: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (['--aide', '--help', '-h'].includes(argument)) {
      process.stdout.write(`${AIDE}\n`);
      process.exit(0);
    } else if (argument === '--base') {
      options.base = argv[++i];
      if (!options.base) quitter('--base attend une référence Git, par exemple origin/marketplace.');
    } else if (argument === '--json') {
      options.json = true;
    } else if (argument.startsWith('--')) {
      quitter(`Option inconnue : ${argument}. Voir --aide.`);
    } else {
      options.racine = argument;
    }
  }
  return options;
}

function quitter(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

// --- Collecte des problèmes ---------------------------------------------------

class Rapport {
  constructor(racine) {
    this.racine = racine;
    this.problemes = [];
  }

  #ajouter(niveau, fichier, message) {
    this.problemes.push({ niveau, fichier: relative(this.racine, fichier).replaceAll('\\', '/') || '.', message });
  }

  erreur(fichier, message) {
    this.#ajouter('erreur', fichier, message);
  }

  avertissement(fichier, message) {
    this.#ajouter('avertissement', fichier, message);
  }

  get erreurs() {
    return this.problemes.filter((p) => p.niveau === 'erreur');
  }
}

function lireJsonVerifie(rapport, chemin) {
  try {
    return lireJson(chemin).donnees;
  } catch (erreur) {
    rapport.erreur(chemin, `JSON illisible : ${erreur.message}`);
    return null;
  }
}

function estObjet(valeur) {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
}

function nomAgentPluginsValide(nom) {
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(nom) && !nom.includes('--') && !nom.includes('..') && nom.length <= 64;
}

// --- Catalogue ------------------------------------------------------------------

function validerCatalogue(rapport, chemin) {
  const catalogue = lireJsonVerifie(rapport, chemin);
  if (!estObjet(catalogue)) {
    if (catalogue !== null) rapport.erreur(chemin, 'le catalogue doit être un objet JSON.');
    return null;
  }
  for (const champ of Object.keys(catalogue)) {
    if (!CHAMPS_CATALOGUE.has(champ)) rapport.avertissement(chemin, `champ « ${champ} » inconnu, ignoré par Copilot.`);
  }
  const nom = catalogue.name;
  if (typeof nom !== 'string' || !(NOM_KEBAB.test(nom) || nomAgentPluginsValide(nom)) || nom.length > 64) {
    rapport.erreur(chemin, '« name » est obligatoire : minuscules, chiffres et tirets (points tolérés), 64 caractères au plus.');
  }
  if (!estObjet(catalogue.owner) || typeof catalogue.owner.name !== 'string' || !catalogue.owner.name) {
    rapport.erreur(chemin, '« owner.name » est obligatoire.');
  }
  if (catalogue.metadata !== undefined && !estObjet(catalogue.metadata)) {
    rapport.erreur(chemin, '« metadata » doit être un objet { description, version, pluginRoot }.');
  } else if (catalogue.metadata?.version !== undefined && !estSemver(catalogue.metadata.version)) {
    rapport.avertissement(chemin, `metadata.version « ${catalogue.metadata.version} » n'est pas une version sémantique.`);
  }
  if (!Array.isArray(catalogue.plugins)) {
    rapport.erreur(chemin, '« plugins » est obligatoire et doit être un tableau.');
    return null;
  }
  return catalogue;
}

function validerEntree(rapport, chemin, entree, index, dejaVus) {
  const ou = `plugins[${index}]`;
  if (!estObjet(entree)) {
    rapport.erreur(chemin, `${ou} doit être un objet.`);
    return false;
  }
  const nom = entree.name;
  if (typeof nom !== 'string' || !(NOM_KEBAB.test(nom) || nomAgentPluginsValide(nom)) || nom.length > 64) {
    rapport.erreur(chemin, `${ou} : « name » obligatoire, en minuscules, chiffres et tirets, 64 caractères au plus.`);
    return false;
  }
  if (dejaVus.has(nom)) rapport.erreur(chemin, `plugin « ${nom} » déclaré deux fois.`);
  dejaVus.add(nom);
  for (const champ of Object.keys(entree)) {
    if (!CHAMPS_ENTREE.has(champ)) rapport.avertissement(chemin, `${nom} : champ « ${champ} » inconnu, ignoré.`);
  }
  if (entree.source === undefined) rapport.erreur(chemin, `${nom} : « source » est obligatoire.`);
  if (typeof entree.description !== 'string' || !entree.description.trim()) {
    rapport.avertissement(chemin, `${nom} : sans « description », le plugin est difficile à choisir dans le catalogue.`);
  } else if (entree.description.length > 1024) {
    rapport.erreur(chemin, `${nom} : « description » dépasse 1024 caractères.`);
  }
  if (entree.version === undefined) {
    rapport.avertissement(chemin, `${nom} : sans « version », les mises à jour ne sont pas annoncées aux utilisateurs.`);
  } else if (!estSemver(entree.version)) {
    rapport.erreur(chemin, `${nom} : version « ${entree.version} » non sémantique (attendu : majeure.mineure.correctif).`);
  }
  if (estObjet(entree.source)) {
    const { sha } = entree.source;
    if (sha !== undefined && !/^[0-9a-f]{40}$/.test(sha)) {
      rapport.erreur(chemin, `${nom} : source.sha doit être un SHA de commit complet (40 caractères hexadécimaux).`);
    }
    rapport.avertissement(chemin, `${nom} : source distante, son contenu n'est pas vérifié ici.`);
  } else if (entree.source !== undefined && typeof entree.source !== 'string') {
    rapport.erreur(chemin, `${nom} : « source » doit être un chemin relatif ou un objet { source, repo|url, ref, sha, path }.`);
  }
  return true;
}

// --- Plugin -----------------------------------------------------------------------

function validerManifeste(rapport, dossier, detection, entree) {
  const chemin = join(dossier, detection.manifeste);
  const manifeste = lireJsonVerifie(rapport, chemin);
  if (!estObjet(manifeste)) return null;
  const nom = manifeste.name;

  if (detection.format === 'agent-plugins') {
    if (typeof nom !== 'string' || !nomAgentPluginsValide(nom)) {
      rapport.erreur(chemin, '« name » : 1 à 64 caractères, minuscules, chiffres, tirets et points, sans « -- » ni « .. ».');
    }
    for (const champ of Object.keys(manifeste)) {
      if (CHAMPS_COMPOSANTS.has(champ)) {
        rapport.erreur(chemin, `« ${champ} » n'existe pas en Agent Plugins 1.0 : les composants sont découverts à des emplacements fixes (skills/, mcp.json, com.github.copilot/).`);
      } else if (!CHAMPS_AGENT_PLUGINS.has(champ)) {
        rapport.avertissement(chemin, `champ « ${champ} » hors du schéma Agent Plugins 1.0, ignoré.`);
      }
    }
  } else if (typeof nom !== 'string' || !NOM_KEBAB.test(nom) || nom.length > 64) {
    rapport.erreur(chemin, '« name » obligatoire : minuscules, chiffres et tirets, 64 caractères au plus.');
  }

  if (typeof nom === 'string' && nom !== entree.name) {
    rapport.erreur(chemin, `le manifeste s'appelle « ${nom} » mais le catalogue l'annonce sous « ${entree.name} ».`);
  }
  if (typeof manifeste.description === 'string' && manifeste.description.length > 1024) {
    rapport.erreur(chemin, '« description » dépasse 1024 caractères.');
  }
  if (manifeste.version === undefined) {
    rapport.avertissement(chemin, 'pas de « version » dans le manifeste du plugin.');
  } else if (!estSemver(manifeste.version)) {
    rapport.erreur(chemin, `version « ${manifeste.version} » non sémantique.`);
  } else if (entree.version !== undefined && entree.version !== manifeste.version) {
    rapport.erreur(
      chemin,
      `version ${manifeste.version} dans le manifeste, ${entree.version} dans le catalogue : alignez les deux, c'est celle du plugin qui s'applique.`,
    );
  }
  return manifeste;
}

/** Emplacements d'un type de composant : ceux du format, ou ceux déclarés par un manifeste historique. */
function emplacements(detection, manifeste, type, champManifeste) {
  const declares = detection.format !== 'agent-plugins' ? manifeste?.[champManifeste] : undefined;
  if (typeof declares === 'string') return [declares];
  if (Array.isArray(declares)) return declares.filter((d) => typeof d === 'string');
  return FORMATS[detection.format][type];
}

function sansBlocsDeCode(texte) {
  return texte.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
}

function validerLiens(rapport, fichier, corps, dossierPlugin) {
  const texte = sansBlocsDeCode(corps);
  const cibles = [
    ...[...texte.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]),
    ...[...texte.matchAll(/#file:(\S+)/g)].map((m) => m[1]),
  ];
  for (const cible of cibles) {
    if (/^([a-z][a-z0-9+.-]*:|#|~|<)/i.test(cible)) continue;
    let chemin = cible.split('#')[0].split('?')[0];
    try {
      chemin = decodeURI(chemin);
    } catch {
      // lien déjà décodé
    }
    if (!chemin) continue;
    const resolu = resolve(dirname(fichier), chemin);
    if (!estDans(dossierPlugin, resolu)) {
      rapport.erreur(fichier, `le lien « ${cible} » sort du plugin : une fois installé, le fichier n'existera pas.`);
    } else if (!existsSync(resolu)) {
      rapport.erreur(fichier, `le lien « ${cible} » mène à un fichier absent.`);
    }
  }
}

function validerSkills(rapport, dossier, detection, manifeste) {
  let total = 0;
  for (const emplacement of emplacements(detection, manifeste, 'skills', 'skills')) {
    const base = join(dossier, emplacement);
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    for (const nomDossier of readdirSync(base)) {
      const fichier = join(base, nomDossier, 'SKILL.md');
      if (!existsSync(fichier)) continue;
      total++;
      const texte = readFileSync(fichier, 'utf8');
      const { champs, corps, erreur } = lireFrontmatter(texte);
      if (!champs) {
        rapport.erreur(fichier, erreur ?? 'frontmatter YAML absent : « name » et « description » sont obligatoires.');
        continue;
      }
      if (!NOM_KEBAB.test(champs.name ?? '') || champs.name.length > 64) {
        rapport.erreur(fichier, '« name » : minuscules, chiffres et tirets simples, 64 caractères au plus ; sinon la skill est ignorée sans message.');
      } else if (champs.name !== nomDossier) {
        rapport.erreur(fichier, `« name: ${champs.name} » doit être identique au nom du dossier « ${nomDossier} ».`);
      }
      if (!champs.description) {
        rapport.erreur(fichier, '« description » est obligatoire : c\'est elle qui décide quand la skill est chargée.');
      } else if (champs.description.length > 1024) {
        rapport.erreur(fichier, '« description » dépasse 1024 caractères.');
      }
      if (typeof champs.compatibility === 'string' && champs.compatibility.length > 500) {
        rapport.erreur(fichier, '« compatibility » dépasse 500 caractères.');
      }
      for (const champ of Object.keys(champs)) {
        if (!CHAMPS_SKILL.has(champ)) rapport.avertissement(fichier, `champ « ${champ} » inconnu de la spécification Agent Skills et de VS Code.`);
      }
      if (texte.split('\n').length > 500) {
        rapport.avertissement(fichier, 'plus de 500 lignes : déplacez le détail dans references/, chargé seulement au besoin.');
      }
      validerLiens(rapport, fichier, corps, dossier);
    }
  }
  return total;
}

function fichiersMarkdown(dossier, emplacementsListe, suffixes) {
  const fichiers = [];
  for (const emplacement of emplacementsListe) {
    const base = join(dossier, emplacement);
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    for (const nom of readdirSync(base)) {
      if (suffixes.some((suffixe) => nom.endsWith(suffixe))) fichiers.push(join(base, nom));
    }
  }
  return fichiers;
}

function validerMarkdowns(rapport, dossier, detection, manifeste) {
  const agents = fichiersMarkdown(dossier, emplacements(detection, manifeste, 'agents', 'agents'), ['.md']);
  for (const fichier of agents) {
    const { champs } = lireFrontmatter(readFileSync(fichier, 'utf8'));
    if (!champs?.description) rapport.avertissement(fichier, 'agent sans « description » : elle s\'affiche dans le sélecteur d\'agents.');
  }
  // VS Code lit .instructions.md, .md et .mdc, et leur « applyTo » ; Copilot CLI ne lit
  // que les .mdc pourvus d'une « description », et leur portée dans « globs » ou « alwaysApply ».
  const regles = fichiersMarkdown(dossier, FORMATS[detection.format].regles, ['.instructions.md', '.md', '.mdc']);
  for (const fichier of regles) {
    const { champs } = lireFrontmatter(readFileSync(fichier, 'utf8'));
    if (!champs?.applyTo && !champs?.description && !champs?.paths) {
      rapport.avertissement(fichier, 'instructions sans « applyTo » ni « description » : VS Code ne les joindra jamais automatiquement.');
    }
    if (!fichier.endsWith('.mdc')) {
      rapport.avertissement(fichier, 'Copilot CLI ne charge, dans un plugin, que les instructions au format .mdc : renommez le fichier.');
    } else if (!champs?.description) {
      rapport.avertissement(fichier, 'Copilot CLI ignore un fichier .mdc sans « description ».');
    } else if (champs.applyTo && !champs.globs && champs.alwaysApply !== 'true') {
      rapport.avertissement(fichier, 'Copilot CLI lit la portée dans « globs » (ou « alwaysApply »), pas dans « applyTo » : ajoutez globs avec les mêmes motifs.');
    }
  }
  const commandes = fichiersMarkdown(dossier, emplacements(detection, manifeste, 'commandes', 'commands'), ['.md']);
  for (const fichier of commandes) {
    const { champs } = lireFrontmatter(readFileSync(fichier, 'utf8'));
    if (!champs?.description) rapport.avertissement(fichier, 'commande sans « description ».');
  }
  return { agents: agents.length, regles: regles.length, commandes: commandes.length };
}

function commandesDeHooks(config) {
  const resultat = [];
  for (const [evenement, liste] of Object.entries(config.hooks ?? {})) {
    if (!Array.isArray(liste)) {
      resultat.push({ evenement, invalide: true });
      continue;
    }
    for (const element of liste) {
      for (const entree of Array.isArray(element?.hooks) ? element.hooks : [element]) resultat.push({ evenement, entree });
    }
  }
  return resultat;
}

function validerCommandeHook(rapport, fichier, dossier, detection, evenement, entree) {
  if (!estObjet(entree)) {
    rapport.erreur(fichier, `${evenement} : entrée de hook invalide.`);
    return;
  }
  const type = entree.type ?? 'command';
  if (type === 'http' || type === 'prompt') return;
  const textes = CHAMPS_COMMANDE_HOOK.map((champ) => entree[champ]).filter((t) => typeof t === 'string');
  if (Array.isArray(entree.args)) textes.push(...entree.args.filter((a) => typeof a === 'string'));
  if (textes.length === 0) {
    rapport.erreur(fichier, `${evenement} : une entrée de hook doit avoir « command » (ou bash, powershell, windows, linux, osx, exec).`);
    return;
  }
  const jetonAttendu = FORMATS[detection.format].jetonRacine;
  for (const texte of textes) {
    for (const [jeton] of texte.matchAll(JETONS_RACINE)) {
      if (jeton === jetonAttendu) continue;
      const conseil = jetonAttendu
        ? `utilisez ${jetonAttendu}`
        : 'utilisez le format Claude (.claude-plugin/plugin.json, hooks/hooks.json, ${CLAUDE_PLUGIN_ROOT}) ou OpenPlugin (.plugin/plugin.json, ${PLUGIN_ROOT})';
      rapport.avertissement(
        fichier,
        `${evenement} : VS Code ne remplace pas ${jeton} dans les hooks d'un plugin au format ${FORMATS[detection.format].libelle} (Copilot CLI, si) ; ${conseil}.`,
      );
    }
    for (const [, chemin] of texte.matchAll(CHEMINS_SOUS_JETON)) {
      if (!existsSync(join(dossier, chemin))) rapport.erreur(fichier, `${evenement} : « ${chemin} » n'existe pas dans le plugin.`);
    }
    for (const mot of texte.split(/[\s"']+/)) {
      if (!mot || JETON_RACINE.test(mot) || /^[a-z]:|^\//i.test(mot) || !/[\\/]/.test(mot)) continue;
      if (existsSync(join(dossier, mot))) {
        rapport.erreur(
          fichier,
          `${evenement} : « ${mot} » est relatif au projet de l'utilisateur, pas au plugin ; préfixez-le par la racine du plugin.`,
        );
      }
    }
  }
}

function validerHooks(rapport, dossier, detection, manifeste) {
  let fichiers = emplacements(detection, manifeste, 'hooks', 'hooks').map((e) => join(dossier, e)).filter(existsSync);
  if (detection.format !== 'agent-plugins' && estObjet(manifeste?.hooks)) {
    rapport.avertissement(join(dossier, detection.manifeste), 'hooks déclarés dans le manifeste : seul Copilot CLI les lit ; VS Code attend un fichier de hooks.');
  }
  fichiers = [...new Set(fichiers)];
  for (const fichier of fichiers) {
    const config = lireJsonVerifie(rapport, fichier);
    if (!estObjet(config)) continue;
    if (!estObjet(config.hooks)) {
      rapport.erreur(fichier, '« hooks » doit être un objet { NomDÉvénement: [ … ] }.');
      continue;
    }
    for (const { evenement, entree, invalide } of commandesDeHooks(config)) {
      if (invalide) {
        rapport.erreur(fichier, `${evenement} : la valeur doit être un tableau d'entrées.`);
        continue;
      }
      if (!EVENEMENTS.has(evenement)) rapport.avertissement(fichier, `événement « ${evenement} » inconnu de VS Code et de Copilot CLI.`);
      validerCommandeHook(rapport, fichier, dossier, detection, evenement, entree);
    }
  }
  return fichiers.length;
}

function validerServeurAgentPlugins(rapport, fichier, nom, serveur) {
  if (!estObjet(serveur)) {
    rapport.erreur(fichier, `serveur « ${nom} » : doit être un objet.`);
    return;
  }
  const autorises = {
    stdio: ['type', 'command', 'args', 'env', 'cwd'],
    'streamable-http': ['type', 'url', 'headers'],
    sse: ['type', 'url', 'headers'],
  }[serveur.type];
  if (!autorises) {
    rapport.erreur(fichier, `serveur « ${nom} » : « type » doit valoir stdio, streamable-http ou sse.`);
    return;
  }
  for (const champ of Object.keys(serveur)) {
    if (!autorises.includes(champ)) rapport.erreur(fichier, `serveur « ${nom} » : champ « ${champ} » interdit pour le type ${serveur.type} (le serveur sera ignoré).`);
  }
  if (serveur.type === 'stdio') {
    const commande = serveur.command;
    if (typeof commande !== 'string' || !(/^\.\/[^\s]+$/.test(commande) || /^[^\s/\\]+$/.test(commande))) {
      rapport.erreur(fichier, `serveur « ${nom} » : « command » est un seul exécutable, nom simple ou chemin « ./ » relatif au plugin.`);
    }
    if (serveur.args !== undefined && !(Array.isArray(serveur.args) && serveur.args.every((a) => typeof a === 'string'))) {
      rapport.erreur(fichier, `serveur « ${nom} » : « args » doit être un tableau de chaînes.`);
    }
    if (serveur.env !== undefined) {
      if (!estObjet(serveur.env) || !Object.values(serveur.env).every((v) => typeof v === 'string')) {
        rapport.erreur(fichier, `serveur « ${nom} » : « env » doit associer des noms à des chaînes.`);
      } else if (Object.keys(serveur.env).some((cle) => ['PLUGIN_ROOT', 'PLUGIN_DATA'].includes(cle.toUpperCase()))) {
        rapport.erreur(fichier, `serveur « ${nom} » : PLUGIN_ROOT et PLUGIN_DATA sont fournis par le client, pas par « env ».`);
      }
    }
    if (serveur.cwd !== undefined && !/^(\.\/|\$\{PLUGIN_ROOT\}(\/|$)|\$\{PLUGIN_DATA\}(\/|$))/.test(serveur.cwd)) {
      rapport.erreur(fichier, `serveur « ${nom} » : « cwd » commence par ./, \${PLUGIN_ROOT} ou \${PLUGIN_DATA}.`);
    }
    if (JSON.stringify(serveur).includes('${PLUGIN_')) {
      rapport.avertissement(
        fichier,
        `serveur « ${nom} » : VS Code (harness Local) peut ne pas développer \${PLUGIN_ROOT} / \${PLUGIN_DATA} dans un plugin Agent Plugins ; testez le serveur dans VS Code avant de publier.`,
      );
    }
  } else {
    let url = null;
    try {
      url = new URL(serveur.url);
    } catch {
      rapport.erreur(fichier, `serveur « ${nom} » : « url » doit être une URL absolue.`);
    }
    const local = url && /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(url.hostname);
    if (url && url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
      rapport.erreur(fichier, `serveur « ${nom} » : HTTPS obligatoire hors boucle locale.`);
    }
    if (url && (url.username || url.password || url.hash)) {
      rapport.erreur(fichier, `serveur « ${nom} » : l'URL ne doit contenir ni identifiants ni fragment.`);
    }
    if (serveur.headers !== undefined && (!estObjet(serveur.headers) || !Object.values(serveur.headers).every((v) => typeof v === 'string'))) {
      rapport.erreur(fichier, `serveur « ${nom} » : « headers » doit associer des noms à des chaînes.`);
    }
    const sensibles = Object.keys(serveur.headers ?? {}).filter((cle) => /authorization|token|key|secret|cookie/i.test(cle));
    if (sensibles.length) {
      rapport.erreur(fichier, `serveur « ${nom} » : en-tête « ${sensibles.join(', ')} » : aucun secret dans un plugin, son contenu est public.`);
    }
  }
}

function validerMcp(rapport, dossier, detection, manifeste, versionSpec) {
  let total = 0;
  for (const fichier of FORMATS[detection.format].mcp.map((e) => join(dossier, e)).filter(existsSync)) {
    const config = lireJsonVerifie(rapport, fichier);
    if (!estObjet(config)) continue;
    if (!estObjet(config.mcpServers)) {
      rapport.erreur(fichier, '« mcpServers » doit être un objet { nom: configuration }.');
      continue;
    }
    total += Object.keys(config.mcpServers).length;
    if (detection.format === 'agent-plugins') {
      const attendu = `https://agent-plugins.org/schemas/${versionSpec}/mcp.schema.json`;
      if (config.$schema !== attendu) {
        rapport.erreur(fichier, `« $schema » doit valoir ${attendu} (même version que plugin.json) ; sinon aucun serveur n'est chargé.`);
      }
      for (const champ of Object.keys(config)) {
        if (!['$schema', 'mcpServers'].includes(champ)) rapport.erreur(fichier, `champ « ${champ} » interdit au premier niveau de mcp.json.`);
      }
      for (const [nom, serveur] of Object.entries(config.mcpServers)) validerServeurAgentPlugins(rapport, fichier, nom, serveur);
    }
  }
  if (detection.format !== 'agent-plugins' && manifeste?.mcpServers !== undefined) total += 1;
  return total;
}

function fichiersJavaScript(dossier) {
  const resultat = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom !== 'node_modules' && !nom.startsWith('.git')) resultat.push(...fichiersJavaScript(chemin));
    } else if (/\.(m|c)?js$/.test(nom)) {
      resultat.push(chemin);
    }
  }
  return resultat;
}

/**
 * Syntaxe des scripts livrés (node --check). Un script de hook qui ne se charge plus
 * sort en erreur, et Copilot CLI refuse alors chaque appel d'outil.
 */
function validerSyntaxeJavaScript(rapport, dossier) {
  for (const fichier of fichiersJavaScript(dossier)) {
    const verification = spawnSync(process.execPath, ['--check', fichier], { encoding: 'utf8' });
    if (verification.status !== 0) {
      const detail = (verification.stderr ?? '').split('\n').find((ligne) => /Error/.test(ligne)) ?? 'erreur de syntaxe';
      rapport.erreur(fichier, `script JavaScript invalide : ${detail.trim()}`);
    }
  }
}

function validerPlugin(rapport, racine, fichierCatalogue, entree) {
  const dossier = dossierDeSource(racine, entree.source);
  if (!dossier) return null;
  if (!estDans(racine, dossier)) {
    rapport.erreur(fichierCatalogue, `${entree.name} : la source « ${entree.source} » sort du dépôt.`);
    return null;
  }
  if (!existsSync(dossier) || !statSync(dossier).isDirectory()) {
    rapport.erreur(fichierCatalogue, `${entree.name} : le dossier « ${entree.source} » n'existe pas.`);
    return null;
  }
  const detection = detecterFormat(dossier);
  if (!detection) {
    rapport.erreur(dossier, 'aucun manifeste : plugin.json, .plugin/plugin.json ou .claude-plugin/plugin.json.');
    return null;
  }
  const manifestes = ['plugin.json', '.plugin/plugin.json', '.claude-plugin/plugin.json', '.github/plugin/plugin.json'].filter((m) =>
    existsSync(join(dossier, m)),
  );
  if (manifestes.length > 1 && detection.format !== 'agent-plugins') {
    rapport.avertissement(dossier, `plusieurs manifestes (${manifestes.join(', ')}) : VS Code et Copilot CLI ne choisiront pas forcément le même.`);
  }
  if (detection.manifeste === '.github/plugin/plugin.json') {
    rapport.avertissement(dossier, '.github/plugin/plugin.json n\'est lu que par Copilot CLI ; VS Code attend plugin.json à la racine du plugin.');
  }

  const manifeste = validerManifeste(rapport, dossier, detection, entree);
  const versionSpec = SCHEMAS_AGENT_PLUGINS[manifeste?.$schema] ?? '1.0.0';
  const composants = {
    skills: validerSkills(rapport, dossier, detection, manifeste),
    ...validerMarkdowns(rapport, dossier, detection, manifeste),
    hooks: validerHooks(rapport, dossier, detection, manifeste),
    mcp: validerMcp(rapport, dossier, detection, manifeste, versionSpec),
  };
  if (Object.values(composants).every((n) => n === 0)) {
    rapport.avertissement(dossier, 'aucun composant trouvé (skill, agent, instructions, commande, hook, serveur MCP).');
  }
  validerSyntaxeJavaScript(rapport, dossier);
  if (!existsSync(join(dossier, 'README.md'))) rapport.avertissement(dossier, 'pas de README.md.');
  if (!existsSync(join(dossier, 'CHANGELOG.md'))) rapport.avertissement(dossier, 'pas de CHANGELOG.md.');
  return { nom: entree.name, version: manifeste?.version ?? entree.version, format: detection.format, dossier, manifeste: detection.manifeste, composants };
}

// --- Versions depuis une référence Git ---------------------------------------------

function git(dossier, args) {
  return execFileSync('git', args, { cwd: dossier, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function validerIncrements(rapport, racine, plugins, base) {
  let depot;
  try {
    depot = git(racine, ['rev-parse', '--show-toplevel']);
    git(racine, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  } catch {
    quitter(`Référence Git introuvable : ${base} (ou ${racine} n'est pas un dépôt Git).`);
  }
  for (const plugin of plugins) {
    const relatif = relative(depot, plugin.dossier).replaceAll('\\', '/');
    const modifies = [
      ...git(depot, ['diff', '--name-only', base, '--', relatif]).split('\n'),
      ...git(depot, ['ls-files', '--others', '--exclude-standard', '--', relatif]).split('\n'),
    ].filter(Boolean);
    if (modifies.length === 0) continue;
    let ancienne;
    try {
      ancienne = JSON.parse(git(depot, ['show', `${base}:${relatif}/${plugin.manifeste}`])).version;
    } catch {
      continue; // plugin absent à la référence : nouveau plugin
    }
    if (!estSemver(ancienne) || !estSemver(plugin.version ?? '')) continue;
    const fichier = join(plugin.dossier, plugin.manifeste);
    const ecart = comparerVersions(plugin.version, ancienne);
    if (ecart === 0) {
      rapport.erreur(
        fichier,
        `${modifies.length} fichier(s) modifié(s) depuis ${base} mais version toujours ${ancienne} : les utilisateurs ne verront pas la mise à jour.`,
      );
    } else if (ecart < 0) {
      rapport.erreur(fichier, `version ${plugin.version} inférieure à celle de ${base} (${ancienne}).`);
    }
  }
}

// --- Programme principal -----------------------------------------------------------

const options = lireArguments(process.argv.slice(2));
const racine = resolve(options.racine);
const marketplace = trouverMarketplace(racine);
if (!marketplace) quitter(`Aucun catalogue de marketplace dans ${racine} (attendu : .github/plugin/marketplace.json).`);

const rapport = new Rapport(racine);
const catalogue = validerCatalogue(rapport, marketplace.chemin);
const plugins = [];
if (catalogue) {
  const dejaVus = new Set();
  catalogue.plugins.forEach((entree, index) => {
    if (!validerEntree(rapport, marketplace.chemin, entree, index, dejaVus)) return;
    const plugin = validerPlugin(rapport, racine, marketplace.chemin, entree);
    if (plugin) plugins.push(plugin);
  });
  if (catalogue.metadata?.pluginRoot !== undefined) {
    rapport.avertissement(marketplace.chemin, 'metadata.pluginRoot n\'est pas pris en compte par ce validateur : les sources sont résolues depuis la racine.');
  }
}
if (options.base) validerIncrements(rapport, racine, plugins, options.base);

const erreurs = rapport.erreurs.length;
const avertissements = rapport.problemes.length - erreurs;

if (options.json) {
  process.stdout.write(`${JSON.stringify({ marketplace: catalogue?.name ?? null, catalogue: marketplace.relatif, plugins: plugins.map(({ dossier, ...reste }) => reste), problemes: rapport.problemes }, null, 2)}\n`);
} else {
  const libelles = {
    skills: ['skill', 'skills'],
    agents: ['agent', 'agents'],
    regles: ['fichier d\'instructions', 'fichiers d\'instructions'],
    commandes: ['commande', 'commandes'],
    hooks: ['fichier de hooks', 'fichiers de hooks'],
    mcp: ['serveur MCP', 'serveurs MCP'],
  };
  console.log(`Marketplace « ${catalogue?.name ?? '?'} » (${marketplace.relatif}) : ${catalogue?.plugins?.length ?? 0} plugin(s).\n`);
  for (const { nom, version, format, composants } of plugins) {
    const contenu = Object.entries(composants)
      .filter(([, n]) => n > 0)
      .map(([type, n]) => `${n} ${libelles[type][n > 1 ? 1 : 0]}`)
      .join(', ');
    console.log(`  ${nom} ${version ?? '?'} · ${FORMATS[format].libelle} · ${contenu || 'aucun composant'}`);
  }
  if (rapport.problemes.length) console.log('');
  for (const { niveau, fichier, message } of rapport.problemes) {
    console.log(`${niveau === 'erreur' ? 'ERREUR   ' : 'ATTENTION'} ${fichier} : ${message}`);
  }
  console.log(`\nBilan : ${erreurs} erreur(s), ${avertissements} avertissement(s).`);
}

// Annotations des fichiers dans une exécution GitHub Actions.
if (process.env.GITHUB_ACTIONS === 'true') {
  for (const { niveau, fichier, message } of rapport.problemes) {
    console.log(`::${niveau === 'erreur' ? 'error' : 'warning'} file=${fichier}::${message.replaceAll('%', '%25').replaceAll('\n', '%0A')}`);
  }
}

process.exit(erreurs > 0 ? 1 : 0);

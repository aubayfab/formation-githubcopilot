// Analyse d'un appel d'outil : quelles commandes il lance, quels fichiers il vise.
//
// Les noms d'outils et de paramètres varient selon le client (VS Code, Copilot CLI,
// plugins au format Claude) et selon leurs versions : on parcourt donc toute l'entrée
// de l'outil plutôt qu'un champ précis, et on classe l'outil d'après son nom.

const OUTIL_TERMINAL = /terminal|bash|powershell|pwsh|shell|^run|exec/i;
const OUTIL_ECRITURE = /create|edit|write|replace|insert|patch|delete|remove|rename|move|update|notebook/i;
const CLE_COMMANDE = /^(command|cmd|script|commandline|commands)$/i;
const CLE_CHEMIN = /path|file|uri|dir|folder|include|glob|destination|target|cwd/i;
const CLE_CONTENU = /^(content|text|file_text|query|pattern|explanation|description|body|input|old_?str(ing)?|new_?str(ing)?)$/i;
const ENTETE_PATCH = /^(?:\*\*\* (?:add|update|delete) file:|\*\*\* move to:|\+\+\+ [ab]\/|--- [ab]\/)\s*(.+)$/gim;

// Verbes qui ne lisent pas le contenu des fichiers passés en argument : nommer un
// fichier de secrets avec eux (l'ajouter au .gitignore, le lister) est sans risque.
const VERBES_SANS_LECTURE = new Set([
  'echo', 'printf', 'write-output', 'write-host', 'add-content', 'ac',
  'ls', 'll', 'dir', 'gci', 'get-childitem', 'test-path', 'stat', 'touch',
  'new-item', 'ni', 'mkdir', 'md', 'rm', 'del', 'erase', 'remove-item', 'ri', 'rimraf',
  'cd', 'pushd', 'popd', 'set-location', 'sl',
]);
const GIT_SANS_LECTURE = new Set(['rm', 'check-ignore', 'ls-files', 'status']);

// Verbes qui ne modifient pas les fichiers passés en argument : seule une
// redirection (« > fichier ») écrit alors quelque chose.
const VERBES_SANS_MODIFICATION = new Set([
  'cat', 'type', 'more', 'less', 'head', 'tail', 'bat', 'get-content', 'gc',
  'select-string', 'sls', 'findstr', 'grep', 'rg', 'wc', 'diff', 'jq', 'code',
  'echo', 'printf', 'write-output', 'write-host',
  'ls', 'll', 'dir', 'gci', 'get-childitem', 'test-path', 'stat',
  'cd', 'pushd', 'popd', 'set-location', 'sl',
]);
const GIT_MODIFICATION = new Set(['checkout', 'restore', 'reset', 'clean', 'mv', 'rm', 'apply', 'stash', 'switch']);

// Préfixes qui ne changent pas la commande réellement lancée.
const PREFIXE = /^(sudo|doas|nohup|time|command|exec|env|[a-z_][a-z0-9_]*=.*)$/i;

// Lanceurs dont un argument est lui-même une ligne de commande : cmd /c "…",
// & $env:ComSpec /c "…", powershell -Command "…", bash -c "…". C'est la commande
// lancée qui est analysée, y compris quand PowerShell la reçoit encodée en base64.
const LANCEURS = new Set(['cmd', '$env:comspec', '%comspec%', 'powershell', 'pwsh', 'bash', 'sh', 'zsh', 'dash']);
const OPTION_COMMANDE = /^(\/c|\/k|-c|-command)$/i;
const OPTION_COMMANDE_ENCODEE = /^-(e|ec|enc|encodedcommand)$/i;
// Exécuteurs dont les arguments, après leurs propres options, forment la commande lancée.
const EXECUTEURS = new Set(['npx', 'pnpx', 'bunx', 'wsl']);
const OPTION_A_VALEUR = /^(-p|--package|-d|--distribution|-u|--user)$/i;
const IMBRICATION_MAX = 3;

/** Chemin comparable : décodé, minuscules, séparateurs « / », sans guillemets ni « ./ ». */
export function normaliserChemin(valeur) {
  let chemin = String(valeur).trim().replace(/^["'`]+|["'`]+$/g, '');
  chemin = chemin.replace(/(%[0-9a-f]{2})+/gi, (sequence) => {
    try {
      return decodeURIComponent(sequence);
    } catch {
      return sequence;
    }
  });
  chemin = chemin.replace(/^file:\/\/\/?/i, '').replace(/\\/g, '/').toLowerCase();
  while (chemin.startsWith('./')) chemin = chemin.slice(2);
  return chemin;
}

/** Découpe une ligne de commande en mots, en retirant les guillemets. */
export function mots(texte) {
  const resultat = [];
  let courant = '';
  let guillemet = null;
  for (const caractere of texte) {
    if (guillemet) {
      if (caractere === guillemet) guillemet = null;
      else courant += caractere;
    } else if (caractere === '"' || caractere === "'") {
      guillemet = caractere;
    } else if (/\s/.test(caractere)) {
      if (courant) resultat.push(courant);
      courant = '';
    } else {
      courant += caractere;
    }
  }
  if (courant) resultat.push(courant);
  return resultat;
}

/** Commande lancée par un lanceur ou un exécuteur (voir LANCEURS), ou null. */
function commandeLancee(verbe, args) {
  if (LANCEURS.has(verbe)) {
    const encodee = args.findIndex((argument) => OPTION_COMMANDE_ENCODEE.test(argument));
    if (encodee >= 0 && (verbe === 'powershell' || verbe === 'pwsh') && args[encodee + 1]) {
      return Buffer.from(args[encodee + 1], 'base64').toString('utf16le');
    }
    const position = args.findIndex((argument) => OPTION_COMMANDE.test(argument));
    return position >= 0 ? args.slice(position + 1).join(' ') || null : null;
  }
  if (EXECUTEURS.has(verbe)) {
    let i = 0;
    while (i < args.length && args[i].startsWith('-')) i += OPTION_A_VALEUR.test(args[i]) ? 2 : 1;
    return args.slice(i).join(' ') || null;
  }
  return null;
}

/**
 * Sépare les commandes enchaînées (« ; », « && », « || », « | », « & », retour à la
 * ligne) et donne pour chacune son verbe et ses arguments. Les redirections vers le
 * néant (« 2>&1 », « >/dev/null », « 2>$null ») sont retirées au préalable, et une
 * commande lancée par cmd, PowerShell, bash, npx… est remplacée par ce qu'elle lance.
 */
export function segments(commande, imbrication = 0) {
  const nettoyee = commande
    .replace(/\d*>&\d+/g, ' ')
    .replace(/\d*>>?\s*(\$null|\/dev\/null|nul)(?![\w/])/gi, ' ');
  const textes = [];
  let courant = '';
  let guillemet = null;
  for (const caractere of nettoyee) {
    if (guillemet) {
      if (caractere === guillemet) guillemet = null;
      courant += caractere;
    } else if (caractere === '"' || caractere === "'") {
      guillemet = caractere;
      courant += caractere;
    } else if (/[;&|\n]/.test(caractere)) {
      if (courant.trim()) textes.push(courant.trim());
      courant = '';
    } else {
      courant += caractere;
    }
  }
  if (courant.trim()) textes.push(courant.trim());

  return textes.flatMap((texte) => {
    const liste = mots(texte);
    while (liste.length > 1 && PREFIXE.test(liste[0])) liste.shift();
    const verbe = (liste[0] ?? '').replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();
    const args = liste.slice(1);
    const lancee = imbrication < IMBRICATION_MAX ? commandeLancee(verbe, args) : null;
    return lancee ? segments(lancee, imbrication + 1) : [{ texte, verbe, args }];
  });
}

/**
 * Ce qui, dans un texte, pourrait être un chemin : les chemins Windows absolus, espaces
 * compris (« C:\Formation Copilot\.env »), chaque mot, et les morceaux d'un mot
 * (« --opt=chemin », « @chemin », « open('chemin') »). Les chemins entiers d'abord, pour
 * que le message cite le fichier complet.
 */
function cheminsCandidats(texte) {
  const candidats = new Set();
  for (const [chemin] of texte.matchAll(/[a-z]:[\\/][^"'`<>|;&*?\n]*/gi)) candidats.add(normaliserChemin(chemin.trimEnd()));
  for (const mot of mots(texte)) {
    candidats.add(normaliserChemin(mot));
    for (const morceau of mot.split(/[\s"'`;|&<>(),=@]+/)) {
      if (morceau) candidats.add(normaliserChemin(morceau));
    }
  }
  candidats.delete('');
  return [...candidats];
}

/** Fichiers visés par une redirection de sortie (« > fichier », « >> fichier »). */
function ciblesDeRedirection(texte) {
  return [...texte.matchAll(/>>?\s*("[^"]*"|'[^']*'|[^\s;&|<>]+)/g)].map(([, cible]) => normaliserChemin(cible));
}

/**
 * Chemins nommés par une commande, avec ce que chaque commande enchaînée en fait
 * vraisemblablement : les lire (cat, Get-Content, python…) ou les écrire (>, cp, sed…).
 * L'heuristique penche du côté prudent : un verbe inconnu est supposé lire et écrire
 * tous les fichiers qu'il nomme.
 */
export function cheminsDeCommande(commande) {
  const resultat = [];
  for (const { texte, verbe, args } of segments(commande)) {
    const sousCommandeGit = verbe === 'git' ? args.find((argument) => !argument.startsWith('-')) : undefined;
    const substitution = /\$\(|`|<\(/.test(texte);
    const redirectionEntree = /<\s*[^\s<(]/.test(texte);
    const lit = substitution || redirectionEntree ||
      !(VERBES_SANS_LECTURE.has(verbe) || GIT_SANS_LECTURE.has(sousCommandeGit));
    const modifieArguments = substitution || (verbe === 'git'
      ? GIT_MODIFICATION.has(sousCommandeGit) && !args.includes('--cached')
      : !VERBES_SANS_MODIFICATION.has(verbe));
    const redirections = new Set(ciblesDeRedirection(texte));
    for (const chemin of cheminsCandidats(texte)) {
      resultat.push({ chemin, lecture: lit, ecriture: modifieArguments || redirections.has(chemin) });
    }
  }
  return resultat;
}

function parcourir(valeur, cle, visite) {
  if (typeof valeur === 'string') {
    visite(valeur, cle);
  } else if (Array.isArray(valeur)) {
    for (const element of valeur) parcourir(element, cle, visite);
  } else if (valeur && typeof valeur === 'object') {
    for (const [sousCle, sousValeur] of Object.entries(valeur)) parcourir(sousValeur, sousCle, visite);
  }
}

function lireEntreeOutil(evenement) {
  const entree = evenement.tool_input ?? evenement.toolInput ?? evenement.toolArgs ?? evenement.tool_args ?? {};
  if (typeof entree !== 'string') return entree;
  try {
    return JSON.parse(entree);
  } catch {
    return { command: entree };
  }
}

/**
 * Décrit un appel d'outil reçu par un hook PreToolUse, quel que soit le client :
 * VS Code (tool_name / tool_input), Copilot CLI (toolName / toolArgs) ou format Claude.
 */
export function decrireAppel(evenement) {
  const outil = String(evenement.tool_name ?? evenement.toolName ?? '');
  const entree = lireEntreeOutil(evenement);
  const terminal = OUTIL_TERMINAL.test(outil);
  // L'outil « str_replace_editor » du CLI sert aussi à lire : command = "view".
  const ecriture = OUTIL_ECRITURE.test(outil) && !(entree && entree.command === 'view');

  const commandes = [];
  const chemins = [];
  parcourir(entree, '', (texte, cle) => {
    if (terminal && CLE_COMMANDE.test(cle)) commandes.push(texte);
    if (CLE_CHEMIN.test(cle) && !CLE_CONTENU.test(cle)) {
      chemins.push({ chemin: normaliserChemin(texte), lecture: !ecriture, ecriture });
    }
    for (const [, chemin] of texte.matchAll(ENTETE_PATCH)) {
      chemins.push({ chemin: normaliserChemin(chemin), lecture: false, ecriture: true });
    }
  });
  for (const commande of commandes) chemins.push(...cheminsDeCommande(commande));

  let texte = '';
  try {
    texte = JSON.stringify(entree) ?? '';
  } catch {
    texte = String(entree);
  }

  return { outil, entree, commandes, chemins, texte };
}

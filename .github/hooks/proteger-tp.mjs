// Protège les fichiers réservés :
// - NOTES-TP.md, la grille du stagiaire : aucun agent ne la lit ni ne l'écrit ;
// - le référentiel des règles et les rapports (règles-métier*.md) : les agents écrivent
//   leurs rapports, mais seule une session lancée par /check-report peut les lire ;
// - mcp-scores/scores.json, les scores de la borne : les agents passent par le serveur MCP.
// UserPromptSubmit note les sessions lancées par /check-report ; PreToolUse refuse
// les appels d'outils qui visent un fichier protégé.
// Pour une lecture, on teste l'entrée complète de l'outil plutôt qu'un champ précis :
// le nom de l'outil et de ses paramètres varie selon la version de VS Code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SESSIONS_CHECK_REPORT = path.join(os.tmpdir(), 'formation-copilot-check-report');
const RESERVE_STAGIAIRE = /notes[-_ ]?tp/;
const RESERVE_CHECK_REPORT = /referentiel-regles|regles-metier/;
const RESERVE_MCP = /serveur-scores|scores-tournoi\.json|sink\.mjs|mcp[\\/_ -]*readme/;
// Nom exact scores.json : « test-scores.json », « scores.json.bak » ou « scores.json.test.js » restent autorisés.
const RESERVE_SCORES = /(?<![\w.-])scores\.json(?![\w-]|\.\w)/;
// Chemin explicite vers le fichier de la borne (mcp-scores/scores.json ou mcp/scores.json).
const SCORES_BORNE = /mcp(?:-scores)?[\\/]+scores\.json(?![\w-]|\.\w)/;
// Un scores.json « nu » n'est toléré que dans un dossier temporaire (copie de test), hors cwd ou cd vers mcp.
const DOSSIER_TEMP = /\$env:te?mp|gettemppath|%te?mp%|\/tmp\/|[\\/]temp[\\/]|tempfile|mkdtemp/;
const CHANGEMENT_VERS_MCP = /\b(?:cd|set-location|pushd|sl)\s+[^;\n|&]*mcp/;
const CWD_MCP = /[\\/]mcp(?:-scores)?[\\/]*$/;
const LANCEMENT_CHECK_REPORT = /\/check-report|tu es correcteur\. tu compares un livrable/;
const OUTIL_ECRITURE = /create|replace|insert|edit|patch|write/i;

// Chemins encodés en URI, accents : « r%C3%A8gles-m%C3%A9tier » devient « regles-metier ».
function normaliser(texte) {
  return texte
    .replace(/(%[0-9a-f]{2})+/gi, (sequence) => {
      try {
        return decodeURIComponent(sequence);
      } catch {
        return sequence;
      }
    })
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Fichiers visés par un outil d'écriture : champs de chemin et en-têtes d'un patch.
// Le contenu écrit n'est pas testé : un rapport peut citer NOTES-TP ou le référentiel.
// « file_text » (outil create de Copilot CLI) est un contenu, pas un chemin.
function fichiersEcrits(valeur, cle = '') {
  if (typeof valeur === 'string') {
    const entetes = [...valeur.matchAll(/\*\*\* (?:add|update|delete) file: (.+)/gi)].map(
      (m) => m[1],
    );
    return /path|uri|file/i.test(cle) && !/text|content|string|body/i.test(cle)
      ? [valeur, ...entetes]
      : entetes;
  }
  if (valeur && typeof valeur === 'object') {
    return Object.entries(valeur).flatMap(([k, v]) =>
      fichiersEcrits(v, Array.isArray(valeur) ? cle : k),
    );
  }
  return [];
}

// Chemins, commandes et recherches d'un appel d'outil, sans le texte libre ni le contenu écrit.
// scores.json est cité dans le prompt du TP, donc dans les plans et listes de tâches de l'agent :
// tester toute l'entrée de l'outil bloquerait la génération du serveur.
function cheminsEtCommandes(valeur, cle = '') {
  if (typeof valeur === 'string') {
    return /command|query|pattern|glob/i.test(cle) ? [valeur] : fichiersEcrits(valeur, cle);
  }
  if (valeur && typeof valeur === 'object') {
    return Object.entries(valeur).flatMap(([k, v]) =>
      cheminsEtCommandes(v, Array.isArray(valeur) ? cle : k),
    );
  }
  return [];
}

function marqueur(evenement) {
  const session = String(evenement.session_id ?? evenement.sessionId ?? '');
  return session && path.join(SESSIONS_CHECK_REPORT, session.replace(/[^\w-]/g, '_'));
}

function refuser(raison) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: raison,
      },
    }),
  );
}

function lireParametres(evenement) {
  const parametres = evenement.tool_input ?? evenement.toolInput;
  if (typeof parametres !== 'string') return parametres;
  try {
    return JSON.parse(parametres);
  } catch {
    return parametres;
  }
}

function noterCheckReport(evenement, fichier) {
  if (fichier && LANCEMENT_CHECK_REPORT.test(normaliser(String(evenement.prompt ?? '')))) {
    fs.mkdirSync(SESSIONS_CHECK_REPORT, { recursive: true });
    fs.writeFileSync(fichier, '');
  }
}

function viseScoresBorne(evenement) {
  const texte = normaliser(cheminsEtCommandes(lireParametres(evenement)).join('\n'));
  if (!RESERVE_SCORES.test(texte)) return false;
  if (SCORES_BORNE.test(texte)) return true;
  const cwd = normaliser(String(evenement.cwd ?? ''));
  return !DOSSIER_TEMP.test(texte) || CHANGEMENT_VERS_MCP.test(texte) || CWD_MCP.test(cwd);
}

function controlerAppel(evenement, texte, fichier) {
  if (viseScoresBorne(evenement)) {
    refuser(
      'Scores de la borne : les agents passent par les outils du serveur MCP, pas par le fichier.',
    );
  } else if (OUTIL_ECRITURE.test(String(evenement.tool_name ?? evenement.toolName ?? ''))) {
    const cibles = fichiersEcrits(lireParametres(evenement));
    if (RESERVE_STAGIAIRE.test(cibles.length ? normaliser(cibles.join('\n')) : texte)) {
      refuser('Fichier réservé au stagiaire : les agents ne doivent pas le modifier.');
    } else if (RESERVE_MCP.test(cibles.length ? normaliser(cibles.join('\n')) : texte)) {
      refuser('Fichier interne du serveur MCP : les agents ne doivent pas le modifier.');
    }
  } else if (RESERVE_STAGIAIRE.test(texte)) {
    refuser('Fichier réservé au stagiaire : les agents ne doivent pas le lire.');
  } else if (RESERVE_MCP.test(texte)) {
    refuser('Fichier interne du serveur MCP : les agents ne doivent pas le lire.');
  } else if (RESERVE_CHECK_REPORT.test(texte) && !(fichier && fs.existsSync(fichier))) {
    refuser(
      'Fichier réservé à /check-report (référentiel ou rapport) : les agents ne doivent pas le lire.',
    );
  }
}

let entree = '';
process.stdin.on('data', (morceau) => (entree += morceau));
process.stdin.on('end', () => {
  let evenement = {};
  try {
    evenement = JSON.parse(entree);
  } catch {}
  const texte = normaliser(Object.keys(evenement).length ? JSON.stringify(evenement) : entree);
  const fichier = marqueur(evenement);

  if ((evenement.hook_event_name ?? evenement.hookEventName) === 'UserPromptSubmit') {
    noterCheckReport(evenement, fichier);
  } else {
    controlerAppel(evenement, texte, fichier);
  }
  process.exit(0);
});

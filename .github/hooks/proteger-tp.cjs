// Protège les fichiers réservés :
// - NOTES-TP.md, la grille du stagiaire : aucun agent ne la lit ni ne l'écrit ;
// - le référentiel des règles et les rapports (règles-métier*.md) : les agents écrivent
//   leurs rapports, mais seule une session lancée par /check-report peut les lire.
// UserPromptSubmit note les sessions lancées par /check-report ; PreToolUse refuse
// les appels d'outils qui visent un fichier protégé.
// Pour une lecture, on teste l'entrée complète de l'outil plutôt qu'un champ précis :
// le nom de l'outil et de ses paramètres varie selon la version de VS Code.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SESSIONS_CHECK_REPORT = path.join(os.tmpdir(), 'formation-copilot-check-report');
const RESERVE_STAGIAIRE = /notes[-_ ]?tp/;
const RESERVE_CHECK_REPORT = /referentiel-regles|regles-metier/;
const RESERVE_MCP = /serveur-scores|scores-tournoi\.json|sink\.mjs|mcp[\\/_ -]*readme/;
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
function fichiersEcrits(valeur, cle = '') {
  if (typeof valeur === 'string') {
    const entetes = [...valeur.matchAll(/\*\*\* (?:add|update|delete) file: (.+)/gi)].map((m) => m[1]);
    return /path|uri|file/i.test(cle) ? [valeur, ...entetes] : entetes;
  }
  if (valeur && typeof valeur === 'object') {
    return Object.entries(valeur).flatMap(([k, v]) => fichiersEcrits(v, Array.isArray(valeur) ? cle : k));
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

function controlerAppel(evenement, texte, fichier) {
  if (OUTIL_ECRITURE.test(String(evenement.tool_name ?? evenement.toolName ?? ''))) {
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
    refuser('Fichier réservé à /check-report (référentiel ou rapport) : les agents ne doivent pas le lire.');
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

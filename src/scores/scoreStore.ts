/**
 * Scores de l'arcade, partagés par tous les jeux et conservés dans le localStorage.
 * Les scores initiaux viennent de mcp-scores/scores.json, via synchroniserScores().
 */

export interface Score {
  readonly jeu: string;
  readonly pseudo: string;
  readonly points: number;
  /** Date ISO 8601. */
  readonly date: string;
  /** Durée de la partie, en millisecondes. */
  readonly dureeMs: number;
}

const CLE = 'arcade:scores';

function estScore(valeur: unknown): valeur is Score {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const score = valeur as Record<string, unknown>;
  return (
    typeof score.jeu === 'string' &&
    typeof score.pseudo === 'string' &&
    typeof score.points === 'number' &&
    typeof score.date === 'string'
  );
}

function lireStockage(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

export function lireScores(): Score[] {
  const brut = lireStockage();
  if (brut === null) return [];

  try {
    const donnees: unknown = JSON.parse(brut);
    return Array.isArray(donnees) ? donnees.filter(estScore) : [];
  } catch {
    return [];
  }
}

export function ajouterScore(jeu: string, pseudo: string, points: number, dureeMs: number): Score {
  const score: Score = { jeu, pseudo, points, date: new Date().toISOString(), dureeMs };
  try {
    localStorage.setItem(CLE, JSON.stringify([...lireScores(), score]));
  } catch {
    // Stockage plein ou interdit : le score est perdu, la partie continue.
  }
  envoyerScores([score]);
  return score;
}

/** Route du serveur de dev qui partage les scores avec le serveur MCP (voir vite.config.ts). */
const API_SCORES = '/api/scores';

function cleScore(score: Score): string {
  return `${score.jeu}|${score.pseudo}|${score.points}|${score.date}`;
}

function envoyerScores(scores: readonly Score[]): void {
  fetch(API_SCORES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scores),
  }).catch(() => {
    // Pas de serveur de dev (build statique) : les scores restent dans le localStorage.
  });
}

/**
 * Fusionne les scores de mcp-scores/scores.json (dont ceux ajoutés par le serveur MCP) avec
 * ceux du localStorage, puis envoie au fichier ceux qu'il ne connaît pas encore.
 * Sans serveur de dev, ne fait rien.
 */
export async function synchroniserScores(): Promise<void> {
  let distants: Score[];
  try {
    const reponse = await fetch(API_SCORES);
    const donnees: unknown = reponse.ok ? await reponse.json() : null;
    if (!Array.isArray(donnees)) return;
    distants = donnees.filter(estScore);
  } catch {
    return;
  }

  const locaux = lireScores();
  const clesLocales = new Set(locaux.map(cleScore));
  const clesDistantes = new Set(distants.map(cleScore));
  const absentsEnLocal = distants.filter((score) => !clesLocales.has(cleScore(score)));
  const absentsDuFichier = locaux.filter((score) => !clesDistantes.has(cleScore(score)));

  if (absentsEnLocal.length > 0) {
    try {
      localStorage.setItem(CLE, JSON.stringify([...locaux, ...absentsEnLocal]));
    } catch {
      // Stockage plein ou interdit : la borne affichera ses seuls scores locaux.
    }
  }
  if (absentsDuFichier.length > 0) envoyerScores(absentsDuFichier);
}

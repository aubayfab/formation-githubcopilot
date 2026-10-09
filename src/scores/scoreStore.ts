/**
 * Scores de l'arcade, partagés par tous les jeux et stockés dans mcp-scores/scores.json,
 * que le serveur de dev lit et complète via la route /api/scores (voir vite.config.ts).
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

const API_SCORES = '/api/scores';

/** Scores du fichier, chargés au démarrage par chargerScores() puis complétés à chaque partie. */
let scores: Score[] = [];

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

export async function chargerScores(): Promise<void> {
  try {
    const reponse = await fetch(API_SCORES);
    const donnees: unknown = reponse.ok ? await reponse.json() : null;
    if (Array.isArray(donnees)) scores = donnees.filter(estScore);
  } catch {
    // Pas de serveur de dev (build statique) : le tableau démarre vide.
  }
}

export function lireScores(): Score[] {
  return [...scores];
}

export function ajouterScore(jeu: string, pseudo: string, points: number, dureeMs: number): Score {
  const score: Score = { jeu, pseudo, points, date: new Date().toISOString(), dureeMs };
  scores.push(score);
  fetch(API_SCORES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(score),
  }).catch(() => {
    // Pas de serveur de dev : le score reste affiché jusqu'au rechargement de la page.
  });
  return score;
}

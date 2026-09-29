import type { Score } from './scoreStore';

const COLONNES = ['jeu', 'pseudo', 'points', 'date'] as const;
const SEPARATEUR = ';';

/** Sérialise des scores pour un tableur : une ligne d'en-tête, puis une ligne par score. */
export function versCsv(scores: readonly Score[]): string {
  const lignes = scores.map((score) =>
    [score.jeu, score.pseudo, String(score.points), score.date].join(SEPARATEUR),
  );
  return [COLONNES.join(SEPARATEUR), ...lignes].join('\n');
}

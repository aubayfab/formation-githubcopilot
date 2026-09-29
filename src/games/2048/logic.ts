/**
 * Logique de 2048 : chronométrage de la partie.
 */

export interface Chrono {
  /** Temps de jeu cumulé, en millisecondes. */
  readonly tempsEcoule: number;
  /** Instant du dernier relevé, en millisecondes. */
  readonly dernierReleve: number;
}

export function demarrerChrono(instant: number): Chrono {
  return { tempsEcoule: 0, dernierReleve: instant };
}

export function releverChrono(chrono: Chrono, instant: number): Chrono {
  return {
    tempsEcoule: chrono.tempsEcoule + (instant - chrono.dernierReleve),
    dernierReleve: instant,
  };
}

export function dureePartie(chrono: Chrono): number {
  const dureeMs = Math.round(chrono.tempsEcoule);
  return dureeMs;
}

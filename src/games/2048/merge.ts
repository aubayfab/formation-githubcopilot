/**
 * Fusion d'une ligne de 2048 vers la gauche. Une case vide vaut 0.
 * Chaque tuile fusionne au plus une fois par mouvement.
 */

export function merge(ligne: readonly number[]): number[] {
  const tuiles = ligne.filter((valeur) => valeur !== 0);
  const fusionnees: number[] = [];

  for (let i = 0; i < tuiles.length; i++) {
    if (tuiles[i] === tuiles[i + 1]) {
      fusionnees.push(tuiles[i] * 2);
      i++;
    } else {
      fusionnees.push(tuiles[i]);
    }
  }

  return [...fusionnees, ...Array<number>(ligne.length - fusionnees.length).fill(0)];
}

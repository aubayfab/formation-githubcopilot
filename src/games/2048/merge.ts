/**
 * Fusion d'une ligne de 2048 vers la gauche. Une case vide vaut 0.
 */

function prochaineTuile(cases: readonly number[], depuis: number): number {
  for (let i = depuis; i < cases.length; i++) {
    if (cases[i] !== 0) return i;
  }
  return -1;
}

function remonter(cases: number[], position: number): number {
  let i = position;
  while (i > 0 && cases[i - 1] === cases[i]) {
    cases[i - 1] *= 2;
    cases[i] = 0;
    i--;
  }
  return i;
}

export function merge(ligne: readonly number[]): number[] {
  const tuiles = ligne.filter((valeur) => valeur !== 0);
  const cases = [...tuiles, ...Array<number>(ligne.length - tuiles.length).fill(0)];

  for (let cible = 0; cible < cases.length; cible++) {
    const source = prochaineTuile(cases, cible + 1);
    if (source === -1) break;

    if (cases[cible] === 0) {
      cases[cible] = cases[source];
      cases[source] = 0;
    } else if (cases[cible] === cases[source]) {
      cases[cible] *= 2;
      cases[source] = 0;
      cible = remonter(cases, cible);
    }
  }

  return cases;
}

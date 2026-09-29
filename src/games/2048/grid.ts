/**
 * Grille de 2048 : rotations, déplacement dans les quatre sens et apparition de tuile.
 */

import { merge } from './merge';

export type Grille = readonly (readonly number[])[];
export type Sens = 'haut' | 'bas' | 'gauche' | 'droite';

export interface Position {
  readonly ligne: number;
  readonly colonne: number;
}

export interface Glissement {
  readonly valeur: number;
  readonly depart: Position;
  readonly arrivee: Position;
}

export interface Deplacement {
  readonly grille: number[][];
  readonly points: number;
  readonly bouge: boolean;
  readonly glissements: Glissement[];
  readonly fusions: Position[];
}

export const TAILLE = 4;

/** Quarts de tour horaires qui ramènent chaque sens à un glissement vers la gauche. */
const QUARTS: Readonly<Record<Sens, number>> = { gauche: 0, bas: 1, droite: 2, haut: 3 };

export function grilleVide(taille = TAILLE): number[][] {
  return Array.from({ length: taille }, () => Array<number>(taille).fill(0));
}

/** Quart de tour dans le sens horaire. */
export function tourner(grille: Grille): number[][] {
  const taille = grille.length;
  return grille.map((_, ligne) => grille.map((__, colonne) => grille[taille - 1 - colonne][ligne]));
}

function tournerPlusieursFois(grille: Grille, quarts: number): number[][] {
  let resultat = grille.map((ligne) => [...ligne]);
  for (let i = 0; i < quarts; i++) resultat = tourner(resultat);
  return resultat;
}

function tournerPosition(position: Position, quarts: number, taille: number): Position {
  let { ligne, colonne } = position;
  for (let i = 0; i < quarts; i++) {
    [ligne, colonne] = [colonne, taille - 1 - ligne];
  }
  return { ligne, colonne };
}

/** Somme des points qu'il a fallu marquer pour former chaque tuile de la grille. */
function valeurCumulee(grille: Grille): number {
  return grille
    .flat()
    .reduce((total, valeur) => total + (valeur > 2 ? valeur * (Math.log2(valeur) - 1) : 0), 0);
}

function suivreLigne(
  avant: readonly number[],
  apres: readonly number[],
  ligne: number,
  glissements: Glissement[],
  fusions: Position[],
): void {
  const sources = avant.flatMap((valeur, colonne) => (valeur ? [{ valeur, colonne }] : []));
  let suivante = 0;

  apres.forEach((valeur, colonne) => {
    if (!valeur) return;
    let cumul = 0;
    let assemblees = 0;
    while (cumul < valeur && suivante < sources.length) {
      const source = sources[suivante];
      glissements.push({
        valeur: source.valeur,
        depart: { ligne, colonne: source.colonne },
        arrivee: { ligne, colonne },
      });
      cumul += source.valeur;
      assemblees++;
      suivante++;
    }
    if (assemblees > 1) fusions.push({ ligne, colonne });
  });
}

export function deplacer(grille: Grille, sens: Sens): Deplacement {
  const taille = grille.length;
  const quarts = QUARTS[sens];
  const retour = (4 - quarts) % 4;
  const glissements: Glissement[] = [];
  const fusions: Position[] = [];

  const lignes = tournerPlusieursFois(grille, quarts).map((ligne, rang) => {
    const fusionnee = merge(ligne);
    suivreLigne(ligne, fusionnee, rang, glissements, fusions);
    return fusionnee;
  });
  const resultat = tournerPlusieursFois(lignes, retour);
  const versGrille = (position: Position) => tournerPosition(position, retour, taille);

  return {
    grille: resultat,
    points: valeurCumulee(resultat) - valeurCumulee(grille),
    bouge: resultat.some((ligne, l) => ligne.some((valeur, c) => valeur !== grille[l][c])),
    glissements: glissements.map((glissement) => ({
      valeur: glissement.valeur,
      depart: versGrille(glissement.depart),
      arrivee: versGrille(glissement.arrivee),
    })),
    fusions: fusions.map(versGrille),
  };
}

export function casesVides(grille: Grille): Position[] {
  return grille.flatMap((ligne, l) =>
    ligne.flatMap((valeur, colonne) => (valeur === 0 ? [{ ligne: l, colonne }] : [])),
  );
}

export function faireApparaitre(
  grille: Grille,
  aleatoire: () => number = Math.random,
): { grille: number[][]; position: Position | null } {
  const copie = grille.map((ligne) => [...ligne]);
  const vides = casesVides(grille);
  if (vides.length === 0) return { grille: copie, position: null };

  const position = vides[Math.floor(aleatoire() * vides.length)];
  copie[position.ligne][position.colonne] = aleatoire() < 0.9 ? 2 : 4;
  return { grille: copie, position };
}

export function plusGrandeTuile(grille: Grille): number {
  return Math.max(0, ...grille.flat());
}

export function peutJouer(grille: Grille): boolean {
  return (Object.keys(QUARTS) as Sens[]).some((sens) => deplacer(grille, sens).bouge);
}

/**
 * Logique de Snake.
 * L'état est immuable : chaque fonction renvoie un nouvel état, sans toucher au DOM.
 */

export type Direction = 'haut' | 'bas' | 'gauche' | 'droite';

export type Issue = 'en-cours' | 'mur' | 'morsure' | 'grille-pleine';

export interface Cellule {
  readonly x: number;
  readonly y: number;
}

export interface EtatSnake {
  readonly colonnes: number;
  readonly lignes: number;
  /** Tête en premier. */
  readonly corps: readonly Cellule[];
  readonly direction: Direction;
  /** Virages demandés entre deux pas, appliqués un par pas. */
  readonly virages: readonly Direction[];
  readonly pomme: Cellule;
  readonly pommes: number;
  readonly score: number;
  readonly issue: Issue;
  /** Horodatage du début de partie, en millisecondes. */
  readonly debutPartie: number;
  /** Horodatage du dernier pas, en millisecondes. */
  readonly dernierPas: number;
  /** Délai entre deux pas, en millisecondes. */
  readonly intervalle: number;
}

export const COLONNES = 30;
export const LIGNES = 20;
export const POINTS_PAR_POMME = 100;
export const INTERVALLE_INITIAL = 130;
export const INTERVALLE_MINIMAL = 55;

/** Gain de vitesse par pomme mangée, en millisecondes. */
const ACCELERATION = 3;
const VIRAGES_MAX = 2;

const VECTEURS: Readonly<Record<Direction, Cellule>> = {
  haut: { x: 0, y: -1 },
  bas: { x: 0, y: 1 },
  gauche: { x: -1, y: 0 },
  droite: { x: 1, y: 0 },
};

const OPPOSEES: Readonly<Record<Direction, Direction>> = {
  haut: 'bas',
  bas: 'haut',
  gauche: 'droite',
  droite: 'gauche',
};

export function memeCellule(a: Cellule, b: Cellule): boolean {
  return a.x === b.x && a.y === b.y;
}

export function estTerminee(etat: EtatSnake): boolean {
  return etat.issue !== 'en-cours';
}

/** Temps écoulé entre le début de la partie et le dernier pas. */
export function dureePartie(etat: EtatSnake): number {
  const dureeMs = etat.dernierPas - etat.debutPartie;
  return dureeMs;
}

function horsGrille(cellule: Cellule, colonnes: number, lignes: number): boolean {
  return cellule.x < 0 || cellule.y < 0 || cellule.x >= colonnes || cellule.y >= lignes;
}

function placerPomme(colonnes: number, lignes: number, corps: readonly Cellule[]): Cellule | null {
  const libres: Cellule[] = [];
  for (let y = 0; y < lignes; y++) {
    for (let x = 0; x < colonnes; x++) {
      const cellule = { x, y };
      if (!corps.some((segment) => memeCellule(segment, cellule))) libres.push(cellule);
    }
  }
  if (libres.length === 0) return null;
  return libres[Math.floor(Math.random() * libres.length)];
}

/** Serpent de trois cases au centre de la grille, tourné vers la droite. */
export function creerEtat(colonnes = COLONNES, lignes = LIGNES): EtatSnake {
  const tete = { x: Math.floor(colonnes / 2), y: Math.floor(lignes / 2) };
  const corps = [tete, { x: tete.x - 1, y: tete.y }, { x: tete.x - 2, y: tete.y }];

  return {
    colonnes,
    lignes,
    corps,
    direction: 'droite',
    virages: [],
    pomme: placerPomme(colonnes, lignes, corps) ?? tete,
    pommes: 0,
    score: 0,
    issue: 'en-cours',
    debutPartie: Date.now(),
    dernierPas: Date.now(),
    intervalle: INTERVALLE_INITIAL,
  };
}

/** Mémorise un virage. Le demi-tour et la répétition de la direction sont ignorés. */
export function orienter(etat: EtatSnake, direction: Direction): EtatSnake {
  if (estTerminee(etat) || etat.virages.length >= VIRAGES_MAX) return etat;

  const reference = etat.virages.at(-1) ?? etat.direction;
  if (direction === reference || direction === OPPOSEES[reference]) return etat;

  return { ...etat, virages: [...etat.virages, direction] };
}

/** Avance d'une case si l'intervalle est écoulé, sinon renvoie l'état tel quel. */
export function tick(etat: EtatSnake): EtatSnake {
  if (estTerminee(etat)) return etat;

  const maintenant = Date.now();
  if (maintenant - etat.dernierPas < etat.intervalle) return etat;

  const [direction = etat.direction, ...virages] = etat.virages;
  const tete = etat.corps[0];
  const vecteur = VECTEURS[direction];
  const suivante = { x: tete.x + vecteur.x, y: tete.y + vecteur.y };
  const mange = memeCellule(suivante, etat.pomme);
  const pas = { direction, virages, dernierPas: maintenant };

  // La queue libère sa case pendant le pas, sauf quand le serpent grandit.
  const reste = mange ? etat.corps : etat.corps.slice(0, -1);

  if (horsGrille(suivante, etat.colonnes, etat.lignes)) {
    return { ...etat, ...pas, issue: 'mur' };
  }
  if (reste.some((segment) => memeCellule(segment, suivante))) {
    return { ...etat, ...pas, issue: 'morsure' };
  }

  const corps = [suivante, ...reste];
  if (!mange) return { ...etat, ...pas, corps };

  const pommes = etat.pommes + 1;
  const pomme = placerPomme(etat.colonnes, etat.lignes, corps);

  return {
    ...etat,
    ...pas,
    corps,
    pommes,
    score: etat.score + POINTS_PAR_POMME,
    intervalle: Math.max(INTERVALLE_MINIMAL, INTERVALLE_INITIAL - pommes * ACCELERATION),
    pomme: pomme ?? suivante,
    issue: pomme ? 'en-cours' : 'grille-pleine',
  };
}

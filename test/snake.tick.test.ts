import { describe, expect, it } from 'vitest';
import {
  POINTS_PAR_POMME,
  creerEtat,
  memeCellule,
  orienter,
  tick,
  type Direction,
  type EtatSnake,
} from '../src/games/snake/logic';

/** Rend le pas exigible tout de suite, sans attendre la fin de l'intervalle. */
function avancer(etat: EtatSnake): EtatSnake {
  return tick({ ...etat, dernierPas: 0 });
}

describe('tick', () => {
  it('attend la fin de l’intervalle avant de bouger', () => {
    const etat = creerEtat(8, 6);
    expect(tick(etat)).toBe(etat);
  });

  it('avance d’une case dans la direction courante', () => {
    const etat = avancer(creerEtat(8, 6));
    expect(etat.corps[0]).toEqual({ x: 5, y: 3 });
    expect(etat.issue).toBe('en-cours');
  });

  it('ignore le demi-tour', () => {
    const etat = avancer(orienter(creerEtat(8, 6), 'gauche'));
    expect(etat.direction).toBe('droite');
    expect(etat.corps[0]).toEqual({ x: 5, y: 3 });
  });

  it('grandit et marque des points en mangeant la pomme', () => {
    const etat = avancer({ ...creerEtat(8, 6), pomme: { x: 5, y: 3 } });
    expect(etat.corps).toHaveLength(4);
    expect(etat.score).toBe(POINTS_PAR_POMME);
    expect(etat.corps.some((segment) => memeCellule(segment, etat.pomme))).toBe(false);
  });

  it('s’arrête contre un mur', () => {
    let etat = creerEtat(8, 6);
    for (let pas = 0; pas < 4; pas++) etat = avancer(etat);
    expect(etat.issue).toBe('mur');
  });

  it('s’arrête en se mordant la queue', () => {
    const etat: EtatSnake = {
      ...creerEtat(8, 6),
      corps: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 2 },
        { x: 3, y: 1 },
      ],
      direction: 'haut',
      pomme: { x: 0, y: 0 },
    };
    expect(avancer(orienter(etat, 'droite')).issue).toBe('morsure');
  });

  it('enchaîne plusieurs virages après un repas', () => {
    let etat: EtatSnake = { ...creerEtat(8, 6), pomme: { x: 5, y: 3 } };
    const parcours: Direction[] = [
      'droite',
      'bas',
      'bas',
      'gauche',
      'gauche',
      'gauche',
      'gauche',
      'haut',
      'haut',
      'haut',
    ];

    for (const direction of parcours) {
      etat = avancer(orienter(etat, direction));
    }

    expect(etat.issue).toBe('en-cours');
    expect(etat.corps[0]).toEqual({ x: 1, y: 2 });
    expect(etat.score).toBe(POINTS_PAR_POMME);
    expect(etat.corps).toHaveLength(4);
  });
});

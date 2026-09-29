import { describe, expect, it } from 'vitest';
import { merge } from '../src/games/2048/merge';

describe('merge', () => {
  it('fait glisser les tuiles vers la gauche', () => {
    expect(merge([0, 2, 0, 4])).toEqual([2, 4, 0, 0]);
    expect(merge([0, 0, 0, 8])).toEqual([8, 0, 0, 0]);
  });

  it('fusionne une paire de tuiles égales', () => {
    expect(merge([2, 2, 0, 0])).toEqual([4, 0, 0, 0]);
    expect(merge([0, 4, 0, 4])).toEqual([8, 0, 0, 0]);
  });

  it('fusionne en priorité les tuiles les plus à gauche', () => {
    expect(merge([2, 2, 2, 0])).toEqual([4, 2, 0, 0]);
  });

  it('ne fusionne chaque tuile qu’une fois par mouvement', () => {
    expect(merge([2, 2, 4, 4])).toEqual([4, 8, 0, 0]);
    expect(merge([4, 2, 2, 0])).toEqual([4, 4, 0, 0]);
  });

  it('laisse intacte une ligne sans paire', () => {
    expect(merge([2, 4, 8, 16])).toEqual([2, 4, 8, 16]);
  });

  it('ne modifie pas la ligne reçue', () => {
    const ligne = [2, 2, 0, 4];
    merge(ligne);
    expect(ligne).toEqual([2, 2, 0, 4]);
  });
});

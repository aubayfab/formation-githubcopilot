/**
 * Snake : boucle de jeu, clavier et enregistrement du score.
 */

import { enregistrerJeu, nomDuJeu, type ContexteJeu } from '../../shell/menu';
import { ajouterScore, lireScores } from '../../scores/scoreStore';
import {
  addEntry,
  addPoints,
  countGame,
  hiscore,
  hiscoreHolder,
  lastPlayer,
  rememberPlayer,
  setHiscore,
  setLastScore,
} from '../../legacy/scoreStore.v1';
import { creerEtat, dureePartie, estTerminee, orienter, tick, type EtatSnake } from './logic';
import { dessinerSnake, type PaletteSnake } from './render';

const ID = 'snake';
const DUREE_COMPTE_A_REBOURS = 1500;
const PAUSE_AVANT_SAISIE = 1100;
const MESSAGE_REJOUER = 'ENTRÉE REJOUER · ÉCHAP MENU';

function lirePalette(contexte: ContexteJeu): PaletteSnake {
  return {
    fond: contexte.couleur('--ecran-fond'),
    grille: contexte.couleur('--neon-cyan'),
    tete: contexte.couleur('--neon-vert'),
    queue: contexte.couleur('--neon-turquoise'),
    pomme: contexte.couleur('--neon-rose'),
    feuille: contexte.couleur('--neon-vert'),
    texte: contexte.couleur('--texte-ecran'),
    discret: contexte.couleur('--texte-discret'),
    accent: contexte.couleur('--neon-jaune'),
    alerte: contexte.couleur('--neon-rouge'),
    sobre: contexte.sobre,
  };
}

function meilleurScoreArcade(): { points: number; pseudo: string } {
  const scores = lireScores().filter((score) => score.jeu === ID);
  const meilleur = scores.sort((a, b) => b.points - a.points)[0];
  return meilleur ?? { points: 0, pseudo: '' };
}

function attendre(duree: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, duree));
}

function lancer(contexte: ContexteJeu): () => void {
  const palette = lirePalette(contexte);
  const nom = nomDuJeu(ID);
  let etat: EtatSnake = creerEtat();
  let record = 0;
  let detenteur = '';
  let depart = 0;
  let bouchee = 0;
  let finie = 0;
  let message: string | null = null;
  let actif = true;
  let image = 0;

  function nouvellePartie(instant: number): void {
    countGame(ID);
    const arcade = meilleurScoreArcade();
    const local = hiscore(ID);
    record = Math.max(local, arcade.points);
    detenteur = local >= arcade.points ? hiscoreHolder(ID) : arcade.pseudo.split('\n')[0];

    etat = creerEtat();
    depart = instant + DUREE_COMPTE_A_REBOURS;
    bouchee = 0;
    finie = 0;
    message = null;
  }

  async function terminer(instant: number): Promise<void> {
    const points = etat.score;
    const duree = dureePartie(etat);
    finie = instant;
    contexte.jouerSon('perdu');
    setLastScore(ID, points);
    addPoints(ID, points);

    await attendre(PAUSE_AVANT_SAISIE);
    if (!actif) return;

    if (points > 0) {
      const pseudo = await contexte.demanderPseudo(points, lastPlayer());
      if (!actif) return;
      if (pseudo) {
        ajouterScore(ID, pseudo, points, duree);
        rememberPlayer(pseudo);
        addEntry(ID, pseudo, points);
        if (setHiscore(ID, points, pseudo)) contexte.jouerSon('record');
      }
    }
    message = MESSAGE_REJOUER;
  }

  function boucle(instant: number): void {
    if (!actif) return;

    if (instant >= depart && !finie && pasEcoule(etat, contexte.lenteur)) {
      const precedent = etat;
      etat = tick(etat);
      if (etat.pommes > precedent.pommes) {
        bouchee = instant;
        contexte.jouerSon('croque');
      }
      if (estTerminee(etat)) void terminer(instant);
    }

    dessinerSnake(
      contexte.ctx,
      { nom, etat, record, detenteur, instant, depart, bouchee, finie, message },
      palette,
    );
    image = requestAnimationFrame(boucle);
  }

  contexte.surAction((action) => {
    if (action === 'valider') {
      if (message) {
        contexte.jouerSon('validation');
        nouvellePartie(performance.now());
      }
      return;
    }
    etat = orienter(etat, action);
  });

  nouvellePartie(performance.now());
  image = requestAnimationFrame(boucle);

  return () => {
    actif = false;
    cancelAnimationFrame(image);
  };
}

/** Le serpent n'avance qu'une fois son intervalle écoulé, multiplié par la lenteur du thème. */
function pasEcoule(etat: EtatSnake, lenteur: number): boolean {
  return Date.now() - etat.dernierPas >= etat.intervalle * lenteur;
}

enregistrerJeu({
  id: ID,
  accroche: 'Mangez, grandissez, évitez votre queue.',
  teinte: '--neon-vert',
  icone: [
    '.........',
    '.#####...',
    '.#.......',
    '.#.......',
    '.#####...',
    '.....#...',
    '.....#.@.',
    '######...',
    '.........',
  ],
  lancer,
});

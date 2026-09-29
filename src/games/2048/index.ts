import { enregistrerJeu, nomDuJeu, type ContexteJeu } from '../../shell/menu';
import { ajouterScore, lireScores } from '../../scores/scoreStore';
import {
  addEntry,
  addPoints,
  bestTile,
  countGame,
  gamesPlayed,
  hiscore,
  hiscoreHolder,
  lastPlayer,
  rememberPlayer,
  setBestTile,
  setHiscore,
  setLastScore,
} from '../../legacy/scoreStore.v1';
import {
  deplacer,
  faireApparaitre,
  grilleVide,
  peutJouer,
  plusGrandeTuile,
  type Glissement,
  type Grille,
  type Position,
  type Sens,
} from './grid';
import { demarrerChrono, dureePartie, releverChrono, type Chrono } from './logic';
import { DUREE_GLISSEMENT, dessinerGame2048, type PaletteGame2048 } from './render';

const ID = '2048';
const VALEURS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
/** Taille du jeu en thème sobre, pour qu'il occupe moins l'écran. */
const ECHELLE_SOBRE = 0.7;

function palette(ctx: ContexteJeu): PaletteGame2048 {
  const tuiles: Record<number, string> = {};
  for (const v of VALEURS) tuiles[v] = ctx.couleur('--tuile-' + v);
  return {
    fond: ctx.couleur('--ecran-fond'),
    plateau: ctx.couleur('--plateau-game2048'),
    caseVide: ctx.couleur('--case-game2048'),
    texte: ctx.couleur('--texte-ecran'),
    discret: ctx.couleur('--texte-discret'),
    titre: ctx.couleur('--neon-rose'),
    accent: ctx.couleur('--neon-jaune'),
    alerte: ctx.couleur('--neon-rouge'),
    tuiles,
    lenteur: ctx.lenteur,
    echelle: ctx.sobre ? ECHELLE_SOBRE : 1,
  };
}

function lancer(contexte: ContexteJeu) {
  const couleurs = palette(contexte);
  const nom = nomDuJeu(ID);
  let grille: Grille = grilleVide();
  let glissements: Glissement[] = [];
  let fusions: Position[] = [];
  let apparitions: Position[] = [];
  let dernierCoup = 0;
  let chrono: Chrono = demarrerChrono(0);
  let score = 0;
  let coups = 0;
  let record = 0;
  let partie = 0;
  let meilleureTuile = 0;
  let gain = 0;
  let instantGain = 0;
  let victoire = 0;
  let finie = 0;
  let annonce: string | null = null;
  let message: string | null = null;
  let actif = true;
  let image = 0;

  function nouvellePartie() {
    countGame(ID);
    partie = gamesPlayed(ID);
    const meilleurArcade = Math.max(
      0,
      ...lireScores()
        .filter((s) => s.jeu === ID)
        .map((s) => s.points),
    );
    record = Math.max(hiscore(ID), meilleurArcade);
    meilleureTuile = bestTile(ID);

    const a = faireApparaitre(grilleVide());
    const b = faireApparaitre(a.grille);
    grille = b.grille;
    apparitions = [a.position, b.position].filter((p): p is Position => p !== null);
    glissements = [];
    fusions = [];
    dernierCoup = performance.now();
    chrono = demarrerChrono(dernierCoup);
    score = 0;
    coups = 0;
    gain = 0;
    victoire = 0;
    finie = 0;
    annonce = null;
    message = null;
  }

  async function terminer(instant: number) {
    const duree = dureePartie(chrono);
    finie = instant;
    contexte.jouerSon('perdu');
    setLastScore(ID, score);
    const ancienDetenteur = hiscoreHolder(ID);

    await new Promise((r) => setTimeout(r, 1200));
    if (!actif) return;

    if (score > 0) {
      const pseudo = await contexte.demanderPseudo(score, lastPlayer());
      if (!actif) return;
      if (pseudo) {
        ajouterScore(ID, pseudo, score, duree);
        rememberPlayer(pseudo);
        addEntry(ID, pseudo, score);
        if (setHiscore(ID, score, pseudo)) {
          annonce =
            ancienDetenteur === '---'
              ? 'NOUVEAU RECORD !'
              : `RECORD DE ${ancienDetenteur.toUpperCase()} BATTU !`;
          contexte.jouerSon('record');
        }
      }
    }
    message = 'ENTRÉE REJOUER · ÉCHAP MENU';
  }

  function jouer(sens: Sens) {
    const maintenant = performance.now();
    if (finie || maintenant - dernierCoup < DUREE_GLISSEMENT) return;

    const resultat = deplacer(grille, sens);
    if (!resultat.bouge) return;

    const apparition = faireApparaitre(resultat.grille);
    grille = apparition.grille;
    glissements = resultat.glissements;
    fusions = resultat.fusions;
    apparitions = apparition.position ? [apparition.position] : [];
    dernierCoup = maintenant;
    chrono = releverChrono(chrono, maintenant);
    coups++;

    if (resultat.points > 0) {
      score += resultat.points;
      addPoints(ID, resultat.points);
      gain = resultat.points;
      instantGain = maintenant;
      contexte.jouerSon('fusion');
    } else {
      contexte.jouerSon('glisse');
    }

    const plusGrande = plusGrandeTuile(grille);
    if (plusGrande > meilleureTuile) {
      meilleureTuile = plusGrande;
      setBestTile(ID, plusGrande);
    }
    if (plusGrande >= 2048 && !victoire) {
      victoire = maintenant;
      contexte.jouerSon('record');
    }

    if (!peutJouer(grille)) void terminer(maintenant);
  }

  function boucle(instant: number) {
    if (!actif) return;
    dessinerGame2048(
      contexte.ctx,
      {
        nom,
        grille,
        glissements,
        fusions,
        apparitions,
        age: instant - dernierCoup,
        score,
        record,
        meilleureTuile,
        partie,
        coups,
        gain,
        ageGain: instant - instantGain,
        instant,
        victoire,
        finie,
        annonce,
        message,
      },
      couleurs,
    );
    image = requestAnimationFrame(boucle);
  }

  contexte.surAction((action) => {
    if (action === 'valider') {
      if (message) {
        contexte.jouerSon('validation');
        nouvellePartie();
      }
      return;
    }
    jouer(action);
  });

  nouvellePartie();
  image = requestAnimationFrame(boucle);

  return () => {
    actif = false;
    cancelAnimationFrame(image);
  };
}

enregistrerJeu({
  id: ID,
  accroche: 'Faites glisser, fusionnez, visez 2048.',
  teinte: '--neon-rose',
  icone: [
    '.........',
    '.###.###.',
    '.#.#.#.#.',
    '.###.###.',
    '.........',
    '.###.@@@.',
    '.#.#.@@@.',
    '.###.@@@.',
    '.........',
  ],
  lancer,
});

/**
 * Menu de l'arcade : écran titre, choix du jeu, lancement et retour au menu.
 * Le menu route aussi les actions du clavier vers l'écran affiché.
 */

import type { Arcade, Son } from './cabinet';
import { ecouterActions, ecouterSaisie, type Action } from './input';
import { ouvrirTableau } from '../scores/scoreboard';
import { lireScores } from '../scores/scoreStore';
import { ecouterTheme, LENTEUR_SOBRE, themeActif } from './theme';

export type ActionJeu = Exclude<Action, 'retour'>;

export interface ContexteJeu {
  readonly ctx: CanvasRenderingContext2D;
  readonly largeur: number;
  readonly hauteur: number;
  /** Reçoit les actions du joueur. Échap reste réservé au retour au menu. */
  surAction(ecouteur: (action: ActionJeu) => void): void;
  /** Ouvre la saisie du pseudo. Résout `null` si le joueur passe. */
  demanderPseudo(points: number, pseudoParDefaut?: string): Promise<string | null>;
  jouerSon(son: Son): void;
  couleur(variable: string): string;
  /** Thème sobre : pas de lueur, de clignotement ni d'effet appuyé. */
  readonly sobre: boolean;
  /** Facteur de ralentissement des mouvements et animations, 1 en thème néon. */
  readonly lenteur: number;
}

export interface Jeu {
  /** Identifiant du jeu : nom de son dossier et clé de `NOMS_JEUX`. */
  readonly id: string;
  readonly accroche: string;
  /** Variable CSS de la couleur du jeu, par exemple `--neon-vert`. */
  readonly teinte: string;
  /** Icône en pixels : `#` couleur du jeu, `@` accent, `.` vide. */
  readonly icone: readonly string[];
  /** Démarre le jeu et renvoie la fonction qui l'arrête. */
  lancer(contexte: ContexteJeu): () => void;
}

interface Vue {
  gerer(action: Action): void;
  fermer(): void;
}

const PSEUDO_MAX = 12;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.!?';

const ICONE_SCORES = [
  '.........',
  '#.#####.#',
  '#.#####.#',
  '.#######.',
  '..##@##..',
  '...###...',
  '....#....',
  '..#####..',
  '.........',
];

/** Registre des jeux : nom affiché dans le menu, par identifiant de jeu. */
export const NOMS_JEUX: Readonly<Record<string, string>> = {
  snake: 'Snake',
  '2048': '2048',
  'casse-briques': 'Casse-briques',
};

const jeux: Jeu[] = [];

export function nomDuJeu(id: string): string {
  return NOMS_JEUX[id] ?? id;
}

export function enregistrerJeu(jeu: Jeu): void {
  if (jeux.some((existant) => existant.id === jeu.id)) return;
  jeux.push(jeu);
}

function formaterPoints(points: number): string {
  return String(points).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function creerVue(calque: HTMLElement, classes: string, html: string): HTMLElement {
  const racine = document.createElement('section');
  racine.className = classes;
  racine.innerHTML = html;
  calque.append(racine);
  return racine;
}

function iconeSvg(motif: readonly string[]): string {
  const largeur = Math.max(...motif.map((ligne) => ligne.length));
  const pixels = motif
    .flatMap((ligne, y) =>
      [...ligne].map((pixel, x) => {
        if (pixel === '.') return '';
        const classe = pixel === '@' ? ' class="accent"' : '';
        return `<rect${classe} x="${x}" y="${y}" width="1" height="1"/>`;
      }),
    )
    .join('');
  return `<svg class="carte__icone" viewBox="0 0 ${largeur} ${motif.length}" shape-rendering="crispEdges" aria-hidden="true">${pixels}</svg>`;
}

function meilleursScores(): Map<string, number> {
  const meilleurs = new Map<string, number>();
  for (const { jeu, points } of lireScores()) {
    meilleurs.set(jeu, Math.max(points, meilleurs.get(jeu) ?? 0));
  }
  return meilleurs;
}

/* Fond animé : coucher de soleil et grille néon qui défile, fond uni en thème sobre. */

interface Fond {
  suspendre(): void;
  reprendre(): void;
}

const ETOILES = Array.from({ length: 70 }, (_, rang) => ({
  x: (rang * 97.3) % 640,
  y: (rang * 53.7) % 250,
  taille: rang % 7 === 0 ? 2 : 1,
  phase: rang * 1.7,
  vitesse: 0.6 + (rang % 5) * 0.35,
}));

const MONTAGNES = [
  0, 300, 40, 262, 92, 284, 150, 236, 214, 280, 262, 258, 300, 290, 340, 290, 384, 246, 440, 276,
  500, 230, 560, 270, 600, 252, 640, 286, 640, 300,
];

function dessinerFond(arcade: Arcade, instant: number): void {
  const { ctx, largeur, hauteur } = arcade;
  if (themeActif() === 'sobre') {
    ctx.fillStyle = arcade.couleur('--ecran-fond');
    ctx.fillRect(0, 0, largeur, hauteur);
    return;
  }

  const horizon = 300;
  const rose = arcade.couleur('--neon-rose');
  const cyan = arcade.couleur('--neon-cyan');

  const ciel = ctx.createLinearGradient(0, 0, 0, horizon);
  ciel.addColorStop(0, '#05020c');
  ciel.addColorStop(0.55, '#1a0730');
  ciel.addColorStop(1, '#52104f');
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, largeur, horizon);

  for (const etoile of ETOILES) {
    const eclat =
      0.35 + 0.65 * Math.abs(Math.sin((instant / 1000) * etoile.vitesse + etoile.phase));
    ctx.fillStyle = `rgba(255, 240, 255, ${eclat.toFixed(2)})`;
    ctx.fillRect(etoile.x, etoile.y, etoile.taille, etoile.taille);
  }

  const soleil = { x: largeur / 2, y: horizon - 34, rayon: 100 };
  const degrade = ctx.createLinearGradient(0, soleil.y - soleil.rayon, 0, soleil.y + soleil.rayon);
  degrade.addColorStop(0, '#ffe14d');
  degrade.addColorStop(0.45, '#ff8a3d');
  degrade.addColorStop(1, rose);
  ctx.save();
  ctx.shadowColor = rose;
  ctx.shadowBlur = 50;
  ctx.fillStyle = degrade;
  ctx.beginPath();
  ctx.arc(soleil.x, soleil.y, soleil.rayon, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.shadowBlur = 0;
  ctx.fillStyle = ciel;
  const decalage = (instant / 70) % 18;
  for (let y = soleil.y - 12; y < soleil.y + soleil.rayon; y += 18) {
    const epaisseur = 2 + (y - soleil.y + 12) / 12;
    ctx.fillRect(soleil.x - soleil.rayon, y + decalage, soleil.rayon * 2, epaisseur);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(MONTAGNES[0], MONTAGNES[1]);
  for (let i = 2; i < MONTAGNES.length; i += 2) ctx.lineTo(MONTAGNES[i], MONTAGNES[i + 1]);
  ctx.fillStyle = '#12051f';
  ctx.fill();
  ctx.strokeStyle = cyan;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = cyan;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();

  const sol = ctx.createLinearGradient(0, horizon, 0, hauteur);
  sol.addColorStop(0, '#1d0630');
  sol.addColorStop(1, '#05020a');
  ctx.fillStyle = sol;
  ctx.fillRect(0, horizon, largeur, hauteur - horizon);

  ctx.save();
  ctx.strokeStyle = rose;
  ctx.shadowColor = rose;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = -14; i <= 14; i++) {
    ctx.moveTo(largeur / 2 + i * 14, horizon);
    ctx.lineTo(largeur / 2 + i * 120, hauteur);
  }
  const progression = (instant / 1400) % 1;
  for (let i = 0; i < 12; i++) {
    const profondeur = (i + progression) / 12;
    const y = horizon + (hauteur - horizon) * profondeur ** 2.4;
    ctx.moveTo(0, y);
    ctx.lineTo(largeur, y);
  }
  ctx.stroke();
  ctx.fillStyle = rose;
  ctx.shadowBlur = 20;
  ctx.fillRect(0, horizon - 1, largeur, 2);
  ctx.restore();
}

function animerFond(arcade: Arcade): Fond {
  let image = 0;
  const boucle = (instant: number) => {
    dessinerFond(arcade, instant);
    image = requestAnimationFrame(boucle);
  };
  return {
    suspendre() {
      cancelAnimationFrame(image);
      image = 0;
    },
    reprendre() {
      if (!image) image = requestAnimationFrame(boucle);
    },
  };
}

/* Saisie du pseudo, façon arcade : clavier libre ou lettres au joystick. */

function creerSaisie(
  arcade: Arcade,
  points: number,
  pseudoParDefaut: string,
  terminer: (pseudo: string | null) => void,
): Vue {
  let pseudo = (pseudoParDefaut.split('\n')[0] ?? '').slice(0, PSEUDO_MAX);
  let suggere = pseudo.length > 0;
  let termine = false;

  const racine = document.createElement('div');
  racine.className = 'saisie';
  racine.innerHTML = `
    <div class="saisie__boite" role="dialog" aria-label="Saisie du pseudo">
      <p class="saisie__annonce">Nouveau score !</p>
      <p class="saisie__points">${formaterPoints(points)}</p>
      <p class="saisie__consigne">Entrez votre pseudo</p>
      <div class="saisie__champ" aria-live="polite"></div>
      <p class="saisie__aide">Tapez au clavier · ↑↓ lettre · → ajouter · ← effacer<br />Entrée valider · Échap passer</p>
    </div>`;
  arcade.calque.append(racine);
  const champ = racine.querySelector('.saisie__champ') as HTMLElement;

  function rafraichir(): void {
    const cases = [...pseudo].map((caractere) => {
      const element = document.createElement('span');
      element.className = suggere ? 'saisie__case est-suggeree' : 'saisie__case';
      element.textContent = caractere;
      return element;
    });
    if ([...pseudo].length < PSEUDO_MAX) {
      const curseur = document.createElement('span');
      curseur.className = 'saisie__case saisie__case--curseur';
      cases.push(curseur);
    }
    champ.replaceChildren(...cases);
  }

  function modifier(suivant: string): void {
    pseudo = suivant;
    suggere = false;
    arcade.jouerSon('deplacement');
    rafraichir();
  }

  function changerLettre(sens: number): void {
    const caracteres = [...pseudo];
    const derniere = caracteres.pop() ?? '';
    const rang = ALPHABET.indexOf(derniere.toUpperCase());
    const suivante = ALPHABET[(rang + sens + ALPHABET.length) % ALPHABET.length];
    modifier([...caracteres, suivante].join(''));
  }

  const desabonner = ecouterSaisie((touche) => {
    if (touche === 'Backspace') {
      modifier(suggere ? '' : [...pseudo].slice(0, -1).join(''));
    } else if (suggere) {
      modifier(touche);
    } else if ([...pseudo].length < PSEUDO_MAX) {
      modifier(pseudo + touche);
    }
  });

  function fermer(resultat: string | null): void {
    if (termine) return;
    termine = true;
    desabonner();
    racine.remove();
    terminer(resultat);
  }

  rafraichir();

  return {
    gerer(action) {
      switch (action) {
        case 'haut':
          changerLettre(1);
          break;
        case 'bas':
          changerLettre(-1);
          break;
        case 'droite':
          if ([...pseudo].length < PSEUDO_MAX) modifier(pseudo + 'A');
          break;
        case 'gauche':
          modifier([...pseudo].slice(0, -1).join(''));
          break;
        case 'valider':
          if (pseudo.trim()) {
            arcade.jouerSon('validation');
            fermer(pseudo.trim());
          } else {
            arcade.jouerSon('retour');
            racine.classList.remove('est-refusee');
            void racine.offsetWidth;
            racine.classList.add('est-refusee');
          }
          break;
        case 'retour':
          arcade.jouerSon('retour');
          fermer(null);
          break;
      }
    },
    fermer() {
      fermer(null);
    },
  };
}

export function demarrerMenu(arcade: Arcade): void {
  const fond = animerFond(arcade);
  let vue: Vue | null = null;
  let saisie: Vue | null = null;
  let jeuEnCours: Jeu | null = null;
  let credits = 0;
  let choix = 0;

  function afficher(fabrique: () => Vue): void {
    saisie?.fermer();
    vue?.fermer();
    arcade.calque.replaceChildren();
    arcade.basculer();
    vue = fabrique();
  }

  function demanderPseudo(points: number, pseudoParDefaut = ''): Promise<string | null> {
    return new Promise((resoudre) => {
      saisie?.fermer();
      saisie = creerSaisie(arcade, points, pseudoParDefaut, (pseudo) => {
        saisie = null;
        resoudre(pseudo);
      });
    });
  }

  function ecranTitre(): Vue {
    fond.reprendre();
    const racine = creerVue(
      arcade.calque,
      'vue titre',
      `<div class="titre__logo">
        <span class="titre__nom" data-texte="Arcade">Aubay</span>
      </div>
      <p class="titre__slogan">Le salon d’arcade qui tient dans un onglet</p>
      <p class="titre__invite">Appuyez sur Entrée</p>
      <footer class="titre__pied">
        <span class="titre__credit">Crédit ${credits}</span>
        <span class="titre__meilleur"></span>
        <span>© 1987 Arcade</span>
      </footer>`,
    );
    const credit = racine.querySelector('.titre__credit') as HTMLElement;
    const meilleur = racine.querySelector('.titre__meilleur') as HTMLElement;
    const record = Math.max(0, ...meilleursScores().values());
    meilleur.textContent = `Record ${formaterPoints(record)}`;

    let depart = 0;
    const inserer = () => {
      if (depart) return;
      credits += 1;
      credit.textContent = `Crédit ${credits}`;
      racine.classList.add('titre--piece');
      arcade.jouerSon('piece');
      depart = window.setTimeout(() => afficher(ecranSelection), 700);
    };
    racine.addEventListener('click', inserer);

    return {
      gerer(action) {
        if (action === 'valider') inserer();
      },
      fermer() {
        clearTimeout(depart);
      },
    };
  }

  function ecranSelection(): Vue {
    fond.reprendre();
    const records = meilleursScores();
    const entrees = [
      ...jeux.map((jeu) => ({
        titre: nomDuJeu(jeu.id),
        accroche: jeu.accroche,
        teinte: jeu.teinte,
        icone: jeu.icone,
        record: records.has(jeu.id) ? formaterPoints(records.get(jeu.id) ?? 0) : '—',
        ouvrir: () => ecranJeu(jeu),
      })),
      {
        titre: 'Scores',
        accroche: 'Le tableau d’honneur de l’arcade',
        teinte: '--neon-jaune',
        icone: ICONE_SCORES,
        record: String(lireScores().length),
        ouvrir: ecranScores,
      },
    ];

    const cartes = entrees
      .map(
        (entree, rang) => `
        <li class="carte" role="option" style="--teinte: var(${entree.teinte}); --rang: ${rang}">
          <span class="carte__fleche" aria-hidden="true">▶</span>
          ${iconeSvg(entree.icone)}
          <span class="carte__texte">
            <span class="carte__nom">${entree.titre}</span>
            <span class="carte__accroche">${entree.accroche}</span>
          </span>
          <span class="carte__record">
            <span class="carte__record-libelle">${entree.ouvrir === ecranScores ? 'Entrées' : 'Record'}</span>
            <span class="carte__record-valeur">${entree.record}</span>
          </span>
        </li>`,
      )
      .join('');

    const racine = creerVue(
      arcade.calque,
      'vue selection',
      `<h2 class="selection__titre">Choisissez un jeu</h2>
      <ul class="selection__liste" role="listbox">${cartes}</ul>
      <p class="menu__aide">↑↓ Choisir · Entrée Jouer · Échap Titre</p>`,
    );
    const elements = [...racine.querySelectorAll<HTMLElement>('.carte')];
    let lancement = 0;

    function choisir(rang: number, sonore = true): void {
      if (lancement) return;
      const suivant = (rang + elements.length) % elements.length;
      if (sonore && suivant !== choix) arcade.jouerSon('deplacement');
      choix = suivant;
      elements.forEach((element, i) => {
        element.classList.toggle('est-choisie', i === choix);
        element.setAttribute('aria-selected', String(i === choix));
      });
    }

    function lancer(): void {
      if (lancement) return;
      arcade.jouerSon('validation');
      elements[choix].classList.add('est-lancee');
      const { ouvrir } = entrees[choix];
      lancement = window.setTimeout(() => afficher(ouvrir), 280);
    }

    elements.forEach((element, rang) => {
      element.addEventListener('mouseenter', () => choisir(rang));
      element.addEventListener('click', () => {
        choisir(rang, false);
        lancer();
      });
    });
    choisir(Math.min(choix, elements.length - 1), false);

    return {
      gerer(action) {
        if (action === 'haut') choisir(choix - 1);
        if (action === 'bas') choisir(choix + 1);
        if (action === 'valider') lancer();
        if (action === 'retour' && !lancement) {
          arcade.jouerSon('retour');
          afficher(ecranTitre);
        }
      },
      fermer() {
        clearTimeout(lancement);
      },
    };
  }

  function ecranScores(): Vue {
    fond.reprendre();
    return ouvrirTableau(arcade.calque, {
      jouerSon: arcade.jouerSon,
      nomDuJeu,
      surRetour: () => afficher(ecranSelection),
    });
  }

  function ecranJeu(jeu: Jeu): Vue {
    fond.suspendre();
    jeuEnCours = jeu;
    const sobre = themeActif() === 'sobre';
    let ecouteur: ((action: ActionJeu) => void) | null = null;
    let enCours = true;

    const arreter = jeu.lancer({
      ctx: arcade.ctx,
      largeur: arcade.largeur,
      hauteur: arcade.hauteur,
      surAction: (nouvel) => {
        ecouteur = nouvel;
      },
      demanderPseudo: (points, pseudoParDefaut) =>
        enCours ? demanderPseudo(points, pseudoParDefaut) : Promise.resolve(null),
      jouerSon: arcade.jouerSon,
      couleur: arcade.couleur,
      sobre,
      lenteur: sobre ? LENTEUR_SOBRE : 1,
    });

    return {
      gerer(action) {
        if (action === 'retour') {
          arcade.jouerSon('retour');
          afficher(ecranSelection);
          return;
        }
        ecouteur?.(action);
      },
      fermer() {
        enCours = false;
        jeuEnCours = null;
        arreter();
        arcade.ctx.clearRect(0, 0, arcade.largeur, arcade.hauteur);
      },
    };
  }

  // Les jeux lisent leurs couleurs au lancement : la partie repart dans le nouveau thème.
  ecouterTheme(() => {
    const jeu = jeuEnCours;
    if (jeu && !saisie) afficher(() => ecranJeu(jeu));
  });

  ecouterActions((action) => (saisie ?? vue)?.gerer(action));
  afficher(ecranTitre);
}

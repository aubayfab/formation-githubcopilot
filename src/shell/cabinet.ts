/**
 * Cadre de l'arcade : fronton, écran cathodique, pupitre et monnayeur.
 * Le canvas des jeux est inséré dans l'écran, sous un calque DOM et les effets CRT.
 */

import { ecouterEtat, emettre, signalerEtat, type Action } from './input';
import { adoucirCanvas } from './theme';

export const LARGEUR_ECRAN = 640;
export const HAUTEUR_ECRAN = 480;

/** Définition du canvas par rapport à sa taille logique. */
const DEFINITION = 2;
const VOLUME = 0.06;
const CLE_SON = 'arcade:son';

export type Son =
  | 'deplacement'
  | 'validation'
  | 'retour'
  | 'piece'
  | 'croque'
  | 'glisse'
  | 'fusion'
  | 'perdu'
  | 'record';

export interface Arcade {
  readonly ecran: HTMLElement;
  /** Calque DOM de 640 × 480 pixels logiques, posé sur le canvas. */
  readonly calque: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly largeur: number;
  readonly hauteur: number;
  jouerSon(son: Son): void;
  /** Effet de changement de programme : neige et saut d'image. */
  basculer(): void;
  /** Valeur d'une variable CSS du thème, par exemple `--neon-cyan`. */
  couleur(variable: string): string;
}

interface Note {
  readonly de: number;
  readonly a?: number;
  readonly duree: number;
  readonly forme?: OscillatorType;
  readonly retard?: number;
  readonly volume?: number;
}

const PARTITIONS: Readonly<Record<Son, readonly Note[]>> = {
  deplacement: [{ de: 880, duree: 0.035, volume: 0.45 }],
  validation: [
    { de: 660, duree: 0.05 },
    { de: 990, duree: 0.09, retard: 0.05 },
  ],
  retour: [{ de: 520, a: 240, duree: 0.12, forme: 'triangle' }],
  piece: [
    { de: 988, duree: 0.08 },
    { de: 1319, duree: 0.3, retard: 0.08 },
  ],
  croque: [{ de: 300, a: 900, duree: 0.07 }],
  glisse: [{ de: 170, a: 90, duree: 0.06, forme: 'triangle', volume: 0.8 }],
  fusion: [{ de: 440, a: 880, duree: 0.09, volume: 0.6 }],
  perdu: [
    { de: 440, a: 110, duree: 0.5, forme: 'sawtooth' },
    { de: 220, a: 55, duree: 0.6, retard: 0.25, volume: 0.6 },
  ],
  record: [523, 659, 784, 1047].map((de, rang) => ({ de, duree: 0.12, retard: rang * 0.1 })),
};

const ENSEIGNE = 'ARCADE';

function gabarit(): string {
  const lettres = [...ENSEIGNE]
    .map((lettre, rang) =>
      lettre === ' '
        ? '<span class="lettre lettre--espace"> </span>'
        : `<span class="lettre${rang === 4 ? ' lettre--vacillante' : ''}">${lettre}</span>`,
    )
    .join('');

  return `
    <div class="salle">
      <div class="arcade">
        <header class="fronton">
          <div class="fronton__caisson">
            <h1 class="fronton__titre" aria-label="Arcade">${lettres}</h1>
            <p class="fronton__devise">★ Arcade · 3 jeux · 1 pièce ★</p>
          </div>
        </header>

        <section class="facade">
          <div class="facade__cadre">
            <div class="ecran ecran--allumage">
              <div class="ecran__tube">
                <canvas class="ecran__canvas"></canvas>
                <div class="ecran__calque"></div>
              </div>
              <div class="ecran__balayage"></div>
              <div class="ecran__verre"></div>
              <div class="ecran__neige"></div>
            </div>
          </div>
          <div class="facade__plaque">
            <span class="haut-parleur"></span>
            <span class="facade__marque">AR-87 · Système néon</span>
            <span class="voyant" title="Sous tension"></span>
            <span class="haut-parleur"></span>
          </div>
        </section>

        <section class="pupitre">
          <div class="pupitre__plateau">
            <div class="manette" data-inclinaison="" title="Manette">
              <div class="manette__socle"></div>
              <div class="manette__tige"><div class="manette__boule"></div></div>
            </div>
            <div class="pupitre__boutons">
              <button type="button" tabindex="-1" class="bouton-arcade bouton-arcade--valider" data-action="valider">
                <span class="bouton-arcade__capuchon"></span>
                <span class="bouton-arcade__etiquette">Entrée</span>
              </button>
              <button type="button" tabindex="-1" class="bouton-arcade bouton-arcade--retour" data-action="retour">
                <span class="bouton-arcade__capuchon"></span>
                <span class="bouton-arcade__etiquette">Échap</span>
              </button>
            </div>
          </div>
          <div class="pupitre__face">
            <p class="arcade__consigne">↑ ↓ ← → déplacer · Entrée valider · Échap retour</p>
            <button type="button" tabindex="-1" class="interrupteur" aria-pressed="true">
              <span class="interrupteur__led"></span>
              <span class="interrupteur__levier"></span>
              Son
            </button>
          </div>
        </section>

        <section class="caisson">
          <div class="monnayeur">
            <div class="monnayeur__fente"><span class="monnayeur__prix">1 €</span></div>
            <div class="monnayeur__fente"><span class="monnayeur__prix">1 €</span></div>
          </div>
          <p class="caisson__plaque">Ne pas secouer l'arcade</p>
        </section>
      </div>
    </div>`;
}

function trouver<T extends Element>(racine: ParentNode, selecteur: string): T {
  const element = racine.querySelector<T>(selecteur);
  if (!element) throw new Error(`Élément introuvable : ${selecteur}`);
  return element;
}

/** Son coupé tant que le joueur ne l'a pas activé. */
function lireReglageSon(): boolean {
  try {
    return localStorage.getItem(CLE_SON) === 'actif';
  } catch {
    return false;
  }
}

function enregistrerReglageSon(actif: boolean): void {
  try {
    localStorage.setItem(CLE_SON, actif ? 'actif' : 'coupe');
  } catch {
    // Stockage indisponible : le réglage ne durera que le temps de la session.
  }
}

function creerHautParleur() {
  let contexte: AudioContext | null = null;
  let actif = lireReglageSon();

  function jouer(son: Son): void {
    if (!actif) return;
    try {
      contexte ??= new AudioContext();
      if (contexte.state === 'suspended') void contexte.resume();
      const origine = contexte.currentTime;

      for (const note of PARTITIONS[son]) {
        const oscillateur = contexte.createOscillator();
        const gain = contexte.createGain();
        const debut = origine + (note.retard ?? 0);
        const fin = debut + note.duree;

        oscillateur.type = note.forme ?? 'square';
        oscillateur.frequency.setValueAtTime(note.de, debut);
        if (note.a) oscillateur.frequency.exponentialRampToValueAtTime(note.a, fin);
        gain.gain.setValueAtTime(VOLUME * (note.volume ?? 1), debut);
        gain.gain.exponentialRampToValueAtTime(0.0001, fin);

        oscillateur.connect(gain).connect(contexte.destination);
        oscillateur.start(debut);
        oscillateur.stop(fin + 0.02);
      }
    } catch {
      // Pas de Web Audio : l'arcade reste muette.
    }
  }

  return {
    jouer,
    get actif() {
      return actif;
    },
    basculer(): boolean {
      actif = !actif;
      enregistrerReglageSon(actif);
      return actif;
    },
  };
}

function brancherPupitre(racine: HTMLElement): void {
  const manette = trouver<HTMLElement>(racine, '.manette');
  const directions: Action[] = [];

  ecouterEtat((action, enfoncee) => {
    const bouton = racine.querySelector(`.bouton-arcade[data-action="${action}"]`);
    if (bouton) {
      bouton.classList.toggle('est-enfonce', enfoncee);
      return;
    }
    const rang = directions.indexOf(action);
    if (rang >= 0) directions.splice(rang, 1);
    if (enfoncee) directions.push(action);
    manette.dataset.inclinaison = directions.at(-1) ?? '';
  });

  for (const bouton of racine.querySelectorAll<HTMLElement>('.bouton-arcade')) {
    const action = bouton.dataset.action as Action;
    const relacher = () => signalerEtat(action, false);
    bouton.addEventListener('pointerdown', (evenement) => {
      evenement.preventDefault();
      signalerEtat(action, true);
      emettre(action);
    });
    bouton.addEventListener('pointerup', relacher);
    bouton.addEventListener('pointerleave', relacher);
  }

  manette.addEventListener('pointerdown', (evenement) => {
    evenement.preventDefault();
    const zone = manette.getBoundingClientRect();
    const dx = evenement.clientX - (zone.left + zone.width / 2);
    const dy = evenement.clientY - (zone.top + zone.height / 2);
    const action: Action =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'gauche' : 'droite') : dy < 0 ? 'haut' : 'bas';

    signalerEtat(action, true);
    emettre(action);
    const relacher = () => {
      signalerEtat(action, false);
      window.removeEventListener('pointerup', relacher);
    };
    window.addEventListener('pointerup', relacher);
  });
}

export function construireArcade(racine: HTMLElement): Arcade {
  racine.innerHTML = gabarit();

  const arcade = trouver<HTMLElement>(racine, '.arcade');
  const ecran = trouver<HTMLElement>(racine, '.ecran');
  const canvas = trouver<HTMLCanvasElement>(racine, '.ecran__canvas');
  const calque = trouver<HTMLElement>(racine, '.ecran__calque');
  const interrupteur = trouver<HTMLButtonElement>(racine, '.interrupteur');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible.');
  canvas.width = LARGEUR_ECRAN * DEFINITION;
  canvas.height = HAUTEUR_ECRAN * DEFINITION;
  ctx.scale(DEFINITION, DEFINITION);
  adoucirCanvas(ctx);

  new ResizeObserver(([entree]) => {
    calque.style.setProperty('--echelle', String(entree.contentRect.width / LARGEUR_ECRAN));
  }).observe(ecran);

  ecran.addEventListener('animationend', (evenement) => {
    if (evenement.animationName === 'allumage') ecran.classList.remove('ecran--allumage');
    if (evenement.animationName === 'neige') ecran.classList.remove('ecran--bascule');
  });

  const hautParleur = creerHautParleur();
  interrupteur.setAttribute('aria-pressed', String(hautParleur.actif));
  interrupteur.addEventListener('click', () => {
    const actif = hautParleur.basculer();
    interrupteur.setAttribute('aria-pressed', String(actif));
    hautParleur.jouer('validation');
  });

  brancherPupitre(racine);

  const styles = getComputedStyle(document.documentElement);

  return {
    ecran,
    calque,
    canvas,
    ctx,
    largeur: LARGEUR_ECRAN,
    hauteur: HAUTEUR_ECRAN,
    jouerSon(son) {
      hautParleur.jouer(son);
      if (son === 'piece') {
        arcade.classList.remove('est-creditee');
        void arcade.offsetWidth;
        arcade.classList.add('est-creditee');
      }
    },
    basculer() {
      ecran.classList.remove('ecran--bascule');
      void ecran.offsetWidth;
      ecran.classList.add('ecran--bascule');
    },
    couleur(variable) {
      return styles.getPropertyValue(variable).trim() || '#ffffff';
    },
  };
}

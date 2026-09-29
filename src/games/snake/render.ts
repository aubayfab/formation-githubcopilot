/**
 * Rendu de Snake sur un canvas de 640 × 480 pixels logiques.
 * Ces fonctions peignent une scène et ne modifient jamais l'état reçu.
 */

import {
  INTERVALLE_INITIAL,
  INTERVALLE_MINIMAL,
  POINTS_PAR_POMME,
  type Cellule,
  type Direction,
  type EtatSnake,
} from './logic';

export interface PaletteSnake {
  readonly fond: string;
  readonly grille: string;
  readonly tete: string;
  readonly queue: string;
  readonly pomme: string;
  readonly feuille: string;
  readonly texte: string;
  readonly discret: string;
  readonly accent: string;
  readonly alerte: string;
  /** Style sobre : ni pulsation ni clignotement, compte à rebours discret dans un coin. */
  readonly sobre: boolean;
}

export interface SceneSnake {
  /** Nom affiché du jeu. */
  readonly nom: string;
  readonly etat: EtatSnake;
  readonly record: number;
  readonly detenteur: string;
  /** Horloge d'animation, en millisecondes. */
  readonly instant: number;
  /** Instant où le serpent se met en route, après le compte à rebours. */
  readonly depart: number;
  /** Instant de la dernière pomme mangée, 0 sinon. */
  readonly bouchee: number;
  /** Instant de la fin de partie, 0 tant qu'elle dure. */
  readonly finie: number;
  readonly message: string | null;
}

interface Terrain {
  readonly x: number;
  readonly y: number;
  readonly taille: number;
  readonly largeur: number;
  readonly hauteur: number;
}

const LARGEUR = 640;
const HAUTEUR = 480;
const BANDEAU = 56;
const MARGE = 20;
const POLICE = '"Silkscreen", monospace';
const DUREE_COMPTE = 500;

const VECTEURS: Readonly<Record<Direction, Cellule>> = {
  haut: { x: 0, y: -1 },
  bas: { x: 0, y: 1 },
  gauche: { x: -1, y: 0 },
  droite: { x: 1, y: 0 },
};

const RAISONS: Readonly<Record<EtatSnake['issue'], string>> = {
  'en-cours': '',
  mur: 'LE MUR ÉTAIT LÀ',
  morsure: 'AÏE, LA QUEUE',
  'grille-pleine': 'GRILLE COMPLÈTE !',
};

function mesurerTerrain(etat: EtatSnake): Terrain {
  const disponibleX = LARGEUR - MARGE * 2;
  const disponibleY = HAUTEUR - BANDEAU - MARGE;
  const taille = Math.floor(Math.min(disponibleX / etat.colonnes, disponibleY / etat.lignes));
  const largeur = taille * etat.colonnes;
  const hauteur = taille * etat.lignes;
  return {
    x: Math.round((LARGEUR - largeur) / 2),
    y: BANDEAU + Math.round((disponibleY - hauteur) / 2),
    taille,
    largeur,
    hauteur,
  };
}

function composantes(couleur: string): [number, number, number] {
  const valeur = parseInt(couleur.replace('#', ''), 16);
  return [(valeur >> 16) & 255, (valeur >> 8) & 255, valeur & 255];
}

function melanger(a: string, b: string, t: number): string {
  const [ra, ga, ba] = composantes(a);
  const [rb, gb, bb] = composantes(b);
  const canal = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${canal(ra, rb)}, ${canal(ga, gb)}, ${canal(ba, bb)})`;
}

function ecrire(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  taille: number,
  couleur: string,
  alignement: CanvasTextAlign = 'left',
  lueur = 0,
): void {
  ctx.font = `${taille}px ${POLICE}`;
  ctx.textAlign = alignement;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = couleur;
  ctx.shadowColor = couleur;
  ctx.shadowBlur = lueur;
  ctx.fillText(texte, x, y);
  ctx.shadowBlur = 0;
}

function arrondi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  rayon: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, largeur, hauteur, rayon);
}

function centre(cellule: Cellule, terrain: Terrain): { x: number; y: number } {
  return {
    x: terrain.x + cellule.x * terrain.taille + terrain.taille / 2,
    y: terrain.y + cellule.y * terrain.taille + terrain.taille / 2,
  };
}

function dessinerTerrain(
  ctx: CanvasRenderingContext2D,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  ctx.fillStyle = palette.fond;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  ctx.fillStyle = palette.grille;
  ctx.globalAlpha = 0.16;
  for (let x = 0; x <= terrain.largeur; x += terrain.taille) {
    for (let y = 0; y <= terrain.hauteur; y += terrain.taille) {
      ctx.fillRect(terrain.x + x - 1, terrain.y + y - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = palette.grille;
  ctx.lineWidth = 2;
  ctx.shadowColor = palette.grille;
  ctx.shadowBlur = 12;
  arrondi(ctx, terrain.x - 4, terrain.y - 4, terrain.largeur + 8, terrain.hauteur + 8, 6);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function dessinerPomme(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  const { x, y } = centre(scene.etat.pomme, terrain);
  const pulsation = palette.sobre ? 0 : Math.sin(scene.instant / 160) * 0.08;
  const rayon = terrain.taille * 0.34 * (1 + pulsation);

  ctx.fillStyle = palette.pomme;
  ctx.shadowColor = palette.pomme;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y + 1, rayon, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillRect(x - rayon * 0.5, y - rayon * 0.4, 3, 3);

  ctx.strokeStyle = palette.feuille;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - rayon + 2);
  ctx.lineTo(x + 3, y - rayon - 4);
  ctx.stroke();
}

function dessinerCorps(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  const { corps } = scene.etat;
  const age = scene.instant - scene.finie;
  const clignote =
    !palette.sobre && scene.finie > 0 && age < 720 && Math.floor(age / 120) % 2 === 0;
  const eteint = scene.finie > 0 && !clignote;

  for (let i = corps.length - 1; i >= 0; i--) {
    const ratio = corps.length > 1 ? i / (corps.length - 1) : 0;
    const couleur = clignote
      ? palette.alerte
      : eteint
        ? melanger(palette.queue, palette.fond, 0.55)
        : melanger(palette.tete, palette.queue, ratio);
    const retrait = i === 0 ? 1 : 2 + ratio * 2;
    const cote = terrain.taille - retrait * 2;
    const ici = centre(corps[i], terrain);

    ctx.fillStyle = couleur;
    ctx.shadowColor = couleur;
    ctx.shadowBlur = eteint ? 0 : i === 0 ? 16 : 8;
    arrondi(ctx, ici.x - cote / 2, ici.y - cote / 2, cote, cote, i === 0 ? 6 : 4);
    ctx.fill();

    if (i > 0) {
      const devant = centre(corps[i - 1], terrain);
      const horizontal = devant.y === ici.y;
      ctx.fillRect(
        horizontal ? Math.min(ici.x, devant.x) : ici.x - cote / 2,
        horizontal ? ici.y - cote / 2 : Math.min(ici.y, devant.y),
        horizontal ? Math.abs(devant.x - ici.x) : cote,
        horizontal ? cote : Math.abs(devant.y - ici.y),
      );
    }
  }
  ctx.shadowBlur = 0;

  dessinerYeux(ctx, scene.etat, terrain, palette);
}

function dessinerYeux(
  ctx: CanvasRenderingContext2D,
  etat: EtatSnake,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  const tete = centre(etat.corps[0], terrain);
  const avant = VECTEURS[etat.direction];
  const cote = { x: -avant.y, y: avant.x };

  for (const sens of [-1, 1]) {
    const x = tete.x + avant.x * terrain.taille * 0.15 + cote.x * sens * terrain.taille * 0.22;
    const y = tete.y + avant.y * terrain.taille * 0.15 + cote.y * sens * terrain.taille * 0.22;
    ctx.fillStyle = palette.fond;
    ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1 + avant.x, y - 1 + avant.y, 2, 2);
  }
}

function dessinerBouchee(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  const age = scene.instant - scene.bouchee;
  if (palette.sobre || !scene.bouchee || age > 600) return;

  const tete = centre(scene.etat.corps[0], terrain);
  const progression = age / 600;

  if (age < 350) {
    const anneau = age / 350;
    ctx.globalAlpha = 1 - anneau;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tete.x, tete.y, terrain.taille * (0.5 + anneau * 1.6), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1 - progression;
  ecrire(
    ctx,
    `+${POINTS_PAR_POMME}`,
    tete.x,
    tete.y - 14 - progression * 24,
    14,
    palette.accent,
    'center',
    8,
  );
  ctx.globalAlpha = 1;
}

function dessinerBandeau(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  palette: PaletteSnake,
): void {
  const { etat } = scene;
  const record = Math.max(scene.record, etat.score);

  ecrire(ctx, scene.nom.toUpperCase(), MARGE, 40, 22, palette.tete, 'left', 12);

  ecrire(ctx, 'SCORE', 196, 22, 12, palette.discret);
  ecrire(ctx, String(etat.score).padStart(6, '0'), 196, 46, 22, palette.texte, 'left', 6);

  ecrire(
    ctx,
    `RECORD · ${scene.detenteur.slice(0, 10).toUpperCase()}`,
    334,
    22,
    12,
    palette.discret,
  );
  ecrire(ctx, String(record).padStart(6, '0'), 334, 46, 22, palette.accent, 'left', 8);

  ecrire(ctx, 'VITESSE', LARGEUR - MARGE, 22, 12, palette.discret, 'right');
  const niveau = (INTERVALLE_INITIAL - etat.intervalle) / (INTERVALLE_INITIAL - INTERVALLE_MINIMAL);
  const allumees = 1 + Math.round(niveau * 4);
  for (let i = 0; i < 5; i++) {
    const allumee = i < allumees;
    ctx.fillStyle = allumee ? melanger(palette.tete, palette.alerte, i / 4) : palette.discret;
    ctx.globalAlpha = allumee ? 1 : 0.25;
    ctx.fillRect(LARGEUR - MARGE - 70 + i * 15, 32 - i * 2, 10, 12 + i * 2);
  }
  ctx.globalAlpha = 1;
}

function dessinerCompteARebours(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  const reste = scene.depart - scene.instant;
  const milieuX = terrain.x + terrain.largeur / 2;
  const milieuY = terrain.y + terrain.hauteur / 2;

  if (reste > 0) {
    const chiffre = Math.ceil(reste / DUREE_COMPTE);
    const phase = 1 - (reste % DUREE_COMPTE) / DUREE_COMPTE;
    ecrire(ctx, 'PRÊT ?', milieuX, milieuY - 70, 18, palette.discret, 'center');
    ctx.save();
    ctx.translate(milieuX, milieuY + 24);
    ctx.scale(1.8 - phase * 0.8, 1.8 - phase * 0.8);
    ctx.globalAlpha = 1 - phase * 0.6;
    ecrire(ctx, String(chiffre), 0, 0, 68, palette.accent, 'center', 20);
    ctx.restore();
    return;
  }

  if (reste > -450) {
    ctx.globalAlpha = 1 + reste / 450;
    ecrire(ctx, 'GO !', milieuX, milieuY + 20, 58, palette.tete, 'center', 24);
    ctx.globalAlpha = 1;
  }
}

/** Compte à rebours sobre : le chiffre change dans le coin du terrain, sans autre effet. */
function dessinerCompteDiscret(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  const reste = scene.depart - scene.instant;
  if (reste <= 0) return;
  const chiffre = String(Math.ceil(reste / DUREE_COMPTE));
  ecrire(
    ctx,
    chiffre,
    terrain.x + terrain.largeur - 10,
    terrain.y + 24,
    16,
    palette.discret,
    'right',
  );
}

function dessinerFin(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  terrain: Terrain,
  palette: PaletteSnake,
): void {
  const age = scene.instant - scene.finie;
  const milieuX = terrain.x + terrain.largeur / 2;

  if (!palette.sobre && age < 260) {
    ctx.fillStyle = palette.alerte;
    ctx.globalAlpha = (1 - age / 260) * 0.35;
    ctx.fillRect(terrain.x, terrain.y, terrain.largeur, terrain.hauteur);
    ctx.globalAlpha = 1;
  }
  if (age < 500) return;

  ctx.globalAlpha = Math.min(1, (age - 500) / 300);
  ctx.fillStyle = 'rgba(5, 2, 12, 0.74)';
  ctx.fillRect(terrain.x, terrain.y, terrain.largeur, terrain.hauteur);

  ecrire(ctx, 'PARTIE TERMINÉE', milieuX, 206, 36, palette.alerte, 'center', 18);
  ecrire(ctx, RAISONS[scene.etat.issue], milieuX, 242, 15, palette.discret, 'center');
  ecrire(
    ctx,
    `SCORE ${String(scene.etat.score).padStart(6, '0')}`,
    milieuX,
    292,
    22,
    palette.texte,
    'center',
    6,
  );

  const visible = palette.sobre || Math.floor(scene.instant / 520) % 2 === 0;
  if (scene.message && visible) {
    ecrire(ctx, scene.message, milieuX, 360, 15, palette.accent, 'center', 8);
  }
  ctx.globalAlpha = 1;
}

export function dessinerSnake(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnake,
  palette: PaletteSnake,
): void {
  const terrain = mesurerTerrain(scene.etat);

  ctx.save();
  dessinerTerrain(ctx, terrain, palette);
  dessinerPomme(ctx, scene, terrain, palette);
  dessinerCorps(ctx, scene, terrain, palette);
  dessinerBouchee(ctx, scene, terrain, palette);
  dessinerBandeau(ctx, scene, palette);
  const dessinerCompte = palette.sobre ? dessinerCompteDiscret : dessinerCompteARebours;
  if (!scene.finie) dessinerCompte(ctx, scene, terrain, palette);
  if (scene.finie) dessinerFin(ctx, scene, terrain, palette);
  ctx.restore();
}

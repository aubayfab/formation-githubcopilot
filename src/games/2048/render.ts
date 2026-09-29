import type { Glissement, Grille, Position } from './grid';

export const DUREE_GLISSEMENT = 110;
export const DUREE_REBOND = 170;

export interface PaletteGame2048 {
  fond: string;
  plateau: string;
  caseVide: string;
  texte: string;
  discret: string;
  titre: string;
  accent: string;
  alerte: string;
  tuiles: Record<number, string>;
  /** Facteur de ralentissement des animations décoratives, fixé par le thème. */
  lenteur: number;
  /** Échelle du jeu sur l'écran, autour de son centre : 1 en néon, plus petit en sobre. */
  echelle: number;
}

export interface SceneGame2048 {
  nom: string;
  grille: Grille;
  glissements: readonly Glissement[];
  fusions: readonly Position[];
  apparitions: readonly Position[];
  age: number; // ms depuis le dernier coup
  score: number;
  record: number;
  meilleureTuile: number;
  partie: number;
  coups: number;
  gain: number;
  ageGain: number;
  instant: number;
  victoire: number;
  finie: number;
  annonce: string | null;
  message: string | null;
}

const POLICE = '"Silkscreen", monospace';
const PLATEAU_X = 226;
const PLATEAU_Y = 52;
const PLATEAU = 400;
const ECART = 12;

function taillesTuile(taille: number) {
  return (PLATEAU - ECART * (taille + 1)) / taille;
}

function coin(p: Position, taille: number) {
  const t = taillesTuile(taille);
  return {
    x: PLATEAU_X + ECART + p.colonne * (t + ECART),
    y: PLATEAU_Y + ECART + p.ligne * (t + ECART),
  };
}

function txt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  px: number,
  color: string,
  align: CanvasTextAlign = 'left',
  glow = 0,
) {
  ctx.font = px + 'px ' + POLICE;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}

function hexVersRgb(c: string) {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number) {
  const A = hexVersRgb(a);
  const B = hexVersRgb(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
}

function couleurTuile(valeur: number, palette: PaletteGame2048, instant: number) {
  if (valeur === 2048)
    return `hsl(${Math.floor(instant / (6 * palette.lenteur)) % 360}, 100%, 66%)`;
  return palette.tuiles[valeur] ?? palette.tuiles[4096] ?? '#ffffff';
}

function tuile(
  ctx: CanvasRenderingContext2D,
  valeur: number,
  x: number,
  y: number,
  echelle: number,
  taille: number,
  palette: PaletteGame2048,
  instant: number,
) {
  const t = taillesTuile(taille);
  const c = t * echelle;
  const cx = x + t / 2;
  const cy = y + t / 2;
  const couleur = couleurTuile(valeur, palette, instant);
  const hex = couleur.startsWith('#') ? couleur : '#ffffff';

  ctx.fillStyle = mix(palette.caseVide, hex, 0.2);
  ctx.beginPath();
  ctx.roundRect(cx - c / 2, cy - c / 2, c, c, 8 * echelle);
  ctx.fill();
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 3;
  ctx.shadowColor = couleur;
  ctx.shadowBlur = 8 + Math.log2(valeur) * 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(cx - c / 2 + 8, cy - c / 2 + 6, c - 16, 3);

  const chiffres = String(valeur).length;
  const px = [0, 40, 36, 30, 22, 18, 14][chiffres] ?? 12;
  txt(
    ctx,
    String(valeur),
    cx,
    cy + (px * echelle) / 2,
    Math.round(px * echelle),
    couleur,
    'center',
    10,
  );
}

function boite(
  ctx: CanvasRenderingContext2D,
  libelle: string,
  valeur: string,
  y: number,
  couleur: string,
  palette: PaletteGame2048,
) {
  ctx.fillStyle = palette.plateau;
  ctx.beginPath();
  ctx.roundRect(20, y, 186, 64, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  txt(ctx, libelle, 34, y + 22, 12, palette.discret);
  txt(ctx, valeur, 34, y + 50, 22, couleur, 'left', 8);
}

function contient(liste: readonly Position[], l: number, c: number) {
  return liste.some((p) => p.ligne === l && p.colonne === c);
}

export function dessinerGame2048(
  ctx: CanvasRenderingContext2D,
  s: SceneGame2048,
  palette: PaletteGame2048,
) {
  const taille = s.grille.length;
  ctx.save();
  ctx.fillStyle = palette.fond;
  ctx.fillRect(0, 0, 640, 480);
  ctx.translate(320 * (1 - palette.echelle), 240 * (1 - palette.echelle));
  ctx.scale(palette.echelle, palette.echelle);

  // panneau de gauche
  txt(ctx, s.nom.toUpperCase(), 20, 42, 30, palette.titre, 'left', 14);
  txt(ctx, 'PARTIE N°' + s.partie, 20, 66, 12, palette.discret);
  boite(ctx, 'SCORE', String(s.score).padStart(6, '0'), 84, palette.texte, palette);
  boite(
    ctx,
    'RECORD',
    String(Math.max(s.record, s.score)).padStart(6, '0'),
    162,
    palette.accent,
    palette,
  );
  boite(
    ctx,
    'MEILLEURE TUILE',
    s.meilleureTuile ? String(s.meilleureTuile) : '-',
    240,
    couleurTuile(s.meilleureTuile, palette, s.instant),
    palette,
  );
  boite(ctx, 'COUPS', String(s.coups), 318, palette.texte, palette);
  if (s.gain > 0 && s.ageGain < 700) {
    ctx.globalAlpha = 1 - s.ageGain / 700;
    txt(ctx, '+' + s.gain, 196, 128 - s.ageGain / 25, 15, palette.accent, 'right', 8);
    ctx.globalAlpha = 1;
  }
  txt(ctx, 'FLÈCHES : GLISSER', 20, 440, 13, palette.discret);

  // plateau
  ctx.fillStyle = palette.plateau;
  ctx.strokeStyle = palette.titre;
  ctx.lineWidth = 2;
  ctx.shadowColor = palette.titre;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(PLATEAU_X, PLATEAU_Y, PLATEAU, PLATEAU, 10);
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  const t = taillesTuile(taille);
  for (let l = 0; l < taille; l++) {
    for (let c = 0; c < taille; c++) {
      const p = coin({ ligne: l, colonne: c }, taille);
      ctx.fillStyle = palette.caseVide;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, t, t, 8);
      ctx.fill();
    }
  }

  const enGlissement = s.glissements.length > 0 && s.age < DUREE_GLISSEMENT;
  if (enGlissement) {
    const k = 1 - Math.pow(1 - s.age / DUREE_GLISSEMENT, 3);
    for (const g of s.glissements) {
      const a = coin(g.depart, taille);
      const b = coin(g.arrivee, taille);
      tuile(
        ctx,
        g.valeur,
        a.x + (b.x - a.x) * k,
        a.y + (b.y - a.y) * k,
        1,
        taille,
        palette,
        s.instant,
      );
    }
  } else {
    const debut = s.glissements.length > 0 ? DUREE_GLISSEMENT : 0;
    const r = Math.min(1, Math.max(0, (s.age - debut) / DUREE_REBOND));
    for (let l = 0; l < taille; l++) {
      for (let c = 0; c < taille; c++) {
        const v = s.grille[l][c];
        if (!v) continue;
        let echelle = 1;
        if (contient(s.fusions, l, c)) echelle = 1 + 0.2 * Math.sin(Math.PI * r);
        if (contient(s.apparitions, l, c) && r < 1) {
          // easeOutBack
          const k = r - 1;
          echelle = Math.max(0.01, 1 + 2.7 * k * k * k + 1.7 * k * k);
        }
        const p = coin({ ligne: l, colonne: c }, taille);
        tuile(ctx, v, p.x, p.y, echelle, taille, palette, s.instant);
      }
    }
  }

  const mx = PLATEAU_X + PLATEAU / 2;
  const my = PLATEAU_Y + PLATEAU / 2;

  if (s.victoire && s.instant - s.victoire < 2600) {
    const a = s.instant - s.victoire;
    ctx.globalAlpha = a < 2200 ? 1 : 1 - (a - 2200) / 400;
    ctx.fillStyle = 'rgba(5,2,12,0.6)';
    ctx.fillRect(PLATEAU_X, my - 60, PLATEAU, 120);
    ctx.save();
    ctx.translate(mx, my + 20);
    const pop = Math.min(1, a / 250);
    ctx.scale(0.5 + pop * 0.5, 0.5 + pop * 0.5);
    txt(ctx, '2048 !', 0, 0, 62, couleurTuile(2048, palette, s.instant), 'center', 24);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  if (s.finie) {
    const a = s.instant - s.finie;
    ctx.globalAlpha = Math.min(1, a / 400);
    ctx.fillStyle = 'rgba(8,4,16,0.8)';
    ctx.beginPath();
    ctx.roundRect(PLATEAU_X, PLATEAU_Y, PLATEAU, PLATEAU, 10);
    ctx.fill();
    txt(ctx, 'PLUS DE COUPS', mx, my - 40, 28, palette.alerte, 'center', 16);
    txt(
      ctx,
      'SCORE ' + String(s.score).padStart(6, '0'),
      mx,
      my + 6,
      20,
      palette.texte,
      'center',
      6,
    );
    if (s.annonce) txt(ctx, s.annonce, mx, my + 42, 14, palette.accent, 'center', 8);
    if (s.message && Math.floor(s.instant / (520 * palette.lenteur)) % 2 === 0)
      txt(ctx, s.message, mx, my + 100, 14, palette.accent, 'center', 8);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
